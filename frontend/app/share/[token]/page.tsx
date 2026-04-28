"use client";

import { useEffect, useState } from "react";
import { getSharedReport } from "@/lib/api";
import type { SharedReport } from "@/lib/api";

const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-[#F8ECEC] text-[#8A2A2A] border-[#EBCBCB]",
  high: "bg-[#FAF3E6] text-[#85601A] border-[#EAD9B2]",
  moderate: "bg-[#EEF3FB] text-[#264B80] border-[#D8E3F5]",
  low: "bg-[#EDF6EF] text-[#2C6741] border-[#CFE3D6]",
};

export default function SharePage({ params }: { params: { token: string } }) {
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setReport(await getSharedReport(params.token));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [params.token]);

  if (error) {
    return (
      <Layout>
        <div className="rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-4 py-6 text-center">
          <h1 className="text-[18px] font-medium text-[#8A2A2A] mb-1.5">This link is no longer valid</h1>
          <p className="text-[13px] text-[#6B7280]">
            The recipient who shared this link can issue a new one.
          </p>
        </div>
      </Layout>
    );
  }

  if (!report) {
    return <Layout><p className="text-[13px] text-[#6B7280]">Loading…</p></Layout>;
  }

  const expiresAt = new Date(report.share_expires_at);
  const expiresIn = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000));

  return (
    <Layout>
      {/* Banner — distinguishes share-view from authenticated dashboard */}
      <div className="rounded-md bg-[#EEF3FB] border border-[#D8E3F5] px-4 py-2.5 text-[12px] text-[#264B80] mb-6 flex items-center justify-between">
        <span>
          Shared report{report.share_label ? ` · ${report.share_label}` : ""} — read-only.
          Expires in {expiresIn} day{expiresIn === 1 ? "" : "s"}.
        </span>
        <span className="font-mono text-[11px] text-[#3A6FB8]">
          Garabyte Privacy
        </span>
      </div>

      <p className="text-[11px] uppercase tracking-[0.18em] text-[#3A6FB8] font-medium mb-2">
        {report.tenant_name}
      </p>
      <h1 className="text-[28px] leading-9 font-medium text-[#1F242C] mb-2">
        {report.assessment_label ?? "Privacy Health Check"}
      </h1>
      {report.published_at && (
        <p className="text-[12.5px] text-[#6B7280] mb-6">
          Published {new Date(report.published_at).toLocaleDateString()} ·
          Reviewed by a Garabyte consultant
        </p>
      )}

      {/* Headline score */}
      <div className="rounded-lg border border-[#E2E5EA] bg-white px-5 py-4 mb-6 flex items-baseline gap-4">
        {report.overall_score !== null ? (
          <>
            <span className="text-[36px] font-medium tabular-nums text-[#1F242C]">
              {report.overall_score.toFixed(2)}
            </span>
            <span className="text-[14px] text-[#4B5360]">/ 4.00</span>
            {report.overall_maturity && (
              <span className="ml-auto inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium bg-[#EEF3FB] text-[#264B80] border border-[#D8E3F5]">
                {report.overall_maturity}
              </span>
            )}
          </>
        ) : (
          <span className="text-[14px] text-[#6B7280]">Score withheld</span>
        )}
      </div>

      {/* Cover note */}
      {report.cover_note && (
        <div className="rounded-lg border border-[#E2E5EA] bg-white px-5 py-4 mb-6">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[#9AA1AD] font-medium mb-2">
            Consultant note
          </p>
          <p className="text-[13.5px] text-[#1F242C] whitespace-pre-wrap">{report.cover_note}</p>
        </div>
      )}

      {/* Findings */}
      <h2 className="text-[16px] font-medium text-[#1F242C] mb-3">
        Findings ({report.findings.length})
      </h2>
      <div className="space-y-3">
        {report.findings.length === 0 ? (
          <div className="rounded-lg border border-[#E2E5EA] bg-white px-5 py-8 text-center text-[13px] text-[#6B7280]">
            No outstanding findings — the program is in good shape.
          </div>
        ) : (
          report.findings.map((f, i) => (
            <article key={i} className="rounded-lg border border-[#E2E5EA] bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-[11px] uppercase tracking-[0.06em] text-[#9AA1AD] font-medium">
                  {f.dimension_id === "compound" ? "Cross-cutting" : f.dimension_id}
                </p>
                <span className={`inline-flex items-center h-5 px-2 rounded text-[11px] font-medium border tabular-nums ${SEVERITY_TONE[f.severity] ?? SEVERITY_TONE.moderate}`}>
                  {f.severity}
                </span>
              </div>
              <p className="text-[13.5px] text-[#1F242C] mb-2">{f.finding_text}</p>
              {f.recommendation && (
                <p className="text-[13px] text-[#4B5360] mb-2">
                  <span className="font-medium text-[#1F242C]">Recommendation. </span>
                  {f.recommendation}
                </p>
              )}
              {f.regulatory_risk && (
                <p className="text-[12px] text-[#85601A] bg-[#FAF3E6] border border-[#EAD9B2] rounded px-2.5 py-1.5">
                  {f.regulatory_risk}
                </p>
              )}
            </article>
          ))
        )}
      </div>

      <p className="text-[11px] text-[#9AA1AD] mt-8 text-center">
        Confidential. Distributed via signed share link to the recipient named above.
      </p>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen bg-[#F7F8FA] text-[#1F242C] py-12 px-6"
      style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      <div className="max-w-[820px] mx-auto">{children}</div>
    </main>
  );
}
