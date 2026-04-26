"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getAssessment,
  getAssessmentResponses,
  getRules,
  isUnauthorized,
} from "@/lib/api";
import type {
  Assessment,
  Dimension,
  ResponseOut,
  RulesLibrary,
} from "@/lib/types";

// Maturity labels — consistent across dimensions (RulesLibrary.validate
// enforces this on the backend, audit H8). If they ever drift, surface
// from /rules instead.
const MATURITY_LABELS = ["Ad hoc", "Developing", "Defined", "Managed", "Optimized"];

// Below this fraction of answered, we don't show a tentative score on
// the dimension card -- it would be too noisy. Matches the audit C4
// confidence-low threshold.
const SCORE_THRESHOLD = 0.6;

interface DimensionStats {
  dim: Dimension;
  total: number;
  answered: number;
  skipped: number;
  score: number | null;       // null if below SCORE_THRESHOLD
  maturity: string | null;
  // The action verb on the per-card button:
  //   start    — no responses at all
  //   continue — some answered, some untouched
  //   review   — all 5 addressed (answered or skipped)
  action: "start" | "continue" | "review";
}

function computeStats(dim: Dimension, responses: Map<string, ResponseOut>): DimensionStats {
  let answered = 0;
  let skipped = 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const q of dim.questions) {
    const r = responses.get(q.id);
    if (!r) continue;
    if (r.skipped) {
      skipped += 1;
      continue;
    }
    if (r.value !== null) {
      answered += 1;
      weightedSum += q.weight * r.value;
      totalWeight += q.weight;
    }
  }
  const total = dim.questions.length;
  const fractionAnswered = total > 0 ? answered / total : 0;

  let score: number | null = null;
  let maturity: string | null = null;
  if (fractionAnswered >= SCORE_THRESHOLD && totalWeight > 0) {
    score = weightedSum / totalWeight;
    const rounded = Math.max(0, Math.min(4, Math.floor(score + 0.5)));
    maturity = MATURITY_LABELS[rounded];
  }

  let action: DimensionStats["action"];
  if (answered + skipped === 0) action = "start";
  else if (answered + skipped < total) action = "continue";
  else action = "review";

  return { dim, total, answered, skipped, score, maturity, action };
}

function maturityTone(score: number | null): string {
  if (score === null) return "bg-garabyte-ink-100";
  if (score < 1.5) return "bg-garabyte-status-critical";
  if (score < 2.5) return "bg-garabyte-status-high";
  if (score < 3.5) return "bg-garabyte-status-moderate";
  return "bg-garabyte-status-good";
}

