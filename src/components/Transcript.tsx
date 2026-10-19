import { parseScript } from "@/lib/script";

export function Transcript({ script }: { script: string }) {
  const parts = parseScript(script);
  if (parts.length === 0) return <p className="muted">This lesson has no transcript yet.</p>;
  return (
    <div className="transcript">
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <p key={i}>{p.text}</p>
        ) : (
          <div key={i} className="pause-cue">
            <span className="pause-label">Pause {p.seconds}s</span>
            <span>{p.prompt ?? "Stop and recall what you just heard before continuing."}</span>
          </div>
        ),
      )}
    </div>
  );
}
