"use client";

import { useState, useMemo } from "react";
import { FINDINGS_SEED } from "@/lib/consultant-mock";
import type { Finding, SeverityKind, FindingStatusKind } from "@/lib/consultant-mock";
import {
  Btn,
  DiffLine,
  EditableNumber,
  EditableText,
  EditableTextArea,
  FieldGroup,
  FilterChip,
  FindingStatus,
  Pill,
  SeveritySelect,
  severityBorder,
} from "./atoms";
import { ConsoleTopBar, EngagementSidebar } from "./chrome";

function FindingCard({ f }: { f: Finding }) {
  const [expanded, setExpanded] = useState(!!f.expanded);
  const [severity, setSeverity] = useState<SeverityKind>(f.severity);
  const [showOriginal, setShowOriginal] = useState(false);
  const [status, setStatus] = useState<FindingStatusKind>(f.status);

  const left = severityBorder(severity);

  if (!expanded) {
    return (
      <div
        className="rounded-lg border border-[#E2E5EA] bg-white pl-3 pr-4 py-2.5 flex items-center gap-3 hover:border-[#CBD0D8] transition-colors group"
        style={{ boxShadow: `inset 3px 0 0 ${left}` }}
      >
        <span className="text-[11px] font-mono text-[#9AA1AD] tabular-nums">{f.id}</span>
        <span className="text-[13px] text-[#1F242C] flex-1 truncate">{f.statement}</span>
        <span className="text-[11.5px] text-[#9AA1AD] hidden md:inline">{f.dim.split(" · ")[0]}</span>
        <FindingStatus status={status} />
        {status !== "rejected" && <span className="text-[11.5px] tabular-nums text-[#6B7280] w-12 text-right">{f.hours}h</span>}
        <button onClick={() => setExpanded(true)} className="text-[11.5px] text-[#3A6FB8] hover:underline">Expand</button>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="rounded-lg border border-[#E2E5EA] bg-white" style={{ boxShadow: `inset 3px 0 0 ${left}` }}>
        <div className="px-4 py-3 border-b border-[#EEF0F3] flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#9AA1AD] tabular-nums">{f.id}</span>
          <span className="text-[11.5px] text-[#6B7280]">{f.dim}</span>
          <span className="ml-auto flex items-center gap-2">
            <FindingStatus status="rejected" />
            <button onClick={() => setExpanded(false)} className="text-[11.5px] text-[#6B7280] hover:text-[#1F242C]">Collapse</button>
          </span>
        </div>
        <div className="px-4 py-3.5 space-y-3">
          <div className="text-[13px] text-[#1F242C] line-through">{f.statement}</div>
          <div className="rounded-md border border-[#EBCBCB] bg-[#F8ECEC] px-3 py-2.5">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#8A2A2A]">Reject reason</span>
              <span className="text-[10.5px] text-[#6B7280]">Internal only · won&apos;t be visible to customer · feeds the rules library</span>
            </div>
            <div className="text-[12.5px] text-[#5C2828] leading-[19px]">{f.rejectReason}</div>
          </div>
          <div className="flex items-center gap-2">
            <Btn kind="ghost" sm onClick={() => setStatus("needs")}>Reinstate finding</Btn>
            <span className="text-[11px] text-[#9AA1AD] ml-auto">Rejected by Jordan T. · 2d ago</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-[#E2E5EA] bg-white"
      style={{ boxShadow: `inset 3px 0 0 ${left}, 0 1px 2px rgba(17,21,27,0.04)` }}
    >
      <div className="px-4 pt-3 pb-2.5 border-b border-[#EEF0F3] flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-mono text-[#9AA1AD] tabular-nums">{f.id}</span>
        <span className="text-[11.5px] text-[#6B7280]">{f.dim}</span>
        <SeveritySelect value={severity} onChange={setSeverity} />
        <FindingStatus status={status} />
        <span className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded transition-colors ${
              showOriginal ? "bg-[#EEF3FB] text-[#264B80]" : "text-[#4B5360] hover:bg-[#EEF0F3]"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 12 12">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            {showOriginal ? "Hide original" : "Show original engine output"}
          </button>
          <button onClick={() => setExpanded(false)} className="text-[11.5px] text-[#6B7280] hover:text-[#1F242C]">Collapse</button>
        </span>
      </div>

      <div className="px-4 py-4 space-y-3.5">
        <FieldGroup label="Finding statement" subtle="What we tell the customer">
          <EditableText value={f.statement} large />
          {showOriginal && f.statementOriginal && <DiffLine original={f.statementOriginal} />}
        </FieldGroup>

        <FieldGroup label="Recommendation" subtle="Edited from engine output">
          <EditableTextArea value={f.rec} rows={3} />
          {showOriginal && f.recOriginal && <DiffLine original={f.recOriginal} />}
        </FieldGroup>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-9">
            <FieldGroup label="Regulatory risk">
              <EditableTextArea value={f.risk} rows={2} />
              {showOriginal && f.riskOriginal && <DiffLine original={f.riskOriginal} />}
            </FieldGroup>
          </div>
          <div className="col-span-12 md:col-span-3">
            <FieldGroup label="Estimated hours" subtle="Internal pricing — not on customer report">
              <EditableNumber value={f.hours} suffix="hours" />
            </FieldGroup>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-[#EEF0F3] bg-[#F7F8FA] flex items-center gap-2 rounded-b-lg">
        <span className="text-[11px] text-[#6B7280]">Last edited by you · 12 min ago</span>
        <span className="ml-auto flex items-center gap-2">
          <Btn kind="destructive" sm onClick={() => setStatus("rejected")}>Reject finding…</Btn>
          <Btn kind="secondary" sm>Save draft</Btn>
          <Btn kind={status === "approved" ? "success" : "primary"} sm onClick={() => setStatus("approved")}>
            {status === "approved" ? "Approved" : "Approve"}
          </Btn>
        </span>
      </div>
    </div>
  );
}

export function FindingsReview() {
  const [findings, setFindings] = useState<Finding[]>(FINDINGS_SEED);
  const [resetKey, setResetKey] = useState(0);
  const [onlyEdited, setOnlyEdited] = useState(false);

  const counts = useMemo(() => {
    const by = (k: SeverityKind) => findings.filter((f) => f.severity === k).length;
    const st = (k: FindingStatusKind) => findings.filter((f) => f.status === k).length;
    return {
      high: by("high"), moderate: by("moderate"), low: by("low"),
      needs: st("needs"), edited: st("edited"), approved: st("approved"), rejected: st("rejected"),
    };
  }, [findings]);

  const grouped = useMemo(() => {
    const visible = onlyEdited ? findings.filter((f) => f.status === "edited") : findings;
    const by: Record<SeverityKind, Finding[]> = { high: [], moderate: [], low: [] };
    visible.forEach((f) => by[f.severity].push(f));
    return by;
  }, [findings, onlyEdited]);

  const bulkApproveModerate = () => {
    setFindings((fs) =>
      fs.map((f) =>
        f.severity === "moderate" && f.status !== "rejected" && f.status !== "approved"
          ? { ...f, status: "approved" }
          : f,
      ),
    );
    setResetKey((k) => k + 1);
  };

  const addCustomFinding = () => {
    const n = findings.filter((f) => f.id.startsWith("D5-F")).length + 1;
    const newF: Finding = {
      id: `D5-F${n + 1}`,
      dim: "D5 · Vendor & third-party management",
      severity: "moderate",
      status: "edited",
      statement: "— New custom finding — fill in the statement.",
      rec: "",
      risk: "",
      hours: 4,
      expanded: true,
      isCustom: true,
    };
    setFindings((fs) => [...fs, newF]);
    setResetKey((k) => k + 1);
  };

  return (
    <>
      <ConsoleTopBar pageContext="Northwind Logistics" pageTitle="Findings review" />
      <div className="flex flex-1 min-h-0">
        <EngagementSidebar active="findings" />
        <main className="flex-1 bg-[#F7F8FA] overflow-auto">
          <div className="bg-white border-b border-[#EEF0F3] px-6 py-3.5 flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-3">
              <h1 className="text-[16px] leading-6 font-medium text-[#1F242C]">Findings</h1>
              <span className="text-[11.5px] text-[#6B7280]">{findings.length} total · sorted by severity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Pill tone="danger" dot>{counts.high} high</Pill>
              <Pill tone="warning" dot>{counts.moderate} moderate</Pill>
              <Pill tone="muted" dot>{counts.low} low</Pill>
            </div>
            <span className="w-px h-5 bg-[#E2E5EA] hidden md:block" />
            <div className="flex items-center gap-1.5">
              <Pill tone="info">{counts.needs} needs review</Pill>
              <Pill tone="info">{counts.edited} edited</Pill>
              <Pill tone="success">{counts.approved} approved</Pill>
              <Pill tone="danger">{counts.rejected} rejected</Pill>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Btn kind="secondary" sm onClick={bulkApproveModerate}>Bulk: approve all moderate as-is</Btn>
              <Btn kind="primary" sm onClick={addCustomFinding}>+ Add custom finding</Btn>
            </div>
          </div>

          <div className="bg-white border-b border-[#EEF0F3] px-6 py-2 flex items-center gap-2 text-[12px]">
            <span className="text-[11px] text-[#9AA1AD]">Filter</span>
            <FilterChip label="Dimension" value="All 8" />
            <FilterChip label="Status" value="Any" />
            <FilterChip label="Severity" value="Any" />
            <button
              onClick={() => setOnlyEdited((v) => !v)}
              className={`ml-auto transition-colors ${onlyEdited ? "text-[#264B80] font-medium" : "text-[#3A6FB8] hover:underline"}`}
            >
              {onlyEdited ? `✕ Showing only edited (${counts.edited})` : `Show only edited (${counts.edited})`}
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {(["high", "moderate", "low"] as SeverityKind[]).map((sev) => (
              <section key={sev}>
                <div className="flex items-baseline gap-3 mb-2.5">
                  <h2
                    className="text-[12.5px] font-medium uppercase tracking-[0.08em]"
                    style={{ color: sev === "high" ? "#8A2A2A" : sev === "moderate" ? "#85601A" : "#6B7280" }}
                  >
                    {sev}
                  </h2>
                  <span className="text-[11.5px] text-[#9AA1AD]">{grouped[sev].length} findings</span>
                  <span className="flex-1 h-px bg-[#EEF0F3]" />
                </div>
                <div className="space-y-2.5">
                  {grouped[sev].map((f) => (
                    <FindingCard key={`${f.id}-${resetKey}`} f={f} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
