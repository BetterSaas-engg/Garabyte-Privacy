// Mock data for the Consultant Console static UI.
// Derived from the design bundle's consultant.jsx. Replace with real API
// reads once the backend has the auth + findings + engagement model
// (audit Phase 3 + Phase 5).

export type ConfidenceKind = "high" | "low" | "none";
export type SeverityKind = "high" | "moderate" | "low";
export type FindingStatusKind = "needs" | "edited" | "approved" | "rejected";
export type EngagementStatus =
  | "progress"
  | "submitted"
  | "review"
  | "publish"
  | "published"
  | "scheduled";

export interface Engagement {
  org: string;
  industry: string;
  hc: number;
  status: EngagementStatus;
  score: number | null;
  low: number | null;
  since: number | null;
  next: string;
  sla: number | null;
  jur: string;
}

export const ENGAGEMENTS: Engagement[] = [
  { org: "Northwind Logistics Inc.",   industry: "Logistics",      hc: 142,  status: "review",     score: 68,   low: 3,    since: 3,    next: "Findings review",         sla: 2,    jur: "CA" },
  { org: "Riverstone Health Network",  industry: "Healthcare",     hc: 1280, status: "review",     score: 54,   low: 5,    since: 5,    next: "Resolve evidence gaps",   sla: 0,    jur: "CA" },
  { org: "Lattice Payments",           industry: "Fintech",        hc: 410,  status: "publish",    score: 81,   low: 1,    since: 8,    next: "Publish report",          sla: -1,   jur: "US" },
  { org: "Kestrel Logistics",          industry: "Logistics",      hc: 78,   status: "submitted",  score: null, low: null, since: 1,    next: "Open initial review",     sla: 4,    jur: "CA" },
  { org: "Foliage SaaS",               industry: "SaaS",           hc: 63,   status: "progress",   score: null, low: null, since: null, next: "—",                       sla: null, jur: "US" },
  { org: "Mariner Insurance Co-op",    industry: "Insurance",      hc: 540,  status: "scheduled",  score: 73,   low: 2,    since: 92,   next: "6-month re-assessment",   sla: 6,    jur: "CA" },
  { org: "Sundial Education Trust",    industry: "Education",      hc: 215,  status: "published",  score: 76,   low: 2,    since: 21,   next: "—",                       sla: null, jur: "CA" },
  { org: "Quartile Manufacturing",     industry: "Manufacturing",  hc: 980,  status: "review",     score: 62,   low: 4,    since: 4,    next: "Findings review",         sla: 1,    jur: "US" },
  { org: "Birchmark Cooperative",      industry: "Retail",         hc: 320,  status: "scheduled",  score: 70,   low: 2,    since: 174,  next: "Annual re-assessment",    sla: 4,    jur: "CA" },
  { org: "Outpost Robotics",           industry: "Manufacturing",  hc: 88,   status: "submitted",  score: null, low: null, since: 0,    next: "Open initial review",     sla: 5,    jur: "US" },
];

export interface Dimension {
  id: string;
  name: string;
  score: number;
  conf: ConfidenceKind;
  findings: number;
}

export const DIMENSIONS: Dimension[] = [
  { id: "d1", name: "Governance & accountability",      score: 82, conf: "high", findings: 1 },
  { id: "d2", name: "Data inventory & mapping",         score: 64, conf: "low",  findings: 3 },
  { id: "d3", name: "Consent & lawful basis",           score: 71, conf: "high", findings: 2 },
  { id: "d4", name: "Individual rights",                score: 78, conf: "high", findings: 1 },
  { id: "d5", name: "Vendor & third-party management",  score: 52, conf: "low",  findings: 4 },
  { id: "d6", name: "Security safeguards",              score: 74, conf: "high", findings: 2 },
  { id: "d7", name: "Cross-border transfer",            score: 48, conf: "low",  findings: 1 },
  { id: "d8", name: "Breach response & accountability", score: 79, conf: "high", findings: 0 },
];

export interface Finding {
  id: string;
  dim: string;
  severity: SeverityKind;
  status: FindingStatusKind;
  statement: string;
  statementOriginal?: string;
  rec: string;
  recOriginal?: string;
  risk: string;
  riskOriginal?: string;
  hours: number;
  expanded?: boolean;
  isCustom?: boolean;
  rejectReason?: string;
}

