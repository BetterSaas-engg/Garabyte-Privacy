"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createAssessment, getTenant, isUnauthorized } from "@/lib/api";

/**
 * Bridge page: starts a new assessment for the tenant and redirects to the
 * Resume Dashboard for that assessment. Renders briefly while the POST is
 * in flight; on success, the user lands on the dashboard ready to answer.
 *
 * Requires org_admin membership in the tenant -- the backend enforces it
 * (returns 403 otherwise) and we surface a friendly error.
 */
export default function NewAssessmentPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [error, setError] = useState<string | null>(null);
  // useRef so React StrictMode's double-effect doesn't fire two
  // create-assessment requests against the API.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const tenant = await getTenant(slug);
        const label = `${new Date().toLocaleString("en-US", { month: "short", year: "numeric" })} assessment`;
        const assessment = await createAssessment(tenant.id, label);
        router.replace(`/tenants/${slug}/assessments/${assessment.id}`);
      } catch (e) {
        if (isUnauthorized(e)) {
          router.replace("/auth/login");
          return;
        }
        setError(e instanceof Error ? e.message : "Could not start assessment");
      }
    })();
  }, [slug, router]);

  return (
    <main className="min-h-[calc(100vh-73px)] px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/tenants/${slug}`}
          className="text-sm text-garabyte-primary-500 hover:text-garabyte-primary-700 inline-block mb-6"
        >
          ← Back
        </Link>
        {error ? (
          <div className="rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-4 py-3 text-sm text-garabyte-status-critical">
            {error}
          </div>
        ) : (
          <p className="text-sm text-garabyte-ink-500">Starting a new assessment…</p>
        )}
      </div>
    </main>
  );
}
