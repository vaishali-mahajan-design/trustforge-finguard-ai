import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CircleHelp, Maximize2, Minimize2, Network, X } from 'lucide-react';
import type { EvidenceItem, InvestigationResponse } from '../api/types';

type NodeKind = 'alert' | 'customer' | 'transaction' | 'device' | 'location' | 'beneficiary' | 'evidence' | 'policy';
type EdgeKind = 'record' | 'evidence' | 'policy';

interface GraphNode {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  detail: string;
  source: string;
  severity?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: EdgeKind;
}

interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

interface GraphViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 158;
const NODE_HEIGHT = 72;
const ROW_GAP = 104;
const GRAPH_WIDTH = 830;

function shorten(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function makeGraph(report: InvestigationResponse, fullscreen = false): GraphModel {
  const transactions = report.alert.transactions;
  const evidence = report.evidence;
  const policies = report.policy_matches;
  const entityRows = new Map<string, { kind: 'device' | 'location' | 'beneficiary'; title: string; transactionIds: string[] }>();

  for (const transaction of transactions) {
    const entities: Array<{ key: string; kind: 'device' | 'location' | 'beneficiary'; title: string }> = [
      { key: `device:${transaction.device_id}`, kind: 'device', title: transaction.device_id },
      { key: `location:${transaction.city}|${transaction.country}`, kind: 'location', title: `${transaction.city}, ${transaction.country}` },
    ];
    if (transaction.beneficiary_id) entities.push({ key: `beneficiary:${transaction.beneficiary_id}`, kind: 'beneficiary', title: transaction.beneficiary_id });

    for (const entity of entities) {
      const current = entityRows.get(entity.key) ?? { kind: entity.kind, title: entity.title, transactionIds: [] };
      if (!current.transactionIds.includes(transaction.transaction_id)) current.transactionIds.push(transaction.transaction_id);
      entityRows.set(entity.key, current);
    }
  }

  const sortedEntities = [...entityRows.entries()].sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  const rightRowCount = fullscreen
    ? Math.max(1, Math.ceil(evidence.length / 2), policies.length)
    : Math.max(1, evidence.length + policies.length);
  const rowGap = fullscreen ? 82 : ROW_GAP;
  const rowCount = Math.max(1, transactions.length, sortedEntities.length, rightRowCount);
  const height = fullscreen
    ? Math.max(440, rowCount * rowGap + 180)
    : Math.max(450, rowCount * ROW_GAP + 250);
  const positions = fullscreen ? {
    alert: { x: 24, y: 56 },
    customer: { x: 220, y: 56 },
    transactions: { x: 220, y: 140 },
    entities: { x: 420, y: 80 },
    evidence: { x: 630, y: 80 },
    evidenceSecond: { x: 800, y: 80 },
    policies: { x: 990, y: 80 },
  } : {
    alert: { x: 26, y: 56 },
    customer: { x: 220, y: 56 },
    transactions: { x: 220, y: 170 },
    entities: { x: 430, y: 100 },
    evidence: { x: 640, y: 70 },
    evidenceSecond: { x: 640, y: 70 },
    policies: { x: 640, y: 70 },
  };
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  function addNode(node: Omit<GraphNode, 'width' | 'height'>): GraphNode {
    const complete = { ...node, width: NODE_WIDTH, height: NODE_HEIGHT };
    nodes.push(complete);
    return complete;
  }

  function addEdge(source: string, target: string, label: string, kind: EdgeKind): void {
    edges.push({ id: `${source}-${target}-${label}`, source, target, label, kind });
  }

  const alertNodeId = `alert:${report.alert.alert_id}`;
  const customerNodeId = `customer:${report.alert.customer_id}`;
  addNode({ id: alertNodeId, kind: 'alert', title: report.alert.alert_id, subtitle: 'Investigation alert', detail: `${report.alert.headline}\nAttempted amount: ${report.alert.currency} ${report.alert.attempted_amount.toLocaleString('en-IN')}`, source: 'Alert record', x: positions.alert.x, y: height / 2 - NODE_HEIGHT / 2 });
  addNode({ id: customerNodeId, kind: 'customer', title: report.alert.customer_id, subtitle: 'Customer on alert record', detail: 'This customer ID is attached to the selected alert record. The graph makes no claims about other customers or cases.', source: 'Alert record', x: positions.customer.x, y: height / 2 - NODE_HEIGHT / 2 });
  addEdge(alertNodeId, customerNodeId, 'raised for', 'record');

  transactions.forEach((transaction, index) => {
    const id = `transaction:${transaction.transaction_id}`;
    const eventTime = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(transaction.timestamp));
    addNode({
      id,
      kind: 'transaction',
      title: transaction.transaction_id,
      subtitle: `${transaction.status.replace(/_/g, ' ')} · ${transaction.currency} ${transaction.amount.toLocaleString('en-IN')}`,
      detail: `${eventTime}\n${transaction.city}, ${transaction.country}\nDevice: ${transaction.device_id}${transaction.beneficiary_id ? `\nBeneficiary: ${transaction.beneficiary_id}` : ''}`,
      source: 'Transaction event record',
      x: positions.transactions.x,
      y: positions.transactions.y + index * rowGap,
    });
    addEdge(alertNodeId, id, 'contains event', 'record');
    addEdge(id, `device:${transaction.device_id}`, 'used device', 'record');
    addEdge(id, `location:${transaction.city}|${transaction.country}`, 'occurred in', 'record');
    if (transaction.beneficiary_id) addEdge(id, `beneficiary:${transaction.beneficiary_id}`, 'names beneficiary', 'record');
  });

  sortedEntities.forEach(([id, entity], index) => {
    addNode({
      id,
      kind: entity.kind,
      title: shorten(entity.title, 25),
      subtitle: `${entity.kind[0].toUpperCase()}${entity.kind.slice(1)} · ${entity.transactionIds.length} event${entity.transactionIds.length === 1 ? '' : 's'}`,
      detail: `Appears in: ${entity.transactionIds.join(', ')}\nThis node is deduplicated from exact matching values in the selected alert's transaction records.`,
      source: 'Transaction event record',
      x: positions.entities.x,
      y: positions.entities.y + index * rowGap,
    });
  });

  const amountTransactions = transactions.length ? [transactions.reduce((largest, current) => current.amount > largest.amount ? current : largest)] : [];
  const targetsForEvidence = (item: EvidenceItem): string[] => {
    const statement = item.statement.toLowerCase();
    if (item.category === 'amount_anomaly') return amountTransactions.map((transaction) => `transaction:${transaction.transaction_id}`);
    if (item.category === 'velocity') return transactions.map((transaction) => `transaction:${transaction.transaction_id}`);
    if (item.category === 'device_change') return sortedEntities.filter(([, entity]) => entity.kind === 'device' && statement.includes(entity.title.toLowerCase())).map(([id]) => id);
    if (item.category === 'new_beneficiary') return sortedEntities.filter(([, entity]) => entity.kind === 'beneficiary' && statement.includes(entity.title.toLowerCase())).map(([id]) => id);
    if (item.category === 'geo_deviation') return sortedEntities.filter(([, entity]) => entity.kind === 'location' && statement.includes(entity.title.split(', ').at(-1)?.toLowerCase() ?? '')).map(([id]) => id);
    if (item.source === 'customer_context') return [customerNodeId];
    return [alertNodeId];
  };

  evidence.forEach((item, index) => {
    const id = `evidence:${item.evidence_id}`;
    addNode({
      id,
      kind: 'evidence',
      title: item.evidence_id,
      subtitle: `${item.category.replace(/_/g, ' ')} · ${item.severity}`,
      detail: `${item.statement}\nValue: ${String(item.value)}`,
      source: item.source.replace(/_/g, ' '),
      severity: item.severity,
      x: fullscreen && index % 2 ? positions.evidenceSecond.x : positions.evidence.x,
      y: positions.evidence.y + (fullscreen ? Math.floor(index / 2) : index) * rowGap,
    });
    const targets = targetsForEvidence(item);
    (targets.length ? targets : [alertNodeId]).forEach((targetId) => {
      addEdge(targetId, id, 'supports case review', 'evidence');
    });
  });

  policies.forEach((policy, index) => {
    const id = `policy:${policy.policy_id}`;
    addNode({
      id,
      kind: 'policy',
      title: policy.policy_id,
      subtitle: shorten(policy.title, 25),
      detail: `${policy.excerpt}\nMatched terms: ${policy.matched_terms.join(', ') || 'Not provided'}`,
      source: 'Policy retrieval result',
      x: positions.policies.x,
      y: positions.policies.y + index * rowGap,
    });
    addEdge(alertNodeId, id, 'retrieved for case', 'policy');
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  return { nodes, edges: edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)), width: fullscreen ? 1170 : GRAPH_WIDTH, height: height + 24 };
}