export const FINDINGS_SEED: Finding[] = [
  {
    id: "D5-F1", dim: "D5 · Vendor & third-party management",
    severity: "high", status: "edited",
    statement: "32% of vendors processing personal data lack a current Data Processing Agreement.",
    statementOriginal: "30%+ of vendors lack DPAs.",
    rec: "Initiate a vendor remediation sprint targeting the 18 untiered vendors flagged in the inventory. Establish a 60-day DPA execution window, escalating to legal for vendors that decline. Block new contracts pending DPA on the procurement form.",
    recOriginal: "Sign DPAs with vendors that don't have them within 60 days.",
    risk: "PIPEDA Principle 8 (Accountability) and Quebec Law 25 art. 18 require formal accountability for transfers to processors. Continued operation without DPAs creates direct exposure in the event of a regulator audit triggered by a vendor breach.",
    riskOriginal: "PIPEDA accountability gap.",
    hours: 14, expanded: true,
  },
  {
    id: "D5-F2", dim: "D5 · Vendor & third-party management",
    severity: "high", status: "needs",
    statement: "No mechanism exists to detect when a vendor changes sub-processors.",
    rec: "Adopt a vendor management tool (Whistic, Vanta Trust, or in-house) that tracks sub-processor manifests and notifies the privacy team on change.",
    risk: "GDPR art. 28(2) explicit consent for sub-processor changes is unenforceable without detection.",
    hours: 8,
  },
  {
    id: "D7-F1", dim: "D7 · Cross-border transfer",
    severity: "high", status: "needs",
    statement: "EU customer data flows to a US data warehouse without a documented transfer mechanism.",
    rec: "Either constrain EU data residency to the existing Frankfurt cluster (operational change) or formalize Standard Contractual Clauses with a documented Transfer Impact Assessment. Decide based on the volume justifying the operational lift.",
    risk: "GDPR ch. V — transfers to third countries without an adequacy decision require an art. 46 mechanism. Schrems II requires a TIA. Direct enforcement risk if a EU regulator audits.",
    hours: 16,
  },
  {
    id: "D2-F1", dim: "D2 · Data inventory & mapping",
    severity: "moderate", status: "approved",
    statement: "Personal data inventory exists in spreadsheet form; 14 systems have not been refreshed in 12+ months.",
    rec: "Migrate to a maintained inventory tool with automated discovery for the 6 highest-volume systems. Establish quarterly review cadence.",
    risk: "Stale inventories degrade incident response timelines, which directly affect breach notification windows under Law 25 (72h) and PIPEDA.",
    hours: 10,
  },
  {
    id: "D2-F2", dim: "D2 · Data inventory & mapping",
    severity: "moderate", status: "needs",
    statement: "Data classification scheme is documented but inconsistently applied (32% of fields unclassified).",
    rec: "Run a classification sprint on the top 10 systems using the existing scheme. Include classification in the definition-of-done for new systems.",
    risk: "Without consistent classification, retention and access controls cannot be enforced reliably.",
    hours: 6,
  },
  {
    id: "D5-F3", dim: "D5 · Vendor & third-party management",
    severity: "moderate", status: "needs",
    statement: "Vendor risk reviews are conducted at onboarding only, not periodically.",
    rec: "Establish annual review cadence for tier-1 vendors and biennial for tier-2.",
    risk: "Vendor posture drift is the leading cause of supply-chain breaches.",
    hours: 4,
  },
  {
    id: "D5-F4", dim: "D5 · Vendor & third-party management",
    severity: "moderate", status: "rejected",
    statement: "No vendor security questionnaire on file.",
    rejectReason: "False positive — Northwind uses a shared questionnaire from their parent organization (verified with Maya Mar 15). Engine didn't pick this up because the file is hosted in a parent-org SharePoint outside the assessment account. Suggest the rules library look for shared-org evidence references in vendor sections.",
    rec: "Adopt a security questionnaire framework (CAIQ-Lite or SIG-Lite) for new vendors.",
    risk: "—",
    hours: 6,
  },
  {
    id: "D3-F1", dim: "D3 · Consent & lawful basis",
    severity: "moderate", status: "needs",
    statement: "Marketing consent capture lacks granular preferences (single opt-in covers all channels).",
    rec: "Decompose consent into channel-specific opt-ins (email, SMS, in-app) at next form revision.",
    risk: "CASL §6 specific consent requirement; Quebec Law 25 prefers granular consent.",
    hours: 5,
  },
  {
    id: "D6-F1", dim: "D6 · Security safeguards",
    severity: "low", status: "needs",
    statement: "Quarterly access reviews are documented but the last review missed the 90-day window by 12 days.",
    rec: "Add a calendar reminder 14 days before quarterly review deadline.",
    risk: "Operational hygiene; no direct regulatory exposure unless pattern persists.",
    hours: 1,
  },
  {
    id: "D1-F1", dim: "D1 · Governance & accountability",
    severity: "low", status: "needs",
    statement: "Privacy training completion at 91% (target 95%); 13 staff overdue.",
    rec: "Direct manager outreach for the overdue 13. Add the privacy training to onboarding checklist.",
    risk: "Pattern, not breach. Watch for trend.",
    hours: 2,
  },
  {
    id: "D4-F1", dim: "D4 · Individual rights",
    severity: "low", status: "approved",
    statement: "DSAR response time average 18 days against 30-day regulatory window — comfortable margin but undocumented runbook.",
    rec: "Document the existing DSAR process so it survives staff turnover.",
    risk: "Continuity risk only; current performance is compliant.",
    hours: 3,
  },
  {
    id: "D6-F2", dim: "D6 · Security safeguards",
    severity: "low", status: "needs",
    statement: "MFA enrolled at 96% on production systems; 4 service accounts use legacy auth.",
    rec: "Migrate the 4 service accounts to modern auth or document compensating controls.",
    risk: "Limited; service accounts have restricted scope per access review.",
    hours: 2,
  },
  {
    id: "D5-F5", dim: "D5 · Vendor & third-party management",
    severity: "low", status: "needs",
    statement: "Onboarding flow doesn't capture vendor location of processing.",
    rec: "Add 'processing location' field to vendor intake form.",
    risk: "Cross-border exposure under-detected if vendor location data is missing.",
    hours: 1,
  },
  {
    id: "D8-F1", dim: "D8 · Breach response", severity: "low", status: "approved",
    statement: "Breach response runbook exists, last tabletop exercise 13 months ago.",
    rec: "Schedule next tabletop within Q2.",
    risk: "Operational readiness drift over time.",
    hours: 2,
  },
];

