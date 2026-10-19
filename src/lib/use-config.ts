"use client";

import { useEffect, useState } from "react";
import type { PublicConfig } from "./config";

type ConfigState = { status: "loading" } | { status: "ready"; config: PublicConfig } | { status: "error" };

/** Reads which server integrations are configured (booleans only, no secrets). */
export function useServerConfig(): ConfigState {
  const [s, setS] = useState<ConfigState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((config: PublicConfig) => !cancelled && setS({ status: "ready", config }))
      .catch(() => !cancelled && setS({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);
  return s;
}