function kindLabel(kind: NodeKind): string {
  return ({ alert: 'Alert', customer: 'Customer', transaction: 'Transaction event', device: 'Device', location: 'Location', beneficiary: 'Beneficiary', evidence: 'Evidence signal', policy: 'Policy match' })[kind];
}

function nodeColor(kind: NodeKind): { fill: string; stroke: string; text: string } {
  return ({
    alert: { fill: '#e9f1ff', stroke: '#7aa2e8', text: '#315da7' },
    customer: { fill: '#f0edff', stroke: '#a89bdf', text: '#6854a7' },
    transaction: { fill: '#f4f7fb', stroke: '#bdcadb', text: '#41536e' },
    device: { fill: '#edf7f4', stroke: '#8ec7b4', text: '#367d69' },
    location: { fill: '#edf6fc', stroke: '#8fbedb', text: '#37739a' },
    beneficiary: { fill: '#fff5e9', stroke: '#e4bd83', text: '#986c2e' },
    evidence: { fill: '#fff2ef', stroke: '#e9a49b', text: '#a65048' },
    policy: { fill: '#f7f4ff', stroke: '#b7a8df', text: '#6e5aab' },
  })[kind];
}

function clampViewport(viewport: GraphViewport, graph: GraphModel): GraphViewport {
  const minWidth = graph.width * 0.4;
  const width = Math.max(minWidth, Math.min(graph.width, viewport.width));
  const height = width * graph.height / graph.width;
  return {
    x: Math.max(0, Math.min(graph.width - width, viewport.x)),
    y: Math.max(0, Math.min(graph.height - height, viewport.y)),
    width,
    height,
  };
}

