"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type ChangeEvent } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { WithState } from "@/components/StateViews";
import { useToast } from "@/components/Toast";
import { blobStorage } from "@/lib/blob-store";
import { AUDIO_MAX_BYTES, TTS_PROVIDERS, normalizedAudioType, validateAudioFile } from "@/lib/providers/tts";
import { audioReadyScript, countPauses, wordCount } from "@/lib/script";
import { orderedLessons } from "@/lib/selectors";
import { dispatch, newClientId } from "@/lib/store";
import type { AppState, Lesson } from "@/lib/types";

function LessonAudioPanel({ state, lesson }: { state: AppState; lesson: Lesson }) {
  const toast = useToast();
  const asset = state.audioAssets.find((a) => a.lessonId === lesson.id);
  const [script, setScript] = useState(lesson.script);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLTextAreaElement>(null);
  const dirty = script !== lesson.script;

  async function copy() {
    const text = audioReadyScript(lesson.title, lesson.script);
    try {
      await navigator.clipboard.writeText(text);
      toast.show("Audio-ready script copied. Paste it into OneStudio.");
    } catch {
      // Clipboard API blocked: select the fallback textarea for manual copy.
      copyRef.current?.focus();
      copyRef.current?.select();
      toast.show("Couldn't access the clipboard. The script is selected, so press Ctrl+C or ⌘C.");
    }
  }

  function download() {
    const blob = new Blob([audioReadyScript(lesson.title, lesson.script)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lesson.id}-script-v${lesson.scriptVersion}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateAudioFile(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploadError(null);
    setBusy(true);
    const id = newClientId("aud");
    try {
      await blobStorage.put(id, file);
      const previous = asset;
      dispatch({
        type: "attachAudio",
        asset: {
          id,
          lessonId: lesson.id,
          fileName: file.name,
          mimeType: normalizedAudioType(file),
          sizeBytes: file.size,
          scriptVersion: lesson.scriptVersion,
          provider: "manual_upload",
        },
      });
      if (previous) await blobStorage.remove(previous.id).catch(() => undefined);
      toast.show(previous ? "Audio replaced." : "Audio attached to the lesson.");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't store the audio file.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!asset || !window.confirm("Remove this audio from the lesson? The transcript stays.")) return;
    dispatch({ type: "removeAudio", assetId: asset.id });
    await blobStorage.remove(asset.id).catch(() => undefined);
    toast.show("Audio removed.");
  }

  return (
    <>
      <section className="card card-accent" aria-labelledby="ap-h">
        <div className="eyebrow">Lesson {lesson.order}</div>
        <h2 id="ap-h">{lesson.title}</h2>
        <p className="small muted">
          Script v{lesson.scriptVersion} · {wordCount(lesson.script)} words · {countPauses(lesson.script)} pause cues
        </p>

        <h3>1. Copy the audio-ready script</h3>
        <p className="small muted">Pause cues stay in the text, so you can turn them into silences or edit them in OneStudio.</p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={copy}>
            Copy script
          </button>
          <button type="button" className="btn" onClick={download}>
            Download .txt
          </button>
        </div>
        <label htmlFor="copy-src" className="visually-hidden">
          Audio-ready script text
        </label>
        <textarea
          id="copy-src"
          ref={copyRef}
          readOnly
          value={audioReadyScript(lesson.title, lesson.script)}
          className="script-editor"
          style={{ minHeight: 120, marginTop: "0.6rem" }}
        />

        <h3 className="mt-1">2. Generate audio in OneStudio</h3>
        <p className="small muted">Done outside SpecLoop for now. Export as MP3 or WAV.</p>

        <h3 className="mt-1">3. Upload and preview</h3>
        <AudioPlayer lesson={lesson} asset={asset} playbackRate={state.settings.playbackRate} />
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <input
            ref={fileRef}
            id="audio-file"
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            onChange={onUpload}
            className="visually-hidden"
            aria-label="Audio file (MP3 or WAV)"
            aria-describedby="audio-hint"
            tabIndex={-1}
          />
          <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Saving…" : asset ? "Replace audio" : "Upload MP3 or WAV"}
          </button>
          {asset && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              Remove audio
            </button>
          )}
        </div>
        <span className="hint" id="audio-hint">
          Up to {AUDIO_MAX_BYTES / 1024 / 1024} MB. Stored privately in this browser (IndexedDB).
        </span>
        {uploadError && (
          <p className="error-text" role="alert">
            {uploadError}
          </p>
        )}
        {asset && (
          <p className="small muted" style={{ marginTop: "0.5rem" }}>
            {asset.fileName} · {(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB · recorded from script v{asset.scriptVersion} · added{" "}
            {new Date(asset.createdAt).toLocaleString()}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="es-h">
        <h2 id="es-h">Edit narration script</h2>
        <p className="small muted">
          Saving creates script v{lesson.scriptVersion + 1}. Earlier versions are kept. Attached audio is flagged when
          it no longer matches the current script.
          {lesson.origin === "seed" && " Seed scripts are draft content pending technical review, so keep edits to wording and pacing."}
        </p>
        <label htmlFor="script-edit" className="visually-hidden">
          Narration script
        </label>
        <textarea id="script-edit" className="script-editor" value={script} onChange={(e) => setScript(e.target.value)} />
        <div className="row" style={{ marginTop: "0.6rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty || !script.trim()}
            onClick={() => {
              dispatch({ type: "updateLessonScript", lessonId: lesson.id, script });
              toast.show(`Saved as script v${lesson.scriptVersion + 1}.`);
            }}
          >
            Save new version
          </button>
          {dirty && (
            <button type="button" className="btn btn-ghost" onClick={() => setScript(lesson.script)}>
              Discard
            </button>
          )}
        </div>
        {lesson.scriptHistory.length > 1 && (
          <details className="mt-1">
            <summary>Version history ({lesson.scriptHistory.length})</summary>
            <ul className="list small">
              {lesson.scriptHistory
                .slice()
                .reverse()
                .map((v) => (
                  <li key={v.version} className="row-between">
                    <span>
                      v{v.version} · {new Date(v.savedAt).toLocaleString()}
                    </span>
                    {v.version !== lesson.scriptVersion && (
                      <button type="button" className="btn btn-sm" onClick={() => setScript(v.script)}>
                        Load into editor
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>
      {toast.node}
    </>
  );
}

function AudioStudio({ state }: { state: AppState }) {
  const params = useSearchParams();
  const router = useRouter();
  const lessons = state.paths.flatMap((p) => orderedLessons(state, p.id));
  const selected = lessons.find((l) => l.id === params.get("lesson")) ?? lessons[0];
  return (
    <>
      <div className="page-head">
        <h1>Audio studio</h1>
        <p>Attach narration to each lesson. Lessons without audio fall back to their transcript.</p>
      </div>

      <section className="card" aria-labelledby="prov-h">
        <h2 id="prov-h">Audio providers</h2>
        <ul className="list small">
          {TTS_PROVIDERS.map((p) => {
            const st = p.status({ onestudioConfigured: false });
            return (
              <li key={p.id}>
                <div className="row-between">
                  <strong>{p.label}</strong>
                  <span className={`badge ${st.available ? "badge-success" : "badge"}`}>{st.available ? "Available" : "Not configured"}</span>
                </div>
                <div className="muted">{st.reason}</div>
              </li>
            );
          })}
        </ul>
        <p className="small muted mb-0">
          Direct OneStudio generation needs verified API details. See <code>docs/onestudio-integration.md</code> for what&apos;s required.
        </p>
      </section>

      <div className="field mt-1">
        <label htmlFor="pick">Lesson</label>
        <select id="pick" value={selected?.id} onChange={(e) => router.replace(`/audio?lesson=${e.target.value}`)}>
          {lessons.map((l) => {
            const has = state.audioAssets.some((a) => a.lessonId === l.id);
            return (
              <option key={l.id} value={l.id}>
                {l.order}. {l.title} {has ? "(audio attached)" : "(no audio)"}
              </option>
            );
          })}
        </select>
      </div>
      {selected ? (
        <LessonAudioPanel key={selected.id} state={state} lesson={selected} />
      ) : (
        <p className="muted">No lessons available.</p>
      )}
      <p className="small mt-1">
        <Link href={selected ? `/lessons/${selected.id}` : "/path"}>Open this lesson →</Link>
      </p>
    </>
  );
}

export default function AudioPage() {
  return (
    <WithState>
      {(state) => (
        <Suspense fallback={null}>
          <AudioStudio state={state} />
        </Suspense>
      )}
    </WithState>
  );
}
