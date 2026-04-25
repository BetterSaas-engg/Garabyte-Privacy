"use client";

import { useState, ReactNode } from "react";
import {
  RESPONSES,
  EVIDENCE,
  HISTORY,
  DIFFS,
  DIMENSIONS,
} from "@/lib/consultant-mock";
import type { HistoryEntry, HistoryKind } from "@/lib/consultant-mock";
import {
  Btn,
  ConfidenceDot,
  FileIcon,
  FilterChip,
  Pill,
} from "./atoms";
import type { ToneKey } from "./atoms";
import { ConsoleTopBar, EngagementSidebar } from "./chrome";

// --- Screen 4 — Raw responses ---------------------------------------------

export function RawResponses() {
  return (
    <>
      <ConsoleTopBar pageContext="Northwind Logistics" pageTitle="Raw responses" />
      <div className="flex flex-1 min-h-0">
        <EngagementSidebar active="responses" />
        <main className="flex-1 bg-[#F7F8FA] overflow-auto">
          <div className="bg-white border-b border-[#EEF0F3] px-6 pt-4 pb-3">
            <div className="flex items-baseline justify-between">
              <div>
                <h1 className="text-[16px] leading-6 font-medium text-[#1F242C]">Raw responses</h1>
                <p className="text-[12px] text-[#6B7280] mt-0.5">96 questions across 8 dimensions · read-only</p>
              </div>
              <div className="flex items-center gap-2">
                <Btn kind="secondary" sm>Export to PDF</Btn>
                <Btn kind="secondary" sm>Open evidence panel</Btn>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-3 -mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {DIMENSIONS.map((d, i) => (
                <button
                  key={d.id}
                  className={`h-7 px-2.5 inline-flex items-center gap-2 text-[12px] rounded transition-colors flex-shrink-0 ${
                    i === 1 ? "bg-[#EEF3FB] text-[#264B80] font-medium" : "text-[#4B5360] hover:bg-[#EEF0F3]"
                  }`}
                >
                  <span className="font-mono text-[10.5px] text-[#9AA1AD]">{d.id}</span>
                  {d.name.split(" & ")[0].split(" ").slice(0, 3).join(" ")}
                  <span className="text-[10.5px] tabular-nums text-[#9AA1AD]">{d.findings}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-3 bg-white border-b border-[#EEF0F3] flex items-center gap-2 text-[12px]">
            <span className="text-[11px] text-[#9AA1AD]">Filter</span>
            <FilterChip label="Status" value="All" />
            <button className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] bg-[#FAF3E6] border border-[#EAD9B2] text-[#85601A]">
              Evidence missing (4)
            </button>
            <button className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] bg-white border border-[#E2E5EA] text-[#4B5360] hover:border-[#CBD0D8]">
              Low confidence (3)
            </button>
            <button className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] bg-white border border-[#E2E5EA] text-[#4B5360] hover:border-[#CBD0D8]">
              Multi-stakeholder
            </button>
            <span className="ml-auto text-[11.5px] text-[#6B7280]">14 questions in D2 · showing all</span>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-lg border border-[#E2E5EA] bg-white overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#EEF0F3] bg-[#F7F8FA] flex items-baseline gap-3">
                <span className="text-[12px] font-medium text-[#1F242C]">D2 · Data inventory &amp; mapping</span>
                <span className="text-[11.5px] text-[#6B7280]">14 questions · score 64</span>
              </div>
              <div className="divide-y divide-[#EEF0F3]">
                {RESPONSES.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-start gap-4">
                    <span className="text-[11px] font-mono text-[#9AA1AD] tabular-nums w-14 mt-0.5 flex-shrink-0">{r.id}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] text-[#1F242C] leading-5 mb-1">{r.q}</div>
                      <div className="text-[12.5px] text-[#4B5360] leading-[19px]">
                        <span className="text-[#9AA1AD] mr-1.5">A.</span>
                        {r.a}
                      </div>
                      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-[#6B7280]">{r.who}</span>
                        {r.evidence > 0 && (
                          <span className="text-[11px] text-[#3A6FB8] inline-flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M5 2v8m4-4H1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                            </svg>
                            {r.evidence} {r.evidence === 1 ? "file" : "files"}
                          </span>
                        )}
                        {r.flags.map((fl) => (
                          <Pill key={fl} tone="warning">{fl}</Pill>
                        ))}
                      </div>
                    </div>
                    <ConfidenceDot conf={r.conf} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// --- Screen 5 — Evidence ---------------------------------------------------

export function Evidence() {
  return (
    <>
      <ConsoleTopBar pageContext="Northwind Logistics" pageTitle="Evidence" />
      <div className="flex flex-1 min-h-0">
        <EngagementSidebar active="evidence" />
        <main className="flex-1 bg-[#F7F8FA] overflow-auto">
          <div className="bg-white border-b border-[#EEF0F3] px-6 pt-4 pb-3">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h1 className="text-[16px] leading-6 font-medium text-[#1F242C]">Evidence</h1>
                <p className="text-[12px] text-[#6B7280] mt-0.5">9 files · 3 not yet reviewed · downloads watermarked with your name and timestamp</p>
              </div>
              <div className="flex items-center gap-2">
                <Btn kind="secondary" sm>Download all (.zip)</Btn>
                <Btn kind="secondary" sm>Export review log</Btn>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-white border-b border-[#EEF0F3] flex items-center gap-2 text-[12px]">
            <span className="text-[11px] text-[#9AA1AD]">Filter</span>
            <button className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] bg-[#FAF3E6] border border-[#EAD9B2] text-[#85601A]">
              Not yet reviewed (3)
            </button>
            <FilterChip label="Dimension" value="All 8" />
            <FilterChip label="File type" value="All" />
            <FilterChip label="Uploader" value="All" />
            <span className="ml-auto text-[11.5px] text-[#6B7280]">
              Sort: <span className="text-[#1F242C]">Upload date</span>
            </span>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-lg border border-[#E2E5EA] bg-white overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-medium text-[#6B7280] tracking-[0.06em] uppercase bg-[#F7F8FA] border-b border-[#EEF0F3]">
                    <th className="px-3 py-2 font-medium">File</th>
                    <th className="px-3 py-2 font-medium">Linked to</th>
                    <th className="px-3 py-2 font-medium">Uploader</th>
                    <th className="px-3 py-2 font-medium">Uploaded</th>
                    <th className="px-3 py-2 font-medium">Reviewer notes</th>
                    <th className="px-3 py-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {EVIDENCE.map((e, i) => (
                    <tr key={i} className="border-b border-[#EEF0F3] hover:bg-[#F7F8FA] transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <FileIcon type={e.type} />
                          <div className="flex flex-col leading-[16px] min-w-0">
                            <a href="#evidence" className="text-[12.5px] text-[#1F242C] font-medium truncate hover:text-[#3A6FB8]">{e.name}</a>
                            <span className="text-[11px] text-[#9AA1AD]">{e.size}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><span className="font-mono text-[11.5px] text-[#4B5360]">{e.dim}</span></td>
                      <td className="px-3 py-2.5 text-[#4B5360]">{e.uploader}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] tabular-nums">{e.uploaded}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] truncate max-w-[280px]">
                        {e.notes || <span className="text-[#9AA1AD]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {e.reviewed ? (
                          <Pill tone="success" dot>Reviewed</Pill>
                        ) : (
                          <button className="inline-flex items-center gap-1.5 h-6 px-2 rounded text-[11.5px] font-medium bg-white border border-[#E2E5EA] text-[#4B5360] hover:border-[#3A6FB8] hover:text-[#3A6FB8]">
                            Mark reviewed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-[#6B7280] mt-3">
              Marking a file reviewed records that you&apos;ve actually opened the document. The mark is part of the audit log and visible in the customer-facing report as &ldquo;evidence reviewed by [your name]&rdquo; without revealing the file contents.
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// --- Screen 6 — Publish ----------------------------------------------------

function ChangeStat({ n, label, tone }: { n: number; label: string; tone?: "success" | "danger" | "info" }) {
  const c = tone === "success" ? "#2C6741" : tone === "danger" ? "#8A2A2A" : "#264B80";
  return (
    <div>
      <div className="text-[20px] font-medium tabular-nums leading-none" style={{ color: c }}>{n}</div>
      <div className="text-[11px] text-[#6B7280] mt-1">{label}</div>
    </div>
  );
}

function ChangeRow({ type, id, text }: { type: "edited" | "added" | "approved" | "rejected"; id: string; text: string }) {
  const map: Record<string, { tone: ToneKey; label: string }> = {
    edited:   { tone: "info",    label: "Edited"   },
    added:    { tone: "info",    label: "Added"    },
    approved: { tone: "success", label: "Approved" },
    rejected: { tone: "danger",  label: "Rejected" },
  };
  return (
    <li className="px-4 py-2 flex items-baseline gap-3">
      <span className="w-20 flex-shrink-0">
        <Pill tone={map[type].tone}>{map[type].label}</Pill>
      </span>
      <span className="font-mono text-[11px] text-[#9AA1AD] tabular-nums w-14 flex-shrink-0">{id}</span>
      <span className="flex-1 text-[#4B5360] leading-[19px]">{text}</span>
    </li>
  );
}

function CheckRow({ done, children }: { done?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-baseline gap-2">
      {done ? (
        <span className="w-3.5 h-3.5 rounded-full bg-[#EDF6EF] inline-flex items-center justify-center flex-shrink-0">
          <svg width="8" height="8" viewBox="0 0 10 10">
            <path d="M2 5l2 2 4-4" stroke="#2C6741" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <span className="w-3.5 h-3.5 rounded-full border border-[#CBD0D8] inline-block flex-shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}

export function Publish() {
  const defaultNote = "Maya — solid first assessment. Strongest areas: governance, breach response, individual rights. The two areas to focus on first: vendor management (where most of the high findings cluster) and cross-border data flows (the EU warehouse path needs a documented mechanism). I've expanded the vendor finding with a 60-day remediation plan that should be tractable for your team. Happy to walk through the report on Monday's call.";
  const [coverNote, setCoverNote] = useState(defaultNote);
  const [followUpScheduled, setFollowUpScheduled] = useState(true);
  const [published, setPublished] = useState(false);

  return (
    <>
      <ConsoleTopBar pageContext="Northwind Logistics" pageTitle="Publish report" />
      <div className="flex flex-1 min-h-0">
        <EngagementSidebar active="publish" />
        <main className="flex-1 bg-[#F7F8FA] overflow-auto">
          <div className="bg-white border-b border-[#EEF0F3] px-6 pt-4 pb-3">
            <h1 className="text-[16px] leading-6 font-medium text-[#1F242C]">Publish report</h1>
            <p className="text-[12px] text-[#6B7280] mt-0.5">
              Final review before the customer sees it. After publication, the report is locked. Further changes require explicit unpublishing.
            </p>
          </div>

          <div className="p-6 grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7 space-y-5">
              <div className="rounded-lg border border-[#E2E5EA] bg-white">
                <div className="px-4 py-3 border-b border-[#EEF0F3] flex items-baseline justify-between">
                  <div className="text-[13px] font-medium text-[#1F242C]">Summary of consultant changes</div>
                  <a href="#findings" className="text-[11.5px] text-[#3A6FB8] hover:underline">Open findings list</a>
                </div>
                <div className="px-4 py-4 grid grid-cols-4 gap-3 text-center">
                  <ChangeStat n={1} label="Edited" />
                  <ChangeStat n={1} label="Added" />
                  <ChangeStat n={3} label="Approved as-is" tone="success" />
                  <ChangeStat n={1} label="Rejected" tone="danger" />
                </div>
                <div className="border-t border-[#EEF0F3]">
                  <ul className="divide-y divide-[#EEF0F3] text-[12.5px]">
                    <ChangeRow type="edited"   id="D5-F1" text="Severity raised to high · recommendation expanded with vendor remediation sprint detail" />
                    <ChangeRow type="added"    id="D5-F6" text="Added: documented exposure to a single point-of-contact for vendor escalations" />
                    <ChangeRow type="approved" id="D2-F1" text="Approved as-is" />
                    <ChangeRow type="approved" id="D4-F1" text="Approved as-is" />
                    <ChangeRow type="approved" id="D8-F1" text="Approved as-is" />
                    <ChangeRow type="rejected" id="D5-F4" text="Rejected — false positive (parent-org vendor questionnaire). Reason logged for rules library." />
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border border-[#E2E5EA] bg-white">
                <div className="px-4 py-3 border-b border-[#EEF0F3]">
                  <div className="text-[13px] font-medium text-[#1F242C]">Cover note to customer</div>
                  <div className="text-[11.5px] text-[#6B7280] mt-0.5">Optional. Appears at the top of their report. No estimated hours, no internal notes.</div>
                </div>
                <div className="px-4 py-4">
                  <textarea
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    rows={5}
                    className="w-full text-[13px] leading-[20px] text-[#1F242C] bg-[#F7F8FA] border border-[#E2E5EA] rounded-md px-3 py-2.5 focus:bg-white focus:border-[#3A6FB8] focus:ring-2 focus:ring-[#3A6FB8]/15 outline-none resize-y"
                    placeholder="Optional cover note…"
                  />
                  <div className="text-[11px] text-[#9AA1AD] mt-1.5 tabular-nums">
                    {coverNote.trim().length} characters · will appear above the score on the customer report
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#E2E5EA] bg-white">
                <div className="px-4 py-3 border-b border-[#EEF0F3]">
                  <div className="text-[13px] font-medium text-[#1F242C]">Schedule follow-up review</div>
                  <div className="text-[11.5px] text-[#6B7280] mt-0.5">When should we re-engage to assess progress on the high-severity findings?</div>
                </div>
                <div className="px-4 py-4 flex items-center gap-3 flex-wrap">
                  {followUpScheduled ? (
                    <>
                      <button className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[#E2E5EA] bg-white hover:border-[#CBD0D8] text-[13px] text-[#1F242C]">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="2" y="3" width="10" height="9" rx="1" stroke="#6B7280" strokeWidth="1.25" />
                          <path d="M2 6h10M5 2v2M9 2v2" stroke="#6B7280" strokeWidth="1.25" strokeLinecap="round" />
                        </svg>
                        Sep 12, 2025
                      </button>
                      <span className="text-[12px] text-[#6B7280]">~6 months out · matches Northwind&apos;s typical re-assessment cadence</span>
                      <button onClick={() => setFollowUpScheduled(false)} className="ml-auto text-[12px] text-[#3A6FB8] hover:underline">Skip — schedule later</button>
                    </>
                  ) : (
                    <>
                      <span className="text-[12px] text-[#85601A] inline-flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M6 2v4M6 8.5v.01" stroke="#B5821F" strokeWidth="1.5" strokeLinecap="round" />
                          <circle cx="6" cy="6" r="5" stroke="#B5821F" strokeWidth="1.25" />
                        </svg>
                        Follow-up not scheduled
                      </span>
                      <button onClick={() => setFollowUpScheduled(true)} className="ml-auto text-[12px] text-[#3A6FB8] hover:underline">Schedule now</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-5">
              <div className="rounded-lg border border-[#E2E5EA] bg-white">
                <div className="px-4 py-3 border-b border-[#EEF0F3] flex items-baseline justify-between">
                  <div className="text-[13px] font-medium text-[#1F242C]">Customer preview</div>
                  <Pill tone="muted">Read-only — what Maya will see</Pill>
                </div>
                <div className="p-4 bg-[#F7F8FA]">
                  <div className="rounded-md border border-[#E2E5EA] bg-white p-4">
                    <div className="flex items-baseline justify-between mb-2.5">
                      <div>
                        <div className="text-[10.5px] font-medium text-[#9AA1AD] tracking-[0.08em] uppercase mb-1">Privacy Health Check report</div>
                        <div className="text-[14px] font-medium text-[#1F242C]">Northwind Logistics Inc.</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[28px] font-medium tabular-nums leading-none" style={{ color: "#85601A", letterSpacing: "-0.01em" }}>68</div>
                        <div className="text-[11px] text-[#6B7280]">/ 100</div>
                      </div>
                    </div>
                    <div className="text-[12px] text-[#4B5360] mb-3">
                      Solid first assessment. Strongest areas: governance, breach response, individual rights. Two areas to focus on first: vendor management and cross-border data flows…
                    </div>
                    <div className="space-y-1.5">
                      {DIMENSIONS.slice(0, 4).map((d) => (
                        <div key={d.id} className="flex items-center gap-2">
                          <ConfidenceDot conf={d.conf} />
                          <span className="text-[11.5px] text-[#1F242C] truncate flex-1">{d.name}</span>
                          <div className="w-20 h-1 rounded-full bg-[#EEF0F3] overflow-hidden">
                            <div className="h-full" style={{ width: `${d.score}%`, background: d.score >= 80 ? "#3F8B5C" : d.score >= 65 ? "#3A6FB8" : "#B5821F" }} />
                          </div>
                          <span className="text-[10.5px] tabular-nums text-[#6B7280] w-6 text-right">{d.score}</span>
                        </div>
                      ))}
                      <div className="text-[11px] text-[#9AA1AD] pl-3.5">+ 4 more dimensions</div>
                    </div>
                    <div className="border-t border-[#EEF0F3] mt-3 pt-2.5 flex items-center gap-2 flex-wrap">
                      <Pill tone="danger">3 high</Pill>
                      <Pill tone="warning">5 moderate</Pill>
                      <Pill tone="muted">5 low</Pill>
                      <span className="text-[10.5px] text-[#9AA1AD] ml-auto">Estimated hours not shown</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#E2E5EA] bg-white p-5">
                <div className="text-[13px] font-medium text-[#1F242C] mb-2">Ready to publish?</div>
                <ul className="text-[12px] text-[#4B5360] space-y-1.5 mb-4">
                  <CheckRow done>All 14 findings reviewed</CheckRow>
                  <CheckRow done>
                    3 of 9 evidence files marked reviewed —{" "}
                    <a href="#evidence" className="text-[#3A6FB8] hover:underline">6 still unreviewed</a>
                  </CheckRow>
                  <CheckRow done={coverNote.trim().length > 0}>
                    {coverNote.trim().length > 0 ? "Cover note drafted" : "Cover note empty (optional)"}
                  </CheckRow>
                  <CheckRow done={followUpScheduled}>
                    {followUpScheduled ? "Follow-up review scheduled" : "Follow-up review not scheduled"}
                  </CheckRow>
                </ul>
                <div className="rounded-md bg-[#FAF3E6] border border-[#EAD9B2] px-3 py-2.5 text-[12px] text-[#85601A] leading-[18px] mb-4">
                  6 evidence files unreviewed. You can publish anyway, but the report&apos;s &ldquo;evidence reviewed&rdquo; attestation will reflect the actual count.
                </div>
                <Btn kind={published ? "success" : "primary"} onClick={() => setPublished(true)}>
                  {published ? "✓ Published · Maya notified" : "Publish report & notify Maya Reyes"}
                </Btn>
                <div className="text-[11px] text-[#6B7280] mt-2">
                  {published
                    ? "Report is now live for the customer. Locked unless explicitly unpublished."
                    : "Customer is notified by email. The report is then locked unless explicitly unpublished."}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// --- Screen 7 — History ----------------------------------------------------

const HISTORY_KIND_MAP: Record<HistoryKind, { tone: ToneKey; label: string }> = {
  submission: { tone: "info",    label: "Submission" },
  system:     { tone: "muted",   label: "System" },
  consultant: { tone: "info",    label: "Consultant" },
  edit:       { tone: "info",    label: "Edit" },
  review:     { tone: "success", label: "Review" },
  reject:     { tone: "danger",  label: "Reject" },
  add:        { tone: "info",    label: "Add" },
  customer:   { tone: "warning", label: "Customer" },
  publish:    { tone: "success", label: "Publish" },
};

function HistoryRow({ h }: { h: HistoryEntry }) {
  const m = HISTORY_KIND_MAP[h.kind];
  const [open, setOpen] = useState(false);
  const canDiff = h.kind === "edit" || h.kind === "reject" || h.kind === "add";
  const diff = DIFFS[h.text];
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline gap-4">
        <span className="text-[11.5px] font-mono text-[#9AA1AD] tabular-nums w-28 flex-shrink-0">{h.when}</span>
        <span className="w-24 flex-shrink-0"><Pill tone={m.tone}>{m.label}</Pill></span>
        <span className="text-[12px] text-[#1F242C] w-40 flex-shrink-0 truncate">{h.actor}</span>
        <span className="flex-1 min-w-0">
          <div className="text-[12.5px] text-[#1F242C] leading-[19px]">{h.text}</div>
          {h.ctx && <div className="text-[11.5px] text-[#6B7280] leading-[17px] mt-0.5">{h.ctx}</div>}
        </span>
        {canDiff && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[11.5px] text-[#3A6FB8] hover:underline flex-shrink-0"
          >
            {open ? "Hide diff" : "View diff"}
          </button>
        )}
      </div>
      {open && canDiff && (
        <div className="mt-2.5 ml-[228px] rounded-md border border-[#E2E5EA] bg-[#F7F8FA] overflow-hidden">
          {diff ? (
            diff.map((d, i) => (
              <div key={i} className={`grid grid-cols-12 text-[12px] leading-[19px] ${i > 0 ? "border-t border-[#EEF0F3]" : ""}`}>
                <div className="col-span-3 px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#9AA1AD] bg-white border-r border-[#EEF0F3]">{d.field}</div>
                <div className="col-span-9">
                  <div className="px-3 py-2 bg-[#F8ECEC]">
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#8A2A2A] mr-2">Engine</span>
                    <span className="text-[#5C2828]">{d.before}</span>
                  </div>
                  <div className="px-3 py-2 bg-[#E8F0E5] border-t border-[#EEF0F3]">
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#2C6741] mr-2">Edited</span>
                    <span className="text-[#1F3A2A]">{d.after}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-[12px] text-[#6B7280]">
              Original engine output preserved — contact engineering to retrieve the JSON snapshot.
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function HistoryView() {
  return (
    <>
      <ConsoleTopBar pageContext="Northwind Logistics" pageTitle="History" />
      <div className="flex flex-1 min-h-0">
        <EngagementSidebar active="history" />
        <main className="flex-1 bg-[#F7F8FA] overflow-auto">
          <div className="bg-white border-b border-[#EEF0F3] px-6 pt-4 pb-3 flex items-baseline justify-between">
            <div>
              <h1 className="text-[16px] leading-6 font-medium text-[#1F242C]">History</h1>
              <p className="text-[12px] text-[#6B7280] mt-0.5">
                Chronological audit log. Every consultant edit is preserved; original engine output is recoverable from any edit entry.
              </p>
            </div>
            <Btn kind="secondary" sm>Export log (JSON)</Btn>
          </div>

          <div className="px-6 py-3 bg-white border-b border-[#EEF0F3] flex items-center gap-2 text-[12px]">
            <span className="text-[11px] text-[#9AA1AD]">Filter</span>
            <FilterChip label="Actor" value="All" />
            <FilterChip label="Kind" value="All" />
            <FilterChip label="Range" value="Engagement to date" />
          </div>

          <div className="px-6 py-5">
            <div className="rounded-lg border border-[#E2E5EA] bg-white overflow-hidden">
              <ul className="divide-y divide-[#EEF0F3]">
                {HISTORY.map((h, i) => (
                  <HistoryRow key={i} h={h} />
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
