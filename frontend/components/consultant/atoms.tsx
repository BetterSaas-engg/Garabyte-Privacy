"use client";

import { useState, ReactNode } from "react";
import type {
  ConfidenceKind,
  SeverityKind,
  FindingStatusKind,
  EngagementStatus,
} from "@/lib/consultant-mock";

// Single-source palette for token tones across the consultant console.
// Keep this aligned with the design's tokens.js — neutral cool gray spine,
// confident blue accent, muted-green/amber/red semantics.

export type ToneKey = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const PILL_TONES: Record<ToneKey, { bg: string; text: string; border: string; dot: string }> = {
  neutral: { bg: "#EEF0F3", text: "#4B5360", border: "#E2E5EA", dot: "#9AA1AD" },
  info:    { bg: "#EEF3FB", text: "#264B80", border: "#D8E3F5", dot: "#3A6FB8" },
  success: { bg: "#EDF6EF", text: "#2C6741", border: "#CFE3D6", dot: "#3F8B5C" },
  warning: { bg: "#FAF3E6", text: "#85601A", border: "#EAD9B2", dot: "#B5821F" },
  danger:  { bg: "#F8ECEC", text: "#8A2A2A", border: "#EBCBCB", dot: "#B53A3A" },
  muted:   { bg: "#F7F8FA", text: "#6B7280", border: "#EEF0F3", dot: "#9AA1AD" },
};

export function Pill({ tone = "neutral", children, dot }: { tone?: ToneKey; children: ReactNode; dot?: boolean }) {
  const t = PILL_TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 h-5 px-2 rounded text-[11px] font-medium border tabular-nums"
      style={{ background: t.bg, color: t.text, borderColor: t.border }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />}
      {children}
    </span>
  );
}

type BtnKind = "primary" | "secondary" | "ghost" | "destructive" | "success";

