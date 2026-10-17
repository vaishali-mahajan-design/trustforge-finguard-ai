export type Action = 'CLEAR' | 'REQUEST_VERIFICATION' | 'ESCALATE';

export interface AlertSummary {
  alert_id: string;
  customer_id: string;
  created_at: string;
  status: string;
  headline: string;
  attempted_amount: number;
  currency: string;
}

export interface Transaction {
  transaction_id: string;
  timestamp: string;
  amount: number;
  currency: string;
  city: string;
  country: string;
  device_id: string;
  beneficiary_id: string | null;
  status: string;
}

export interface AlertDetail extends AlertSummary {
  transactions: Transaction[];
}

export interface EvidenceItem {
  evidence_id: string;
  category: string;
  statement: string;
  value: string | number | boolean;
  source: string;
  severity: 'high' | 'medium' | 'low' | string;
}

export interface PolicyMatch {
  policy_id: string;
  title: string;
  excerpt: string;
  matched_terms: string[];
}

export interface Hypothesis {
  name: string;
  explanation: string;
  supporting_evidence_ids: string[];
  contradicting_evidence_ids: string[];
  missing_evidence: string[];
}

export interface InvestigationAnalysis {
  summary: string;
  primary_hypothesis: Hypothesis;
  alternative_hypotheses: Hypothesis[];
  counterfactual: string;
  recommended_action: Action;
  recommended_reason: string;
  next_best_action: string;
  policy_basis: string[];
}

export interface InvestigationResponse {
  investigation_id: string;
  alert: AlertDetail;
  evidence: EvidenceItem[];
  policy_matches: PolicyMatch[];
  analysis: InvestigationAnalysis;
  model_used: string;
  ai_mode: string;
}

export interface AnalystDecisionRequest {
  action: Action;
  rationale: string;
  analyst: string;
}

export interface AnalystDecision extends AnalystDecisionRequest {
  investigation_id: string;
  alert_id: string;
  decided_at: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  ai_mode: string;
}
