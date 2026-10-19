import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEED_VERSION, buildSeedLessons, buildSeedPath } from "./ccst-level1";
import { seedSql } from "./seed-sql";

const file = join(import.meta.dirname, "../../../supabase/migrations/0003_seed_ccst_l1.sql");

describe("seed course SQL", () => {
  it("committed migration matches the bundled seed (run `npm run seed:sql` if this fails)", () => {
    const sql = seedSql(buildSeedPath(), buildSeedLessons(), SEED_VERSION);
    if (process.env.UPDATE_SEED_SQL === "1") writeFileSync(file, sql);
    expect(readFileSync(file, "utf8")).toBe(sql);
  });
});
