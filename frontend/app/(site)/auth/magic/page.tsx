"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { magicConsume, magicRequest } from "@/lib/api";
import {
  AuthShell,
  ErrorBanner,
  FieldLabel,
  InfoBanner,
  PrimaryButton,
  TextField,
} from "@/components/auth/AuthShell";

function MagicInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  // Token-present mode = consume on mount.
  const [consuming, setConsuming] = useState(!!token);
  const [consumeError, setConsumeError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    magicConsume(token)
      .then(() => {
        router.push("/");
        router.refresh();
      })
      .catch((err) => {
        setConsumeError(err instanceof Error ? err.message : "Sign-in link invalid");
        setConsuming(false);
      });
  }, [token, router]);

  // Request-mode state.
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await magicRequest(email);
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send magic link");
    } finally {
      setSubmitting(false);
    }
  }

  if (token) {
    return (
      <AuthShell title="Signing you in…">
        {consuming && <p className="text-[13px] text-[#6B7280]">Verifying your sign-in link…</p>}
        <ErrorBanner message={consumeError} />
        {consumeError && (
          <p className="text-[12.5px] text-[#6B7280] mt-3">
            <Link href="/auth/magic" className="text-[#3A6FB8] hover:underline">
              Request a new link
            </Link>
          </p>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in with a magic link"
      subtitle="We'll email you a one-click link. No password needed."
      footer={
        <span>
          Prefer a password?{" "}
          <Link href="/auth/login" className="text-[#3A6FB8] hover:underline">
            Sign in with password
          </Link>
        </span>
      }
    >
      <ErrorBanner message={error} />
      <InfoBanner message={info} />
      {!info && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextField
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <PrimaryButton disabled={submitting}>
            {submitting ? "Sending…" : "Email me a sign-in link"}
          </PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}

export default function MagicPage() {
  return (
    <Suspense fallback={<AuthShell title="Magic link">Loading…</AuthShell>}>
      <MagicInner />
    </Suspense>
  );
}