export interface Response {
  id: string;
  q: string;
  a: string;
  who: string;
  evidence: number;
  conf: ConfidenceKind;
  flags: string[];
}

export const RESPONSES: Response[] = [
  { id: "D2-Q1",  q: "Do you maintain a current inventory of personal data systems?",                a: "Yes — spreadsheet, last refreshed Q4 2024. 14 systems flagged as 12+ months stale.",            who: "Daniel Cho",  evidence: 1, conf: "high", flags: [] },
  { id: "D2-Q2",  q: "What proportion of personal-data fields are classified per your scheme?",      a: "Approximately 68%. Top-10 systems classified; tail systems patchy.",                              who: "Daniel Cho",  evidence: 0, conf: "low",  flags: ["evidence missing"] },
  { id: "D2-Q3",  q: "Cross-border flows from Canada — list jurisdictions and lawful basis.",        a: "US (warehouse), EU (Frankfurt cluster). Lawful basis documented for US contracts; EU residency assumed but not documented.", who: "Daniel Cho",  evidence: 2, conf: "high", flags: [] },
  { id: "D2-Q4",  q: "How frequently is the inventory refreshed?",                                   a: "Quarterly target; last full review 5 months ago.",                                                who: "Daniel Cho",  evidence: 0, conf: "low",  flags: ["evidence missing", "low confidence"] },
  { id: "D2-Q5",  q: "Define your data classification scheme.",                                      a: "Public / Internal / Confidential / Restricted. Documented in Wiki, last revision 2023.",          who: "Daniel Cho",  evidence: 1, conf: "high", flags: [] },
  { id: "D2-Q6",  q: "Are personal data flows mapped end-to-end?",                                   a: "Partially — top 3 systems mapped, tail systems not.",                                              who: "Daniel Cho",  evidence: 0, conf: "low",  flags: ["evidence missing"] },
  { id: "D2-Q7",  q: "Who is responsible for inventory maintenance?",                                a: "IT director (myself) with privacy lead oversight.",                                                who: "Daniel Cho",  evidence: 0, conf: "high", flags: [] },
  { id: "D2-Q8",  q: "What automated discovery tooling do you use?",                                  a: "None. Manual updates from system owners.",                                                         who: "Daniel Cho",  evidence: 0, conf: "high", flags: [] },
  { id: "D2-Q9",  q: "Retention schedules — who owns and how often reviewed?",                       a: "Legal owns; reviewed annually in Q1.",                                                            who: "Hans Olsen",  evidence: 1, conf: "high", flags: [] },
  { id: "D2-Q10", q: "Are deletion requests fulfilled across all systems including backups?",       a: "Production yes; backups deleted per 90-day rolling schedule.",                                    who: "Daniel Cho",  evidence: 1, conf: "high", flags: [] },
  { id: "D2-Q11", q: "Do you anonymize data used for analytics?",                                    a: "Pseudonymized for product analytics; full PII for finance reporting.",                            who: "Daniel Cho",  evidence: 0, conf: "low",  flags: ["low confidence"] },
  { id: "D2-Q12", q: "Are inventory changes captured in a change log?",                              a: "No formal log; ad-hoc edits to the spreadsheet.",                                                  who: "Daniel Cho",  evidence: 0, conf: "high", flags: [] },
  { id: "D2-Q13", q: "What systems are out of scope and why?",                                       a: "Email archives (legal hold scope), HR records (separate ITAR-style controls).",                   who: "Daniel Cho",  evidence: 1, conf: "high", flags: [] },
  { id: "D2-Q14", q: "Who has read access to the inventory itself?",                                 a: "IT, Privacy, Legal. ~12 named individuals.",                                                       who: "Daniel Cho",  evidence: 0, conf: "high", flags: [] },
];

