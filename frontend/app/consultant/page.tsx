import type { Metadata } from "next";
import { ScreenFrame } from "@/components/consultant/atoms";
import { CanvasHeader, CanvasIntro } from "@/components/consultant/chrome";
import { ConsultantHome } from "@/components/consultant/home";
import { CustomerOverview } from "@/components/consultant/overview";
import { FindingsReview } from "@/components/consultant/findings";
import {
  RawResponses,
  Evidence,
  Publish,
  HistoryView,
} from "@/components/consultant/screens-tail";

export const metadata: Metadata = {
  title: "Consultant console",
  description:
    "Internal consultant tooling for Garabyte Privacy Health Check. Static UI mock — backend wiring lands progressively as the auth + findings + engagement model is built (audit Phase 3 onward).",
};

export default function ConsultantConsolePage() {
  return (
    <div
      className="min-h-screen bg-[#F7F8FA] text-[#1F242C]"
      style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      <CanvasHeader />
      <CanvasIntro />
      <main className="pb-16">
        <ScreenFrame
          id="home"
          label="01 · Consultant home"
          sublabel="Engagement list with status strip, search, filters, and sort. Other consultants' customers are not listed."
          height={920}
        >
          <ConsultantHome />
        </ScreenFrame>

        <ScreenFrame
          id="overview"
          label="02 · Customer overview"
          sublabel="Org context, score, dimension breakdown, customer team, and recent activity. Default landing for an engagement."
          height={1000}
        >
          <CustomerOverview />
        </ScreenFrame>

        <ScreenFrame
          id="findings"
          label="03 · Findings review"
          sublabel="The core working surface. Severity-grouped list with editable cards. One finding (D5-F1) is shown in its expanded edit state with the original engine output revealed; one is shown rejected with the internal reason."
          height={1500}
        >
          <FindingsReview />
        </ScreenFrame>

        <ScreenFrame
          id="responses"
          label="04 · Raw responses"
          sublabel="Read-only view of every question and answer. Per-dimension tabs; filters for evidence-missing and low-confidence."
          height={1100}
        >
          <RawResponses />
        </ScreenFrame>

        <ScreenFrame
          id="evidence"
          label="05 · Evidence"
          sublabel="All uploaded files across the assessment. Mark-as-reviewed attestation per file. Downloads are watermarked with consultant identity."
          height={840}
        >
          <Evidence />
        </ScreenFrame>

        <ScreenFrame
          id="publish"
          label="06 · Publish"
          sublabel="Final review. Summary of consultant changes, customer-facing preview (no internal hours), cover note, follow-up scheduling, and explicit publish action."
          height={1100}
        >
          <Publish />
        </ScreenFrame>

        <ScreenFrame
          id="history"
          label="07 · History"
          sublabel="Chronological audit log. Submission, every consultant edit, customer interactions after publication. View-diff link on each edit recovers the original engine output."
          height={780}
        >
          <HistoryView />
        </ScreenFrame>
      </main>

      <footer className="border-t border-[#EEF0F3] py-8">
        <div className="max-w-[1400px] mx-auto px-6 text-[12px] text-[#6B7280]">
          Consultant console spec · Garabyte Privacy Health Check internal tooling. Static UI mock — backend integration follows audit Phase 3 (auth + ownership) and Phase 5 (findings as first-class, consultant override layer, audit log).
        </div>
      </footer>
    </div>
  );
}
