"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { passwordResetConfirm, passwordResetRequest } from "@/lib/api";
import {
  AuthShell,
  ErrorBanner,
  FieldLabel,
  InfoBanner,
  PrimaryButton,
  TextField,
} from "@/components/auth/AuthShell";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setSubmitting(true);
    try {
      const res = await passwordResetRequest(email);
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      await passwordResetConfirm(token!, newPassword);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setSubmitting(false);
    }
  }

  if (token) {
    return (
      <AuthShell
        title="Set a new password"
        subtitle="Choose a passphrase you can remember. At least 12 characters."
      >
        <ErrorBanner message={error} />
        <form onSubmit={onConfirm} className="space-y-4">
          <div>
            <FieldLabel>New password</FieldLabel>
            <TextField
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={12}
            />
          </div>
          <PrimaryButton disabled={submitting}>
            {submitting ? "Setting…" : "Set new password and sign in"}
          </PrimaryButton>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a reset link if the address is registered."
      footer={
        <span>
          Remembered it?{" "}
          <Link href="/auth/login" className="text-[#3A6FB8] hover:underline">
            Back to sign in
          </Link>
        </span>
      }
    >
      <ErrorBanner message={error} />
      <InfoBanner message={info} />
      {!info && (
        <form onSubmit={onRequest} className="space-y-4">
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
            {submitting ? "Sending…" : "Email me a reset link"}
          </PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}

export default function PasswordResetPage() {
  return (
    <Suspense fallback={<AuthShell title="Reset password">Loading…</AuthShell>}>
      <ResetInner />
    </Suspense>
  );
}
