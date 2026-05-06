'use client'
import { useState, useRef, useEffect } from 'react'

const NODES = [
  // Sources
  { id: 'sf1',   label: 'SF_Codex',        sub: 'Snowflake · CODEX',       type: 'source',    x: 40,  y: 60,  icon: '❄️' },
  { id: 'pg1',   label: 'prod_db',          sub: 'PostgreSQL · orders',     type: 'source',    x: 40,  y: 190, icon: '🐘' },
  { id: 'bq1',   label: 'bq_marketing',     sub: 'BigQuery · analytics',    type: 'source',    x: 40,  y: 320, icon: '📊' },
  { id: 'api1',  label: 'payments_api',     sub: 'REST API · v2',           type: 'source',    x: 40,  y: 450, icon: '🔌' },

  // Raw / Ingestion
  { id: 'raw1',  label: 'raw_orders',       sub: 'CODEX.RAW',               type: 'raw',       x: 240, y: 60,  icon: '📥' },
  { id: 'raw2',  label: 'raw_customers',    sub: 'CODEX.RAW',               type: 'raw',       x: 240, y: 190, icon: '📥' },
  { id: 'raw3',  label: 'raw_sessions',     sub: 'CODEX.RAW',               type: 'raw',       x: 240, y: 320, icon: '📥' },
  { id: 'raw4',  label: 'raw_payments',     sub: 'CODEX.RAW',               type: 'raw',       x: 240, y: 450, icon: '📥' },

  // Transforms (dbt models)
  { id: 't1',    label: 'fact_orders',      sub: 'CODEX.PUBLIC · dbt',      type: 'transform', x: 450, y: 30,  icon: '⚙️' },
  { id: 't2',    label: 'dim_customers',    sub: 'CODEX.PUBLIC · dbt',      type: 'transform', x: 450, y: 160, icon: '⚙️' },
  { id: 't3',    label: 'fact_inventory',   sub: 'CODEX.PUBLIC · dbt',      type: 'transform', x: 450, y: 290, icon: '⚙️' },
  { id: 't4',    label: 'fact_payments',    sub: 'CODEX.PUBLIC · dbt',      type: 'transform', x: 450, y: 420, icon: '⚙️' },
  { id: 't5',    label: 'web_sessions',     sub: 'CODEX.ANALYTICS · dbt',   type: 'transform', x: 450, y: 540, icon: '⚙️' },

  // Aggregations / Serving
  { id: 'agg1',  label: 'revenue_by_channel', sub: 'CODEX.ANALYTICS · view', type: 'warehouse', x: 670, y: 80,  icon: '🗄️' },
  { id: 'agg2',  label: 'customer_ltv',     sub: 'CODEX.ML · ML model',     type: 'warehouse', x: 670, y: 230, icon: '🗄️' },
  { id: 'agg3',  label: 'fact_returns',     sub: 'CODEX.PUBLIC · table',    type: 'warehouse', x: 670, y: 380, icon: '🗄️' },
  { id: 'agg4',  label: 'dim_products',     sub: 'CODEX.PUBLIC · table',    type: 'warehouse', x: 670, y: 510, icon: '🗄️' },

  // Outputs
  { id: 'out1',  label: 'Revenue Dashboard', sub: 'BI · Tableau',           type: 'output',    x: 890, y: 60,  icon: '📈' },
  { id: 'out2',  label: 'Finance Report',    sub: 'Export · weekly',        type: 'output',    x: 890, y: 190, icon: '📋' },
  { id: 'out3',  label: 'Churn ML Model',    sub: 'ML Pipeline · prod',     type: 'output',    x: 890, y: 310, icon: '🤖' },
  { id: 'out4',  label: 'Marketing CDP',     sub: 'Integration · Segment',  type: 'output',    x: 890, y: 430, icon: '📣' },
  { id: 'out5',  label: 'Ops Dashboard',     sub: 'BI · Grafana',           type: 'output',    x: 890, y: 540, icon: '⚡' },
]

