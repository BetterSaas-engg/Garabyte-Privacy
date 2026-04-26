"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getAssessment,
  getAssessmentResponses,
  getRules,
  isUnauthorized,
  scoreAssessment,
} from "@/lib/api";
import type {
  Assessment,
  Dimension,
  ResponseOut,
  RulesLibrary,
} from "@/lib/types";

type Confidence = "high" | "low" | "none";

interface DimReview {
  dim: Dimension;
  total: number;
  answered: number;
  skipped: number;
  fraction: number;
  confidence: Confidence;
}

function confidenceFor(answered: number, total: number): Confidence {
  if (total === 0) return "none";
  const frac = answered / total;
  if (frac >= 0.8) return "high";
  if (frac >= 0.4) return "low";
  return "none";
}

function localStorageKey(assessmentId: number): string {
  return `garabyte:answers:${assessmentId}`;
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "Confident",
  low: "Low confidence",
  none: "No data",
};

export default function SubmissionReviewPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; id: string }>();
  const slug = params.slug;
  const assessmentId = Number(params.id);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [rules, setRules] = useState<RulesLibrary | null>(null);
  const [responses, setResponses] = useState<ResponseOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setResponses(rs);
        if (a.status === "completed") {
          router.replace(`/tenants/${slug}`);
        }
      } catch (e) {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [assessmentId, slug, router]);

  const responseMap = useMemo(() => {
    const m = new Map<string, ResponseOut>();
    (responses ?? []).forEach((r) => m.set(r.question_id, r));
    return m;
  }, [responses]);

  const reviews = useMemo<DimReview[] | null>(() => {
    if (!rules) return null;
    return rules.dimensions.map((dim) => {
      let answered = 0;
      let skipped = 0;
      for (const q of dim.questions) {
        const r = responseMap.get(q.id);
        if (!r) continue;
        if (r.skipped) skipped += 1;
        else if (r.value !== null) answered += 1;
      }
      const total = dim.questions.length;
      return {
        dim,
        total,
        answered,
        skipped,
        fraction: total > 0 ? answered / total : 0,
        confidence: confidenceFor(answered, total),
      };
    });
  }, [rules, responseMap]);

  const summary = useMemo(() => {
    if (!reviews) return null;
    const total = reviews.reduce((s, r) => s + r.total, 0);
    const totalAnswered = reviews.reduce((s, r) => s + r.answered, 0);
    const counts = { high: 0, low: 0, none: 0 } as Record<Confidence, number>;
    reviews.forEach((r) => { counts[r.confidence] += 1; });
    return { total, totalAnswered, counts };
  }, [reviews]);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await scoreAssessment(assessmentId);
      // Clear localstorage backstop now that the server has the canonical
      // result. (Best-effort -- if it fails, no harm done.)
      try {
        localStorage.removeItem(localStorageKey(assessmentId));
      } catch {
        // ignore
      }
      router.push(`/tenants/${slug}`);
      router.refresh();
    } catch (e) {
      if (isUnauthorized(e)) {
        router.replace("/auth/login");
        return;
      }
      setError(e instanceof Error ? e.message : "Could not submit");
      setSubmitting(false);
    }
  }

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

  if (!assessment || !rules || !reviews || !summary) {
    return (
      <main className="min-h-[calc(100vh-73px)] px-6 py-12">
        <div className="max-w-3xl mx-auto animate-pulse">
          <div className="h-8 bg-garabyte-ink-100 rounded w-1/3 mb-6" />
          <div className="h-64 bg-white rounded-xl shadow-soft" />
        </div>
      </main>
    );
  }

  const allHigh = summary.counts.low === 0 && summary.counts.none === 0;
  const lowConfDimIds = reviews.filter((r) => r.confidence !== "high").map((r) => r.dim.id);
  const canSubmit = summary.totalAnswered > 0;

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/tenants/${slug}/assessments/${assessmentId}`}
          className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-4"
        >
          ← Back to dashboard
        </Link>

        <header className="mb-6">
          <h1 className="text-h1 text-garabyte-primary-800 mb-2">
            {allHigh ? "Ready to submit." : "Ready to submit?"}
          </h1>
          <p className="text-sm text-garabyte-ink-700">
            {summary.totalAnswered} of {summary.total} answered ·{" "}
            <span className="text-garabyte-status-good font-medium">{summary.counts.high} dimensions confident</span>
            {summary.counts.low > 0 && (
              <>
                {" · "}
                <span className="text-garabyte-status-high font-medium">{summary.counts.low} low confidence</span>
              </>
            )}
            {summary.counts.none > 0 && (
              <>
                {" · "}
                <span className="text-garabyte-ink-500 font-medium">{summary.counts.none} with no data</span>
              </>
            )}
          </p>
        </header>

        {/* Per-dimension confidence list */}
        <div className="rounded-xl bg-white shadow-soft border border-garabyte-ink-100 mb-8 divide-y divide-garabyte-ink-100">
          {reviews.map((r) => (
            <DimensionRow key={r.dim.id} review={r} />
          ))}
        </div>

        {/* Three ranked actions */}
        <div className="space-y-3 mb-6">
          {!allHigh && (
            <ActionCard
              recommended
              title="Finish the gaps"
              description={`Roughly ${Math.max(1, Math.ceil((summary.total - summary.totalAnswered) * 0.5))} minutes — gives you a fully confident report.`}
              cta="Continue"
              href={`/tenants/${slug}/assessments/${assessmentId}`}
            />
          )}

          {!allHigh && lowConfDimIds.length > 0 && (
            <ActionCard
              title="Delegate to colleagues"
              description={`Send ${lowConfDimIds.join(", ")} to the right people on your team.`}
              cta="Delegate"
              href="/"
              hint="(Opens the dashboard where you can invite colleagues — a per-dimension delegation flow lands in v2.)"
            />
          )}

          <ActionCard
            destructive={!allHigh}
            title={allHigh ? "Submit and generate the report" : "Submit anyway"}
            description={
              allHigh
                ? "All eight dimensions are confident. The engine will produce a scored report and a prioritized gap list."
                : "Low-confidence dimensions will be flagged in the report. You can re-assess them later and run a new scoring."
            }
            cta={submitting ? "Submitting…" : "Submit"}
            onClick={canSubmit && !submitting ? onSubmit : undefined}
            disabled={!canSubmit || submitting}
          />
        </div>

        {!canSubmit && (
          <p className="text-xs text-garabyte-ink-500 italic">
            Answer at least one question to enable submission.
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-3 py-2 text-sm text-garabyte-status-critical">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}

function DimensionRow({ review }: { review: DimReview }) {
  const dotColor =
    review.confidence === "high"
      ? "bg-garabyte-status-good"
      : review.confidence === "low"
      ? "bg-garabyte-status-high"
      : "bg-garabyte-ink-300";
  const pillClasses =
    review.confidence === "high"
      ? "bg-garabyte-status-good/10 text-garabyte-status-good"
      : review.confidence === "low"
      ? "bg-garabyte-status-high/10 text-garabyte-status-high"
      : "bg-garabyte-ink-100 text-garabyte-ink-500";
  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      <span className="text-xs font-mono text-garabyte-ink-500 uppercase w-8">{review.dim.id}</span>
      <span className="text-sm text-garabyte-primary-800 flex-1 truncate">{review.dim.name}</span>
      <span className="text-xs tabular-nums text-garabyte-ink-500 w-16 text-right">
        {review.answered} of {review.total}
      </span>
      <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded ${pillClasses}`}>
        {CONFIDENCE_LABELS[review.confidence]}
      </span>
    </div>
  );
}

