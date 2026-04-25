/**
 * API client — every frontend call to the backend goes through here.
 *
 * Design principles:
 * - One function per endpoint, typed input and output
 * - Centralized error handling
 * - Base URL from env; works in dev and production unchanged
 *
 * Usage:
 *   import { getTenants } from "@/lib/api";
 *   const tenants = await getTenants();
 */

import type {
  Tenant,
  TenantCreate,
  TenantHistoryItem,
  Assessment,
  ResponseSubmit,
  BulkResponsesResult,
  AssessmentResultOut,
  RulesLibrary,
  HealthResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

/** Internal helper — does the fetch, handles errors consistently. */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    // credentials:"include" sends the gp_session httpOnly cookie cross-origin.
    // Required because the frontend (Vercel) and backend (Railway) live on
    // different domains in production.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const err = await response.json();
      detail = err.detail ?? detail;
    } catch {
      // response had no JSON body; keep statusText
    }
    const err = new Error(`API ${response.status}: ${detail}`) as ApiError;
    err.status = response.status;
    throw err;
  }

  // 204 No Content (logout) — return undefined; callers shouldn't read .json()
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return response.json() as Promise<T>;
}

// Error type carrying the HTTP status, so callers can react to 401 etc.
export interface ApiError extends Error {
  status?: number;
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof Error && (err as ApiError).status === 401;
}

// ---- Health ----

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
}

// ---- Rules library ----

export function getRules(): Promise<RulesLibrary> {
  return apiRequest<RulesLibrary>("/rules");
}

// ---- Tenants ----

export function getTenants(): Promise<Tenant[]> {
  return apiRequest<Tenant[]>("/tenants");
}

export function getTenant(slug: string): Promise<Tenant> {
  return apiRequest<Tenant>(`/tenants/${slug}`);
}

export function createTenant(payload: TenantCreate): Promise<Tenant> {
  return apiRequest<Tenant>("/tenants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTenantHistory(slug: string): Promise<TenantHistoryItem[]> {
  return apiRequest<TenantHistoryItem[]>(`/tenants/${slug}/history`);
}

// ---- Assessments ----

export function createAssessment(
  tenantId: number,
  label?: string,
): Promise<Assessment> {
  return apiRequest<Assessment>(`/tenants/${tenantId}/assessments`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function getAssessment(id: number): Promise<Assessment> {
  return apiRequest<Assessment>(`/assessments/${id}`);
}

export function submitResponses(
  assessmentId: number,
  responses: ResponseSubmit[],
): Promise<BulkResponsesResult> {
  return apiRequest<BulkResponsesResult>(
    `/assessments/${assessmentId}/responses`,
    {
      method: "POST",
      body: JSON.stringify({ responses }),
    },
  );
}

export function scoreAssessment(
  assessmentId: number,
): Promise<AssessmentResultOut> {
  return apiRequest<AssessmentResultOut>(
    `/assessments/${assessmentId}/score`,
    { method: "POST" },
  );
}

export function getAssessmentResult(
  assessmentId: number,
): Promise<AssessmentResultOut> {
  return apiRequest<AssessmentResultOut>(
    `/assessments/${assessmentId}/result`,
  );
}

// ---- Auth ----

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  email_verified: boolean;
  created_at: string;
}

export interface AuthMembership {
  org_id: number;
  org_slug: string;
  org_name: string;
  role: string;
  dimension_ids: string[] | null;
}

export interface WhoAmI {
  user: AuthUser;
  memberships: AuthMembership[];
}

export interface InvitationPreview {
  email: string;
  org_name: string;
  org_slug: string;
  role: string;
  dimension_ids: string[] | null;
}

export function signup(payload: { email: string; password: string; name?: string }) {
  return apiRequest<{ email: string; message: string }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyEmail(token: string) {
  return apiRequest<AuthUser>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function whoami(): Promise<WhoAmI> {
  return apiRequest<WhoAmI>("/auth/me");
}

export function magicRequest(email: string) {
  return apiRequest<{ message: string }>("/auth/magic/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function magicConsume(token: string) {
  return apiRequest<AuthUser>("/auth/magic/consume", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function passwordResetRequest(email: string) {
  return apiRequest<{ message: string }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function passwordResetConfirm(token: string, newPassword: string) {
  return apiRequest<AuthUser>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export function previewInvitation(token: string) {
  return apiRequest<InvitationPreview>(
    `/auth/invitations/preview?token=${encodeURIComponent(token)}`,
  );
}

export function acceptInvitation(payload: {
  token: string;
  name?: string;
  password?: string;
}) {
  return apiRequest<AuthUser>("/auth/invitations/accept", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
