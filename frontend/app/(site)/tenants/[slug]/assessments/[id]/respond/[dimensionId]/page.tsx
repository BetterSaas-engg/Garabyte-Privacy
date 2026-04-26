"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getAssessment,
  getAssessmentResponses,
  getRules,
  isUnauthorized,
  submitResponses,
  uploadEvidence,
} from "@/lib/api";
import type {
  Assessment,
  Dimension,
  Question,
  ResponseOut,
  RulesLibrary,
} from "@/lib/types";

const MATURITY_LABELS = ["Ad hoc", "Developing", "Defined", "Managed", "Optimized"];
const SCORE_THRESHOLD = 0.6;
const AUTOSAVE_DEBOUNCE_MS = 500;

type SaveState = "idle" | "saving" | "saved" | "error";

interface AnswerState {
  value: number | null;     // 0-4 if answered, null otherwise
  skipped: boolean;
  note: string;
  evidence_url: string;
}

function emptyAnswer(): AnswerState {
  return { value: null, skipped: false, note: "", evidence_url: "" };
}

function fromResponse(r: ResponseOut | undefined): AnswerState {
  if (!r) return emptyAnswer();
  return {
    value: r.value,
    skipped: r.skipped,
    note: r.note ?? "",
    evidence_url: r.evidence_url ?? "",
  };
}

function localStorageKey(assessmentId: number): string {
  return `garabyte:answers:${assessmentId}`;
}

