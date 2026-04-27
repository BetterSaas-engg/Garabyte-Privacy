"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  createAnnotation,
  createCustomFinding,
  getAssessment,
  getAssessmentFindings,
  getRules,
  getTenant,
  isUnauthorized,
  publishAssessment,
} from "@/lib/api";
import type {
  Assessment,
  Dimension,
  FindingFromApi,
  RulesLibrary,
  Tenant,
} from "@/lib/types";

function findingsBySeverity(fs: FindingFromApi[]): Record<string, FindingFromApi[]> {
  const out: Record<string, FindingFromApi[]> = { critical: [], high: [], moderate: [], low: [] };
  for (const f of fs) {
    (out[f.severity] ?? out.moderate).push(f);
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  }
  return out;
}

export default function FindingsReviewRealPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; assessmentId: string }>();
  const slug = params.slug;
  const assessmentId = Number(params.assessmentId);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [rules, setRules] = useState<RulesLibrary | null>(null);
  const [findings, setFindings] = useState<FindingFromApi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function reloadFindings() {
    const fs = await getAssessmentFindings(assessmentId);
    setFindings(fs);
  }

  useEffect(() => {
    if (!Number.isFinite(assessmentId)) {
      setError("Invalid assessment id.");
      return;
    }
    (async () => {
      try {
        const [t, a, r, fs] = await Promise.all([
          getTenant(slug),
          getAssessment(assessmentId),
          getRules(),
          getAssessmentFindings(assessmentId),
        ]);
        setTenant(t);
        setAssessment(a);
        setRules(r);
        setFindings(fs);
      } catch (e) {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [slug, assessmentId, router]);

  const dimensionsByid = useMemo(() => {
    const m = new Map<string, Dimension>();
    rules?.dimensions.forEach((d) => m.set(d.id, d));
    return m;
  }, [rules]);

  const grouped = useMemo(() => {
    return findingsBySeverity(findings ?? []);
  }, [findings]);

  const counts = useMemo(() => {
    const fs = findings ?? [];
    const c = { needs: 0, edited: 0, approved: 0, rejected: 0 };
    for (const f of fs) {
      if (f.annotation_status === "unreviewed") c.needs += 1;
      else if (f.annotation_status === "confirmed") c.approved += 1;
      else if (f.annotation_status === "dismissed") c.rejected += 1;
      else c.edited += 1;
    }
    return { ...c, total: fs.length };
  }, [findings]);

  const isPublished = !!assessment?.published_at;
  const canPublish =
    !isPublished && counts.needs === 0 && (findings?.length ?? 0) > 0;

  async function onApprove(f: FindingFromApi) {
    setBusyId(f.id);
    try {
      await createAnnotation(f.id, { status: "confirmed" });
      await reloadFindings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onAnnotate(
    f: FindingFromApi,
    body: Parameters<typeof createAnnotation>[1],
  ) {
    setBusyId(f.id);
    try {
      await createAnnotation(f.id, body);
      await reloadFindings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onPublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const note = window.prompt(
        "Cover note for the customer (optional, appears at the top of the report):",
        "",
      );
      await publishAssessment(assessmentId, note ? { cover_note: note } : {});
      const a = await getAssessment(assessmentId);
      setAssessment(a);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  async function onAddCustom() {
    const dimensionId = window.prompt("Dimension (d1-d8):", "d5");
    if (!dimensionId) return;
    const severity = window.prompt("Severity (critical/high/moderate/low):", "moderate");
    if (!severity) return;
    const finding_text = window.prompt("Finding statement (one sentence):");
    if (!finding_text) return;
    const recommendation = window.prompt("Recommendation (optional):") ?? undefined;
    setBusyId(-1);
    try {
      await createCustomFinding(assessmentId, {
        dimension_id: dimensionId,
        severity,
        finding_text,
        recommendation,
      });
      await reloadFindings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add finding");
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen px-6 py-12 bg-[#F7F8FA]">
        <div className="max-w-5xl mx-auto">
          <Link href="/consultant" className="text-sm text-[#3A6FB8] hover:underline inline-block mb-6">
            ← Consultant home
          </Link>
          <div className="rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-4 py-3 text-sm text-[#8A2A2A]">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!tenant || !assessment || !findings) {
    return (
      <main className="min-h-screen px-6 py-12 bg-[#F7F8FA]">
        <div className="max-w-5xl mx-auto animate-pulse">
          <div className="h-6 bg-[#E2E5EA] rounded w-1/3 mb-4" />
          <div className="h-64 bg-white rounded-xl border border-[#E2E5EA]" />
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#F7F8FA] text-[#1F242C]"
      style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Top bar */}
      <header className="bg-white border-b border-[#EEF0F3] px-6 h-14 flex items-center gap-4">
        <Link href="/consultant" className="text-[12px] text-[#6B7280] hover:text-[#1F242C]">
          ← Consultant console
        </Link>
        <span className="w-px h-5 bg-[#E2E5EA]" />
        <span className="text-[13px] font-medium text-[#1F242C]">{tenant.name}</span>
        <span className="text-[12px] text-[#9AA1AD]">/</span>
        <span className="text-[12.5px] text-[#1F242C]">Findings review</span>
        <span className="ml-auto flex items-center gap-2">
          {isPublished ? (
            <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-[#EDF6EF] text-[#2C6741] text-[12px] font-medium border border-[#CFE3D6]">
              ✓ Published {new Date(assessment.published_at as string).toLocaleDateString("en-CA")}
            </span>
          ) : (
            <button
              onClick={onPublish}
              disabled={publishing || !canPublish}
              title={!canPublish ? "Approve / dismiss every finding first" : undefined}
              className="inline-flex items-center h-7 px-2.5 rounded-md text-[12px] font-medium bg-[#3A6FB8] hover:bg-[#2F5C9C] text-white disabled:bg-[#7AA0D8] disabled:cursor-not-allowed transition-colors"
            >
              {publishing ? "Publishing…" : "Publish report"}
            </button>
          )}
        </span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Stats + actions */}
        <div className="rounded-lg border border-[#E2E5EA] bg-white px-5 py-4 mb-5 flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[16px] leading-6 font-medium text-[#1F242C]">Findings</h1>
            <span className="text-[12px] text-[#6B7280]">{counts.total} total</span>
          </div>
          <div className="flex items-center gap-2 text-[11.5px]">
            <Pill tone="info">{counts.needs} needs review</Pill>
            <Pill tone="info">{counts.edited} edited</Pill>
            <Pill tone="success">{counts.approved} approved</Pill>
            <Pill tone="danger">{counts.rejected} rejected</Pill>
          </div>
          <button
            onClick={onAddCustom}
            disabled={isPublished || busyId === -1}
            className="ml-auto inline-flex items-center h-7 px-2.5 rounded-md text-[12px] font-medium bg-white hover:bg-[#F7F8FA] text-[#343A45] border border-[#E2E5EA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + Add custom finding
          </button>
        </div>

        {publishError && (
          <div className="rounded-md bg-[#F8ECEC] border border-[#EBCBCB] px-3 py-2 text-[12px] text-[#8A2A2A] mb-4">
            {publishError}
          </div>
        )}

        {/* Severity sections */}
        <div className="space-y-6">
          {(["critical", "high", "moderate", "low"] as const).map((sev) => {
            const list = grouped[sev] ?? [];
            if (list.length === 0) return null;
            return (
              <section key={sev}>
                <div className="flex items-baseline gap-3 mb-2.5">
                  <h2
                    className="text-[12.5px] font-medium uppercase tracking-[0.08em]"
                    style={{
                      color:
                        sev === "critical" || sev === "high"
                          ? "#8A2A2A"
                          : sev === "moderate"
                          ? "#85601A"
                          : "#6B7280",
                    }}
                  >
                    {sev}
                  </h2>
                  <span className="text-[11.5px] text-[#9AA1AD]">{list.length} findings</span>
                  <span className="flex-1 h-px bg-[#EEF0F3]" />
                </div>
                <div className="space-y-2.5">
                  {list.map((f) => (
                    <FindingCard
                      key={f.id}
                      f={f}
                      dimensionsByid={dimensionsByid}
                      busy={busyId === f.id}
                      isPublished={isPublished}
                      onApprove={() => onApprove(f)}
                      onAnnotate={(body) => onAnnotate(f, body)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {(findings?.length ?? 0) === 0 && (
            <p className="text-sm text-[#6B7280] py-12 text-center">
              No findings yet. Score the assessment first.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// FindingCard — single finding with the four annotation actions
// ---------------------------------------------------------------------------

function FindingCard({
  f,
  dimensionsByid,
  busy,
  isPublished,
  onApprove,
  onAnnotate,
}: {
  f: FindingFromApi;
  dimensionsByid: Map<string, Dimension>;
  busy: boolean;
  isPublished: boolean;
  onApprove: () => void;
  onAnnotate: (body: Parameters<typeof createAnnotation>[1]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftSeverity, setDraftSeverity] = useState(f.severity);
  const [draftText, setDraftText] = useState(f.finding_text);
  const [draftRec, setDraftRec] = useState(f.recommendation ?? "");
  const [draftRisk, setDraftRisk] = useState(f.regulatory_risk ?? "");
  const [draftRationale, setDraftRationale] = useState("");
  const [rejectInput, setRejectInput] = useState<string | null>(null);

  const isEdited = f.engine_finding_text !== f.finding_text
    || f.engine_severity !== f.severity
    || f.engine_recommendation !== f.recommendation
    || f.engine_regulatory_risk !== f.regulatory_risk;

  // Compound findings have no Dimension entry; show a stable label
  // instead of the bare "compound" sentinel id.
  const dimensionName =
    f.dimension_id === "compound"
      ? "Cross-cutting"
      : dimensionsByid.get(f.dimension_id)?.name ?? f.dimension_id;
  const left =
    f.severity === "critical" || f.severity === "high"
      ? "#B53A3A"
      : f.severity === "moderate"
      ? "#B5821F"
      : "#CBD0D8";

  async function saveEdits() {
    if (!draftRationale.trim()) {
      window.alert("Rationale is required for prose edits.");
      return;
    }
    await onAnnotate({
      status: "replaced",
      new_severity: draftSeverity !== f.engine_severity ? draftSeverity : undefined,
      new_finding_text: draftText !== f.engine_finding_text ? draftText : undefined,
      new_recommendation: draftRec !== (f.engine_recommendation ?? "") ? draftRec : undefined,
      new_regulatory_risk: draftRisk !== (f.engine_regulatory_risk ?? "") ? draftRisk : undefined,
      rationale: draftRationale.trim(),
    });
    setEditing(false);
    setDraftRationale("");
  }

  async function saveSeverity() {
    if (!draftRationale.trim()) {
      window.alert("Rationale required.");
      return;
    }
    await onAnnotate({
      status: "severity_adjusted",
      new_severity: draftSeverity,
      rationale: draftRationale.trim(),
    });
    setEditing(false);
    setDraftRationale("");
  }

  async function reject() {
    if (!rejectInput?.trim()) {
      window.alert("Reject reason is required.");
      return;
    }
    await onAnnotate({ status: "dismissed", rationale: rejectInput.trim() });
    setRejectInput(null);
  }

  // Collapsed row
  if (!expanded) {
    return (
      <div
        className="rounded-lg border border-[#E2E5EA] bg-white pl-3 pr-4 py-2.5 flex items-center gap-3 hover:border-[#CBD0D8] transition-colors"
        style={{ boxShadow: `inset 3px 0 0 ${left}` }}
      >
        <span className="text-[11px] font-mono text-[#9AA1AD] tabular-nums">F{f.id}</span>
        <span className="text-[13px] text-[#1F242C] flex-1 truncate">{f.finding_text}</span>
        <span className="text-[11.5px] text-[#9AA1AD] hidden md:inline">{f.dimension_id}</span>
        <StatusPill status={f.annotation_status} />
        <button onClick={() => setExpanded(true)} className="text-[11.5px] text-[#3A6FB8] hover:underline">
          Expand
        </button>
      </div>
    );
  }

  // Expanded
  return (
    <div
      className="rounded-lg border border-[#E2E5EA] bg-white"
      style={{ boxShadow: `inset 3px 0 0 ${left}, 0 1px 2px rgba(17,21,27,0.04)` }}
    >
      <div className="px-4 pt-3 pb-2.5 border-b border-[#EEF0F3] flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-mono text-[#9AA1AD] tabular-nums">F{f.id}</span>
        <span className="text-[11.5px] text-[#6B7280]">{f.dimension_id} · {dimensionName}</span>
        <StatusPill status={f.annotation_status} />
        {f.source === "consultant" && (
          <span className="text-[10.5px] uppercase tracking-[0.06em] text-[#264B80] bg-[#EEF3FB] px-1.5 py-0.5 rounded font-medium">
            Custom
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {isEdited && (
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className={`text-[11.5px] px-2 py-1 rounded transition-colors ${showOriginal ? "bg-[#EEF3FB] text-[#264B80]" : "text-[#4B5360] hover:bg-[#EEF0F3]"}`}
            >
              {showOriginal ? "Hide original" : "Show original engine output"}
            </button>
          )}
          <button onClick={() => setExpanded(false)} className="text-[11.5px] text-[#6B7280] hover:text-[#1F242C]">
            Collapse
          </button>
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        {!editing ? (
          <>
            <p className="text-[14px] text-[#1F242C] leading-snug">{f.finding_text}</p>
            {f.recommendation && (
              <p className="text-[13px] text-[#4B5360] leading-relaxed">{f.recommendation}</p>
            )}
            {f.regulatory_risk && (
              <div className="text-[12px] text-[#4B5360] bg-[#F7F8FA] rounded p-2.5 border border-[#EEF0F3]">
                <span className="font-medium text-[#1F242C]">Regulatory risk:</span> {f.regulatory_risk}
              </div>
            )}

            {showOriginal && isEdited && (
              <div className="rounded-md border border-[#EEF0F3] bg-[#F7F8FA] p-3 space-y-2 text-[12px]">
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-[#9AA1AD] font-medium">Engine original</div>
                <div className="text-[#5C2828] font-mono leading-snug">
                  <span className="text-[10px] uppercase mr-2">[{f.engine_severity}]</span>
                  {f.engine_finding_text}
                </div>
                {f.engine_recommendation && (
                  <div className="text-[#6B7280] font-mono leading-snug">{f.engine_recommendation}</div>
                )}
              </div>
            )}

            {f.annotation_rationale && f.annotation_status !== "confirmed" && (
              <div className="text-[11.5px] text-[#6B7280] italic">
                <span className="font-medium not-italic">Rationale:</span> {f.annotation_rationale}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.06em] text-[#9AA1AD] font-medium mb-1.5">
                Severity
              </label>
              <select
                value={draftSeverity}
                onChange={(e) => setDraftSeverity(e.target.value)}
                className="h-8 px-2 rounded border border-[#E2E5EA] text-[12px]"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
                <option value="low">Low</option>
              </select>
            </div>
            <Field label="Finding statement">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={2}
                className={textareaClass}
              />
            </Field>
            <Field label="Recommendation">
              <textarea
                value={draftRec}
                onChange={(e) => setDraftRec(e.target.value)}
                rows={3}
                className={textareaClass}
              />
            </Field>
            <Field label="Regulatory risk">
              <textarea
                value={draftRisk}
                onChange={(e) => setDraftRisk(e.target.value)}
                rows={2}
                className={textareaClass}
              />
            </Field>
            <Field label="Rationale (required)">
              <textarea
                value={draftRationale}
                onChange={(e) => setDraftRationale(e.target.value)}
                rows={2}
                placeholder="Why are you overriding the engine output?"
                className={textareaClass}
              />
            </Field>
          </>
        )}

        {rejectInput !== null && (
          <div className="rounded-md border border-[#EBCBCB] bg-[#F8ECEC] p-3">
            <label className="block text-[11px] uppercase tracking-[0.06em] text-[#8A2A2A] font-medium mb-1.5">
              Reject reason — internal only · feeds the rules library
            </label>
            <textarea
              value={rejectInput}
              onChange={(e) => setRejectInput(e.target.value)}
              rows={2}
              autoFocus
              className={textareaClass}
            />
          </div>
        )}
      </div>

      {!isPublished && (
        <div className="px-4 py-3 border-t border-[#EEF0F3] bg-[#F7F8FA] flex items-center gap-2 rounded-b-lg flex-wrap">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="text-[12px] text-[#6B7280] hover:text-[#1F242C] px-2 py-1">
                Cancel
              </button>
              <span className="ml-auto flex items-center gap-2">
                {draftSeverity !== f.severity &&
                  draftText === f.finding_text &&
                  draftRec === (f.recommendation ?? "") &&
                  draftRisk === (f.regulatory_risk ?? "") ? (
                  <button onClick={saveSeverity} disabled={busy} className={btnPrimary}>
                    Save severity change
                  </button>
                ) : (
                  <button onClick={saveEdits} disabled={busy} className={btnPrimary}>
                    Save edits
                  </button>
                )}
              </span>
            </>
          ) : rejectInput !== null ? (
            <>
              <button onClick={() => setRejectInput(null)} className="text-[12px] text-[#6B7280] hover:text-[#1F242C] px-2 py-1">
                Cancel
              </button>
              <button onClick={reject} disabled={busy} className={btnDanger + " ml-auto"}>
                Reject finding
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} disabled={busy} className={btnSecondary}>
                Edit
              </button>
              <button onClick={() => setRejectInput("")} disabled={busy} className={btnDestructive}>
                Reject…
              </button>
              <button onClick={onApprove} disabled={busy} className={btnPrimary + " ml-auto"}>
                {f.annotation_status === "confirmed" ? "Re-approve" : "Approve as-is"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline UI atoms (kept small to avoid a separate file just for this page)
// ---------------------------------------------------------------------------

function Pill({ tone, children }: { tone: "info" | "success" | "danger" | "muted"; children: React.ReactNode }) {
  const map = {
    info: "bg-[#EEF3FB] text-[#264B80] border-[#D8E3F5]",
    success: "bg-[#EDF6EF] text-[#2C6741] border-[#CFE3D6]",
    danger: "bg-[#F8ECEC] text-[#8A2A2A] border-[#EBCBCB]",
    muted: "bg-[#EEF0F3] text-[#4B5360] border-[#E2E5EA]",
  };
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded text-[11px] font-medium border tabular-nums ${map[tone]}`}>
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: FindingFromApi["annotation_status"] }) {
  const map = {
    unreviewed: { tone: "muted" as const, label: "Needs review" },
    confirmed: { tone: "success" as const, label: "Approved" },
    severity_adjusted: { tone: "info" as const, label: "Severity adjusted" },
    replaced: { tone: "info" as const, label: "Edited" },
    dismissed: { tone: "danger" as const, label: "Rejected" },
  };
  const m = map[status] ?? map.unreviewed;
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.06em] text-[#9AA1AD] font-medium mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const textareaClass =
  "w-full text-[13px] leading-[20px] text-[#1F242C] bg-white px-2.5 py-2 rounded border border-[#E2E5EA] hover:border-[#CBD0D8] focus:border-[#3A6FB8] focus:ring-2 focus:ring-[#3A6FB8]/20 outline-none transition-colors resize-y";

const btnPrimary =
  "inline-flex items-center h-7 px-3 rounded-md text-[12px] font-medium bg-[#3A6FB8] hover:bg-[#2F5C9C] disabled:bg-[#7AA0D8] disabled:cursor-not-allowed text-white transition-colors";
const btnSecondary =
  "inline-flex items-center h-7 px-3 rounded-md text-[12px] font-medium bg-white hover:bg-[#F7F8FA] text-[#343A45] border border-[#E2E5EA] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnDestructive =
  "inline-flex items-center h-7 px-3 rounded-md text-[12px] font-medium bg-white hover:bg-[#F8ECEC] text-[#8A2A2A] border border-[#E2E5EA] hover:border-[#B53A3A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnDanger =
  "inline-flex items-center h-7 px-3 rounded-md text-[12px] font-medium bg-[#B53A3A] hover:bg-[#8A2A2A] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors";
