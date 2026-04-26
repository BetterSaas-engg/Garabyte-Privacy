/**
 * TypeScript types matching the backend API response shapes.
 * Keep in sync with backend/app/schemas/*.py if you change either side.
 */

// ---- Tenants ----

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  sector: "utility" | "healthcare" | "telecom" | "other";
  jurisdiction: string;
  employee_count: number | null;
  is_demo: number;
  created_at: string;
}

export interface TenantCreate {
  slug: string;
  name: string;
  sector: "utility" | "healthcare" | "telecom" | "other";
  jurisdiction?: string;
  employee_count?: number;
}

export interface TenantHistoryItem {
  assessment_id: number;
  label: string | null;
  overall_score: number | null;
  overall_maturity: string | null;
  completed_at: string | null;
}

// ---- Assessments ----

export interface Assessment {
  id: number;
  tenant_id: number;
  label: string | null;
  status: "in_progress" | "completed";
  overall_score: number | null;
  overall_maturity: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface ResponseSubmit {
  question_id: string;
  // null only when skipped is true (audit M21)
  value: number | null;
  skipped?: boolean;
  skip_reason?: string;
  note?: string;
  evidence_url?: string;
}

export interface ResponseOut {
  question_id: string;
  value: number | null;
  skipped: boolean;
  skip_reason: string | null;
  note: string | null;
  evidence_url: string | null;
  answered_at: string | null;
}

export interface BulkResponsesResult {
  created: number;
  updated: number;
}

// ---- Scoring Result ----

export interface DimensionScore {
  dimension_id: string;
  dimension_name: string;
  score: number;
  maturity_label: string;
  weight: number;
  question_count: number;
  answered_count: number;
  // Backend now returns these (audit C4, M14, H9). Optional on the type
  // for any older stored result_json blobs that pre-date the change.
  confidence?: "high" | "low" | "none";
  evidence_coverage?: number;
}

export interface GapFinding {
  dimension_id: string;
  dimension_name: string;
  severity: "critical" | "high" | "moderate" | "low";
  finding: string;
  recommendation: string;
  regulatory_risk: string | null;
  typical_consulting_hours: number | null;
  upsell_hook: string | null;
  score: number;
}

export interface AssessmentScoreResult {
  overall_score: number;
  overall_maturity_label: string;
  dimension_scores: DimensionScore[];
  gaps: GapFinding[];
  // Versioning + provenance fields added in Phase 2 (audit M18). Optional
  // for the same back-compat reason as DimensionScore.
  schema_version?: number;
  rules_version?: string;
  assessed_at?: string;
  // Fraction of dimensions with usable signal (audit C4).
  coverage?: number;
}

export interface AssessmentResultOut {
  assessment: Assessment;
  result: AssessmentScoreResult;
}

// ---- Rules library ----

export interface QuestionOption {
  value: number;
  label: string;
}

export interface Question {
  id: string;
  text: string;
  weight: number;
  options: QuestionOption[];
  evidence_prompt: string | null;
  regulatory_note: string | null;
}

export interface Dimension {
  id: string;
  name: string;
  description: string;
  weight: number;
  questions: Question[];
}

export interface RulesLibrary {
  dimensions: Dimension[];
}

// ---- Health ----

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
  dimensions_loaded: number;
  total_questions: number;
}
