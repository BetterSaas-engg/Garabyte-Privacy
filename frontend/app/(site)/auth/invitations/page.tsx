"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvitation, previewInvitation } from "@/lib/api";
import type { InvitationPreview } from "@/lib/api";
import {
  AuthShell,
  ErrorBanner,
  FieldLabel,
  PrimaryButton,
  TextField,
} from "@/components/auth/AuthShell";

function InvitationInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewError("No invitation token in the link.");
      return;
    }
    previewInvitation(token)
      .then(setPreview)
      .catch((err) => setPreviewError(err instanceof Error ? err.message : "Invalid invitation"));
  }, [token]);

  async function onAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await acceptInvitation({
        token: token!,
        name: name || undefined,
        password: password || undefined,
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invitation");
      setSubmitting(false);
    }
  }

  if (previewError) {
    return (
      <AuthShell title="Invitation">
        <ErrorBanner message={previewError} />
      </AuthShell>
    );
  }

  if (!preview) {
    return (
      <AuthShell title="Invitation">
        <p className="text-[13px] text-[#6B7280]">Checking invitation…</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`You're invited to ${preview.org_name}`}
      subtitle={`Role: ${preview.role}${preview.dimension_ids?.length ? ` · Dimensions: ${preview.dimension_ids.join(", ")}` : ""}`}
    >
      <p className="text-[12.5px] text-[#6B7280] mb-5">
        Set a password to accept the invitation. The invitation is bound to{" "}
        <span className="text-[#1F242C] font-medium">{preview.email}</span>.
      </p>
      <ErrorBanner message={error} />
      <form onSubmit={onAccept} className="space-y-4">
        <div>
          <FieldLabel>Name (optional)</FieldLabel>
          <TextField
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
          />
        </div>
        <div>
          <FieldLabel>Password</FieldLabel>
          <TextField
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            placeholder="At least 12 characters (skip if you already have an account)"
          />
        </div>
        <PrimaryButton disabled={submitting}>
          {submitting ? "Accepting…" : `Accept and join ${preview.org_name}`}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}

export default function InvitationPage() {
  return (
    <Suspense fallback={<AuthShell title="Invitation">Loading…</AuthShell>}>
      <InvitationInner />
    </Suspense>
  );
}