export interface EvidenceFile {
  name: string;
  dim: string;
  type: "PDF" | "XLSX" | "DOCX" | "CSV";
  size: string;
  uploader: string;
  uploaded: string;
  reviewed: boolean;
  notes: string;
}

export const EVIDENCE: EvidenceFile[] = [
  { name: "Privacy Policy v3.2.pdf",        dim: "D1-Q3", type: "PDF",  size: "412 KB", uploader: "Maya Reyes",     uploaded: "Mar 11", reviewed: true,  notes: "Verified against published version on northwindlogistics.ca." },
  { name: "Data Inventory Q4 2024.xlsx",    dim: "D2-Q1", type: "XLSX", size: "1.4 MB", uploader: "Daniel Cho",     uploaded: "Mar 12", reviewed: true,  notes: "Spot-checked 12 systems; classifications match wiki." },
  { name: "Classification Scheme.docx",     dim: "D2-Q5", type: "DOCX", size: "84 KB",  uploader: "Daniel Cho",     uploaded: "Mar 12", reviewed: true,  notes: "" },
  { name: "Vendor List - tier1.csv",        dim: "D5-Q2", type: "CSV",  size: "22 KB",  uploader: "Priya Banerjee", uploaded: "Mar 12", reviewed: false, notes: "" },
  { name: "DPA - AcmeShip.pdf",             dim: "D5-Q4", type: "PDF",  size: "612 KB", uploader: "Priya Banerjee", uploaded: "Mar 13", reviewed: false, notes: "" },
  { name: "DPA - Stripe (signed).pdf",      dim: "D5-Q4", type: "PDF",  size: "508 KB", uploader: "Priya Banerjee", uploaded: "Mar 13", reviewed: true,  notes: "Standard Stripe DPA — current version." },
  { name: "DSAR Log 2024.xlsx",             dim: "D4-Q2", type: "XLSX", size: "98 KB",  uploader: "Hans Olsen",     uploaded: "Mar 13", reviewed: false, notes: "" },
  { name: "Quarterly Access Review Q1.pdf", dim: "D6-Q3", type: "PDF",  size: "1.1 MB", uploader: "Daniel Cho",     uploaded: "Mar 14", reviewed: true,  notes: "" },
  { name: "Breach Runbook v2.pdf",          dim: "D8-Q1", type: "PDF",  size: "248 KB", uploader: "Maya Reyes",     uploaded: "Mar 14", reviewed: true,  notes: "Tabletop log included." },
];

export type HistoryKind =
  | "submission" | "system" | "consultant" | "edit"
  | "review" | "reject" | "add" | "customer" | "publish";

export interface HistoryEntry {
  when: string;
  actor: string;
  kind: HistoryKind;
  text: string;
  ctx: string;
}