const EDGES = [
  // Sources → Raw
  { from: 'sf1',  to: 'raw1' }, { from: 'sf1',  to: 'raw2' }, { from: 'sf1', to: 'raw3' },
  { from: 'pg1',  to: 'raw1' }, { from: 'pg1',  to: 'raw2' },
  { from: 'bq1',  to: 'raw3' },
  { from: 'api1', to: 'raw4' },
  // Raw → Transforms
  { from: 'raw1', to: 't1' }, { from: 'raw1', to: 't3' },
  { from: 'raw2', to: 't2' },
  { from: 'raw3', to: 't5' },
  { from: 'raw4', to: 't4' },
  // Transforms → Aggregations
  { from: 't1',   to: 'agg1' }, { from: 't1',   to: 'agg3' },
  { from: 't2',   to: 'agg2' },
  { from: 't3',   to: 'agg3' },
  { from: 't4',   to: 'agg1' }, { from: 't4',   to: 'agg3' },
  { from: 't5',   to: 'agg2' },
  { from: 'sf1',  to: 'agg4' },
  // Aggregations → Outputs
  { from: 'agg1', to: 'out1' }, { from: 'agg1', to: 'out2' },
  { from: 'agg2', to: 'out3' }, { from: 'agg2', to: 'out4' },
  { from: 'agg3', to: 'out2' }, { from: 'agg3', to: 'out5' },
  { from: 'agg4', to: 'out5' },
]

const NODE_W = 160, NODE_H = 56

