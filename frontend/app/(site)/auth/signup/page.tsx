"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/lib/api";
import {
  AuthShell,
  ErrorBanner,
  FieldLabel,
  InfoBanner,
  PrimaryButton,
  TextField,
} from "@/components/auth/AuthShell";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await signup({ email, password, name: name || undefined });
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="We'll send a verification link to confirm your email."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[#3A6FB8] hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <ErrorBanner message={error} />
      <InfoBanner message={info} />
      {!info && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextField
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </div>
          <div>
            <FieldLabel>Work email</FieldLabel>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              placeholder="At least 12 characters"
            />
          </div>
          <PrimaryButton disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
