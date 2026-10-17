export type Action = 'CLEAR' | 'REQUEST_VERIFICATION' | 'ESCALATE'

export interface AlertSummary {
  alert_id: string
  customer_id: string
  created_at: string
  status: string
  headline: string
  attempted_amount: number
  currency: string
}

export interface Transaction {
  transaction_id: string
  timestamp: string
  amount: number
  currency: string
  city: string
  country: string
  device_id: string
  beneficiary_id: string | null
  status: string
}

export interface AlertDetail extends AlertSummary {
  transactions: Transaction[]
}

export interface EvidenceItem {
  evidence_id: string
  category: string
  statement: string
  value: string | number | boolean
  source: string
  severity: string
}

export interface PolicyMatch {
  policy_id: string
  title: string
  excerpt: string
  matched_terms: string[]
}

export interface Hypothesis {
  name: string
  explanation: string
  supporting_evidence_ids: string[]
  contradicting_evidence_ids: string[]
  missing_evidence: string[]
}

/** Optional 2.0 fields. Rendered only when supplied by the investigation API. */
export interface CheckableCondition {
  condition: string
  checkable_facts: string[]
  evidence_ids?: string[]
  check_id?: string
}

export interface AlternativeAction {
  action: string
  rationale: string
  rejection_reason: string
}

export interface InvestigationCheck {
  check_id: string
  title: string
  status: 'AVAILABLE' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  rank: number
  expected_information_gain: number
  investigation_cost: number
  customer_friction: number
  ranking_reason?: string
  result?: string
  evidence_ids?: string[]
}

export interface AssessmentSnapshot {
  recorded_at: string
  primary_hypothesis: string
  alternative_hypotheses: string[]
  remaining_uncertainties: string[]
  recommended_action: Action
  next_best_action: string
}

export interface AuditTrailEvent {
  event_id: string
  occurred_at: string
  event_type: string
  description: string
  actor?: string
  evidence_ids?: string[]
  check_id?: string
}

export interface Analysis {
  summary: string
  primary_hypothesis: Hypothesis
  alternative_hypotheses: Hypothesis[]
  counterfactual: string
  recommended_action: Action
  recommended_reason: string
  next_best_action: string
  policy_basis: string[]
  flips_to_legitimate?: CheckableCondition[]
  flips_to_fraud?: CheckableCondition[]
  alternatives_considered?: AlternativeAction[]
}

export interface Investigation {
  investigation_id: string
  alert: AlertDetail
  evidence: EvidenceItem[]
  policy_matches: PolicyMatch[]
  analysis: Analysis
  model_used: string
  ai_mode: string
  ranked_checks?: InvestigationCheck[]
  assessment_history?: AssessmentSnapshot[]
  audit_trail?: AuditTrailEvent[]
}

export interface AnalystDecision {
  investigation_id: string
  alert_id: string
  action: Action
  rationale: string
  analyst: string
  decided_at: string
}