export function Btn({
  kind = "primary",
  children,
  sm,
  disabled,
  onClick,
  type = "button",
  title,
}: {
  kind?: BtnKind;
  children: ReactNode;
  sm?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  title?: string;
}) {
  const h = sm ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[12.5px]";
  const map: Record<BtnKind, string> = {
    primary:     "bg-[#3A6FB8] hover:bg-[#2F5C9C] text-white border border-[#3A6FB8]",
    secondary:   "bg-white hover:bg-[#F7F8FA] text-[#343A45] border border-[#E2E5EA] hover:border-[#CBD0D8]",
    ghost:       "bg-transparent hover:bg-[#EEF0F3] text-[#4B5360] hover:text-[#1F242C] border border-transparent",
    destructive: "bg-white hover:bg-[#F8ECEC] text-[#8A2A2A] border border-[#E2E5EA] hover:border-[#B53A3A]",
    success:     "bg-[#2C6741] hover:bg-[#1f4f31] text-white border border-[#2C6741]",
  };
  const dis = disabled ? "opacity-50 cursor-not-allowed" : "";
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors ${h} ${map[kind]} ${dis}`}
    >
      {children}
    </button>
  );
}

export function ConfidenceDot({ conf }: { conf: ConfidenceKind }) {
  const map: Record<ConfidenceKind, string> = { high: "#3F8B5C", low: "#B5821F", none: "#CBD0D8" };
  return <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: map[conf] }} />;
}

export function FindingStatus({ status }: { status: FindingStatusKind }) {
  const map: Record<FindingStatusKind, { tone: ToneKey; label: string }> = {
    needs:    { tone: "info",    label: "Needs review" },
    edited:   { tone: "info",    label: "Consultant edited" },
    approved: { tone: "success", label: "Approved" },
    rejected: { tone: "danger",  label: "Rejected" },
  };
  const m = map[status];
  return <Pill tone={m.tone} dot>{m.label}</Pill>;
}

export function severityBorder(sev: SeverityKind): string {
  return sev === "high" ? "#B53A3A" : sev === "moderate" ? "#B5821F" : "#CBD0D8";
}

export function StatusBadge({ status }: { status: EngagementStatus }) {
  const map: Record<EngagementStatus, { tone: ToneKey; label: string }> = {
    progress:  { tone: "muted",   label: "Assessment in progress" },
    submitted: { tone: "info",    label: "Submitted" },
    review:    { tone: "info",    label: "Under review" },
    publish:   { tone: "warning", label: "Awaiting publication" },
    published: { tone: "success", label: "Published" },
    scheduled: { tone: "muted",   label: "Scheduled review" },
  };
  const m = map[status];
  return <Pill tone={m.tone} dot>{m.label}</Pill>;
}

export function SlaCell({ sla }: { sla: number | null }) {
  if (sla === null) return <span className="text-[12px] text-[#9AA1AD]">—</span>;
  if (sla < 0) return <span className="text-[12px] tabular-nums" style={{ color: "#8A2A2A" }}>{Math.abs(sla)}d over</span>;
  if (sla === 0) return <span className="text-[12px] tabular-nums" style={{ color: "#85601A" }}>Due today</span>;
  if (sla <= 1) return <span className="text-[12px] tabular-nums" style={{ color: "#85601A" }}>{sla}d left</span>;
  return <span className="text-[12px] tabular-nums text-[#4B5360]">{sla}d left</span>;
}

export function FilterChip({ label, value }: { label: string; value: string }) {
  const [active, setActive] = useState(false);
  const filtered = active && value !== "All" && value !== "Any";
  return (
    <button
      onClick={() => setActive((v) => !v)}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] border transition-colors ${
        filtered
          ? "bg-[#EEF3FB] border-[#D8E3F5] text-[#264B80]"
          : "bg-white border-[#E2E5EA] text-[#4B5360] hover:border-[#CBD0D8] hover:text-[#1F242C]"
      }`}
    >
      <span className={filtered ? "text-[#3A6FB8]" : "text-[#9AA1AD]"}>{label}:</span>
      <span className={filtered ? "text-[#264B80] font-medium" : "text-[#1F242C]"}>{value}</span>
      <svg width="10" height="10" viewBox="0 0 12 12">
        <path d="M2.5 4.5L6 8l3.5-3.5" stroke={filtered ? "#3A6FB8" : "#6B7280"} strokeWidth="1.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function SeveritySelect({ value, onChange }: { value: SeverityKind; onChange?: (v: SeverityKind) => void }) {
  const items: { id: SeverityKind; label: string; tone: "muted" | "warning" | "danger" }[] = [
    { id: "low",      label: "Low",      tone: "muted" },
    { id: "moderate", label: "Moderate", tone: "warning" },
    { id: "high",     label: "High",     tone: "danger" },
  ];
  const tones: Record<"muted" | "warning" | "danger", string> = {
    muted:   "bg-[#EEF0F3] text-[#4B5360]",
    warning: "bg-[#FAF3E6] text-[#85601A]",
    danger:  "bg-[#F8ECEC] text-[#8A2A2A]",
  };
  return (
    <div className="inline-flex items-center rounded-md border border-[#E2E5EA] bg-white p-0.5">
      {items.map((it) => {
        const sel = it.id === value;
        return (
          <button
            key={it.id}
            onClick={() => onChange?.(it.id)}
            className={`h-6 px-2.5 rounded text-[11.5px] font-medium transition-colors ${sel ? tones[it.tone] : "text-[#6B7280] hover:text-[#1F242C]"}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function EditableText({ value, large }: { value: string; large?: boolean }) {
  const [v, setV] = useState(value);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      className={`w-full ${large ? "text-[14px]" : "text-[13px]"} text-[#1F242C] bg-white px-2.5 py-1.5 rounded border border-[#E2E5EA] hover:border-[#CBD0D8] focus:border-[#3A6FB8] focus:ring-2 focus:ring-[#3A6FB8]/20 outline-none transition-colors`}
    />
  );
}

export function EditableTextArea({ value, rows = 3 }: { value: string; rows?: number }) {
  const [v, setV] = useState(value);
  return (
    <textarea
      value={v}
      rows={rows}
      onChange={(e) => setV(e.target.value)}
      className="w-full text-[13px] leading-[20px] text-[#1F242C] bg-white px-2.5 py-2 rounded border border-[#E2E5EA] hover:border-[#CBD0D8] focus:border-[#3A6FB8] focus:ring-2 focus:ring-[#3A6FB8]/20 outline-none transition-colors resize-y"
    />
  );
}

export function EditableNumber({ value, suffix }: { value: number; suffix?: string }) {
  const [v, setV] = useState(String(value));
  return (
    <div className="inline-flex items-center gap-1 bg-white border border-[#E2E5EA] hover:border-[#CBD0D8] focus-within:border-[#3A6FB8] focus-within:ring-2 focus-within:ring-[#3A6FB8]/20 rounded transition-colors">
      <input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="w-14 h-7 px-2 text-[13px] tabular-nums text-[#1F242C] bg-transparent outline-none"
      />
      {suffix && <span className="text-[12px] text-[#6B7280] pr-2">{suffix}</span>}
    </div>
  );
}

export function FieldGroup({ label, subtle, children }: { label: string; subtle?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9AA1AD]">{label}</span>
        {subtle && <span className="text-[11px] text-[#9AA1AD]">— {subtle}</span>}
      </div>
      {children}
    </div>
  );
}

export function DiffLine({ original }: { original: string }) {
  return (
    <div className="mt-1.5 rounded-md border border-[#EEF0F3] bg-[#F7F8FA] px-2.5 py-1.5">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#9AA1AD]">Engine original</span>
      </div>
      <div className="text-[12px] text-[#6B7280] leading-[18px] font-mono">{original}</div>
    </div>
  );
}

export function ScreenFrame({
  id,
  label,
  sublabel,
  children,
  height,
}: {
  id: string;
  label: string;
  sublabel?: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-16">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-[11px] font-medium text-[#9AA1AD] tracking-[0.08em] uppercase mb-1">{label}</div>
            {sublabel && <div className="text-[13px] text-[#4B5360] max-w-[820px]">{sublabel}</div>}
          </div>
          <a href={`#${id}`} className="text-[11px] text-[#9AA1AD] hover:text-[#4B5360]">#{id}</a>
        </div>
        <div className="rounded-lg overflow-hidden border border-[#E2E5EA] bg-white shadow-[0_1px_2px_rgba(17,21,27,0.04),0_8px_24px_rgba(17,21,27,0.04)]">
          <div className="h-7 bg-[#F7F8FA] border-b border-[#EEF0F3] flex items-center gap-1.5 px-3">
            <span className="w-2 h-2 rounded-full bg-[#E2E5EA]" />
            <span className="w-2 h-2 rounded-full bg-[#E2E5EA]" />
            <span className="w-2 h-2 rounded-full bg-[#E2E5EA]" />
            <span className="ml-3 text-[11px] text-[#9AA1AD] truncate">console.garabyte.internal/{id}</span>
          </div>
          <div style={{ minHeight: height || 720, display: "flex", flexDirection: "column" }}>{children}</div>
        </div>
      </div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warning" | "success" | "info" | "muted";
}) {
  const c =
    tone === "warning" ? "#85601A" :
    tone === "success" ? "#2C6741" :
    tone === "info"    ? "#264B80" :
    tone === "muted"   ? "#6B7280" : "#1F242C";
  return (
    <div className="rounded-md border border-[#EEF0F3] bg-[#F7F8FA] px-3 py-2.5">
      <div className="text-[10.5px] font-medium text-[#9AA1AD] tracking-[0.06em] uppercase mb-1">{label}</div>
      <div className="text-[16px] font-medium tabular-nums leading-5" style={{ color: c }}>{value}</div>
      {sub && <div className="text-[10.5px] text-[#6B7280] mt-0.5">{sub}</div>}
    </div>
  );
}

export function FileIcon({ type }: { type: "PDF" | "XLSX" | "DOCX" | "CSV" }) {
  const map: Record<string, string> = { PDF: "#B53A3A", XLSX: "#2C6741", DOCX: "#264B80", CSV: "#85601A" };
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-8 rounded text-[9px] font-medium text-white tabular-nums"
      style={{ background: map[type] || "#6B7280" }}
    >
      {type}
    </span>
  );
}
