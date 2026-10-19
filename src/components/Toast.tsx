"use client";

import { useCallback, useEffect, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);
  const show = useCallback((m: string) => setMessage(m), []);
  const node = (
    <div aria-live="polite" role="status">
      {message && <div className="toast">{message}</div>}
    </div>
  );
  return { show, node };
}
