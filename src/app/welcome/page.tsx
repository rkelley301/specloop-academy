"use client";

import { useRouter } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { IndependenceNote } from "@/components/Notes";
import { WithState } from "@/components/StateViews";
import { dispatch } from "@/lib/store";

export default function WelcomePage() {
  const router = useRouter();
  return (
    <WithState requireProfile={false}>
      {(state) => (
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <div className="page-head">
            <div className="eyebrow">{state.profile ? "Edit your setup" : "Welcome"}</div>
            <h1>Learn I&amp;C in short loops</h1>
            <p>
              Each lesson follows a short cycle: <strong>listen</strong> to a narrated lesson, <strong>recall</strong>{" "}
              the key points, <strong>apply</strong> them to a field scenario, then <strong>review</strong> on a simple
              schedule.
            </p>
          </div>
          <div className="card">
            <ProfileForm
              initial={state.profile}
              submitLabel={state.profile ? "Save changes" : "Start learning"}
              onSubmit={(profile) => {
                dispatch({ type: "saveProfile", profile });
                router.push("/today");
              }}
            />
          </div>
          <div className="notice notice-warning mt-1">
            <strong>Local demo mode</strong>
            Your profile and progress stay in this browser on this device. There&apos;s no account or sign-in, and this
            isn&apos;t secure multi-user storage.
          </div>
          <div className="mt-1">
            <IndependenceNote />
          </div>
        </div>
      )}
    </WithState>
  );
}
