// Minimal in-memory stand-in for the Supabase HTTP API (Auth, PostgREST,
// Storage), used only by the hosted-mode end-to-end tests. It does NOT
// enforce row-level security; RLS is verified against Postgres and, for a
// live project, by scripts/verify-rls.mjs. This exercises the app's wiring:
// magic-link callback, session cookies, loading, writes, files, failures.
import http from "node:http";

const PORT = Number(process.env.MOCK_SUPABASE_PORT || 54399);
const USER = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  aud: "authenticated",
  role: "authenticated",
  email: "pilot@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-10-19T00:00:00Z",
};
const SEED_IDS = Array.from({ length: 10 }, (_, i) => `sl${String(i + 1).padStart(2, "0")}`);

let db, files, control, sessions;
function reset() {
  db = new Map();
  db.set("lessons", SEED_IDS.map((id, i) => ({ id, owner_id: null, path_id: "ccst-l1", position: i + 1 })));
  files = new Map();
  control = { failWrites: false, failLoad: false, seedMissing: false };
  sessions = new Set();
}
reset();

const table = (name) => {
  if (!db.has(name)) db.set(name, []);
  return db.get(name);
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Type");
}

function send(res, status, body, headers = {}) {
  cors(res);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  if (Buffer.isBuffer(body)) {
    res.writeHead(status).end(body);
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.writeHead(status).end(JSON.stringify(body));
}

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

function session() {
  const token = `token-${Math.random().toString(36).slice(2)}`;
  sessions.add(token);
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${token}`,
    user: USER,
  };
}

const authed = (req) => sessions.has((req.headers.authorization || "").replace(/^Bearer /, ""));

const RESERVED = new Set(["select", "offset", "limit", "order", "on_conflict", "columns"]);
function matches(row, params) {
  for (const [col, expr] of params) {
    if (RESERVED.has(col)) continue;
    const v = row[col] === null || row[col] === undefined ? null : String(row[col]);
    if (expr.startsWith("eq.")) {
      if (v !== expr.slice(3)) return false;
    } else if (expr.startsWith("in.(")) {
      const list = expr.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, ""));
      if (!list.includes(v)) return false;
    } else if (expr === "is.null") {
      if (v !== null) return false;
    } else {
      throw new Error(`mock: unsupported filter ${col}=${expr}`);
    }
  }
  return true;
}

async function rest(req, res, name, url) {
  const rows = table(name);
  const params = [...url.searchParams.entries()];
  if (req.method === "GET" || req.method === "HEAD") {
    if (control.failLoad) return send(res, 500, { message: "mock: database unavailable" });
    if (control.seedMissing && name === "lessons") return send(res, 200, [], { "Content-Range": "*/0" });
    const hit = rows.filter((r) => matches(r, params));
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || hit.length);
    const page = hit.slice(offset, offset + limit);
    const range = page.length ? `${offset}-${offset + page.length - 1}/${hit.length}` : `*/${hit.length}`;
    return send(res, 200, req.method === "HEAD" ? undefined : page, { "Content-Range": range });
  }
  if (control.failWrites) return send(res, 500, { message: "mock: write rejected" });
  if (req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString() || "[]");
    const list = Array.isArray(body) ? body : [body];
    const upsert = /merge-duplicates/.test(req.headers.prefer || "");
    const keys = (url.searchParams.get("on_conflict") || "id").split(",");
    for (const r of list) {
      const i = upsert ? rows.findIndex((x) => keys.every((k) => String(x[k]) === String(r[k]))) : -1;
      if (i >= 0) rows[i] = { ...rows[i], ...r };
      else rows.push({ ...r });
    }
    return send(res, 201, undefined);
  }
  if (req.method === "DELETE") {
    db.set(name, rows.filter((r) => !matches(r, params)));
    return send(res, 204, undefined);
  }
  return send(res, 405, { message: "mock: method" });
}

async function storage(req, res, path) {
  if (!authed(req)) return send(res, 400, { statusCode: "403", error: "Unauthorized", message: "mock: not signed in" });
  let m;
  if (req.method === "POST" && (m = path.match(/^\/object\/list\/([^/]+)$/))) {
    const { prefix } = JSON.parse((await readBody(req)).toString());
    const out = [...files.keys()]
      .filter((k) => k.startsWith(`${m[1]}/${prefix}/`))
      .map((k) => ({ name: k.split("/").pop(), id: k }));
    return send(res, 200, out);
  }
  if (req.method === "DELETE" && (m = path.match(/^\/object\/([^/]+)$/))) {
    const { prefixes } = JSON.parse((await readBody(req)).toString());
    const removed = [];
    for (const p of prefixes) if (files.delete(`${m[1]}/${p}`)) removed.push({ name: p });
    return send(res, 200, removed);
  }
  if ((m = path.match(/^\/object\/([^/]+)\/(.+)$/))) {
    const key = `${m[1]}/${decodeURIComponent(m[2])}`;
    if (req.method === "GET") {
      const f = files.get(key);
      return f ? send(res, 200, f.data, { "Content-Type": f.type }) : send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    }
    if (req.method === "POST" || req.method === "PUT") {
      if (control.failWrites) return send(res, 500, { message: "mock: upload rejected" });
      files.set(key, { data: await readBody(req), type: req.headers["content-type"] || "application/octet-stream" });
      return send(res, 200, { Key: key, Id: key });
    }
  }
  return send(res, 404, { message: `mock: unknown storage route ${req.method} ${path}` });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === "OPTIONS") return send(res, 204, undefined);
    const p = url.pathname;

    // Test control endpoints.
    if (p === "/__reset") return reset(), send(res, 200, { ok: true });
    if (p === "/__control") return Object.assign(control, JSON.parse((await readBody(req)).toString())), send(res, 200, control);
    if (p === "/__state") return send(res, 200, { tables: Object.fromEntries(db), files: [...files.keys()] });

    if (p === "/auth/v1/otp") return send(res, 200, {});
    if (p === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      if (grant === "pkce" && body.auth_code === "valid-code" && body.code_verifier) return send(res, 200, session());
      if (grant === "refresh_token") return send(res, 200, session());
      return send(res, 400, { error: "invalid_grant", error_description: "mock: bad code" });
    }
    if (p === "/auth/v1/user") return authed(req) ? send(res, 200, USER) : send(res, 401, { message: "mock: invalid token" });
    if (p === "/auth/v1/logout") {
      sessions.delete((req.headers.authorization || "").replace(/^Bearer /, ""));
      return send(res, 204, undefined);
    }
    if (p.startsWith("/rest/v1/")) {
      if (!authed(req) && req.method !== "OPTIONS") return send(res, 401, { message: "mock: JWT required" });
      return rest(req, res, p.slice("/rest/v1/".length), url);
    }
    if (p.startsWith("/storage/v1")) return storage(req, res, p.slice("/storage/v1".length));
    return send(res, 404, { message: `mock: no route ${req.method} ${p}` });
  } catch (err) {
    return send(res, 500, { message: String(err) });
  }
});

server.listen(PORT, () => console.log(`mock supabase on :${PORT}`));
