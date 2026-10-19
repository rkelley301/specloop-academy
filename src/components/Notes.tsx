import Link from "next/link";
import type { Lesson } from "@/lib/types";
import { REVIEW_STATUS_LABELS } from "@/lib/types";

export function SafetyNote() {
  return (
    <div className="notice notice-info">
      <strong>Study material, not a work instruction</strong>
      Field tasks must follow your site procedures, permits, isolation and lockout/tagout (LOTO) where applicable, and
      qualified supervision. Nothing in SpecLoop authorizes live work.
    </div>
  );
}

export function ReviewStatusBadge({ status }: { status: Lesson["reviewStatus"] }) {
  const cls =
    status === "approved" ? "badge-success" : status === "changes_requested" ? "badge-danger" : status === "in_review" ? "badge-info" : "badge-warning";
  return <span className={`badge ${cls}`}>{status === "draft" ? "Draft: technical review required" : REVIEW_STATUS_LABELS[status]}</span>;
}

export function IndependenceNote() {
  return (
    <p className="small muted">
      Independent study support. Not endorsed by or affiliated with ISA, not a complete exam blueprint, and no guarantee
      of certification or regulatory compliance. <Link href="/about">More</Link>
    </p>
  );
}
