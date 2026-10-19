// Narration scripts are plain text with editable pause cues, for example
// "[PAUSE 3 SECONDS]" (seed-pack style), "[PAUSE 5s]" or
// "[PAUSE 5s: Name the parts before I list them.]".

export type ScriptPart =
  | { kind: "text"; text: string }
  | { kind: "pause"; seconds: number; prompt: string | null; raw: string };

const CUE = /\[PAUSE\s+(\d+)\s*(?:SECONDS?|SECS?|S)?\s*(?::\s*([^\]]*))?\]/gi;

export function parseScript(script: string): ScriptPart[] {
  const parts: ScriptPart[] = [];
  let last = 0;
  for (const m of script.matchAll(CUE)) {
    const idx = m.index ?? 0;
    if (idx > last) pushText(parts, script.slice(last, idx));
    parts.push({ kind: "pause", seconds: Number(m[1]), prompt: m[2]?.trim() || null, raw: m[0] });
    last = idx + m[0].length;
  }
  if (last < script.length) pushText(parts, script.slice(last));
  return parts;
}

function pushText(parts: ScriptPart[], chunk: string) {
  for (const para of chunk.split(/\n\s*\n/)) {
    const text = para.trim();
    if (text) parts.push({ kind: "text", text });
  }
}

export function countPauses(script: string): number {
  return [...script.matchAll(CUE)].length;
}

export function wordCount(script: string): number {
  return script.replace(CUE, " ").split(/\s+/).filter(Boolean).length;
}

/** Text to paste into a TTS tool. Cues stay as editable text. */
export function audioReadyScript(title: string, script: string): string {
  return `${title}\n\n${script.trim()}\n`;
}
