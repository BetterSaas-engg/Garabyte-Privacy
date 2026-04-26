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
  jurisdiction_codes: string[] | null;
  employee_count: number | null;
  is_demo: number;
  created_at: string;
}

export interface TenantCreate {
  slug: string;
  name: string;
  sector: "utility" | "healthcare" | "telecom" | "other";
  jurisdiction?: string;
  jurisdiction_codes?: string[];
  employee_count?: number;
}

// ISO-style jurisdiction codes the platform recognizes today.
// Keep this in sync with backend/app/services/jurisdictions.py
// KNOWN_JURISDICTION_CODES.
export const JURISDICTION_CODES: { code: string; label: string }[] = [
  { code: "CA",     label: "Canada (federal)" },
  { code: "CA-ON",  label: "Ontario" },
  { code: "CA-QC",  label: "Quebec" },
  { code: "CA-BC",  label: "British Columbia" },
  { code: "CA-AB",  label: "Alberta" },
  { code: "EU",     label: "European Union" },
  { code: "US",     label: "United States (federal)" },
  { code: "US-CA",  label: "California" },
  { code: "US-NY",  label: "New York" },
  { code: "UK",     label: "United Kingdom" },
];

export interface TenantHistoryItem {
  assessment_id: number;
  label: string | null;
  overall_score: number | null;
  overall_maturity: string | null;
  completed_at: string | null;
  published_at: string | null;
}

// Phase 5 — finding + annotation types

export type AnnotationStatus =
  | "unreviewed"
  | "confirmed"
  | "severity_adjusted"
  | "replaced"
  | "dismissed";

export interface FindingFromApi {
  id: number;
  assessment_id: number;
  dimension_id: string;
  finding_template_id: string | null;

  // Effective (post-annotation) values — what the customer sees.
  severity: string;
  finding_text: string;
  recommendation: string | null;
  regulatory_risk: string | null;
  typical_consulting_hours: number | null;
  upsell_hook: string | null;

  // Engine layer for the consultant diff view.
  engine_severity: string;
  engine_finding_text: string;
  engine_recommendation: string | null;
  engine_regulatory_risk: string | null;
  engine_hours: number | null;

  source: "engine" | "consultant";
  score: number | null;

  annotation_status: AnnotationStatus;
  annotation_rationale: string | null;
  annotation_consultant_id: number | null;
  annotation_at: string | null;
}

export interface AnnotationCreateBody {
  status: Exclude<AnnotationStatus, "unreviewed">;
  new_severity?: string;
  new_finding_text?: string;
  new_recommendation?: string;
  new_regulatory_risk?: string;
  new_hours?: number;
  rationale?: string;
}

export interface AnnotationFromApi {
  id: number;
  finding_id: number;
  consultant_id: number | null;
  status: string;
  new_severity: string | null;
  new_finding_text: string | null;
  new_recommendation: string | null;
  new_regulatory_risk: string | null;
  new_hours: number | null;
  rationale: string | null;
  created_at: string;
}

export interface CustomFindingCreateBody {
  dimension_id: string;
  severity: string;
  finding_text: string;
  recommendation?: string;
  regulatory_risk?: string;
  typical_consulting_hours?: number;
}

export interface PublishCreateBody {
  cover_note?: string;
}

export interface PublicationFromApi {
  id: number;
  assessment_id: number;
  published_by_id: number | null;
  published_at: string;
  cover_note: string | null;
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
  // Phase 5: present iff the consultant has published the report.
  // Until set, customer-facing surfaces should show "Awaiting consultant
  // review" instead of the rendered findings.
  published_at: string | null;
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
  // Phase 9: attribution
  answered_by_id: number | null;
  answered_by_email: string | null;
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
