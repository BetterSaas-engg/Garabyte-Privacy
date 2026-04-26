"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import {
  AuthShell,
  ErrorBanner,
  FieldLabel,
  PrimaryButton,
  TextField,
} from "@/components/auth/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your work email and password."
      footer={
        <span className="text-[#6B7280]">
          Garabyte Privacy is invitation-only. If your privacy lead invited you,
          check your email for the sign-in link.
        </span>
      }
    >
      <ErrorBanner message={error} />
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
        <div>
          <FieldLabel>Password</FieldLabel>
          <TextField
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={1}
          />
          <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
            <Link href="/auth/magic" className="text-[#3A6FB8] hover:underline">
              Send me a magic link instead
            </Link>
            <Link href="/auth/password-reset" className="text-[#9AA1AD] hover:text-[#4B5360]">
              Forgot password?
            </Link>
          </div>
        </div>
        <PrimaryButton disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