function EvidenceGraph({ report }: { report: InvestigationResponse }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(true);
  const [showPolicies, setShowPolicies] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const graph = useMemo(() => makeGraph(report, isFullscreen), [report, isFullscreen]);
  const [viewport, setViewport] = useState<GraphViewport>(() => ({ x: 0, y: 0, width: graph.width, height: graph.height }));
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number; viewWidth: number; viewHeight: number; nodeId: string | null; didMove: boolean } | null>(null);
  const fullscreenToggleRef = useRef<HTMLButtonElement>(null);
  const fullscreenCloseRef = useRef<HTMLButtonElement>(null);
  const visibleNodes = graph.nodes.filter((node) => (showEvidence || node.kind !== 'evidence') && (showPolicies || node.kind !== 'policy'));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const activeSelectedNodeId = selectedNodeId && visibleIds.has(selectedNodeId) ? selectedNodeId : null;
  const selectedNode = visibleNodes.find((node) => node.id === activeSelectedNodeId);
  const connectedNodeIds = new Set(visibleEdges.flatMap((edge) => edge.source === activeSelectedNodeId ? [edge.target] : edge.target === activeSelectedNodeId ? [edge.source] : []));
  const matches = searchQuery.trim() ? visibleNodes.filter((node) => `${node.title} ${node.subtitle} ${kindLabel(node.kind)}`.toLowerCase().includes(searchQuery.trim().toLowerCase())) : [];

  useEffect(() => {
    setViewport({ x: 0, y: 0, width: graph.width, height: graph.height });
  }, [graph]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    fullscreenCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.requestAnimationFrame(() => fullscreenToggleRef.current?.focus());
    };
  }, [isFullscreen]);

  function focusNode(node: GraphNode): void {
    setSelectedNodeId(node.id);
    setViewport((current) => clampViewport({ ...current, x: node.x + node.width / 2 - current.width / 2, y: node.y + node.height / 2 - current.height / 2 }, graph));
  }

  function zoomBy(factor: number): void {
    setViewport((current) => {
      const width = Math.max(graph.width * 0.4, Math.min(graph.width, current.width * factor));
      const height = width * graph.height / graph.width;
      return clampViewport({ x: current.x + (current.width - width) / 2, y: current.y + (current.height - height) / 2, width, height }, graph);
    });
  }

  function focusSearchResult(index = searchIndex): void {
    if (!matches.length) return;
    const nextIndex = ((index % matches.length) + matches.length) % matches.length;
    setSearchIndex(nextIndex);
    focusNode(matches[nextIndex]);
  }

  function startPan(event: ReactPointerEvent<SVGSVGElement>): void {
    if (event.button !== 0) return;
    const nodeElement = event.target instanceof Element ? event.target.closest('.graph-node') : null;
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewX: viewport.x, viewY: viewport.y, viewWidth: viewport.width, viewHeight: viewport.height, nodeId: nodeElement?.getAttribute('data-node-id') ?? null, didMove: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: ReactPointerEvent<SVGSVGElement>): void {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - pan.startX) > 4 || Math.abs(event.clientY - pan.startY) > 4) pan.didMove = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = pan.viewWidth / rect.width;
    const scaleY = pan.viewHeight / rect.height;
    setViewport((current) => clampViewport({ ...current, x: pan.viewX - (event.clientX - pan.startX) * scaleX, y: pan.viewY - (event.clientY - pan.startY) * scaleY }, graph));
  }

  function endPan(event: ReactPointerEvent<SVGSVGElement>): void {
    const pan = panRef.current;
    if (pan?.pointerId !== event.pointerId) return;
    if (!pan.didMove && pan.nodeId) {
      const node = nodes.get(pan.nodeId);
      if (node) focusNode(node);
    }
    panRef.current = null;
  }

  return (
    <div className={`graph-tab-body ${isFullscreen ? 'is-fullscreen' : ''}`} role={isFullscreen ? 'dialog' : undefined} aria-modal={isFullscreen || undefined} aria-labelledby={isFullscreen ? 'graph-fullscreen-title' : undefined} tabIndex={isFullscreen ? -1 : undefined}>
      {isFullscreen && <div className="graph-fullscreen-bar"><div className="graph-fullscreen-heading"><span className="eyebrow"><Network size={13} /> CASE GRAPH <i /> FULL SCREEN</span><strong id="graph-fullscreen-title">{report.alert.alert_id} <span>·</span> {report.alert.headline}</strong><small>Explore the recorded connections, evidence and policy matches for this alert.</small></div><button ref={fullscreenCloseRef} type="button" className="graph-control-button graph-fullscreen-close" onClick={() => setIsFullscreen(false)}><Minimize2 size={15} /> Return to investigation <kbd>Esc</kbd></button></div>}
      <div className={`graph-intro ${isFullscreen ? 'graph-intro-fullscreen' : ''}`}>
        <div className="graph-intro-icon"><Network size={20} /></div>
        <div><span className="eyebrow">CASE EVIDENCE MAP</span><h3>How the recorded facts connect</h3><p>Search to jump to a node, drag anywhere in the graph to move around, or use zoom controls to explore the case.</p></div>
      </div>
      <div className="graph-toolbar">
        <div className="graph-legend" aria-label="Graph relationship legend"><span><i className="legend-line record" />Recorded relationship</span><span><i className="legend-line evidence" />Evidence association</span><span><i className="legend-line policy" />Retrieved policy</span></div>
        <div className="graph-toggles"><label><input type="checkbox" checked={showEvidence} onChange={(event) => setShowEvidence(event.target.checked)} /> Evidence</label><label><input type="checkbox" checked={showPolicies} onChange={(event) => setShowPolicies(event.target.checked)} /> Policies</label></div>
      </div>
      <div className="graph-navigation">
        <form className="graph-search" onSubmit={(event) => { event.preventDefault(); focusSearchResult(0); }}>
          <label htmlFor={`graph-search-${report.alert.alert_id}`}>Find a node</label>
          <input id={`graph-search-${report.alert.alert_id}`} type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchIndex(0); }} placeholder="Alert, transaction, device…" />
          <button type="submit" className="graph-control-button" disabled={!matches.length}>Focus</button>
          {matches.length > 1 && <button type="button" className="graph-control-button graph-next-match" onClick={() => focusSearchResult(searchIndex + 1)} aria-label={`Focus next match, ${matches.length} results`}>Next {searchIndex + 1}/{matches.length}</button>}
          <span className="graph-search-status" role="status">{searchQuery ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : `${visibleNodes.length} nodes`}</span>
        </form>
        <div className="graph-zoom-controls" role="group" aria-label="Graph zoom controls"><button type="button" className="graph-control-button graph-zoom-button" onClick={() => zoomBy(0.8)} disabled={viewport.width <= graph.width * 0.41} aria-label="Zoom in">+</button><button type="button" className="graph-control-button graph-zoom-button" onClick={() => zoomBy(1.25)} disabled={viewport.width >= graph.width * 0.99} aria-label="Zoom out">−</button><button type="button" className="graph-control-button" onClick={() => setViewport({ x: 0, y: 0, width: graph.width, height: graph.height })}>Fit graph</button><button ref={fullscreenToggleRef} type="button" className="graph-control-button graph-expand-button" onClick={() => setIsFullscreen(true)} aria-label="Expand graph to full screen"><Maximize2 size={14} /> Full screen</button></div>
      </div>
      <div className="graph-canvas-scroll" role="region" aria-label="Scrollable case evidence graph" tabIndex={0}>
        <svg className={`evidence-graph-svg ${panRef.current ? 'is-panning' : ''}`} viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`} role="img" tabIndex={0} aria-labelledby="evidence-graph-title evidence-graph-desc" aria-label="Interactive case graph. Drag to pan or use arrow keys to move around." onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const step = viewport.width * 0.12;
          const directions: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          const direction = directions[event.key];
          if (!direction) return;
          event.preventDefault();
          setViewport((current) => clampViewport({ ...current, x: current.x + direction[0], y: current.y + direction[1] }, graph));
        }} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
          <title id="evidence-graph-title">Evidence relationships for alert {report.alert.alert_id}</title>
          <desc id="evidence-graph-desc">An interactive graph connects the alert with its customer, transaction events, devices, locations, beneficiaries, evidence signals and retrieved policies. Connections only represent recorded or explicitly labelled system relationships.</desc>
          <defs><marker id="graph-arrow-record" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#a8b6c9" /></marker><marker id="graph-arrow-evidence" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#d99b91" /></marker><marker id="graph-arrow-policy" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#a99bd1" /></marker></defs>
          <text className="graph-column-label" x="26" y="27">CASE</text><text className="graph-column-label" x="220" y="27">CUSTOMER &amp; ACTIVITY</text><text className="graph-column-label" x={isFullscreen ? '420' : '430'} y="27">RELATED ENTITIES</text><text className="graph-column-label" x={isFullscreen ? '630' : '640'} y="27">{isFullscreen ? 'EVIDENCE' : 'ASSESSMENT'}</text>{isFullscreen && <text className="graph-column-label" x="990" y="27">POLICY MATCHES</text>}
          {visibleEdges.map((edge) => {
            const source = nodes.get(edge.source)!;
            const target = nodes.get(edge.target)!;
            const x1 = source.x + source.width;
            const y1 = source.y + source.height / 2;
            const x2 = target.x;
            const y2 = target.y + target.height / 2;
            const mid = x1 + (x2 - x1) / 2;
            const color = edge.kind === 'record' ? '#a8b6c9' : edge.kind === 'evidence' ? '#d99b91' : '#a99bd1';
            const marker = edge.kind === 'record' ? 'url(#graph-arrow-record)' : edge.kind === 'evidence' ? 'url(#graph-arrow-evidence)' : 'url(#graph-arrow-policy)';
            const isConnected = edge.source === activeSelectedNodeId || edge.target === activeSelectedNodeId;
            const isNeighborEdge = !activeSelectedNodeId || isConnected;
            return <g key={edge.id} className={`graph-edge graph-edge-${edge.kind} ${!isFullscreen && !isNeighborEdge ? 'is-dimmed' : ''}`}><path d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2 - 5} ${y2}`} fill="none" stroke={color} strokeWidth={isConnected ? '2.5' : '1.5'} strokeDasharray={edge.kind === 'record' ? undefined : '4 5'} markerEnd={marker} /><title>{`${nodes.get(edge.source)?.title} ${edge.label} ${nodes.get(edge.target)?.title}`}</title></g>;
          })}
          {visibleNodes.map((node) => {
            const color = nodeColor(node.kind);
            const isSelected = activeSelectedNodeId === node.id;
            const isNeighbor = connectedNodeIds.has(node.id);
            return <g key={node.id} data-node-id={node.id} className={`graph-node graph-node-${node.kind} ${isSelected ? 'is-selected' : ''} ${!isFullscreen && activeSelectedNodeId && !isSelected && !isNeighbor ? 'is-dimmed' : ''}`} role="button" tabIndex={0} aria-label={`${kindLabel(node.kind)}: ${node.title}. ${node.subtitle}. Select for details.`} aria-pressed={isSelected} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (isSelected) setSelectedNodeId(null); else focusNode(node); } }}>
              <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="12" fill={color.fill} stroke={isSelected ? '#316bda' : color.stroke} strokeWidth={isSelected ? '2.5' : '1.4'} />
              <circle cx={node.x + 16} cy={node.y + 18} r="4" fill={node.severity === 'high' ? '#d35e59' : node.severity === 'medium' ? '#d69b43' : color.stroke} />
              <text x={node.x + 27} y={node.y + 21} className="graph-node-kind">{kindLabel(node.kind).toUpperCase()}</text>
              <text x={node.x + 13} y={node.y + 43} className="graph-node-title" fill={color.text}>{shorten(node.title, 22)}</text>
              <text x={node.x + 13} y={node.y + 60} className="graph-node-subtitle">{shorten(node.subtitle, 27)}</text>
            </g>;
          })}
        </svg>
      </div>
      <div className="graph-detail-row">
        {selectedNode ? <article className="graph-detail-card" aria-live="polite"><div className="graph-detail-heading"><div><span className="eyebrow">{kindLabel(selectedNode.kind)} DETAILS</span><h4>{selectedNode.title}</h4></div><button type="button" className="icon-button" onClick={() => setSelectedNodeId(null)} aria-label="Close graph details"><X size={16} /></button></div><p>{selectedNode.detail.split('\n').map((line, index) => <span key={`${selectedNode.id}-${index}`}>{line}</span>)}</p><small>Source: {selectedNode.source}</small></article> : <div className="graph-select-hint"><CircleHelp size={16} /><span>Select any node to inspect its details and source.</span></div>}
        <p className="graph-provenance-note">Solid lines come from the alert and transaction records. Dashed evidence lines link a deterministic signal to the record field(s) it describes; policy lines mean the policy was retrieved for this case. A relationship is not proof of fraud.</p>
      </div>
      <details className="graph-relationships"><summary>Read relationship list ({visibleEdges.length})</summary><ul>{visibleEdges.map((edge) => <li key={`edge-${edge.id}`}><strong>{nodes.get(edge.source)?.title}</strong><span>{edge.label}</span><strong>{nodes.get(edge.target)?.title}</strong></li>)}</ul></details>
      <div className="graph-accessible-list"><h4>Graph contents</h4><ul>{visibleNodes.map((node) => <li key={`list-${node.id}`}><button type="button" onClick={() => focusNode(node)}>{kindLabel(node.kind)} — {node.title}: {node.subtitle}</button></li>)}</ul></div>
    </div>
  );
}

export default EvidenceGraph;