export default function QuestionScreenPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; id: string; dimensionId: string }>();
  const slug = params.slug;
  const assessmentId = Number(params.id);
  const dimensionId = params.dimensionId;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [rules, setRules] = useState<RulesLibrary | null>(null);
  const [answers, setAnswers] = useState<Map<string, AnswerState>>(new Map());
  const [qIndex, setQIndex] = useState(0); // 0-based within the dimension
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});

  const dimension: Dimension | null = useMemo(() => {
    return rules?.dimensions.find((d) => d.id === dimensionId) ?? null;
  }, [rules, dimensionId]);

  const dimIndex = useMemo(() => {
    if (!rules) return -1;
    return rules.dimensions.findIndex((d) => d.id === dimensionId);
  }, [rules, dimensionId]);

  // Load assessment, rules, and saved responses. Then merge with any
  // localStorage backstop in case the user navigated away with pending
  // edits before the autosave fired.
  useEffect(() => {
    if (!Number.isFinite(assessmentId)) {
      setError("Invalid assessment id.");
      return;
    }
    (async () => {
      try {
        const [a, r, rs] = await Promise.all([
          getAssessment(assessmentId),
          getRules(),
          getAssessmentResponses(assessmentId),
        ]);
        setAssessment(a);
        setRules(r);
        if (a.status === "completed") {
          router.replace(`/tenants/${slug}`);
          return;
        }
        const map = new Map<string, AnswerState>();
        rs.forEach((row) => map.set(row.question_id, fromResponse(row)));
        // localStorage backstop -- only overwrite if the local copy is newer
        // (we don't track timestamps, so be conservative: only overlay
        // unsaved entries that don't exist server-side at all).
        try {
          const raw = localStorage.getItem(localStorageKey(assessmentId));
          if (raw) {
            const local = JSON.parse(raw) as Record<string, AnswerState>;
            for (const [qid, state] of Object.entries(local)) {
              if (!map.has(qid)) map.set(qid, state);
            }
          }
        } catch {
          // ignore — localStorage parse failure
        }
        setAnswers(map);
      } catch (e) {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [assessmentId, slug, router]);

  // Persist working state to localStorage on every change (cheap and
  // covers tab refresh / network blips per audit M-low).
  useEffect(() => {
    if (answers.size === 0) return;
    try {
      const obj: Record<string, AnswerState> = {};
      answers.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(localStorageKey(assessmentId), JSON.stringify(obj));
    } catch {
      // quota / disabled — fine, server is still source of truth
    }
  }, [answers, assessmentId]);

  // ---------------------------------------------------------------------
  // Autosave
  // ---------------------------------------------------------------------

  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const saveOne = useCallback(
    async (qid: string, ans: AnswerState) => {
      // Empty/blank state -- nothing to save (and the validator would 422).
      if (ans.value === null && !ans.skipped) return;
      setSaveState((s) => ({ ...s, [qid]: "saving" }));
      try {
        await submitResponses(assessmentId, [
          {
            question_id: qid,
            value: ans.value,
            skipped: ans.skipped,
            skip_reason: ans.skipped ? "deferred" : undefined,
            note: ans.note || undefined,
            evidence_url: ans.evidence_url || undefined,
          },
        ]);
        setSaveState((s) => ({ ...s, [qid]: "saved" }));
      } catch (e) {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
          return;
        }
        setSaveState((s) => ({ ...s, [qid]: "error" }));
      }
    },
    [assessmentId, router],
  );

  const queueSave = useCallback(
    (qid: string, ans: AnswerState) => {
      const existing = debounceRef.current.get(qid);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        debounceRef.current.delete(qid);
        void saveOne(qid, ans);
      }, AUTOSAVE_DEBOUNCE_MS);
      debounceRef.current.set(qid, t);
    },
    [saveOne],
  );

  const flushAll = useCallback(async () => {
    // Cancel debounced timers and immediately save everything that was
    // mid-flight. Used by Back / Save-and-resume / Next button so the
    // user can navigate away with confidence.
    const pending: Promise<void>[] = [];
    debounceRef.current.forEach((timer, qid) => {
      clearTimeout(timer);
      const ans = answers.get(qid);
      if (ans) pending.push(saveOne(qid, ans));
    });
    debounceRef.current.clear();
    await Promise.all(pending);
  }, [answers, saveOne]);

  function updateAnswer(qid: string, mutator: (prev: AnswerState) => AnswerState) {
    setAnswers((prev) => {
      const cur = prev.get(qid) ?? emptyAnswer();
      const next = mutator(cur);
      const out = new Map(prev);
      out.set(qid, next);
      queueSave(qid, next);
      return out;
    });
  }

  // ---------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------

  if (error) {
    return (
      <main className="min-h-[calc(100vh-73px)] px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <Link
            href={`/tenants/${slug}/assessments/${assessmentId}`}
            className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-6"
          >
            ← Back to dashboard
          </Link>
          <div className="rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-4 py-3 text-sm text-garabyte-status-critical">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!assessment || !rules || !dimension || dimension.questions.length === 0) {
    return (
      <main className="min-h-[calc(100vh-73px)] px-6 py-12">
        <div className="max-w-3xl mx-auto animate-pulse">
          <div className="h-6 bg-garabyte-ink-100 rounded w-1/3 mb-4" />
          <div className="h-32 bg-white rounded-xl shadow-soft" />
        </div>
      </main>
    );
  }

  const question: Question = dimension.questions[qIndex];
  const ans = answers.get(question.id) ?? emptyAnswer();
  const dimQuestionsCount = dimension.questions.length;
  const isLastInDim = qIndex === dimQuestionsCount - 1;
  const isFirstInDim = qIndex === 0;

  // Two-grain progress
  const overallTotal = rules.dimensions.reduce((s, d) => s + d.questions.length, 0);
  const overallAnsweredOrSkipped = (() => {
    let n = 0;
    rules.dimensions.forEach((d) => {
      d.questions.forEach((q) => {
        const a = answers.get(q.id);
        if (a && (a.skipped || a.value !== null)) n += 1;
      });
    });
    return n;
  })();
  const dimAnsweredOrSkipped = dimension.questions.filter((q) => {
    const a = answers.get(q.id);
    return a && (a.skipped || a.value !== null);
  }).length;

  // Live dimension score (≥60% threshold to avoid noisy early scores)
  const dimScore = (() => {
    const answered = dimension.questions
      .map((q) => ({ q, a: answers.get(q.id) }))
      .filter(
        (x): x is { q: Question; a: AnswerState } =>
          !!x.a && !x.a.skipped && x.a.value !== null,
      );
    if (answered.length / dimQuestionsCount < SCORE_THRESHOLD) return null;
    const tw = answered.reduce((s, x) => s + x.q.weight, 0);
    if (tw <= 0) return null;
    const ws = answered.reduce((s, x) => s + x.q.weight * (x.a.value as number), 0);
    const score = ws / tw;
    const rounded = Math.max(0, Math.min(4, Math.floor(score + 0.5)));
    return { score, label: MATURITY_LABELS[rounded] };
  })();

  const saveStatus = saveState[question.id] ?? "idle";

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------

  function pickValue(value: number) {
    updateAnswer(question.id, (prev) => ({ ...prev, value, skipped: false }));
  }

  function setNote(note: string) {
    updateAnswer(question.id, (prev) => ({ ...prev, note }));
  }

  function setEvidenceUrl(evidence_url: string) {
    updateAnswer(question.id, (prev) => ({ ...prev, evidence_url }));
  }

  async function onBack() {
    await flushAll();
    if (isFirstInDim) {
      router.push(`/tenants/${slug}/assessments/${assessmentId}`);
    } else {
      setQIndex((i) => i - 1);
    }
  }

  async function onSkip() {
    // Mark skipped, save immediately (don't wait for debounce), advance.
    setAnswers((prev) => {
      const out = new Map(prev);
      out.set(question.id, { value: null, skipped: true, note: ans.note, evidence_url: ans.evidence_url });
      return out;
    });
    await saveOne(question.id, {
      value: null,
      skipped: true,
      note: ans.note,
      evidence_url: ans.evidence_url,
    });
    onAdvance();
  }

  async function onSaveAndResume() {
    await flushAll();
    router.push(`/tenants/${slug}/assessments/${assessmentId}`);
  }

  async function onNext() {
    await flushAll();
    onAdvance();
  }

  function onAdvance() {
    if (!isLastInDim) {
      setQIndex((i) => i + 1);
      return;
    }
    // Last in this dimension — go to next dimension if any, else /review.
    const nextDim = rules?.dimensions[dimIndex + 1];
    if (nextDim) {
      router.push(`/tenants/${slug}/assessments/${assessmentId}/respond/${nextDim.id}`);
    } else {
      router.push(`/tenants/${slug}/assessments/${assessmentId}/review`);
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/tenants/${slug}/assessments/${assessmentId}`}
          className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-4"
        >
          ← Back to dashboard
        </Link>

        {/* Header */}
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-xs font-mono text-garabyte-ink-500 uppercase">
              {dimension.id} · {dimension.name}
            </p>
            <p className="text-xs text-garabyte-ink-500 mt-0.5">
              Question {qIndex + 1} of {dimQuestionsCount} · {overallAnsweredOrSkipped} of {overallTotal} overall
            </p>
          </div>
          {dimScore && (
            <div className="text-right">
              <p className="text-xs text-garabyte-ink-500 mb-0.5">This dimension</p>
              <p className="text-sm font-semibold text-garabyte-primary-800">
                {dimScore.score.toFixed(1)} · {dimScore.label}
              </p>
            </div>
          )}
        </div>

        {/* Two-grain progress: this dimension + overall */}
        <div className="space-y-1.5 mb-8">
          <div className="h-1.5 rounded-full bg-garabyte-ink-100 overflow-hidden">
            <div
              className="h-full bg-garabyte-primary-500 transition-all"
              style={{ width: `${(dimAnsweredOrSkipped / dimQuestionsCount) * 100}%` }}
            />
          </div>
          <div className="h-1 rounded-full bg-garabyte-ink-100/60 overflow-hidden">
            <div
              className="h-full bg-garabyte-primary-500/40 transition-all"
              style={{ width: `${(overallAnsweredOrSkipped / overallTotal) * 100}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-xl shadow-soft border border-garabyte-ink-100 p-7">
          <p className="text-xl text-garabyte-primary-800 leading-snug mb-1.5">
            {question.text}
          </p>
          {question.regulatory_note && (
            <p className="text-xs text-garabyte-ink-500 mb-5">
              Maps to: {question.regulatory_note}
            </p>
          )}
          {!question.regulatory_note && <div className="mb-5" />}

          {/* Options */}
          <div className="space-y-2">
            {question.options.map((opt) => {
              const selected = ans.value === opt.value && !ans.skipped;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => pickValue(opt.value)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
                    selected
                      ? "border-garabyte-primary-500 bg-garabyte-primary-500/5"
                      : "border-garabyte-ink-100 hover:border-garabyte-ink-300 bg-white"
                  }`}
                >
                  <span
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selected ? "border-garabyte-primary-500" : "border-garabyte-ink-300"
                    }`}
                  >
                    {selected && <span className="w-2 h-2 rounded-full bg-garabyte-primary-500" />}
                  </span>
                  <span className="flex-1">
                    <span className="text-xs font-mono text-garabyte-ink-500 mr-2">
                      {opt.value}
                    </span>
                    <span className="text-sm text-garabyte-primary-800">{opt.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Evidence */}
          {question.evidence_prompt && (
            <div className="mt-6">
              <label className="block text-xs uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium mb-1.5">
                Evidence (optional)
                <span
                  className={`ml-2 normal-case tracking-normal ${
                    ans.evidence_url ? "text-garabyte-status-good" : "text-garabyte-status-high"
                  }`}
                >
                  · {ans.evidence_url ? "verified" : "self-reported"}
                </span>
              </label>
              <p className="text-xs text-garabyte-ink-500 mb-2">
                {question.evidence_prompt}
              </p>
              <input
                type="url"
                value={ans.evidence_url}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://link-to-document"
                pattern="^https?://.+"
                maxLength={512}
                className="w-full h-9 px-3 rounded-md text-sm bg-white text-garabyte-ink-900 placeholder:text-garabyte-ink-300 border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none transition-colors"
              />
              <EvidenceUploader
                questionId={question.id}
                assessmentId={assessmentId}
                onUploaded={(serverUrl) => setEvidenceUrl(serverUrl)}
              />
            </div>
          )}

          {/* Note */}
          <div className="mt-5">
            <label className="block text-xs uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium mb-1.5">
              Note (optional)
            </label>
            <textarea
              value={ans.note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Context for this answer (visible to your consultant)"
              className="w-full px-3 py-2 rounded-md text-sm bg-white text-garabyte-ink-900 placeholder:text-garabyte-ink-300 border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none transition-colors resize-y"
            />
          </div>

          {/* Save status */}
          <div className="mt-4 text-xs text-garabyte-ink-500 h-4">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && (
              <span className="text-garabyte-status-critical">
                Save failed — your answer is preserved locally; will retry on next change
              </span>
            )}
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBack}
            className="text-sm px-4 py-2 rounded-md text-garabyte-primary-700 hover:bg-garabyte-cream-100 transition-colors"
          >
            ← {isFirstInDim ? "Back to dashboard" : "Previous"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm px-4 py-2 rounded-md border border-garabyte-ink-100 hover:bg-garabyte-cream-100 text-garabyte-ink-700 transition-colors"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={onSaveAndResume}
              className="text-sm px-4 py-2 rounded-md border border-garabyte-ink-100 hover:bg-garabyte-cream-100 text-garabyte-ink-700 transition-colors"
            >
              Save and resume later
            </button>
            <button
              type="button"
              onClick={onNext}
              className="text-sm px-4 py-2 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600 transition-colors"
            >
              {isLastInDim
                ? dimIndex < (rules?.dimensions.length ?? 0) - 1
                  ? "Next dimension →"
                  : "Review →"
                : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Wraps the file <input> for evidence upload. Looks up the persisted
 * Response.id from the loaded responses so the upload endpoint has a
 * concrete row to attach to. If the answer hasn't been saved yet, the
 * uploader prompts the customer to answer first — we deliberately don't
 * upload-then-create-row because the row tracks the answered_by_id
 * audit pointer.
 */
function EvidenceUploader({
  questionId,
  assessmentId,
  onUploaded,
}: {
  questionId: string;
  assessmentId: number;
  onUploaded: (serverUrl: string) => void;
}) {
  const [responses, setResponses] = useState<ResponseOut[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getAssessmentResponses(assessmentId).then(setResponses).catch(() => undefined);
  }, [assessmentId]);

  const responseId = responses?.find((r) => r.question_id === questionId)?.id;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !responseId) return;
    setBusy(true);
    setErr(null);
    try {
      const ev = await uploadEvidence(responseId, file);
      onUploaded(`/evidence/${ev.id}`);
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mt-2">
      <input
        ref={fileInputRef}
        type="file"
        onChange={onPick}
        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,image/png,image/jpeg,image/gif,image/webp"
        disabled={!responseId || busy}
        className="text-xs"
      />
      <p className="text-[11px] text-garabyte-ink-500 mt-1">
        {!responseId
          ? "Pick an answer above first; the upload attaches to a saved response."
          : busy
            ? "Uploading…"
            : "Or upload a file directly (PDF, Office, image; up to 10 MB)."}
      </p>
      {err && <p className="text-[11px] text-garabyte-status-critical mt-1">{err}</p>}
    </div>
  );
}
