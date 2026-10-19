"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { blobStorage } from "@/lib/blob-store";
import { dispatch } from "@/lib/store";
import type { AudioAsset, Lesson } from "@/lib/types";

const SPEEDS = [0.75, 1, 1.25, 1.5];

type Load = { state: "loading" } | { state: "ready"; url: string } | { state: "missing" } | { state: "error"; message: string };

export function useAudioUrl(asset: AudioAsset | undefined) {
  const [load, setLoad] = useState<Load>(asset ? { state: "loading" } : { state: "missing" });
  useEffect(() => {
    if (!asset) {
      setLoad({ state: "missing" });
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    setLoad({ state: "loading" });
    blobStorage
      .get(asset.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setLoad({ state: "error", message: "The audio record exists, but the file isn't in this browser's storage. It may have been cleared." });
          return;
        }
        url = URL.createObjectURL(blob);
        setLoad({ state: "ready", url });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoad({ state: "error", message: e instanceof Error ? e.message : "Couldn't load the audio file." });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset]);
  return load;
}

export function AudioPlayer({ lesson, asset, playbackRate }: { lesson: Lesson; asset: AudioAsset | undefined; playbackRate: number }) {
  const load = useAudioUrl(asset);
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = playbackRate;
  }, [playbackRate, load]);

  if (load.state === "missing") {
    return (
      <div className="notice">
        <strong>No narration attached yet</strong>
        This lesson is transcript-first for now. Read the transcript below. Pause where it says to, and say your answer
        out loud before moving on.{" "}
        <Link href={`/audio?lesson=${lesson.id}`}>Attach audio in Audio studio</Link>.
      </div>
    );
  }
  if (load.state === "loading") {
    return (
      <div role="status" className="notice">
        Loading audio…
      </div>
    );
  }
  if (load.state === "error") {
    return (
      <div className="notice notice-warning" role="alert">
        <strong>Audio unavailable</strong>
        {load.message} The transcript below has the full lesson.{" "}
        <Link href={`/audio?lesson=${lesson.id}`}>Re-upload in Audio studio</Link>.
      </div>
    );
  }
  const stale = asset && asset.scriptVersion !== lesson.scriptVersion;
  return (
    <div className="player">
      <audio
        ref={ref}
        controls
        preload="metadata"
        src={load.url}
        aria-label={`Narration for ${lesson.title}`}
        onLoadedMetadata={(e) => (e.currentTarget.playbackRate = playbackRate)}
      >
        Your browser can&apos;t play this audio. Use the transcript below.
      </audio>
      <div className="row-between">
        <div className="speed-group" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-sm"
              aria-pressed={playbackRate === s}
              onClick={() => dispatch({ type: "updateSettings", settings: { playbackRate: s } })}
            >
              {s}×
            </button>
          ))}
        </div>
        <span className="small muted">{asset?.fileName}</span>
      </div>
      {stale && (
        <p className="small" style={{ color: "var(--warning)", marginTop: "0.5rem" }}>
          This audio was recorded from script v{asset?.scriptVersion}. The transcript is now v{lesson.scriptVersion}, so
          they may differ.
        </p>
      )}
    </div>
  );
}
