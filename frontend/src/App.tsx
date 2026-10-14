import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { api } from './api/client'
import type { Action, AlertDetail, AlertSummary, AnalystDecision, EvidenceItem, Investigation, Transaction } from './api/types'

const currency = (amount: number, code = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
const dateTime = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const titleCase = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const actionLabel: Record<Action, string> = { CLEAR: 'Clear alert', REQUEST_VERIFICATION: 'Request verification', ESCALATE: 'Escalate case' }

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<string, ReactNode> = {
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
    alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    pulse: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
  }
  return <svg {...common}>{paths[name] ?? paths.alert}</svg>
}

function App() {
  const [alerts, setAlerts] = useState<AlertSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<AlertDetail | null>(null)
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [decision, setDecision] = useState<AnalystDecision | null>(null)
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [investigating, setInvestigating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [action, setAction] = useState<Action>('ESCALATE')
  const [rationale, setRationale] = useState('')
  const [analyst, setAnalyst] = useState('demo-analyst')
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [activeView, setActiveView] = useState<'dashboard' | 'alerts'>('dashboard')

  const loadAlerts = useCallback(async () => {
    setLoadingQueue(true); setError('')
    try {
      const data = await api.alerts()
      setAlerts(data)
      setSelectedId((current) => data.some((item) => item.alert_id === current) ? current : data[0]?.alert_id ?? '')
      setApiOnline(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load alerts'); setApiOnline(false) }
    finally { setLoadingQueue(false) }
  }, [])

  useEffect(() => { void loadAlerts() }, [loadAlerts])
  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let active = true
    setLoadingDetail(true); setError('')
    setDetail(null); setInvestigation(null); setDecision(null); setRationale('')
    api.alert(selectedId).then((data) => { if (active) setDetail(data) })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Unable to load alert detail') })
      .finally(() => { if (active) setLoadingDetail(false) })
    return () => { active = false }
  }, [selectedId])

  const visibleAlerts = useMemo(() => alerts.filter((alert) => {
    const matchesSearch = `${alert.alert_id} ${alert.customer_id} ${alert.headline}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (filter === 'ALL' || alert.status === filter)
  }), [alerts, search, filter])
  const activeAlert = alerts.find((alert) => alert.alert_id === selectedId)
  const investigateCase = async () => {
    if (!selectedId) return
    setInvestigating(true); setError(''); setDecision(null)
    try {
      const result = await api.investigate(selectedId)
      setInvestigation(result); setAction(result.analysis.recommended_action); setRationale('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Investigation could not be completed') }
    finally { setInvestigating(false) }
  }
  const submitDecision = async (event: FormEvent) => {
    event.preventDefault()
    if (!investigation) return
    setSubmitting(true); setError('')
    try {
      const result = await api.decide(investigation.investigation_id, { action, rationale, analyst })
      setDecision(result)
      setAlerts((items) => items.map((item) => item.alert_id === selectedId ? { ...item, status: action === 'CLEAR' ? 'CLEARED' : action === 'ESCALATE' ? 'ESCALATED' : 'PENDING_VERIFICATION' } : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'Decision could not be saved') }
    finally { setSubmitting(false) }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#dashboard" onClick={() => setActiveView('dashboard')} aria-label="FinGuard AI home"><span className="brand-mark"><Icon name="shield" size={21}/></span><span><strong>FinGuard<span className="brand-ai">AI</span></strong><small>TRUSTFORGE</small></span></a>
      <div className="nav-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <a className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`} href="#dashboard" onClick={() => setActiveView('dashboard')}><Icon name="grid"/>Overview</a>
        <a className={`nav-link ${activeView === 'alerts' ? 'active' : ''}`} href="#alerts" onClick={() => setActiveView('alerts')}><span className="nav-icon"><Icon name="alert"/></span>Alert queue<span className="nav-count">{alerts.filter((a) => a.status === 'OPEN').length}</span></a>
      </nav>
      <div className="sidebar-bottom"><div className="environment"><span className={`status-dot ${apiOnline ? 'online' : apiOnline === false ? 'offline' : ''}`}/><span><b>{apiOnline ? 'API connected' : apiOnline === false ? 'API disconnected' : 'Connecting'}</b><small>Local environment</small></span></div><div className="analyst"><div className="avatar">DA</div><span><b>Demo Analyst</b><small>Fraud operations</small></span><button className="plain-icon" title="Analyst profile" aria-label="Analyst profile"><span>•••</span></button></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={14}/><strong>{activeView === 'dashboard' ? 'Overview' : 'Alert queue'}</strong></div><div className="top-actions"><span className="secure-tag"><Icon name="lock" size={14}/> Secure workspace</span><div className="top-avatar">DA</div></div></header>
      <div className="page-content" id={activeView === 'dashboard' ? 'dashboard' : 'alerts'}>
        <section className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> RISK OPERATIONS <span className="eyebrow-separator">/</span> INVESTIGATIONS</div><h1>{activeView === 'dashboard' ? 'Investigation overview' : 'Alert queue'}</h1><p>{activeView === 'dashboard' ? 'A clear view of the cases waiting for an analyst.' : 'Review suspicious activity and make evidence-backed decisions.'}</p></div><button className="button button-secondary refresh-button" onClick={() => void loadAlerts()} disabled={loadingQueue}><Icon name="refresh" size={16}/>{loadingQueue ? 'Refreshing' : 'Refresh queue'}</button></section>

        {error && <div className="error-banner" role="alert"><Icon name="alert" size={18}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" size={16}/></button></div>}

        <section className="metric-row" aria-label="Queue summary">
          <Metric label="Open alerts" value={alerts.filter((a) => a.status === 'OPEN').length.toString().padStart(2, '0')} icon="alert" tone="coral" note="Require analyst review"/>
          <Metric label="Total flagged" value={alerts.length.toString().padStart(2, '0')} icon="pulse" tone="blue" note="In current queue"/>
          <Metric label="Queue status" value={apiOnline ? 'Live' : apiOnline === false ? 'Offline' : '—'} icon="check" tone="green" note={apiOnline ? 'API connection healthy' : 'Waiting for API'}/>
          <div className="metric-card metric-highlight"><div className="highlight-top"><span className="highlight-orb"><Icon name="shield" size={20}/></span><span className="ai-label">AI COPILOT</span></div><strong>Evidence first.</strong><span>Every signal is traceable. Every decision is yours.</span></div>
        </section>

        {activeView === 'dashboard' ? <DashboardOverview alerts={alerts} loading={loadingQueue} apiOnline={apiOnline} onOpenQueue={() => setActiveView('alerts')} onOpenCase={(id) => { setSelectedId(id); setActiveView('alerts') }}/> : <section className="workspace-grid">
          <div className="queue-panel panel">
            <div className="panel-heading"><div><h2>Flagged activity <span className="heading-count">{visibleAlerts.length}</span></h2><p>Prioritized for your review</p></div><button className="more-button" aria-label="Queue options">•••</button></div>
            <div className="queue-controls"><label className="search-box"><Icon name="search" size={16}/><input aria-label="Search alerts" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alerts..."/><kbd>⌘ K</kbd></label><select aria-label="Filter alert status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">All status</option><option value="OPEN">Open</option><option value="CLEARED">Cleared</option><option value="ESCALATED">Escalated</option><option value="PENDING_VERIFICATION">Pending verification</option></select></div>
            <div className="queue-list" aria-live="polite">
              {loadingQueue ? <QueueLoading/> : visibleAlerts.length ? visibleAlerts.map((alert) => <AlertRow key={alert.alert_id} alert={alert} selected={selectedId === alert.alert_id} onClick={() => setSelectedId(alert.alert_id)}/>) : <div className="empty-state"><span className="empty-icon"><Icon name="search"/></span><b>No alerts found</b><span>Try changing your search or filter.</span></div>}
            </div>
            <div className="queue-footer"><span>Showing <b>{visibleAlerts.length}</b> of <b>{alerts.length}</b> alerts</span><span>Updated just now <Icon name="refresh" size={13}/></span></div>
          </div>

          <div className="detail-column">
            {loadingDetail ? <DetailLoading/> : detail ? <>
              <AlertDetailCard alert={detail} investigating={investigating} onInvestigate={investigateCase}/>
              {investigation ? <InvestigationReport key={investigation.investigation_id} investigation={investigation} action={action} rationale={rationale} analyst={analyst} decision={decision} submitting={submitting} onAction={setAction} onRationale={setRationale} onAnalyst={setAnalyst} onSubmit={submitDecision}/> : <InvestigationPrompt/>}
            </> : <div className="panel empty-detail"><span className="empty-icon"><Icon name="alert"/></span><h2>Select an alert</h2><p>Choose a case from the queue to review its activity.</p></div>}
          </div>
        </section>}
        <footer className="page-footer"><span>FinGuard AI <span className="footer-dot">·</span> TrustForge</span><span>Synthetic demo data <span className="footer-dot">·</span> Human review required</span></footer>
      </div>
    </main>
  </div>
}

function DashboardOverview({ alerts, loading, apiOnline, onOpenQueue, onOpenCase }: { alerts: AlertSummary[]; loading: boolean; apiOnline: boolean | null; onOpenQueue: () => void; onOpenCase: (id: string) => void }) {
  const openAlerts = alerts.filter((alert) => alert.status === 'OPEN').sort((a, b) => b.attempted_amount - a.attempted_amount)
  const latestAlerts = [...alerts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4)
  return <section className="overview-grid" aria-label="Investigation dashboard">
    <div className="overview-main panel">
      <div className="overview-panel-heading"><div><span className="overview-kicker">ANALYST WORKSPACE</span><h2>Cases needing attention</h2><p>Open cases from the connected FinGuard API.</p></div><button className="button button-secondary" onClick={onOpenQueue}>Open alert queue<Icon name="arrow" size={14}/></button></div>
      {loading ? <QueueLoading/> : openAlerts.length ? <div className="overview-case-list">{openAlerts.slice(0, 5).map((alert) => <button className="overview-case" key={alert.alert_id} onClick={() => onOpenCase(alert.alert_id)}><span className="overview-case-mark"><Icon name="alert" size={16}/></span><span className="overview-case-copy"><span className="overview-case-title"><b>{alert.alert_id}</b><span className="status-pill open">Open</span></span><span className="overview-case-headline">{alert.headline}</span><span className="overview-case-meta">{alert.customer_id}<i>·</i>{dateTime(alert.created_at)}</span></span><span className="overview-case-value"><b>{currency(alert.attempted_amount, alert.currency)}</b><span>Attempted</span><Icon name="chevron" size={16}/></span></button>)}</div> : <div className="overview-empty"><span className="empty-icon"><Icon name="check"/></span><b>No open alerts</b><span>There are no cases awaiting review in the current queue.</span></div>}
      <div className="overview-list-footer"><span>Largest attempted amounts shown first</span><button className="text-button" onClick={onOpenQueue}>View all alerts <Icon name="arrow" size={13}/></button></div>
    </div>
    <aside className="overview-side">
      <section className="panel operating-card"><div className="operating-top"><span className="operating-icon"><Icon name="shield" size={19}/></span><span className={`operating-status ${apiOnline ? 'connected' : apiOnline === false ? 'disconnected' : ''}`}><i/>{apiOnline ? 'CONNECTED' : apiOnline === false ? 'OFFLINE' : 'CHECKING'}</span></div><h2>Evidence before action.</h2><p>FinGuard gathers case signals and policy context. An analyst reviews the findings and owns the final decision.</p><div className="operating-steps"><div><span>01</span><b>Review alert</b></div><div><span>02</span><b>Inspect evidence</b></div><div><span>03</span><b>Record decision</b></div></div></section>
      <section className="panel latest-panel"><div className="latest-heading"><div><span className="overview-kicker">CASE INTAKE</span><h2>Latest alerts</h2></div><button className="plain-action" onClick={onOpenQueue} aria-label="Open alert queue"><Icon name="arrow" size={15}/></button></div>{loading ? <div className="latest-loading">Loading latest alerts…</div> : latestAlerts.length ? <div className="latest-list">{latestAlerts.map((alert) => <button className="latest-row" key={alert.alert_id} onClick={() => onOpenCase(alert.alert_id)}><span className="latest-status-dot"/><span><b>{alert.alert_id}</b><small>{dateTime(alert.created_at)}</small></span><strong>{currency(alert.attempted_amount, alert.currency)}</strong></button>)}</div> : <div className="latest-loading">No alerts returned by the API.</div>}</section>
    </aside>
  </section>
}

function Metric({ label, value, icon, tone, note }: { label: string; value: string; icon: string; tone: string; note: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon name={icon} size={17}/></span></div><div className="metric-value">{value}</div><div className="metric-note"><span className={tone === 'coral' ? 'note-dot coral-dot' : 'note-dot'}/>{note}</div></div>
}

function AlertRow({ alert, selected, onClick }: { alert: AlertSummary; selected: boolean; onClick: () => void }) {
  const isOpen = alert.status === 'OPEN'
  return <button className={`alert-row ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected}>
    <span className={`alert-symbol ${isOpen ? 'high' : 'neutral'}`}><Icon name={isOpen ? 'alert' : 'check'} size={17}/></span><span className="row-copy"><span className="row-id">{alert.alert_id}<span className={`status-pill ${isOpen ? 'open' : 'resolved'}`}>{titleCase(alert.status)}</span></span><span className="row-headline">{alert.headline}</span><span className="row-meta">{alert.customer_id}<span>·</span>{dateTime(alert.created_at)}</span></span><span className="row-right"><strong>{currency(alert.attempted_amount, alert.currency)}</strong><Icon name="chevron" size={16}/></span>
  </button>
}

function AlertDetailCard({ alert, investigating, onInvestigate }: { alert: AlertDetail; investigating: boolean; onInvestigate: () => void }) {
  return <section className="panel case-panel"><div className="case-head"><div><div className="case-id"><span className="case-signal"><Icon name="alert" size={14}/></span> CASE {alert.alert_id}<span className={`status-pill ${alert.status === 'OPEN' ? 'open' : 'resolved'}`}>{titleCase(alert.status)}</span></div><h2>{alert.headline}</h2><p className="case-subtitle">Customer <b>{alert.customer_id}</b><span>·</span> Flagged {dateTime(alert.created_at)}</p></div><button className="button button-primary investigate-button" onClick={onInvestigate} disabled={investigating}><Icon name={investigating ? 'pulse' : 'search'} size={16}/>{investigating ? 'Investigating…' : 'Run investigation'}<Icon name="arrow" size={14}/></button></div>
    <div className="case-stats"><div><span>Attempted amount</span><strong className="amount">{currency(alert.attempted_amount, alert.currency)}</strong></div><div><span>Related events</span><strong>{alert.transactions.length} <small>transactions</small></strong></div><div><span>Primary location</span><strong>{alert.transactions[0]?.city ?? 'Unknown'}<small>{alert.transactions[0]?.country ?? ''}</small></strong></div><div><span>Risk signals</span><strong>{new Set(alert.transactions.map((t) => t.device_id)).size > 0 ? 'Review' : '—'}<small>Analyst assessment</small></strong></div></div>
    <div className="section-divider"><span>Activity timeline</span><span>{alert.transactions.length} EVENTS</span></div><div className="timeline">{alert.transactions.map((transaction, i) => <TransactionRow key={transaction.transaction_id} transaction={transaction} last={i === alert.transactions.length - 1}/>)}</div>
  </section>
}

function TransactionRow({ transaction, last }: { transaction: Transaction; last: boolean }) {
  const blocked = transaction.status === 'BLOCKED'
  const added = transaction.status === 'BENEFICIARY_ADDED'
  return <div className={`transaction ${last ? 'last' : ''}`}><div className={`timeline-marker ${blocked ? 'marker-alert' : added ? 'marker-new' : ''}`}>{blocked ? <Icon name="lock" size={13}/> : added ? <Icon name="check" size={13}/> : <span/>}</div><div className="transaction-main"><div className="transaction-top"><strong>{titleCase(transaction.status)}</strong><span>{dateTime(transaction.timestamp)}</span></div><div className="transaction-detail"><span>{transaction.transaction_id}</span><span>·</span><span>{transaction.city}, {transaction.country}</span><span>·</span><span>{transaction.device_id}</span></div>{transaction.beneficiary_id && <div className="beneficiary-note">Beneficiary <b>{transaction.beneficiary_id}</b></div>}</div><strong className={`transaction-amount ${blocked ? 'blocked-amount' : ''}`}>{currency(transaction.amount, transaction.currency)}</strong></div>
}

function InvestigationPrompt() {
  return <div className="panel investigation-prompt"><span className="prompt-icon"><Icon name="pulse" size={20}/></span><div><h3>Ready to investigate</h3><p>Run an investigation to surface evidence, policy guidance, and AI-assisted hypotheses.</p></div><span className="prompt-hint">Takes a few seconds</span></div>
}

function InvestigationReport({ investigation, action, rationale, analyst, decision, submitting, onAction, onRationale, onAnalyst, onSubmit }: { investigation: Investigation; action: Action; rationale: string; analyst: string; decision: AnalystDecision | null; submitting: boolean; onAction: (value: Action) => void; onRationale: (value: string) => void; onAnalyst: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  const analysis = investigation.analysis
  const evidenceById = useMemo(() => new Map(investigation.evidence.map((item) => [item.evidence_id, item])), [investigation.evidence])
  return <section className="panel report-panel"><div className="report-header"><div><div className="report-kicker"><span className="report-icon"><Icon name="pulse" size={15}/></span> INVESTIGATION REPORT <span className="report-id">{investigation.investigation_id}</span></div><h2>Evidence review</h2></div><span className={`mode-badge ${investigation.ai_mode === 'mock' ? 'mock' : 'live'}`}><span/>{investigation.ai_mode === 'mock' ? 'MOCK ANALYSIS' : 'VERTEX AI'}</span></div>
    {investigation.ai_mode === 'mock' && <div className="mock-note"><Icon name="alert" size={15}/><span><b>Demo analysis</b> — this report uses deterministic mock output, not a live Gemini response.</span></div>}
    <div className="summary-block"><span className="block-label">EXECUTIVE SUMMARY</span><p>{analysis.summary}</p></div>
    <div className="report-section"><SectionTitle title="Evidence signals" trailing={`${investigation.evidence.length} signals`}/><div className="evidence-list">{investigation.evidence.map((item) => <EvidenceCard key={item.evidence_id} item={item}/>)}</div></div>
    <div className="report-section"><SectionTitle title="Hypothesis assessment" trailing="AI-assisted · analyst owned"/><HypothesisCard hypothesis={analysis.primary_hypothesis} evidenceById={evidenceById} primary/><div className="hypothesis-alternatives">{analysis.alternative_hypotheses.map((hypothesis, index) => <HypothesisCard key={`${hypothesis.name}-${index}`} hypothesis={hypothesis} evidenceById={evidenceById}/>)}</div></div>
    <div className="insight-grid"><div className="insight-card"><span className="insight-icon blue"><Icon name="refresh" size={15}/></span><div><span className="block-label">COUNTERFACTUAL</span><p>{analysis.counterfactual}</p></div></div><div className="insight-card"><span className="insight-icon green"><Icon name="arrow" size={15}/></span><div><span className="block-label">RECOMMENDED NEXT STEP</span><p>{analysis.next_best_action}</p></div></div></div>
    <div className="report-section"><SectionTitle title="Policy basis" trailing={`${investigation.policy_matches.length} references`}/>{investigation.policy_matches.length ? <div className="policy-list">{investigation.policy_matches.map((policy) => <article className="policy-card" key={policy.policy_id}><div className="policy-head"><span className="policy-id">{policy.policy_id}</span><strong>{policy.title}</strong></div><p>{policy.excerpt}</p><div className="term-list">{policy.matched_terms.map((term) => <span key={term}>{term}</span>)}</div></article>)}</div> : <p className="muted-copy">No policy matches were returned for this investigation.</p>}</div>
    <div className="decision-section"><div className="decision-heading"><div><span className="decision-overline">HUMAN REVIEW</span><h3>Record your decision</h3></div><span className="human-only"><Icon name="lock" size={13}/> Analyst confirmation required</span></div>{decision ? <div className="decision-success" role="status"><span className="success-check"><Icon name="check" size={17}/></span><span><b>Decision recorded: {actionLabel[decision.action]}</b><small>{decision.analyst} · {dateTime(decision.decided_at)}</small><small>{decision.rationale}</small></span></div> : <form onSubmit={onSubmit} className="decision-form"><label>Decision<select value={action} onChange={(e) => onAction(e.target.value as Action)}><option value="ESCALATE">Escalate case</option><option value="REQUEST_VERIFICATION">Request verification</option><option value="CLEAR">Clear alert</option></select><span className="recommended-hint">AI recommendation: {actionLabel[analysis.recommended_action]} · confirm or change</span></label><label>Analyst ID<input value={analyst} onChange={(e) => onAnalyst(e.target.value)} required maxLength={80}/></label><label className="rationale-field">Rationale<textarea value={rationale} onChange={(e) => onRationale(e.target.value)} minLength={3} maxLength={1000} rows={3} placeholder="Document the evidence behind your decision…" required/><span className="char-count">{rationale.length}/1000</span></label><div className="decision-submit"><span><Icon name="lock" size={13}/> This action will be recorded in the case history.</span><button type="submit" className="button button-dark" disabled={submitting || rationale.trim().length < 3 || !analyst.trim()}>{submitting ? 'Saving decision…' : 'Confirm decision'}<Icon name="arrow" size={14}/></button></div></form>}</div>
  </section>
}

function SectionTitle({ title, trailing }: { title: string; trailing: string }) { return <div className="section-title"><h3>{title}</h3><span>{trailing}</span></div> }

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const severity = item.severity.toLowerCase()
  return <article className="evidence-card"><div className="evidence-top"><span className="evidence-id">{item.evidence_id}</span><span className={`severity ${severity}`}>{titleCase(item.severity)} severity</span></div><strong>{titleCase(item.category)}</strong><p>{item.statement}</p><span className="evidence-source">Source: {titleCase(item.source)}</span></article>
}

function HypothesisCard({ hypothesis, evidenceById, primary = false }: { hypothesis: Investigation['analysis']['primary_hypothesis']; evidenceById: Map<string, EvidenceItem>; primary?: boolean }) {
  return <article className={`hypothesis-card ${primary ? 'primary-hypothesis' : ''}`}><div className="hypothesis-title"><span className={`hypothesis-mark ${primary ? 'primary-mark' : ''}`}>{primary ? <Icon name="pulse" size={15}/> : <Icon name="arrow" size={14}/>}</span><div><span className="hypothesis-kind">{primary ? 'PRIMARY HYPOTHESIS' : 'ALTERNATIVE HYPOTHESIS'}</span><h4>{hypothesis.name}</h4></div></div><p>{hypothesis.explanation}</p><EvidenceRefs label="Supporting" ids={hypothesis.supporting_evidence_ids} evidenceById={evidenceById} tone="support"/><EvidenceRefs label="Contradicting" ids={hypothesis.contradicting_evidence_ids} evidenceById={evidenceById} tone="contradict"/><div className="missing-evidence"><span>Missing evidence</span><ul>{hypothesis.missing_evidence.map((item) => <li key={item}>{item}</li>)}</ul></div></article>
}

function EvidenceRefs({ label, ids, evidenceById, tone }: { label: string; ids: string[]; evidenceById: Map<string, EvidenceItem>; tone: string }) {
  return <div className={`evidence-refs ${tone}`}><span>{label}</span>{ids.length ? ids.map((id) => <span className="evidence-ref-chip" key={id} title={evidenceById.get(id)?.statement ?? id}>{id}</span>) : <em>None identified</em>}</div>
}

function QueueLoading() { return <div className="skeleton-list" aria-label="Loading alerts">{[0, 1, 2].map((n) => <div className="skeleton-row" key={n}><span className="skeleton circle"/><span className="skeleton-copy"><i/><i/><i/></span><span className="skeleton amount-skeleton"/></div>)}</div> }
function DetailLoading() { return <div className="panel loading-detail"><span className="loading-spinner"/><b>Loading case details</b><span>Getting the latest activity…</span></div> }

export default App
