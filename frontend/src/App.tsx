import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, BrainCircuit, Check, CheckCircle2,
  ChevronRight, CircleAlert, Clock3, Download, FileCheck2, FileSearch2,
  Fingerprint, Globe2, Layers3, LockKeyhole, RefreshCw, Search, Share2, Shield,
  ShieldAlert, ShieldCheck, Sparkles, UserCheck, Wallet, X,
} from 'lucide-react';
import { api } from './api/client';
import type {
  Action, AlertDetail, AlertSummary, AnalystDecision, EvidenceItem,
  Hypothesis, InvestigationResponse, Transaction,
} from './api/types';
import EvidenceGraph from './components/EvidenceGraph';

type Tab = 'overview' | 'transactions' | 'graph' | 'policies';
type QueueFilter = 'all' | 'open' | 'reviewed';

const actionLabels: Record<Action, string> = {
  CLEAR: 'Clear alert',
  REQUEST_VERIFICATION: 'Request verification',
  ESCALATE: 'Escalate case',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ActionBadge({ action }: { action: Action }) {
  return <span className={`action-badge action-${action.toLowerCase()}`}>{actionLabels[action]}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`severity severity-${severity.toLowerCase()}`}><span className="severity-dot" />{titleCase(severity)}</span>;
}

function EmptyPanel({ onInvestigate, loading, alert }: { onInvestigate: () => void; loading: boolean; alert: AlertSummary }) {
  return (
    <div className="empty-investigation">
      <div className="empty-illustration"><FileSearch2 size={32} strokeWidth={1.5} /><span className="empty-sparkle"><Sparkles size={16} /></span></div>
      <span className="eyebrow">Ready for investigation</span>
      <h3>Turn this alert into an evidence-backed decision.</h3>
      <p>FinGuard gathers deterministic signals, retrieves relevant policies, and asks Gemini to challenge competing explanations before suggesting a next action.</p>
      <div className="empty-flow"><span><Fingerprint size={14} /> Evidence</span><ChevronRight size={14} /><span><BrainCircuit size={14} /> AI reasoning</span><ChevronRight size={14} /><span><UserCheck size={14} /> Analyst</span></div>
      <button type="button" className="button button-primary" onClick={onInvestigate} disabled={loading}>
        {loading ? <RefreshCw size={17} className="spin" /> : <Sparkles size={17} />}
        {loading ? 'Investigating with Gemini…' : `Investigate ${alert.alert_id}`}
        {!loading && <ArrowRight size={16} />}
      </button>
      <small>Uses synthetic case data. AI recommendations do not execute decisions.</small>
    </div>
  );
}

function HypothesisCard({ hypothesis, primary }: { hypothesis: Hypothesis; primary?: boolean }) {
  return (
    <article className={`hypothesis-card ${primary ? 'primary-hypothesis' : ''}`}>
      <div className="hypothesis-heading">
        <div className={`hypothesis-icon ${primary ? 'primary' : ''}`}>{primary ? <ShieldAlert size={19} /> : <Layers3 size={19} />}</div>
        <div><span className="eyebrow">{primary ? 'Primary hypothesis' : 'Alternative explanation'}</span><h4>{hypothesis.name}</h4></div>
      </div>
      <p>{hypothesis.explanation}</p>
      <div className="hypothesis-metadata">
        <span>Supporting evidence</span>
        <div className="evidence-refs">{hypothesis.supporting_evidence_ids.length ? hypothesis.supporting_evidence_ids.map((id) => <span key={id}>{id}</span>) : <em>None cited</em>}</div>
      </div>
      {hypothesis.contradicting_evidence_ids.length > 0 && <div className="hypothesis-metadata"><span>Contradicting evidence</span><div className="evidence-refs contradicting">{hypothesis.contradicting_evidence_ids.map((id) => <span key={id}>{id}</span>)}</div></div>}
      {hypothesis.missing_evidence.length > 0 && <div className="missing-evidence"><CircleAlert size={15} /><span>Still needed: {hypothesis.missing_evidence.join('; ')}</span></div>}
    </article>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <article className="evidence-card">
      <div className="evidence-card-top"><span className="evidence-id">{item.evidence_id}</span><SeverityBadge severity={item.severity} /></div>
      <h4>{titleCase(item.category)}</h4>
      <p>{item.statement}</p>
      <div className="evidence-source"><FileCheck2 size={13} /> {item.source.replace(/_/g, ' ')}</div>
    </article>
  );
}

