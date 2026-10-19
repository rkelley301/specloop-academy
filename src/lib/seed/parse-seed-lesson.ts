// Parser for the SpecLoop seed-course lesson markdown format (pack v0.1).
// Kept dependency-free so scripts/import-seed.ts can run it under plain Node.
// The parser copies text verbatim; it never rewrites lesson content.

export interface ParsedSeedLesson {
  file: string;
  code: string;
  title: string;
  banner: string;
  objective: string;
  script: string;
  recall: string[];
  scenario: string;
  answers: string[];
  scenarioAnswer: string | null;
  reviewNote: string | null;
}

function sections(md: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = md.split(/^## +/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    const name = (nl === -1 ? part : part.slice(0, nl)).trim().toLowerCase();
    out.set(name, nl === -1 ? "" : part.slice(nl + 1).trim());
  }
  return out;
}

function numbered(block: string): string[] {
  const items: string[] = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*\d+\.\s+(.*)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

function boldField(block: string, label: string): string | null {
  const re = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`, "mi");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

export function parseSeedLesson(file: string, md: string): ParsedSeedLesson {
  const text = md.replace(/\r\n/g, "\n");
  const heading = text.match(/^# +(\S+)\s+[—–-]\s+(.+)$/m);
  if (!heading) throw new Error(`${file}: missing "# SLxx — Title" heading`);
  const banner = (text.match(/^> +(.+)$/m)?.[1] ?? "").replace(/\*\*/g, "").trim();
  const objective = boldField(text, "Objective");
  if (!objective) throw new Error(`${file}: missing **Objective:**`);

  const s = sections(text);
  const script = s.get("audio script");
  const recallBlock = s.get("recall check");
  const scenario = s.get("scenario");
  const answerBlock = s.get("answer key");
  if (!script || !recallBlock || !scenario || !answerBlock) {
    throw new Error(`${file}: expected Audio script, Recall check, Scenario and Answer key sections`);
  }
  const recall = numbered(recallBlock);
  const answers = numbered(answerBlock);
  if (recall.length === 0 || recall.length !== answers.length) {
    throw new Error(`${file}: ${recall.length} recall questions but ${answers.length} answers`);
  }
  return {
    file,
    code: heading[1].trim(),
    title: heading[2].trim(),
    banner,
    objective,
    script,
    recall,
    scenario: scenario.trim(),
    answers,
    scenarioAnswer: boldField(answerBlock, "Scenario answer"),
    reviewNote: boldField(answerBlock, "Review note"),
  };
}