export const HISTORY: HistoryEntry[] = [
  { when: "Mar 14, 09:14", actor: "Maya Reyes (org admin)", kind: "submission", text: "Submitted assessment", ctx: "96 of 96 questions answered, 9 evidence files attached" },
  { when: "Mar 14, 09:18", actor: "System",                  kind: "system",     text: "Engine generated 14 findings", ctx: "Compute: 4h 51m. Rules library v2024.11" },
  { when: "Mar 14, 14:02", actor: "Jordan Taylor",           kind: "consultant", text: "Opened initial review", ctx: "Assigned consultant" },
  { when: "Mar 14, 16:30", actor: "Jordan Taylor",           kind: "edit",       text: "Edited finding D2-F1 (data inventory)", ctx: "Recommendation expanded · severity unchanged" },
  { when: "Mar 14, 16:45", actor: "Jordan Taylor",           kind: "edit",       text: "Edited finding D5-F1 (vendor DPAs)", ctx: "Severity raised moderate → high · recommendation expanded · regulatory risk rewritten" },
  { when: "Mar 14, 16:58", actor: "Jordan Taylor",           kind: "review",     text: "Marked 2 evidence files reviewed", ctx: "Privacy Policy v3.2.pdf, Data Inventory Q4 2024.xlsx" },
  { when: "Mar 15, 09:10", actor: "Jordan Taylor",           kind: "reject",     text: "Rejected finding D5-F4 (vendor questionnaire)", ctx: "Reason: false positive — parent-org questionnaire (logged for rules library)" },
  { when: "Mar 15, 09:22", actor: "Jordan Taylor",           kind: "add",        text: "Added custom finding D5-F6 (vendor escalation SPOC)", ctx: "Severity moderate · 4 hours estimated" },
  { when: "Mar 15, 09:40", actor: "Jordan Taylor",           kind: "review",     text: "Approved 5 findings as-is", ctx: "D2-F1, D4-F1, D8-F1, D6-F1, D3-F1" },
  { when: "Mar 15, 11:05", actor: "Maya Reyes",              kind: "customer",   text: "Asked: 'Can we discuss D5-F1 before publication?'", ctx: "Comment thread on engagement" },
  { when: "Mar 15, 11:30", actor: "Jordan Taylor",           kind: "consultant", text: "Replied · scheduled call for Mar 18", ctx: "" },
];

export const DIFFS: Record<string, { field: string; before: string; after: string }[]> = {
  "Edited finding D2-F1 (data inventory)": [
    { field: "Recommendation", before: "Migrate to a maintained inventory tool.", after: "Migrate to a maintained inventory tool with automated discovery for the 6 highest-volume systems. Establish quarterly review cadence." },
  ],
  "Edited finding D5-F1 (vendor DPAs)": [
    { field: "Severity",        before: "moderate", after: "high" },
    { field: "Statement",       before: "30%+ of vendors lack DPAs.", after: "32% of vendors processing personal data lack a current Data Processing Agreement." },
    { field: "Recommendation",  before: "Source DPAs from the top 12 vendors by data volume.", after: "Run a 60-day vendor remediation sprint targeting the 12 highest-volume vendors first. Use the standard DPA template (legal has approved one). Track in vendor management tool. Escalate non-signers after 30 days." },
    { field: "Regulatory risk", before: "Sub-processor obligations under PIPEDA may be unmet.", after: "Under PIPEDA, accountability for personal information transferred to third parties remains with the organization. Without DPAs, Northwind cannot demonstrate the contractual safeguards Section 4.1.3 expects, exposing it in the event of a vendor incident." },
  ],
  "Rejected finding D5-F4 (vendor questionnaire)": [
    { field: "Reject reason", before: "(none — finding active)", after: "False positive — Northwind uses a shared questionnaire from their parent organization (verified with Maya Mar 15). Engine didn't pick this up because the file is hosted in a parent-org system. Logged for the rules library to handle inherited-questionnaire patterns." },
  ],
  "Added custom finding D5-F6 (vendor escalation SPOC)": [
    { field: "Statement", before: "(custom — added by consultant)", after: "No documented single-point-of-contact for vendor escalations; engine missed this because the dimension didn't include an explicit question." },
    { field: "Severity",  before: "(none)", after: "moderate" },
  ],
};

export const TEAM = [
  { name: "Maya Reyes",    role: "Privacy lead · org admin",    initials: "MR", color: { bg: "#E2E8EE", fg: "#2F4A66" }, ans: 38 },
  { name: "Daniel Cho",    role: "IT director · contributor",   initials: "DC", color: { bg: "#DCE5E4", fg: "#36504D" }, ans: 14 },
  { name: "Priya Banerjee",role: "Procurement · contributor",   initials: "PB", color: { bg: "#EAE3DA", fg: "#5C4A33" }, ans: 22 },
  { name: "Hans Olsen",    role: "Legal · contributor",         initials: "HO", color: { bg: "#E2E1E8", fg: "#3F3D52" }, ans: 22 },
];

export const ACTIVITY = [
  { who: "Customer", text: "Maya Reyes submitted the assessment", when: "3d ago", tone: "info" },
  { who: "System",   text: "Engine generated 14 findings (5h compute)", when: "3d ago", tone: "muted" },
  { who: "You",      text: "Opened initial review", when: "2d ago", tone: "muted" },
  { who: "You",      text: "Edited finding D2-F1 (data inventory completeness)", when: "2d ago", tone: "info" },
  { who: "You",      text: "Marked 2 evidence files reviewed", when: "yesterday", tone: "muted" },
];
