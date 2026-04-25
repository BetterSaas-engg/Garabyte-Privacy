"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "@/lib/api";
import {
  AuthShell,
  ErrorBanner,
  SuccessBanner,
} from "@/components/auth/AuthShell";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No verification token in the link.");
      return;
    }
    verifyEmail(token)
      .then(() => setDone(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Verification failed"));
  }, [token]);

  return (
    <AuthShell
      title="Verify your email"
      footer={
        done ? (
          <Link href="/auth/login" className="text-[#3A6FB8] hover:underline">
            Sign in →
          </Link>
        ) : null
      }
    >
      {!error && !done && (
        <p className="text-[13px] text-[#6B7280]">Verifying your link…</p>
      )}
      <ErrorBanner message={error} />
      <SuccessBanner message={done ? "Your email is verified. You can sign in now." : null} />
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthShell title="Verify your email">Loading…</AuthShell>}>
      <VerifyInner />
    </Suspense>
  );
}
