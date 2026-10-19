// Regenerates src/lib/seed/ccst-l1-seed.generated.json from the seed pack
// markdown in content/ccst-l1-seed-v0.1. Run: npm run seed:import
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSeedLesson } from "../src/lib/seed/parse-seed-lesson.ts";

const root = new URL("..", import.meta.url).pathname;
const packDir = join(root, "content/ccst-l1-seed-v0.1");
const lessonsDir = join(packDir, "lessons");
const files = readdirSync(lessonsDir).filter((f) => f.endsWith(".md")).sort();
const lessons = files.map((f) => parseSeedLesson(f, readFileSync(join(lessonsDir, f), "utf8")));
const index = readFileSync(join(packDir, "COURSE_INDEX.md"), "utf8");
const version = index.match(/\*\*Version:\*\*\s*([^\s]+)/)?.[1] ?? "unknown";

const out = join(root, "src/lib/seed/ccst-l1-seed.generated.json");
writeFileSync(out, JSON.stringify({ packVersion: version, lessons }, null, 2) + "\n");
console.log(`Wrote ${lessons.length} lessons (pack v${version}) to ${out}`);
for (const l of lessons) {
  if (!l.scenarioAnswer) console.warn(`  note: ${l.code} has no scenario answer in the pack`);
}
