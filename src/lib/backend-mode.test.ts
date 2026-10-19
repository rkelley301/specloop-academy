import { describe, expect, it } from "vitest";
import { resolveBackendMode } from "./backend-mode";

describe("resolveBackendMode (fail closed)", () => {
  it("is local only when both variables are absent or blank", () => {
    expect(resolveBackendMode(undefined, undefined)).toEqual({ mode: "local" });
    expect(resolveBackendMode("", "  ")).toEqual({ mode: "local" });
  });
  it("is misconfigured when only one variable is set", () => {
    expect(resolveBackendMode("https://x.supabase.co", undefined).mode).toBe("misconfigured");
    expect(resolveBackendMode(undefined, "anon").mode).toBe("misconfigured");
    expect(resolveBackendMode("", "anon").mode).toBe("misconfigured");
  });
  it("rejects invalid or insecure URLs", () => {
    expect(resolveBackendMode("not a url", "anon").mode).toBe("misconfigured");
    expect(resolveBackendMode("http://x.supabase.co", "anon").mode).toBe("misconfigured");
  });
  it("accepts https, and http for localhost", () => {
    expect(resolveBackendMode("https://x.supabase.co/", "anon")).toEqual({ mode: "supabase", url: "https://x.supabase.co", anonKey: "anon" });
    expect(resolveBackendMode("http://127.0.0.1:54321", "anon").mode).toBe("supabase");
  });
});