function Transactions({ transactions }: { transactions: Transaction[] }) {
  const approved = transactions.filter((t) => t.status === 'APPROVED').reduce((sum, t) => sum + t.amount, 0);
  const blocked = transactions.filter((t) => t.status === 'BLOCKED').reduce((sum, t) => sum + t.amount, 0);
  const currency = transactions[0]?.currency ?? 'INR';
  return (
    <div className="tab-body">
      <div className="transaction-summary">
        <div><span className="stat-caption">Approved transaction value</span><strong>{formatMoney(approved, currency)}</strong><small>Sum of approved transaction events</small></div>
        <div><span className="stat-caption">Blocked attempt value</span><strong>{formatMoney(blocked, currency)}</strong><small>Not counted as completed exposure</small></div>
        <div><span className="stat-caption">Recorded events</span><strong>{transactions.length}</strong><small>Includes non-payment events</small></div>
      </div>
      <div className="section-heading"><div><span className="eyebrow">Activity timeline</span><h3>Transaction and account events</h3></div></div>
      <div className="table-scroll">
        <table className="transaction-table"><thead><tr><th>Time</th><th>Transaction</th><th>Location / device</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{transactions.map((txn) => <tr key={txn.transaction_id}>
            <td>{formatTime(txn.timestamp)}</td>
            <td><strong>{txn.transaction_id}</strong>{txn.beneficiary_id && <small>{txn.beneficiary_id}</small>}</td>
            <td>{txn.city}, {txn.country}<small>{txn.device_id}</small></td>
            <td className="money-cell">{formatMoney(txn.amount, txn.currency)}</td>
            <td><span className={`tx-status tx-${txn.status.toLowerCase()}`}>{titleCase(txn.status)}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="disclaimer">Beneficiary-added events are account activity, not completed payments. Amounts are displayed as provided in the synthetic case data.</p>
    </div>
  );
}

function downloadReport(report: InvestigationResponse): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `finguard-${report.alert.alert_id}-${report.investigation_id}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [investigations, setInvestigations] = useState<Record<string, InvestigationResponse>>({});
  const [decisions, setDecisions] = useState<Record<string, AnalystDecision>>({});
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [tab, setTab] = useState<Tab>('overview');
  const [analyst, setAnalyst] = useState('demo-analyst');
  const [action, setAction] = useState<Action>('REQUEST_VERIFICATION');
  const [rationale, setRationale] = useState('');
  const [showDecisionForm, setShowDecisionForm] = useState(false);

  async function loadAlerts() {
    setLoadingAlerts(true);
    setError(null);
    try {
      const result = await api.alerts();
      setAlerts(result);
      setSelectedId((previous) => result.some((alert) => alert.alert_id === previous) ? previous : result[0]?.alert_id ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load alerts.');
    } finally {
      setLoadingAlerts(false);
    }
  }

  useEffect(() => { void loadAlerts(); }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let active = true;
    setDetail(null);
    setLoadingDetail(true);
    setError(null);
    setTab('overview');
    setShowDecisionForm(false);
    setRationale('');
    setAction(investigations[selectedId]?.analysis.recommended_action ?? 'REQUEST_VERIFICATION');
    api.alert(selectedId)
      .then((result) => { if (active) setDetail(result); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Unable to load alert.'); })
      .finally(() => { if (active) setLoadingDetail(false); });
    return () => { active = false; };
    // Intentionally refresh only when the selected alert changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = alerts.find((alert) => alert.alert_id === selectedId);
  const investigation = investigations[selectedId];
  const decision = decisions[selectedId];
  const visibleAlerts = useMemo(() => alerts.filter((alert) => {
    const matchesSearch = `${alert.alert_id} ${alert.headline} ${alert.customer_id}`.toLowerCase().includes(search.toLowerCase());
    const reviewed = Boolean(decisions[alert.alert_id]);
    return matchesSearch && (filter === 'all' || (filter === 'reviewed' ? reviewed : !reviewed));
  }), [alerts, search, filter, decisions]);

  async function investigate() {
    if (!selectedId || investigating) return;
    const alertId = selectedId;
    setInvestigating(true);
    setError(null);
    try {
      const report = await api.investigate(alertId);
      setInvestigations((previous) => ({ ...previous, [alertId]: report }));
      setDecisions((previous) => { const updated = { ...previous }; delete updated[alertId]; return updated; });
      if (alertId === selectedRef.current) {
        setAction(report.analysis.recommended_action);
        setRationale('');
        setTab('overview');
        setShowDecisionForm(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Investigation failed.');
    } finally {
      setInvestigating(false);
    }
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!investigation || submitting || !analyst.trim() || rationale.trim().length < 3) return;
    const alertId = selectedId;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await api.decide(investigation.investigation_id, { action, analyst: analyst.trim(), rationale: rationale.trim() });
      setDecisions((previous) => ({ ...previous, [alertId]: saved }));
      setShowDecisionForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record decision.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={24} strokeWidth={2.1} /></div><div><strong>FinGuard <span>AI</span></strong><small>by TrustForge</small></div></div>
        <div className="sidebar-label">WORKSPACE</div>
        <div className="sidebar-nav"><div className="nav-active"><Layers3 size={18} /> Investigation center <span>{alerts.length || '—'}</span></div></div>
        <div className="sidebar-label sidebar-label-lower">WORKFLOW</div>
        <div className="workflow-list">
          <div><span className="workflow-number">01</span><span>Detect &amp; triage</span><Check size={15} /></div>
          <div><span className="workflow-number">02</span><span>Analyze evidence</span><BrainCircuit size={15} /></div>
          <div><span className="workflow-number">03</span><span>Human decision</span><UserCheck size={15} /></div>
        </div>
        <div className="sidebar-bottom"><div className="privacy-icon"><LockKeyhole size={17} /></div><div><strong>Safe by design</strong><p>Synthetic demo data only. Analyst retains control.</p></div></div>
      </aside>

      <div className="main-area">
        <header className="topbar"><div className="breadcrumbs">Workspace <ChevronRight size={14} /> <strong>Investigation center</strong></div><div className="topbar-right"><span className="demo-pill"><span /> Prototype environment</span><span className="avatar">TF</span></div></header>
        <main className="content">
          <div className="page-heading"><div><div className="eyebrow page-eyebrow"><span className="eyebrow-dot" /> INTELLIGENT FRAUD OPERATIONS</div><h1>Investigation center<span className="heading-period">.</span></h1><p>From suspicious signals to decisions you can defend.</p></div><div className="page-heading-actions"><button type="button" className="button button-outline" onClick={() => void loadAlerts()} disabled={loadingAlerts}><RefreshCw size={16} className={loadingAlerts ? 'spin' : ''} /> Refresh alerts</button></div></div>

          <div className="hero"><div className="hero-copy"><span className="hero-label"><Sparkles size={14} /> EVIDENCE-FIRST INTELLIGENCE</span><h2>Every alert has a story.<br /><em>Find the truth behind it.</em></h2><p>Deterministic evidence. Competing hypotheses. Human judgment. Powered by Gemini on Vertex AI.</p></div><div className="hero-graphic" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-core"><Shield size={53} strokeWidth={1.2} /><Sparkles size={20} className="hero-core-star" /></div><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /></div></div>

          <section className="metric-grid" aria-label="Workspace metrics">
            <div className="metric-card"><div className="metric-top"><span>Total demo alerts</span><div className="metric-icon blue"><Activity size={19} /></div></div><strong>{alerts.length}</strong><small>Loaded from the FinGuard API</small></div>
            <div className="metric-card"><div className="metric-top"><span>Investigations run</span><div className="metric-icon violet"><BrainCircuit size={19} /></div></div><strong>{Object.keys(investigations).length}</strong><small>This browser session</small></div>
            <div className="metric-card"><div className="metric-top"><span>Analyst decisions</span><div className="metric-icon green"><UserCheck size={19} /></div></div><strong>{Object.keys(decisions).length}</strong><small>Recorded in this session</small></div>
            <div className="metric-card"><div className="metric-top"><span>Awaiting decision</span><div className="metric-icon amber"><Clock3 size={19} /></div></div><strong>{Math.max(0, alerts.length - Object.keys(decisions).length)}</strong><small>Among loaded demo alerts</small></div>
          </section>

          {error && <div className="error-banner" role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError(null)}><X size={16} /></button></div>}

          <div className="workspace-grid">
            <section className="queue-panel" aria-label="Alert queue"><div className="panel-heading"><div><span className="eyebrow">CASE INBOX</span><h2>Alert queue <span className="count-chip">{alerts.length}</span></h2></div><div className="queue-live"><span /> API data</div></div>
              <label className="search-box"><Search size={17} /><input aria-label="Search alerts" placeholder="Search alert or customer…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <div className="queue-filters" role="group" aria-label="Filter alerts"><button type="button" className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button><button type="button" className={filter === 'open' ? 'selected' : ''} onClick={() => setFilter('open')}>To review</button><button type="button" className={filter === 'reviewed' ? 'selected' : ''} onClick={() => setFilter('reviewed')}>Decided</button></div>
              <div className="queue-items">
                {loadingAlerts ? <div className="queue-loading"><RefreshCw size={20} className="spin" /> Loading alerts…</div> : visibleAlerts.length === 0 ? <div className="queue-loading">No alerts match this filter.</div> : visibleAlerts.map((alert) => {
                  const report = investigations[alert.alert_id];
                  const saved = decisions[alert.alert_id];
                  return <button type="button" key={alert.alert_id} className={`queue-item ${selectedId === alert.alert_id ? 'active' : ''}`} onClick={() => setSelectedId(alert.alert_id)} aria-pressed={selectedId === alert.alert_id}>
                    <div className="queue-item-top"><span className="alert-id"><span className="alert-indicator" /> {alert.alert_id}</span><span className="queue-date">{formatDate(alert.created_at).split(',')[0]}</span></div>
                    <strong className="queue-title">{alert.headline}</strong><span className="queue-customer">{alert.customer_id} · {alert.status}</span>
                    <div className="queue-item-bottom"><strong>{formatMoney(alert.attempted_amount, alert.currency)}</strong>{saved ? <span className="queue-tag done"><CheckCircle2 size={12} /> Decided</span> : report ? <span className="queue-tag analyzed"><BrainCircuit size={12} /> Analyzed</span> : <span className="queue-tag pending"><Clock3 size={12} /> Pending</span>}</div>
                    {selectedId === alert.alert_id && <span className="queue-active-line" />}
                  </button>;
                })}
              </div>
              <div className="queue-footer"><LockKeyhole size={14} /> Synthetic data · Not connected to banking systems</div>
            </section>

            <section className="report-panel" aria-label="Investigation report">
              {!selected ? <div className="report-placeholder">{loadingAlerts ? 'Loading investigation workspace…' : 'Select an alert to begin.'}</div> : <>
                <div className="report-header"><div className="report-heading-left"><span className="eyebrow">CASE WORKSPACE <span className="eyebrow-divider">/</span> {selected.alert_id}</span><h2>{selected.headline}</h2><div className="report-meta"><span><Wallet size={14} /> {formatMoney(selected.attempted_amount, selected.currency)} alert amount</span><span><Clock3 size={14} /> {formatDate(selected.created_at)}</span><span><Layers3 size={14} /> {detail?.transactions.length ?? "…"} events</span></div></div><div className="report-actions">{investigation && <button type="button" className="icon-button" title="Download investigation JSON" aria-label="Download investigation JSON" onClick={() => downloadReport(investigation)}><Download size={18} /></button>}<span className="open-badge">{selected.status}</span></div></div>
                {investigation && <div className="report-tabs" role="tablist" aria-label="Investigation views"><button type="button" role="tab" aria-selected={tab === 'overview'} className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button><button type="button" role="tab" aria-selected={tab === 'transactions'} className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Transactions <span>{investigation.alert.transactions.length}</span></button><button type="button" role="tab" aria-selected={tab === 'graph'} className={tab === 'graph' ? 'active' : ''} onClick={() => setTab('graph')}><Share2 size={13} /> Case graph</button><button type="button" role="tab" aria-selected={tab === 'policies'} className={tab === 'policies' ? 'active' : ''} onClick={() => setTab('policies')}>Policies <span>{investigation.policy_matches.length}</span></button></div>}
                {loadingDetail && !investigation ? <div className="report-placeholder"><RefreshCw size={23} className="spin" /> Loading case details…</div> : !investigation ? <EmptyPanel alert={selected} loading={investigating} onInvestigate={() => void investigate()} /> : <>
                  {tab === 'overview' && <div className="tab-body">
                    <div className="ai-status"><div className="ai-status-left"><div className="ai-status-icon"><BrainCircuit size={21} /></div><div><strong>AI investigation complete</strong><span>{investigation.ai_mode === 'vertex-ai' ? 'Live Gemini analysis via Vertex AI' : 'Mock analysis · demonstration only'} · {investigation.model_used}</span></div></div><button type="button" className="text-button" onClick={() => void investigate()} disabled={investigating}><RefreshCw size={14} className={investigating ? 'spin' : ''} /> {investigating ? 'Analyzing…' : 'Run again'}</button></div>
                    <div className="recommendation-card"><div className="recommendation-top"><span className="eyebrow"><Sparkles size={14} /> AI RECOMMENDATION</span><span className="recommendation-human"><UserCheck size={14} /> Human approval required</span></div><div className="recommendation-main"><div><ActionBadge action={investigation.analysis.recommended_action} /><h3>{investigation.analysis.next_best_action}</h3><p>{investigation.analysis.recommended_reason}</p></div><div className="recommendation-symbol"><ShieldCheck size={36} /></div></div></div>
                    <div className="section-heading"><div><span className="eyebrow">THE INVESTIGATION</span><h3>What the evidence tells us</h3></div><span className="section-count">{investigation.evidence.length} signals</span></div>
                    <p className="analysis-summary">{investigation.analysis.summary}</p>
                    <div className="evidence-grid">{investigation.evidence.map((item) => <EvidenceCard key={item.evidence_id} item={item} />)}</div>
                    <div className="section-heading"><div><span className="eyebrow">CHALLENGE THE ASSUMPTIONS</span><h3>Competing hypotheses</h3></div></div>
                    <div className="hypotheses"><HypothesisCard hypothesis={investigation.analysis.primary_hypothesis} primary />{investigation.analysis.alternative_hypotheses.map((hypothesis, index) => <HypothesisCard key={`${hypothesis.name}-${index}`} hypothesis={hypothesis} />)}</div>
                    <div className="counterfactual-card"><div className="counterfactual-icon"><Sparkles size={20} /></div><div><span className="eyebrow">COUNTERFACTUAL REASONING</span><h3>What would change this assessment?</h3><p>{investigation.analysis.counterfactual}</p></div></div>
                    <div className="policy-footnote"><FileCheck2 size={16} /><span>Grounded in {investigation.analysis.policy_basis.length ? investigation.analysis.policy_basis.join(' · ') : 'available policy context'}</span><button type="button" onClick={() => setTab('policies')}>View policies <ArrowUpRight size={14} /></button></div>
                  </div>}
                  {tab === 'transactions' && <Transactions transactions={investigation.alert.transactions} />}
                  {tab === 'graph' && <EvidenceGraph report={investigation} />}
                  {tab === 'policies' && <div className="tab-body"><div className="section-heading"><div><span className="eyebrow">RETRIEVED GUIDANCE</span><h3>Policy references</h3></div><span className="section-count">{investigation.policy_matches.length} matches</span></div><p className="analysis-summary">These excerpts are from the prototype's synthetic policy library, not live financial regulations.</p><div className="policy-list">{investigation.policy_matches.map((policy) => <article className="policy-card" key={policy.policy_id}><div className="policy-heading"><span className="policy-id">{policy.policy_id}</span><FileCheck2 size={18} /></div><h4>{policy.title}</h4><p>{policy.excerpt}</p><div className="policy-terms">{policy.matched_terms.map((term) => <span key={term}>{term}</span>)}</div></article>)}</div></div>}
                  <div className="decision-section"><div className="decision-section-heading"><div><span className="eyebrow">FINAL CONTROL</span><h3>Human analyst decision</h3><p>AI recommends. Your analyst decides.</p></div><div className="human-control-icon"><UserCheck size={22} /></div></div>
                    {decision ? <div className="decision-success"><div className="success-icon"><CheckCircle2 size={24} /></div><div><strong>Decision recorded successfully</strong><div className="success-action"><ActionBadge action={decision.action} /> <span>by {decision.analyst} · {formatDate(decision.decided_at)}</span></div><p>{decision.rationale}</p><small>Recorded in the demo backend's memory; not a persistent case closure.</small></div></div> : showDecisionForm ? <form className="decision-form" onSubmit={(event) => void submitDecision(event)}><div className="form-row"><label>Analyst identifier<input required value={analyst} onChange={(event) => setAnalyst(event.target.value)} placeholder="demo-analyst" /></label><label>Decision<select value={action} onChange={(event) => setAction(event.target.value as Action)}><option value="CLEAR">Clear alert</option><option value="REQUEST_VERIFICATION">Request verification</option><option value="ESCALATE">Escalate case</option></select></label></div><label>Decision rationale<textarea required minLength={3} maxLength={1000} rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Explain the evidence and policy basis for your decision…" /></label><div className="form-actions"><button type="button" className="button button-outline" onClick={() => setShowDecisionForm(false)} disabled={submitting}>Cancel</button><button type="submit" className="button button-primary" disabled={submitting || !analyst.trim() || rationale.trim().length < 3}>{submitting ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}{submitting ? 'Recording…' : 'Confirm analyst decision'}</button></div></form> : <div className="decision-cta"><div><strong>Ready for human review</strong><span>Recommended: {actionLabels[investigation.analysis.recommended_action]}. You can choose a different action.</span></div><button type="button" className="button button-primary" onClick={() => setShowDecisionForm(true)}><UserCheck size={17} /> Record decision <ArrowRight size={16} /></button></div>}
                  </div>
                </>}
              </>}
            </section>
          </div>
          <footer className="footer"><span><ShieldCheck size={15} /> FinGuard AI · TrustForge</span><span>Prototype only · Synthetic evidence and policies · Not for production fraud decisions</span><span>Built on Google Cloud <Globe2 size={15} /></span></footer>
        </main>
      </div>
    </div>
  );
}
