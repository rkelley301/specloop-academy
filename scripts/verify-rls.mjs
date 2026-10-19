#!/usr/bin/env node
// Verifies SpecLoop's row-level security and storage policies against a LIVE
// Supabase project, acting as real signed-in users.
//
//   SUPABASE_URL=https://xyz.supabase.co \
//   SUPABASE_ANON_KEY=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   npm run verify:rls
//
// The service-role key bypasses RLS, so it is used ONLY to:
//   1. create two temporary, pre-confirmed users (no emails are sent),
//   2. mint a one-time magic-link token for each,
//   3. clean up afterwards (their files, then the users; rows cascade).
// Every data and storage check runs through each user's own anon-key client
// after that user signs in with their token, so the policies under test apply.
//
// Run it from your own machine. Never put the service-role key in .env.local,
// in the app, or in the browser.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (in your shell, not in a committed file).");
  process.exit(2);
}
if (serviceKey === anonKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY equals the anon key. Check your variables.");
  process.exit(2);
}

const noPersist = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, noPersist);

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
async function expectRows(name, query, expected) {
  const { data, error } = await query;
  if (error) return record(name, false, `error: ${error.message}`);
  record(name, data.length === expected, `got ${data.length} row(s), expected ${expected}`);
}
async function expectError(name, query) {
  const { error } = await query;
  record(name, Boolean(error), error ? error.message : "operation was allowed");
}
async function expectOk(name, query) {
  const { error } = await query;
  record(name, !error, error ? error.message : "");
}

const run = randomUUID().slice(0, 8);
const users = [];

/** Creates a confirmed user with the admin API, then signs in through the anon key with a magic-link token. */
async function makeUser(label) {
  const email = `specloop-rls-${label}-${run}@example.com`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  users.push(created.user);
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr) throw new Error(`generateLink(${label}): ${linkErr.message}`);
  const client = createClient(url, anonKey, noPersist);
  let { error: otpErr } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (otpErr) ({ error: otpErr } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" }));
  if (otpErr) throw new Error(`sign-in(${label}): ${otpErr.message}`);
  const { data: me } = await client.auth.getUser();
  if (me.user?.id !== created.user.id) throw new Error(`sign-in(${label}) returned the wrong user`);
  return { id: created.user.id, email, client };
}

function wavBytes() {
  const b = Buffer.alloc(44 + 800);
  b.write("RIFF", 0); b.writeUInt32LE(36 + 800, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36);
  b.writeUInt32LE(800, 40); b.fill(128, 44);
  return b;
}

