"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingView, StoreErrorView } from "@/components/StateViews";
import { useStore } from "@/lib/store";

export default function Home() {
  const snap = useStore();
  const router = useRouter();
  const target = snap.status === "ready" ? (snap.state.profile ? "/today" : "/welcome") : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  if (snap.status === "error") return <StoreErrorView message={snap.message} raw={snap.raw} />;
  return <LoadingView label="Opening SpecLoop…" />;
}