export default function ResumeDashboardPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; id: string }>();
  const slug = params.slug;
  const assessmentId = Number(params.id);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [rules, setRules] = useState<RulesLibrary | null>(null);
  const [responses, setResponses] = useState<ResponseOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        // Already submitted? Bounce to the tenant page so the user sees
        // the rendered report instead of the working dashboard.
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

  const stats = useMemo(() => {
    if (!rules) return null;
    return rules.dimensions.map((d) => computeStats(d, responseMap));
  }, [rules, responseMap]);

  const totals = useMemo(() => {
    if (!stats) return null;
    return stats.reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        answered: acc.answered + s.answered,
        skipped: acc.skipped + s.skipped,
      }),
      { total: 0, answered: 0, skipped: 0 },
    );
  }, [stats]);

  if (error) {
    return (
      <main className="min-h-[calc(100vh-73px)] px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <Link href={`/tenants/${slug}`} className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-6">
            ← Back to organization
          </Link>
          <div className="rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-4 py-3 text-sm text-garabyte-status-critical">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!assessment || !rules || !stats || !totals) {
    return (
      <main className="min-h-[calc(100vh-73px)] px-6 py-12">
        <div className="max-w-5xl mx-auto animate-pulse">
          <div className="h-8 bg-garabyte-ink-100 rounded w-1/3 mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-32 bg-white rounded-xl shadow-soft" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  const fractionDone = totals.total > 0 ? (totals.answered + totals.skipped) / totals.total : 0;
  const allAddressed = stats.every((s) => s.action === "review");
  const enoughForSubmit = totals.answered > 0;

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <Link
          href={`/tenants/${slug}`}
          className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-4"
        >
          ← Back to organization
        </Link>

        {/* Header band */}
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-garabyte-primary-500 font-medium mb-2">
            {assessment.label || "Assessment in progress"}
          </p>
          <h1 className="text-h1 text-garabyte-primary-800 mb-3">
            Pick up where you left off.
          </h1>
          <div className="flex items-center gap-6 text-sm text-garabyte-ink-700">
            <span>
              <span className="font-medium text-garabyte-primary-800">{totals.answered}</span>
              {" of "}
              {totals.total} answered
            </span>
            {totals.skipped > 0 && (
              <span>
                <span className="font-medium text-garabyte-primary-800">{totals.skipped}</span>
                {" skipped"}
              </span>
            )}
            <span>
              <span className="font-medium text-garabyte-primary-800">{Math.round(fractionDone * 100)}%</span>
              {" complete"}
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-garabyte-ink-100 overflow-hidden max-w-xl">
            <div
              className="h-full bg-garabyte-primary-500 transition-all"
              style={{ width: `${fractionDone * 100}%` }}
            />
          </div>
        </header>

        {/* 2x4 dimension grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((s) => (
            <DimensionCard
              key={s.dim.id}
              s={s}
              href={
                s.action === "review"
                  ? `/tenants/${slug}/assessments/${assessmentId}/respond/${s.dim.id}`
                  : `/tenants/${slug}/assessments/${assessmentId}/respond/${s.dim.id}`
              }
            />
          ))}
        </div>

        {/* Submit ribbon */}
        <div
          className={`rounded-xl p-5 flex items-center gap-4 flex-wrap ${
            allAddressed
              ? "bg-garabyte-primary-500/5 border border-garabyte-primary-500/20"
              : "bg-garabyte-accent-100 border border-garabyte-accent-300"
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-h3 text-garabyte-primary-800 mb-1">
              {allAddressed ? "Ready to submit" : "Submit anytime"}
            </p>
            <p className="text-sm text-garabyte-ink-700">
              {allAddressed
                ? "All 40 questions are addressed. Generate the scored report."
                : `Submitting now flags any unanswered dimensions as low-confidence in your report. You can keep filling in answers anytime before you submit.`}
            </p>
          </div>
          <Link
            href={`/tenants/${slug}/assessments/${assessmentId}/review`}
            className={`text-sm px-4 py-2 rounded-md transition-colors flex-shrink-0 ${
              !enoughForSubmit
                ? "bg-garabyte-ink-100 text-garabyte-ink-300 cursor-not-allowed pointer-events-none"
                : allAddressed
                ? "bg-garabyte-primary-500 hover:bg-garabyte-primary-600 text-white"
                : "bg-garabyte-accent-500 hover:bg-garabyte-accent-600 text-white"
            }`}
          >
            Review and submit
          </Link>
        </div>
      </div>
    </main>
  );
}

function DimensionCard({ s, href }: { s: DimensionStats; href: string }) {
  const fraction = s.total > 0 ? (s.answered + s.skipped) / s.total : 0;
  const verb = s.action === "start" ? "Start" : s.action === "continue" ? "Continue" : "Review";
  return (
    <Link
      href={href}
      className="block rounded-xl bg-white shadow-soft border border-garabyte-ink-100 p-4 hover:shadow-card transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-mono text-garabyte-ink-500 uppercase">{s.dim.id}</span>
        {s.maturity && (
          <span className="text-[11px] font-medium text-garabyte-primary-700 bg-garabyte-cream-100 px-1.5 py-0.5 rounded">
            {s.maturity}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-garabyte-primary-800 leading-snug mb-3 line-clamp-2 min-h-[2.5em]">
        {s.dim.name}
      </p>
      <div className="h-1 rounded-full bg-garabyte-ink-100 overflow-hidden mb-3">
        <div
          className={`h-full ${maturityTone(s.score)}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-garabyte-ink-500">
          {s.answered} of {s.total}
          {s.skipped > 0 && ` · ${s.skipped} skipped`}
        </span>
        <span className="text-xs font-medium text-garabyte-primary-500">
          {verb} →
        </span>
      </div>
    </Link>
  );
}
