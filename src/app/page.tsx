"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingView, NotReadyView } from "@/components/StateViews";
import { useStore } from "@/lib/store";

export default function Home() {
  const snap = useStore();
  const router = useRouter();
  const target =
    snap.status === "ready" ? (snap.state.profile ? "/today" : "/welcome") : snap.status === "signed-out" ? "/sign-in" : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  if (snap.status === "error") return <NotReadyView snap={snap} />;
  return <LoadingView label="Opening SpecLoop…" />;
}