async function main() {
  console.log(`SpecLoop RLS verification against ${url} (run ${run})\n`);
  const A = await makeUser("a");
  const B = await makeUser("b");
  const anon = createClient(url, anonKey, noPersist);
  const now = new Date().toISOString();

  // ---- A creates data through A's own client (positive controls) ----
  const sourceId = randomUUID();
  const draftId = randomUUID();
  const attemptId = randomUUID();
  const lessonId = `rls-${run}`;
  const pathId = `my-lessons:${A.id}`;
  const audioPath = `${A.id}/rls-check.wav`;
  const pdfPath = `${A.id}/rls-check.pdf`;

  await expectOk("A can create own profile", A.client.from("profiles").insert({
    user_id: A.id, display_name: "RLS A", experience_level: "new", goal: "rls check", target: "ccst1",
    target_topic: "CCST Level 1", daily_minutes: 10, timezone: "UTC",
  }));
  await expectOk("A can create own source", A.client.from("sources").insert({
    id: sourceId, user_id: A.id, title: "A private source", type: "own_notes", citation: "A", body_text: "private text",
    rights_confirmed: true, confidentiality_confirmed: true,
  }));
  await expectOk("A can create own draft", A.client.from("lesson_drafts").insert({
    id: draftId, user_id: A.id, title: "A draft", content: { concepts: [], questions: [], scenario: null }, generated_by: "manual",
  }));
  await expectOk("A can record an attempt on a seed question (seed course installed)", A.client.from("attempts").insert({
    id: attemptId, user_id: A.id, lesson_id: "sl01", question_id: "sl01-q1", kind: "recall", context: "lesson", response: "a", result: "correct",
  }));
  await expectOk("A can create own review item", A.client.from("review_items").insert({
    user_id: A.id, lesson_id: "sl01", question_id: "sl01-q1", concept_id: "sl01-c1", track: "correct", step: 0,
    due_date: now.slice(0, 10), status: "active", last_result: "correct",
  }));
  await expectOk("A can create own learning path", A.client.from("learning_paths").insert({ id: pathId, owner_id: A.id, title: "A path", origin: "custom" }));
  await expectOk("A can create own lesson", A.client.from("lessons").insert({
    id: lessonId, owner_id: A.id, path_id: pathId, position: 1, title: "A lesson", objective: "o", est_minutes: 5, script: "s",
    review_status: "approved", origin: "draft",
  }));
  await expectOk("A can add a concept to own lesson", A.client.from("concepts").insert({ id: `${lessonId}-c1`, lesson_id: lessonId, label: "c" }));
  await expectOk("A can upload to own audio folder", A.client.storage.from("audio").upload(audioPath, wavBytes(), { contentType: "audio/wav" }));
  await expectOk("A can upload to own sources folder", A.client.storage.from("sources").upload(pdfPath, Buffer.from("%PDF-1.4\n%rls\n"), { contentType: "application/pdf" }));
  await expectRows("A can read own source", A.client.from("sources").select("id").eq("id", sourceId), 1);
  await expectOk("A can download own audio", A.client.storage.from("audio").download(audioPath));

  // ---- B, signed in as B, must not see or change A's data ----
  await expectRows("B can read the shared seed lessons", B.client.from("lessons").select("id").eq("path_id", "ccst-l1").is("owner_id", null), 10);
  await expectOk("B can create own profile (B's client works)", B.client.from("profiles").insert({
    user_id: B.id, display_name: "RLS B", experience_level: "new", goal: "rls check", target: "ccst1",
    target_topic: "CCST Level 1", daily_minutes: 10, timezone: "UTC",
  }));
  for (const [table, col] of [
    ["profiles", "user_id"], ["sources", "user_id"], ["lesson_drafts", "user_id"], ["attempts", "user_id"],
    ["review_items", "user_id"], ["learning_paths", "owner_id"], ["lessons", "owner_id"],
  ]) {
    await expectRows(`B can't read A's ${table}`, B.client.from(table).select("*").eq(col, A.id), 0);
  }
  await expectRows("B can't read A's concepts", B.client.from("concepts").select("*").eq("lesson_id", lessonId), 0);
  await expectRows("B's update of A's source changes nothing", B.client.from("sources").update({ title: "hijacked" }).eq("id", sourceId).select(), 0);
  await expectRows("B's delete of A's attempt removes nothing", B.client.from("attempts").delete().eq("id", attemptId).select(), 0);
  await expectError("B can't insert a source owned by A", B.client.from("sources").insert({
    id: randomUUID(), user_id: A.id, title: "spoof", type: "own_notes", citation: "x", rights_confirmed: true, confidentiality_confirmed: true,
  }));
  await expectError("B can't insert a profile for A", B.client.from("profiles").insert({
    user_id: A.id, display_name: "spoof", experience_level: "new", goal: "x", target: "ccst1", target_topic: "", daily_minutes: 10, timezone: "UTC",
  }));
  await expectError("B can't add questions to A's lesson", B.client.from("questions").insert({
    id: `${lessonId}-spoof`, lesson_id: lessonId, concept_id: `${lessonId}-c1`, kind: "recall", position: 9, prompt: "x", answer_key: "x",
  }));
  // Migration 0004: lessons may only go into a path the writer owns.
  for (const [label, path, position] of [["A's path", pathId, 2], ["the shared seed path", "ccst-l1", 99]]) {
    const spoofId = `rls-spoof-${run}-${position}`;
    await expectError(`B can't add a lesson to ${label}`, B.client.from("lessons").insert({
      id: spoofId, owner_id: B.id, path_id: path, position, title: "x", objective: "x", est_minutes: 1, script: "x", review_status: "draft", origin: "draft",
    }));
    await B.client.from("lessons").delete().eq("id", spoofId); // only matters if the check above failed
  }
  await expectError("B can't download A's audio", B.client.storage.from("audio").download(audioPath));
  await expectError("B can't download A's PDF", B.client.storage.from("sources").download(pdfPath));
  await expectError("B can't create a signed URL for A's audio", B.client.storage.from("audio").createSignedUrl(audioPath, 60));
  await expectRows("B can't list A's audio folder", B.client.storage.from("audio").list(A.id), 0);
  await expectError("B can't upload into A's folder", B.client.storage.from("audio").upload(`${A.id}/intruder.wav`, wavBytes(), { contentType: "audio/wav" }));
  await B.client.storage.from("audio").remove([audioPath]);
  await expectOk("A's audio survives B's delete attempt", A.client.storage.from("audio").download(audioPath));
  await expectError("Files must live in the user's folder (root upload rejected)", B.client.storage.from("audio").upload("loose.wav", wavBytes(), { contentType: "audio/wav" }));
  await expectOk("B can upload into B's own folder", B.client.storage.from("audio").upload(`${B.id}/own.wav`, wavBytes(), { contentType: "audio/wav" }));

  // ---- Unchanged from A's point of view ----
  const { data: still } = await A.client.from("sources").select("title").eq("id", sourceId).single();
  record("A's source title is unchanged", still?.title === "A private source", `title: ${still?.title}`);
  await expectRows("A's attempt still exists", A.client.from("attempts").select("id").eq("id", attemptId), 1);

  // ---- Signed-out (anon key, no session) ----
  await expectRows("Signed-out can't read sources", anon.from("sources").select("*").eq("user_id", A.id), 0);
  await expectRows("Signed-out can't read profiles", anon.from("profiles").select("*"), 0);
  await expectRows("Signed-out can't read attempts", anon.from("attempts").select("*"), 0);
  await expectError("Signed-out can't download A's audio", anon.storage.from("audio").download(audioPath));
  const publicUrl = anon.storage.from("audio").getPublicUrl(audioPath).data.publicUrl;
  const resp = await fetch(publicUrl);
  record("Audio bucket is private (public URL doesn't serve the file)", !resp.ok, `HTTP ${resp.status}`);
}

async function cleanup() {
  for (const u of users) {
    for (const bucket of ["audio", "sources"]) {
      const { data } = await admin.storage.from(bucket).list(u.id, { limit: 1000 });
      if (data?.length) await admin.storage.from(bucket).remove(data.map((f) => `${u.id}/${f.name}`));
    }
    const { error } = await admin.auth.admin.deleteUser(u.id);
    console.log(error ? `cleanup: couldn't delete ${u.email}: ${error.message}` : `cleanup: deleted ${u.email}`);
  }
  // Root-level object from the negative test, in case a misconfigured policy let it through.
  await admin.storage.from("audio").remove(["loose.wav"]);
}

try {
  await main();
} catch (err) {
  record("verification run", false, err instanceof Error ? err.message : String(err));
} finally {
  await cleanup();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.log("Failures:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
