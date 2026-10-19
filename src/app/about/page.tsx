import Link from "next/link";
import { SafetyNote } from "@/components/Notes";
import { LADDERS } from "@/lib/scheduler";
import { SEED_PACK_VERSION, SEED_RELEASE_GATE } from "@/lib/seed/ccst-level1";

export const metadata = { title: "About & disclaimers" };

export default function AboutPage() {
  return (
    <>
      <div className="page-head">
        <h1>About SpecLoop Academy</h1>
        <p>
          Short narrated lessons for instrumentation and controls (I&amp;C) technicians, built around listen → recall →
          apply → review.
        </p>
      </div>

      <section className="card">
        <h2>Independent study support</h2>
        <p>
          SpecLoop isn&apos;t endorsed by, affiliated with, or reviewed by ISA (the International Society of Automation).
          The sample path uses the public ISA Certified Control Systems Technician (CCST) Body of Knowledge only as a
          broad topic reference. It isn&apos;t a complete exam blueprint, contains no ISA study-guide text or exam
          questions, and doesn&apos;t guarantee certification or regulatory compliance.
        </p>
      </section>

      <section className="card">
        <h2>Seed course status</h2>
        <p>
          The ten seeded lessons come from the SpecLoop CCST Level 1 Seed Course, Draft v{SEED_PACK_VERSION}. They are
          original drafts marked <strong>technical review required</strong>.
        </p>
        <div className="notice notice-warning small">{SEED_RELEASE_GATE}</div>
      </section>

      <section className="card" id="demo-mode">
        <h2>Local demo mode</h2>
        <p>
          There&apos;s no sign-in. Your profile, progress, sources, drafts and audio are stored only in this
          browser&apos;s local storage and IndexedDB on this device. Anyone using this browser profile can see them, and
          clearing site data deletes them. This isn&apos;t secure multi-user authentication. Use{" "}
          <Link href="/settings#data">Settings → Export</Link> to keep a copy.
        </p>
      </section>

      <section className="card">
        <h2>How reviews are scheduled</h2>
        <p>
          A deliberately simple, explainable ladder, not an adaptive algorithm such as FSRS. Missed items come back after{" "}
          {LADDERS.missed.join(", ")} days. Correct items come back after {LADDERS.correct.join(", ")} days. A miss
          restarts the missed ladder. Every review item shows why it&apos;s due.
        </p>
      </section>

      <section className="card">
        <h2>Content and sources</h2>
        <p>
          Lessons drafted from your sources keep their citation, stay drafts until a reviewer approves them, and should
          summarize in original wording. Don&apos;t upload paywalled study guides, proprietary exam questions, or
          confidential company procedures. If AI drafting is enabled, text is sent to the provider only after you
          explicitly confirm, and unsupported claims are marked [VERIFY].
        </p>
      </section>

      <SafetyNote />
    </>
  );
}