function ActionCard({
  title,
  description,
  cta,
  href,
  onClick,
  recommended,
  destructive,
  disabled,
  hint,
}: {
  title: string;
  description: string;
  cta: string;
  href?: string;
  onClick?: () => void;
  recommended?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const wrapClasses = recommended
    ? "border-garabyte-primary-500 bg-garabyte-primary-500/5"
    : destructive
    ? "border-garabyte-accent-300 bg-garabyte-accent-100/40"
    : "border-garabyte-ink-100 bg-white";

  const buttonClasses = recommended
    ? "bg-garabyte-primary-500 hover:bg-garabyte-primary-600 text-white"
    : destructive
    ? "bg-garabyte-accent-500 hover:bg-garabyte-accent-600 text-white"
    : "bg-white border border-garabyte-ink-100 hover:bg-garabyte-cream-100 text-garabyte-primary-700";

  return (
    <div className={`rounded-xl border p-5 flex items-start gap-4 ${wrapClasses}`}>
      <div className="flex-1 min-w-0">
        {recommended && (
          <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-1">
            Recommended
          </p>
        )}
        <p className="text-base font-semibold text-garabyte-primary-800 mb-1">{title}</p>
        <p className="text-sm text-garabyte-ink-700">{description}</p>
        {hint && <p className="text-xs text-garabyte-ink-500 mt-1.5 italic">{hint}</p>}
      </div>
      {href ? (
        <Link
          href={href}
          className={`text-sm px-4 py-2 rounded-md flex-shrink-0 transition-colors ${buttonClasses}`}
        >
          {cta}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`text-sm px-4 py-2 rounded-md flex-shrink-0 transition-colors ${buttonClasses} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {cta}
        </button>
      )}
    </div>
  );
}
