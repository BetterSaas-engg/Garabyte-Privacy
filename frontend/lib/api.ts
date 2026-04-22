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
    throw new Error(`API ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
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