const typeConfig = {
  source:    { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', label: 'Source' },
  raw:       { bg: '#fdf4ff', border: '#e9d5ff', color: '#7e22ce', label: 'Raw' },
  transform: { bg: '#faf5ff', border: '#c4b5fd', color: '#7c3aed', label: 'Transform' },
  warehouse: { bg: '#f0fdf4', border: '#86efac', color: '#166534', label: 'Warehouse' },
  output:    { bg: '#fff7ed', border: '#fdba74', color: '#c2410c', label: 'Output' },
}

function cx(node: typeof NODES[0]) { return node.x + NODE_W / 2 }
function cy(node: typeof NODES[0]) { return node.y + NODE_H / 2 }

// All searchable labels (label + sub)
const allSearchTerms = NODES.map(n => ({
  id: n.id,
  text: n.label,
  sub: n.sub,
  type: n.type,
  icon: n.icon,
}))

export default function LineagePage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const matches = search.trim().length > 0
    ? allSearchTerms.filter(t =>
        t.text.toLowerCase().includes(search.toLowerCase()) ||
        t.sub.toLowerCase().includes(search.toLowerCase()) ||
        t.type.toLowerCase().includes(search.toLowerCase())
      )
    : []

  function selectNode(id: string, label: string) {
    setSelected(id)
    setSearch(label)
    setShowDropdown(false)
    // Scroll detail panel into view
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }

  function clearSearch() {
    setSearch('')
    setSelected(null)
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const highlighted = selected
    ? new Set([selected, ...EDGES.filter(e => e.from === selected || e.to === selected).flatMap(e => [e.from, e.to])])
    : null

  const selectedNode = selected ? NODES.find(n => n.id === selected) : null
  const upstream = selected ? EDGES.filter(e => e.to === selected).map(e => NODES.find(n => n.id === e.from)!) : []
  const downstream = selected ? EDGES.filter(e => e.from === selected).map(e => NODES.find(n => n.id === e.to)!) : []

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!(e.target as Element).closest('.lineage-search-box')) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1400px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Data Lineage</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>End-to-end data flow · search or click any node to trace dependencies</p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {Object.entries(typeConfig).map(([type, cfg]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '4px 10px', borderRadius: '20px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: cfg.border }} />
              <span style={{ fontSize: '11px', color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="lineage-search-box" style={{ position: 'relative', maxWidth: '480px', marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none', opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
            onFocus={() => { if (search) setShowDropdown(true) }}
            placeholder="Search objects — fact_orders, dim_customers, Revenue Dashboard…"
            style={{ width: '100%', padding: '10px 40px 10px 38px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fff', color: '#0f172a', boxSizing: 'border-box', outline: 'none', boxShadow: showDropdown && matches.length > 0 ? '0 0 0 3px #dbeafe' : 'none', borderColor: showDropdown && matches.length > 0 ? '#93c5fd' : '#e2e8f0' }}
          />
          {search && (
            <button onClick={clearSearch} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '16px', lineHeight: 1 }}>✕</button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && matches.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, marginTop: '4px', maxHeight: '280px', overflowY: 'auto' }}>
            <div style={{ padding: '6px 12px', fontSize: '11px', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid #f3f1ea' }}>
              {matches.length} object{matches.length !== 1 ? 's' : ''} found
            </div>
            {matches.map(m => {
              const cfg = typeConfig[m.type as keyof typeof typeConfig]
              return (
                <div key={m.id} onMouseDown={() => selectNode(m.id, m.text)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{m.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a' }}>{m.text}</div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.sub}</div>
                  </div>
                  <span style={{ background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 600, flexShrink: 0 }}>{m.type}</span>
                </div>
              )
            })}
          </div>
        )}

        {showDropdown && search.trim().length > 0 && matches.length === 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, marginTop: '4px', padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            No objects found for &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      {/* Graph */}
      <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '14px', padding: '24px', overflowX: 'auto' }}>
        <svg width="1100" height="640" viewBox="0 0 1100 640" style={{ display: 'block', minWidth: '1100px' }}>
          <defs>
            <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#cbd5e1" />
            </marker>
            <marker id="arrow-hl" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#2563eb" />
            </marker>
            <marker id="arrow-up" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#16a34a" />
            </marker>
            <marker id="arrow-dn" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#ea580c" />
            </marker>
          </defs>

          {/* Lane labels */}
          {[{ x: 40, label: 'SOURCES' }, { x: 240, label: 'RAW LAYER' }, { x: 450, label: 'TRANSFORMS' }, { x: 670, label: 'WAREHOUSE' }, { x: 890, label: 'OUTPUTS' }].map(lane => (
            <text key={lane.x} x={lane.x + NODE_W / 2} y={20} textAnchor="middle" fontSize="10" fontWeight="600" fill="#94a3b8" letterSpacing="0.08em">{lane.label}</text>
          ))}

          {/* Lane dividers */}
          {[220, 430, 640, 860].map(x => (
            <line key={x} x1={x} y1={30} x2={x} y2={630} stroke="#f3f1ea" strokeWidth="1" strokeDasharray="4,4" />
          ))}

          {/* Edges */}
          {EDGES.map((edge, i) => {
            const from = NODES.find(n => n.id === edge.from)!
            const to   = NODES.find(n => n.id === edge.to)!
            const fx = cx(from) + NODE_W / 2 - 8
            const fy = cy(from)
            const tx = cx(to)  - NODE_W / 2 + 2
            const ty = cy(to)
            const midX = (fx + tx) / 2

            const isUpstream   = selected && highlighted?.has(edge.from) && highlighted?.has(edge.to) && EDGES.some(e => e.to === selected && e.from === edge.from)
            const isDownstream = selected && highlighted?.has(edge.from) && highlighted?.has(edge.to) && EDGES.some(e => e.from === selected && e.to === edge.to)
            const isHL = highlighted?.has(edge.from) && highlighted?.has(edge.to)

            const stroke = isUpstream ? '#16a34a' : isDownstream ? '#ea580c' : isHL ? '#2563eb' : '#e2e8f0'
            const marker = isUpstream ? 'url(#arrow-up)' : isDownstream ? 'url(#arrow-dn)' : isHL ? 'url(#arrow-hl)' : 'url(#arrow)'

            return (
              <path key={i}
                d={`M${fx},${fy} C${midX},${fy} ${midX},${ty} ${tx},${ty}`}
                fill="none" stroke={stroke} strokeWidth={isHL ? 2 : 1}
                markerEnd={marker}
                style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                opacity={highlighted && !isHL ? 0.15 : 1}
              />
            )
          })}

          {/* Nodes */}
          {NODES.map(node => {
            const cfg = typeConfig[node.type as keyof typeof typeConfig]
            const isSelected = selected === node.id
            const isDimmed = highlighted && !highlighted.has(node.id)
            return (
              <g key={node.id} style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (selected === node.id) { setSelected(null); setSearch('') }
                  else { selectNode(node.id, node.label) }
                }}>
                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={9}
                  fill={isSelected ? cfg.bg : cfg.bg}
                  stroke={isSelected ? '#2563eb' : cfg.border}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  opacity={isDimmed ? 0.2 : 1}
                  filter={isSelected ? 'drop-shadow(0 0 8px rgba(37,99,235,0.35))' : undefined}
                  style={{ transition: 'all 0.2s' }}
                />
                <text x={node.x + 10} y={node.y + 22} fontSize="14" opacity={isDimmed ? 0.2 : 1}>{node.icon}</text>
                <text x={node.x + 28} y={node.y + 22} fontSize="11.5" fontWeight={isSelected ? 700 : 600} fill={cfg.color} opacity={isDimmed ? 0.2 : 1}>{node.label}</text>
                <text x={node.x + 28} y={node.y + 38} fontSize="9.5" fill={cfg.color} opacity={isDimmed ? 0.1 : 0.6}>{node.sub}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div ref={detailRef} style={{ marginTop: '16px', background: '#fff', border: '1px solid #93c5fd', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 4px 16px rgba(37,99,235,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: typeConfig[selectedNode.type as keyof typeof typeConfig].bg, border: `1px solid ${typeConfig[selectedNode.type as keyof typeof typeConfig].border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{selectedNode.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#1a1a1a' }}>{selectedNode.label}</div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>{selectedNode.sub}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ background: typeConfig[selectedNode.type as keyof typeof typeConfig].bg, color: typeConfig[selectedNode.type as keyof typeof typeConfig].color, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>{selectedNode.type}</span>
              <button onClick={clearSearch} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '28px', height: '28px', borderRadius: '7px', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>✕</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Upstream */}
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11.5px', color: '#166534', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⬆</span> UPSTREAM SOURCES ({upstream.length})
              </div>
              {upstream.length > 0
                ? upstream.map(n => (
                    <div key={n.id} onClick={() => selectNode(n.id, n.label)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', marginBottom: '4px', cursor: 'pointer', background: 'rgba(255,255,255,0.6)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.6)')}>
                      <span style={{ fontSize: '14px' }}>{n.icon}</span>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#166534' }}>{n.label}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{n.sub}</div>
                      </div>
                    </div>
                  ))
                : <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No upstream sources — this is a root node</div>
              }
            </div>

            {/* Downstream */}
            <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11.5px', color: '#c2410c', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⬇</span> DOWNSTREAM CONSUMERS ({downstream.length})
              </div>
              {downstream.length > 0
                ? downstream.map(n => (
                    <div key={n.id} onClick={() => selectNode(n.id, n.label)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', marginBottom: '4px', cursor: 'pointer', background: 'rgba(255,255,255,0.6)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.6)')}>
                      <span style={{ fontSize: '14px' }}>{n.icon}</span>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#c2410c' }}>{n.label}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{n.sub}</div>
                      </div>
                    </div>
                  ))
                : <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No downstream consumers — this is a terminal node</div>
              }
            </div>
          </div>

          {/* Impact summary */}
          <div style={{ marginTop: '12px', background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', color: '#475569', display: 'flex', gap: '20px' }}>
            <span>📊 <strong>{upstream.length}</strong> upstream source{upstream.length !== 1 ? 's' : ''}</span>
            <span>📡 <strong>{downstream.length}</strong> downstream consumer{downstream.length !== 1 ? 's' : ''}</span>
            <span>🔗 <strong>{upstream.length + downstream.length}</strong> total connections</span>
            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>Click any upstream/downstream node to navigate to it</span>
          </div>
        </div>
      )}
    </div>
  )
}
