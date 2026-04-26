"use client";

import { useEffect, useState } from "react";
import { createInvitation } from "@/lib/api";
import type { AuthMembership } from "@/lib/api";

// Dimension names match the rules library YAMLs. If the rules evolve, fetch
// from /rules instead of hardcoding -- but the IDs (d1..d8) are immutable
// (audit H11), so only labels would drift.
const DIMENSIONS = [
  { id: "d1", name: "Governance & accountability" },
  { id: "d2", name: "Data inventory & mapping" },
  { id: "d3", name: "Consent & notice" },
  { id: "d4", name: "Individual rights handling" },
  { id: "d5", name: "Vendor & third-party management" },
  { id: "d6", name: "Breach response readiness" },
  { id: "d7", name: "Training & awareness" },
  { id: "d8", name: "Privacy by design & AI governance" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  memberships: AuthMembership[];
  isGarabyteAdmin: boolean;
}

export function InviteModal({ open, onClose, memberships, isGarabyteAdmin }: Props) {
  // Org options: the user can invite into any org where they're org_admin.
  // Garabyte admins can pick any org the user knows about (their memberships
  // -- listing every tenant in the system would require a separate endpoint).
  const orgOptions = memberships.filter(
    (m) => m.role === "org_admin" || m.role === "garabyte_admin",
  );

  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState<number | null>(null);
  const [role, setRole] = useState("section_contributor");
  const [dimensionIds, setDimensionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successFor, setSuccessFor] = useState<string | null>(null);

  // Initialize org_id once we have options
  useEffect(() => {
    if (open && orgId === null && orgOptions.length > 0) {
      setOrgId(orgOptions[0].org_id);
    }
  }, [open, orgId, orgOptions]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("section_contributor");
      setDimensionIds([]);
      setError(null);
      setSuccessFor(null);
      setSubmitting(false);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggleDim(id: string) {
    setDimensionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (orgId === null) {
      setError("Pick an organization.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createInvitation({
        email,
        org_id: orgId,
        role,
        dimension_ids: role === "section_contributor" && dimensionIds.length > 0 ? dimensionIds : undefined,
      });
      setSuccessFor(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setSubmitting(false);
    }
  }

  if (orgOptions.length === 0) {
    return (
      <Backdrop onClose={onClose}>
        <h2 className="text-h3 text-garabyte-primary-800 mb-3">Invite a colleague</h2>
        <p className="text-sm text-garabyte-ink-700">
          You don&apos;t have admin access to any organization, so you can&apos;t issue invitations from here.
          Ask your org admin (or Garabyte admin) to invite you with the <code className="text-xs">org_admin</code> role first.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-md border border-garabyte-ink-100 hover:bg-garabyte-cream-100"
          >
            Close
          </button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      <h2 className="text-h3 text-garabyte-primary-800 mb-1">Invite a colleague</h2>
      <p className="text-sm text-garabyte-ink-500 mb-5">
        They&apos;ll get an email with a sign-in link bound to a specific organization and role.
      </p>

      {successFor ? (
        <div>
          <div className="rounded-md bg-garabyte-status-good/10 border border-garabyte-status-good/20 px-3 py-2.5 text-sm text-garabyte-status-good mb-2">
            Invitation sent to <span className="font-medium">{successFor}</span>.
          </div>
          <p className="text-xs text-garabyte-ink-500 leading-relaxed mb-5">
            In production, the recipient gets an email with an acceptance link. In dev, the link is printed in the
            backend (uvicorn) terminal — check there to copy/paste the URL into a browser.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setSuccessFor(null); setEmail(""); }}
              className="text-sm px-4 py-2 rounded-md border border-garabyte-ink-100 hover:bg-garabyte-cream-100"
            >
              Send another
            </button>
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-garabyte-status-critical/10 border border-garabyte-status-critical/20 px-3 py-2 text-sm text-garabyte-status-critical">
              {error}
            </div>
          )}

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <Label>Organization</Label>
            <select
              value={orgId ?? ""}
              onChange={(e) => setOrgId(Number(e.target.value))}
              className={selectClass}
            >
              {orgOptions.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {m.org_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={selectClass}
            >
              <option value="section_contributor">Section contributor — answers questions in assigned dimensions</option>
              <option value="org_viewer">Viewer — read-only on the published report</option>
              {isGarabyteAdmin && (
                <>
                  <option value="org_admin">Organization admin — full access</option>
                  <option value="consultant">Consultant — Garabyte-side reviewer</option>
                </>
              )}
            </select>
          </div>

          {role === "section_contributor" && (
            <div>
              <Label>Dimensions assigned (optional)</Label>
              <p className="text-xs text-garabyte-ink-500 mb-2">
                Leave empty to assign later. Section contributors can only see and edit dimensions explicitly assigned to them (R&P C5).
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {DIMENSIONS.map((d) => {
                  const sel = dimensionIds.includes(d.id);
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => toggleDim(d.id)}
                      className={`text-left text-xs px-2.5 py-2 rounded-md border transition-colors ${
                        sel
                          ? "bg-garabyte-primary-500/10 border-garabyte-primary-500 text-garabyte-primary-800"
                          : "bg-white border-garabyte-ink-100 text-garabyte-ink-700 hover:border-garabyte-ink-300"
                      }`}
                    >
                      <span className="font-mono text-[10px] text-garabyte-ink-500 mr-1.5">{d.id}</span>
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-md border border-garabyte-ink-100 hover:bg-garabyte-cream-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-2 rounded-md bg-garabyte-primary-500 text-white hover:bg-garabyte-primary-600 disabled:bg-garabyte-primary-300 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send invitation"}
            </button>
          </div>
        </form>
      )}
    </Backdrop>
  );
}

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center px-4 pt-24"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-card border border-garabyte-ink-100 max-w-md w-full p-6">
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs uppercase tracking-[0.06em] text-garabyte-ink-500 font-medium mb-1.5">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-9 px-3 rounded-md text-sm bg-white text-garabyte-ink-900 placeholder:text-garabyte-ink-300 border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none transition-colors"
    />
  );
}

const selectClass =
  "w-full h-9 px-3 pr-9 rounded-md text-sm bg-white text-garabyte-ink-900 border border-garabyte-ink-100 hover:border-garabyte-ink-300 focus:border-garabyte-primary-500 focus:ring-2 focus:ring-garabyte-primary-500/20 outline-none appearance-none transition-colors";
