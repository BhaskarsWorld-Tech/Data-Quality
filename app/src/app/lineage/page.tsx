'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

/* ─── types ─────────────────────────────────────────────────────────────── */
interface Column { name: string; type: string; nullable: string; position: number }
interface TableMeta { name: string; rows: number; bytes: number; type: string; columnDetails?: Column[] }

interface LNode {
  id: string; label: string; sub: string
  type: 'source' | 'master' | 'transaction' | 'view' | 'other'
  x: number; y: number; icon: string; rows?: number
}

interface LEdge { from: string; to: string }

/* ─── node type config ───────────────────────────────────────────────────── */
const typeConfig = {
  source:      { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', label: 'Source'      },
  master:      { bg: '#f0fdfa', border: '#5eead4', color: '#0f766e', label: 'Master Data' },
  transaction: { bg: '#eff6ff', border: '#a5b4fc', color: '#4338ca', label: 'Transact.'   },
  view:        { bg: '#f5f3ff', border: '#c4b5fd', color: '#7c3aed', label: 'View'        },
  other:       { bg: '#fafaf5', border: '#d1d5db', color: '#374151', label: 'Table'       },
}

/* ─── smart table classification ─────────────────────────────────────────── */
const MASTER_KEYWORDS = ['SUPPLIER', 'CUSTOMER', 'PRODUCT', 'CATEGORY', 'WAREHOUSE', 'CARRIER', 'LOCATION', 'EMPLOYEE', 'VENDOR']
const TRANS_KEYWORDS  = ['ORDER', 'INVENTORY', 'SHIPMENT', 'INVOICE', 'PAYMENT', 'RETURN', 'SALE', 'FORECAST', 'RECEIPT', 'STOCK', 'TRANSACTION']

function classifyTable(name: string, type: string): LNode['type'] {
  if (!name) return 'other'
  const u = String(name).toUpperCase()
  type = String(type ?? '')
  if (type === 'VIEW' || type === 'MATERIALIZED VIEW' || u.startsWith('VW_') || u.endsWith('_MV')) return 'view'
  if (u.startsWith('DIM_'))                       return 'master'
  if (u.startsWith('FACT_'))                      return 'transaction'
  if (TRANS_KEYWORDS.some(k  => u.includes(k)))  return 'transaction'
  if (MASTER_KEYWORDS.some(k => u.includes(k)))  return 'master'
  return 'other'
}

function tableIcon(name: string): string {
  const u = name.toUpperCase()
  if (u.startsWith('VW_'))             return '🔍'
  if (u.includes('SUPPLIER'))          return '🏭'
  if (u.includes('CUSTOMER'))          return '👥'
  if (u.includes('PRODUCT_CAT'))       return '🗂️'
  if (u.includes('PRODUCT'))           return '📦'
  if (u.includes('WAREHOUSE'))         return '🏗️'
  if (u.includes('CARRIER'))           return '🚛'
  if (u.includes('LOCATION'))          return '📍'
  if (u.includes('PURCHASE'))          return '📋'
  if (u.includes('SALE') || u.includes('SALES'))  return '💰'
  if (u.includes('INVENTORY'))         return '📊'
  if (u.includes('SHIPMENT'))          return '🚢'
  if (u.includes('RECEIPT'))           return '📥'
  if (u.includes('FORECAST'))          return '📈'
  if (u.includes('QUALITY') || u.includes('INSP')) return '🔎'
  if (u.includes('RETURN'))            return '↩️'
  return '❄️'
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 5)    return 'just now'
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

/* ─── build graph ────────────────────────────────────────────────────────── */
const NODE_W = 180, NODE_H = 58
const SPACING = 72  // vertical gap between nodes in a column

interface ViewDep { view: string; references: string[] }
interface ColumnLineageEntry {
  view:       string
  column:     string
  upstream:   Array<{ table: string; column: string }>
  expression: string
}

function buildGraph(
  tables: TableMeta[],
  connectionName: string,
  database: string,
  schema: string,
  viewDeps: ViewDep[] = []
): { nodes: LNode[]; edges: LEdge[]; canvasW: number; canvasH: number } {
  const classified = tables.map(t => ({ ...t, nodeType: classifyTable(t.name, t.type) }))

  const masters      = classified.filter(t => t.nodeType === 'master')
  const transactions = classified.filter(t => t.nodeType === 'transaction')
  const views        = classified.filter(t => t.nodeType === 'view')
  const others       = classified.filter(t => t.nodeType === 'other')

  // All non-view, non-classified → dump into transactions if there are no clean groups
  const allMaster  = masters.length > 0 ? masters       : []
  const allTrans   = transactions.length > 0 ? transactions : []
  const allOther   = others

  // Determine columns needed
  const hasViews  = views.length > 0
  const hasFacts  = allTrans.length > 0
  const hasMaster = allMaster.length > 0 || allOther.length > 0
  const allLeft   = [...allMaster, ...allOther]

  // X positions based on how many columns we need
  let COL_X: Record<string, number>
  if (hasViews && hasFacts) {
    COL_X = { source: 20, master: 250, trans: 490, view: 730 }
  } else if (hasFacts) {
    COL_X = { source: 20, master: 250, trans: 490, view: 490 }
  } else {
    COL_X = { source: 20, master: 250, trans: 250, view: 250 }
  }

  // Canvas height = enough for tallest column
  const maxColCount = Math.max(allLeft.length, allTrans.length, views.length, 1)
  const canvasH     = Math.max(400, maxColCount * SPACING + NODE_H + 60)
  const canvasW     = (hasViews ? 730 : hasFacts ? 490 : 250) + NODE_W + 30

  function colStartY(count: number): number {
    const totalH = count * SPACING
    return Math.max(30, (canvasH - totalH) / 2)
  }

  const nodes: LNode[] = []
  const edges: LEdge[] = []

  // Source node (centered)
  nodes.push({
    id: 'SOURCE', label: database || 'Snowflake',
    sub: `${connectionName} · ${schema}`,
    type: 'source', x: COL_X.source, y: canvasH / 2 - NODE_H / 2,
    icon: '❄️',
  })

  // Master / Other column
  if (allLeft.length > 0) {
    const startY = colStartY(allLeft.length)
    allLeft.forEach((t, i) => {
      nodes.push({
        id: t.name, label: t.name, sub: `${schema} · ${t.nodeType === 'view' ? 'View' : 'Table'}`,
        type: t.nodeType as LNode['type'],
        x: COL_X.master, y: startY + i * SPACING,
        icon: tableIcon(t.name), rows: t.rows,
      })
      edges.push({ from: 'SOURCE', to: t.name })
    })
  }

  // Transaction column
  if (allTrans.length > 0) {
    const startY = colStartY(allTrans.length)
    allTrans.forEach((t, i) => {
      nodes.push({
        id: t.name, label: t.name, sub: `${schema} · Table`,
        type: 'transaction', x: COL_X.trans, y: startY + i * SPACING,
        icon: tableIcon(t.name), rows: t.rows,
      })
      edges.push({ from: 'SOURCE', to: t.name })
      // Connect master data → transactions that reference them
      allLeft.forEach(m => {
        const base = m.name.toUpperCase().replace(/S$/, '') // strip trailing S
        if (t.name.toUpperCase().includes(base.split('_')[0])) {
          edges.push({ from: m.name, to: t.name })
        }
      })
    })
  }

  // View column — sort views topologically so dependent views appear after
  // the views they depend on (reads top-to-bottom in render order).
  if (views.length > 0) {
    const depByView   = new Map(viewDeps.map(d => [d.view.toUpperCase(), d.references.map(r => r.toUpperCase())]))
    const allBaseSet  = new Set([...allLeft, ...allTrans].map(t => t.name.toUpperCase()))
    const allViewSet  = new Set(views.map(v => v.name.toUpperCase()))

    // Topological sort so a view that depends on another view appears later.
    const order: typeof views = []
    const placed = new Set<string>()
    function place(v: typeof views[number]) {
      const key = v.name.toUpperCase()
      if (placed.has(key)) return
      const refs = depByView.get(key) ?? []
      // Place any prerequisite views first (DFS, guard against cycles)
      placed.add(key) // mark before recursion to break cycles
      refs.forEach(r => {
        if (allViewSet.has(r)) {
          const dep = views.find(x => x.name.toUpperCase() === r)
          if (dep) place(dep)
        }
      })
      order.push(v)
    }
    views.forEach(place)

    const startY = colStartY(order.length)
    order.forEach((t, i) => {
      const isMV = (t.type ?? '').toUpperCase() === 'MATERIALIZED VIEW' || t.name.toUpperCase().endsWith('_MV')
      nodes.push({
        id: t.name, label: t.name,
        sub: `${schema} · ${isMV ? 'Materialized View' : 'View'}`,
        type: 'view', x: COL_X.view, y: startY + i * SPACING,
        icon: isMV ? '🧊' : tableIcon(t.name), rows: t.rows,
      })

      // Use the parsed view definition. References can point to either base
      // tables OR other views — both are valid lineage edges.
      const refs = depByView.get(t.name.toUpperCase())
      if (refs && refs.length > 0) {
        refs.forEach(refName => {
          let actualName: string | undefined
          if (allBaseSet.has(refName)) {
            actualName = [...allLeft, ...allTrans].find(b => b.name.toUpperCase() === refName)?.name
          } else if (allViewSet.has(refName) && refName !== t.name.toUpperCase()) {
            // View-to-view dependency
            actualName = views.find(v => v.name.toUpperCase() === refName)?.name
          }
          if (actualName) edges.push({ from: actualName, to: t.name })
        })
      } else if (refs && refs.length === 0) {
        // View has a definition but references no in-schema objects — leave as terminal.
      } else {
        // No definition data — legacy fallback to fan-out from base tables only.
        ;[...allLeft, ...allTrans].forEach(base => edges.push({ from: base.name, to: t.name }))
      }
    })
  }

  // De-duplicate edges
  const uniqueEdges = [...new Map(edges.map(e => [`${e.from}→${e.to}`, e])).values()]

  return { nodes, edges: uniqueEdges, canvasW, canvasH }
}

/* ─── component ─────────────────────────────────────────────────────────── */
export default function LineagePage() {
  const [tables, setTables]       = useState<TableMeta[]>([])
  const [viewDeps, setViewDeps]   = useState<ViewDep[]>([])
  const [columnLineage, setColumnLineage] = useState<ColumnLineageEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [error, setError]         = useState('')
  const [connInfo, setConnInfo]   = useState({ id: '', name: 'DM_Solutions', database: 'SUPPLYCHAIN_DB', schema: 'SUPPLYCHAIN' })
  const [selected, setSelected]   = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<LNode['type'] | null>(null)
  const [search, setSearch]       = useState('')
  const [showDrop, setShowDrop]   = useState(false)
  const [autoRefreshSec, setAutoRefreshSec] = useState<0 | 10 | 30 | 60 | 300>(30) // 30s default
  const inputRef  = useRef<HTMLInputElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const cidRef    = useRef<string>('')

  /** Single shared loader — used by initial mount, manual refresh, polling, and focus events. */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else         setRefreshing(true)
    try {
      // Pick the active connection first so we can pass its id to the overview API
      let activeId = cidRef.current
      if (!activeId) {
        const connRes = await fetch('/api/connections')
        if (connRes.ok) {
          const conns = await connRes.json() as Array<{ id?: string; name?: string; database?: string; schema?: string; status?: string }>
          const active = conns.find(c => c.status === 'active') ?? conns[0]
          if (active) {
            activeId = active.id ?? ''
            cidRef.current = activeId
            setConnInfo({ id: activeId, name: active.name ?? 'Snowflake', database: active.database ?? '', schema: active.schema ?? '' })
          }
        }
      }

      // /api/snowflake/overview returns BOTH table metadata and parsed view definitions
      const overviewUrl = activeId ? `/api/snowflake/overview?connectionId=${activeId}` : '/api/snowflake/overview'
      const ovRes = await fetch(overviewUrl, { cache: 'no-store' })
      if (!ovRes.ok) throw new Error('Failed to fetch overview')
      const ov = await ovRes.json() as {
        tables?:   Array<Record<string, unknown>>
        viewDeps?: ViewDep[]
        columnLineage?: ColumnLineageEntry[]
      }

      const normalized: TableMeta[] = (ov.tables ?? []).map(t => ({
        name:  (t.TABLE_NAME ?? t.name)   as string,
        type:  (t.TABLE_TYPE ?? t.type)   as string,
        rows:  ((t.ROW_COUNT ?? t.rows)   as number) ?? 0,
        bytes: ((t.BYTES     ?? t.bytes)  as number) ?? 0,
        columnDetails: (t.columnDetails as Column[]) ?? [],
      }))
      setTables(normalized)
      setViewDeps(ov.viewDeps ?? [])
      setColumnLineage(ov.columnLineage ?? [])
      setError('')
      setLastRefresh(new Date())
    } catch (e) { setError((e as Error).message) }
    finally     { setLoading(false); setRefreshing(false) }
  }, [])

  // Initial load on mount
  useEffect(() => { load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [])

  // Auto-refresh on a configurable interval
  useEffect(() => {
    if (autoRefreshSec === 0) return
    const id = setInterval(() => { load(true) }, autoRefreshSec * 1000)
    return () => clearInterval(id)
  }, [autoRefreshSec, load])

  // Refresh whenever the user switches back to the tab — picks up changes
  // they made in Snowflake while looking at another window.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [load])

  const { nodes, edges, canvasW, canvasH } = buildGraph(tables, connInfo.name, connInfo.database, connInfo.schema, viewDeps)
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

  // Object-level matches (table / view name contains the search string)
  const searchMatches = search.trim().length > 0
    ? nodes.filter(n => n.id !== 'SOURCE' && n.label.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : []

  // Column-level matches: returns { tableName, columnName, type } for any column
  // whose name contains the search string. Used to find which objects expose a
  // given column.
  type ColumnHit = { tableName: string; columnName: string; columnType: string }
  const columnMatches: ColumnHit[] = search.trim().length > 0
    ? tables.flatMap(t =>
        (t.columnDetails ?? [])
          .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
          .map(c => ({ tableName: t.name, columnName: c.name, columnType: c.type }))
      ).slice(0, 15)
    : []

  function selectNode(id: string, label: string) {
    setSelected(id); setSearch(id === 'SOURCE' ? label : label); setShowDrop(false)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }
  function clearSearch() { setSelected(null); setSearch(''); setShowDrop(false); inputRef.current?.focus() }

  /** BFS the lineage graph to collect every transitive upstream/downstream node,
   *  grouped by hop distance from the selected node. */
  function traverse(start: string, direction: 'up' | 'down'): { node: LNode; depth: number }[] {
    const visited = new Set<string>([start])
    const queue: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }]
    const out: { node: LNode; depth: number }[] = []
    while (queue.length) {
      const { id, depth } = queue.shift()!
      const next = direction === 'up'
        ? edges.filter(e => e.to   === id).map(e => e.from)
        : edges.filter(e => e.from === id).map(e => e.to)
      for (const n of next) {
        if (visited.has(n)) continue
        visited.add(n)
        const node = nodeMap[n]
        if (node) {
          out.push({ node, depth: depth + 1 })
          queue.push({ id: n, depth: depth + 1 })
        }
      }
    }
    return out
  }

  const selectedNode = selected ? nodeMap[selected] : null
  const upstreamAll   = selected ? traverse(selected, 'up')   : []
  const downstreamAll = selected ? traverse(selected, 'down') : []

  // Highlight every node and edge in the transitive lineage path
  const highlighted = selected
    ? new Set<string>([selected, ...upstreamAll.map(u => u.node.id), ...downstreamAll.map(d => d.node.id)])
    : null

  // Group by hop depth (for the rendered list)
  function byDepth(items: { node: LNode; depth: number }[]) {
    const groups: Record<number, LNode[]> = {}
    items.forEach(i => { (groups[i.depth] ||= []).push(i.node) })
    return Object.keys(groups).map(Number).sort((a, b) => a - b).map(d => ({ depth: d, nodes: groups[d] }))
  }
  const upstreamGroups   = byDepth(upstreamAll)
  const downstreamGroups = byDepth(downstreamAll)

  useEffect(() => {
    function h(e: MouseEvent) { if (!(e.target as Element).closest('.lineage-search')) setShowDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Compute columns for lane labels
  const hasMasters = nodes.some(n => n.type === 'master' || n.type === 'other')
  const hasTrans   = nodes.some(n => n.type === 'transaction')
  const hasViews   = nodes.some(n => n.type === 'view')

  const lanes = [
    { type: 'source', label: 'SOURCE',       show: true },
    { type: 'master', label: 'MASTER DATA',  show: hasMasters },
    { type: 'transaction', label: 'TRANSACTIONS', show: hasTrans },
    { type: 'view',   label: 'VIEWS',        show: hasViews },
  ]

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1400px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>

      <style>{`@keyframes ln-spin { from { transform: rotate(0) } to { transform: rotate(360deg) } } @keyframes ln-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Data Lineage</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            {loading ? 'Loading from Snowflake…'
              : error ? 'Could not connect to Snowflake'
              : `${connInfo.database}.${connInfo.schema} · ${tables.length} tables · click any node to trace dependencies`}
          </p>
        </div>

        {/* Refresh controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {refreshing && (
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', animation: 'ln-pulse 1.2s ease-in-out infinite' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
              Live
            </span>
          )}
          {lastRefresh && !refreshing && (
            <span style={{ fontSize: '11px', color: '#94a3b8' }} title={lastRefresh.toLocaleString()}>
              Updated {timeAgo(lastRefresh)}
            </span>
          )}
          <button onClick={() => load(true)} disabled={refreshing || loading} title="Refresh now"
            style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '7px 12px', borderRadius: '8px', cursor: refreshing || loading ? 'not-allowed' : 'pointer', fontSize: '12.5px', color: '#475569', fontWeight: 600, opacity: refreshing || loading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', animation: refreshing ? 'ln-spin 1s linear infinite' : 'none' }}>⟳</span>
            Refresh
          </button>
          <select value={autoRefreshSec} onChange={e => setAutoRefreshSec(parseInt(e.target.value, 10) as 0 | 10 | 30 | 60 | 300)}
            title="Auto-refresh interval"
            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: autoRefreshSec === 0 ? '#fff' : '#dcfce7', fontSize: '12px', color: autoRefreshSec === 0 ? '#475569' : '#16a34a', fontWeight: 600, cursor: 'pointer' }}>
            <option value={0}>Auto-refresh: off</option>
            <option value={10}>Every 10 s</option>
            <option value={30}>Every 30 s</option>
            <option value={60}>Every 1 min</option>
            <option value={300}>Every 5 min</option>
          </select>
        </div>
      </div>

      {/* Legend row — click to filter; click again to clear */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        {(Object.entries(typeConfig) as [LNode['type'], typeof typeConfig.source][]).map(([type, cfg]) => {
          const count    = nodes.filter(n => n.type === type).length
          const isActive = typeFilter === type
          const isDim    = typeFilter !== null && !isActive
          return (
            <button key={type}
              onClick={() => setTypeFilter(isActive ? null : type)}
              title={isActive ? `Showing only ${cfg.label} · click to clear` : `Click to highlight only ${cfg.label} nodes`}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: isActive ? cfg.color : cfg.bg,
                border: `${isActive ? 2 : 1}px solid ${cfg.color}`,
                padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                opacity: isDim ? 0.5 : 1,
                boxShadow: isActive ? `0 2px 8px ${cfg.color}50` : 'none',
                transition: 'all 0.15s',
              }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isActive ? '#fff' : cfg.color }} />
              <span style={{ fontSize: '11px', color: isActive ? '#fff' : cfg.color, fontWeight: isActive ? 700 : 500 }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: '10px', color: isActive ? 'rgba(255,255,255,0.85)' : cfg.color, fontWeight: 600, background: isActive ? 'rgba(255,255,255,0.2)' : '#fff', padding: '0 6px', borderRadius: '10px' }}>
                {count}
              </span>
            </button>
          )
        })}
        {typeFilter !== null && (
          <button onClick={() => setTypeFilter(null)}
            style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', color: '#475569', fontWeight: 500 }}>
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* Search */}
      <div className="lineage-search" style={{ position: 'relative', maxWidth: '480px', marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none', opacity: 0.5 }}>🔍</span>
          <input ref={inputRef} value={search}
            onChange={e => { setSearch(e.target.value); setShowDrop(true) }}
            onFocus={() => { if (search) setShowDrop(true) }}
            placeholder={loading ? 'Loading…' : `Search tables or columns (e.g. EMAIL, CUSTOMER_ID)…`}
            disabled={loading}
            style={{ width: '100%', padding: '10px 40px 10px 38px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fff', color: '#0f172a', boxSizing: 'border-box', outline: 'none', boxShadow: showDrop && (searchMatches.length > 0 || columnMatches.length > 0) ? '0 0 0 3px #dbeafe' : 'none' }}
          />
          {search && <button onClick={clearSearch} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }}>✕</button>}
        </div>
        {showDrop && (searchMatches.length > 0 || columnMatches.length > 0) && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, marginTop: '4px', maxHeight: '440px', overflowY: 'auto' }}>
            {searchMatches.length > 0 && (
              <>
                <div style={{ padding: '8px 14px', fontSize: '10.5px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', background: '#fafaf9', borderBottom: '1px solid #f1f5f9' }}>
                  OBJECTS · {searchMatches.length}
                </div>
                {searchMatches.map(m => {
                  const cfg = typeConfig[m.type]
                  return (
                    <div key={m.id} onMouseDown={() => selectNode(m.id, m.label)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{m.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a' }}>{m.label}</div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{m.sub}{m.rows && m.rows > 0 ? ` · ${fmt(m.rows)} rows` : ''}</div>
                      </div>
                      <span style={{ background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 600 }}>{cfg.label}</span>
                    </div>
                  )
                })}
              </>
            )}
            {columnMatches.length > 0 && (
              <>
                <div style={{ padding: '8px 14px', fontSize: '10.5px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', background: '#fafaf9', borderBottom: '1px solid #f1f5f9', borderTop: searchMatches.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
                  COLUMNS · {columnMatches.length}{columnMatches.length >= 15 ? '+' : ''}
                </div>
                {columnMatches.map((cm, i) => {
                  const node = nodes.find(n => n.label === cm.tableName)
                  const cfg  = node ? typeConfig[node.type] : typeConfig.other
                  return (
                    <div key={i} onMouseDown={() => node && selectNode(node.id, node.label)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fef3c7')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: '14px' }}>🔡</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', color: '#1a1a1a', fontFamily: 'monospace' }}>
                          <span style={{ fontWeight: 700 }}>{cm.columnName}</span>
                          <span style={{ color: '#94a3b8' }}> in </span>
                          <span style={{ fontWeight: 600, color: cfg.color }}>{cm.tableName}</span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '20px', fontFamily: 'monospace', fontWeight: 600 }}>{cm.columnType}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600 }}>Open ↗</span>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Graph */}
      <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '14px', padding: '24px', overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '12px', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px' }}>❄️</div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>Connecting to Snowflake…</div>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '8px', color: '#dc2626' }}>
            <div style={{ fontSize: '32px' }}>⚠️</div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>Could not load lineage: {error}</div>
          </div>
        ) : (
          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} style={{ display: 'block', minWidth: `${canvasW}px`, overflow: 'visible' }}>
            <defs>
              <marker id="arr"    markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#cbd5e1" /></marker>
              <marker id="arr-hl" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#2563eb" /></marker>
              <marker id="arr-up" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#16a34a" /></marker>
              <marker id="arr-dn" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#ea580c" /></marker>
            </defs>

            {/* Lane labels and dividers */}
            {nodes.length > 0 && lanes.filter(l => l.show).map((lane, li) => {
              const firstNodeOfType = nodes.find(n => n.type === lane.type)
              if (!firstNodeOfType) return null
              const x = firstNodeOfType.x + NODE_W / 2
              return (
                <g key={lane.type}>
                  {li > 0 && <line x1={firstNodeOfType.x - 14} y1={20} x2={firstNodeOfType.x - 14} y2={canvasH - 10} stroke="#f3f1ea" strokeWidth="1" strokeDasharray="4 4" />}
                  <text x={x} y={16} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#94a3b8" letterSpacing="0.08em">{lane.label}</text>
                </g>
              )
            })}

            {/* Edges */}
            {edges.map((edge, i) => {
              const from = nodeMap[edge.from], to = nodeMap[edge.to]
              if (!from || !to) return null
              const fx = from.x + NODE_W - 4
              const fy = from.y + NODE_H / 2
              const tx = to.x + 2
              const ty = to.y + NODE_H / 2
              const midX = (fx + tx) / 2

              const upIds = new Set(upstreamAll.map(u => u.node.id))
              const dnIds = new Set(downstreamAll.map(d => d.node.id))
              // An edge is "upstream" if both endpoints are on the upstream path from selected
              const onUpstream   = (upIds.has(edge.from) && (upIds.has(edge.to)   || edge.to   === selected))
              const onDownstream = (dnIds.has(edge.to)   && (dnIds.has(edge.from) || edge.from === selected))
              const isUp = onUpstream
              const isDn = onDownstream
              const isHL = isUp || isDn

              const stroke = isUp ? '#16a34a' : isDn ? '#ea580c' : isHL ? '#2563eb' : '#e2e8f0'
              const marker = isUp ? 'url(#arr-up)' : isDn ? 'url(#arr-dn)' : isHL ? 'url(#arr-hl)' : 'url(#arr)'

              // Dim edges when a node-type filter is on and neither endpoint matches
              const edgeFiltered = typeFilter !== null
                                && from.type !== typeFilter
                                && to.type   !== typeFilter
              const dimByHL  = !!(highlighted && !isHL)
              return (
                <path key={i} d={`M${fx},${fy} C${midX},${fy} ${midX},${ty} ${tx},${ty}`}
                  fill="none" stroke={stroke} strokeWidth={isHL ? 2 : 1}
                  markerEnd={marker} style={{ transition: 'stroke 0.2s' }}
                  opacity={(dimByHL || edgeFiltered) ? 0.05 : 1}
                />
              )
            })}

            {/* Render non-selected nodes first so the expanded selected card sits on top */}
            {nodes.filter(n => n.id !== selected).map(node => {
              const cfg        = typeConfig[node.type]
              const isDimmed   = (highlighted && !highlighted.has(node.id))
                              || (typeFilter !== null && node.type !== typeFilter)
              const shortLabel = node.label.length > 22 ? node.label.slice(0, 21) + '…' : node.label
              return (
                <g key={node.id} style={{ cursor: 'pointer' }}
                  onClick={() => selectNode(node.id, node.label)}>
                  <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={9}
                    fill={cfg.bg} stroke={cfg.border} strokeWidth={1.5}
                    opacity={isDimmed ? 0.12 : 1}
                    style={{ transition: 'all 0.2s' }}
                  />
                  <text x={node.x + 10} y={node.y + 21} fontSize="14" opacity={isDimmed ? 0.12 : 1}>{node.icon}</text>
                  <text x={node.x + 30} y={node.y + 22} fontSize="10.5" fontWeight={600} fill={cfg.color} opacity={isDimmed ? 0.12 : 1}>{shortLabel}</text>
                  <text x={node.x + 30} y={node.y + 38} fontSize="9.5" fill={cfg.color} opacity={isDimmed ? 0.05 : 0.55}>
                    {node.rows !== undefined && node.rows > 0 ? `${fmt(node.rows)} rows · ` : ''}{cfg.label}
                  </text>
                  {node.rows !== undefined && node.rows > 0 && (
                    <circle cx={node.x + NODE_W - 10} cy={node.y + 11} r="5" fill="#16a34a" opacity={isDimmed ? 0.12 : 0.85} />
                  )}
                </g>
              )
            })}

            {/* Render the SELECTED node last as an expanded HTML card.
                The card is placed BESIDE the node (right when possible,
                left when too close to the right edge) so it never covers
                the node itself or other adjacent nodes. Y is clamped so
                the card stays inside the canvas. */}
            {selectedNode && (() => {
              const node = selectedNode
              const cfg  = typeConfig[node.type]
              const tbl  = tables.find(t => t.name === node.label)
              const cols = tbl?.columnDetails ?? []

              const cardW = 280
              const cardH = node.id === 'SOURCE' ? NODE_H : 420   // fixed; inner list scrolls

              // Prefer right of node; flip to the left if we'd run off the right edge
              const GAP    = 16
              const wantX  = node.x + NODE_W + GAP
              const cardX  = wantX + cardW > canvasW
                  ? Math.max(10, node.x - cardW - GAP)            // place to the left
                  : wantX
              // Vertical: align top of card with top of node, clamp inside canvas
              const cardY  = Math.max(10, Math.min(node.y, canvasH - cardH - 10))

              return (
                <foreignObject x={cardX} y={cardY} width={cardW} height={cardH} style={{ overflow: 'visible' }}>
                  <NodeColumnCard
                    node={node}
                    cfg={cfg}
                    cols={cols}
                    schema={connInfo.schema}
                    columnLineage={columnLineage}
                    tables={tables}
                    onClose={() => clearSearch()}
                    onJumpToTable={(name) => {
                      const target = nodes.find(n => n.label === name)
                      if (target) selectNode(target.id, target.label)
                    }}
                  />
                </foreignObject>
              )
            })()}
          </svg>
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div ref={detailRef} style={{ marginTop: '16px', background: '#fff', border: '1px solid #93c5fd', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 4px 16px rgba(37,99,235,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: typeConfig[selectedNode.type].bg, border: `1px solid ${typeConfig[selectedNode.type].border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{selectedNode.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#1a1a1a' }}>{selectedNode.label}</div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>
                  {selectedNode.sub}{selectedNode.rows && selectedNode.rows > 0 ? ` · ${fmt(selectedNode.rows)} live rows` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ background: typeConfig[selectedNode.type].bg, color: typeConfig[selectedNode.type].color, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{typeConfig[selectedNode.type].label}</span>
              <button onClick={clearSearch} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '28px', height: '28px', borderRadius: '7px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* UPSTREAM — full chain back to source, grouped by hop depth */}
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11.5px', color: '#166534', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⬆ UPSTREAM CHAIN ({upstreamAll.length})</span>
                {upstreamGroups.length > 0 && <span style={{ background: '#fff', padding: '1px 8px', borderRadius: '20px', color: '#166534', fontSize: '10.5px' }}>{upstreamGroups.length} hop{upstreamGroups.length === 1 ? '' : 's'} to source</span>}
              </div>
              {upstreamGroups.length === 0
                ? <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Root node — no upstream sources</div>
                : upstreamGroups.map(({ depth, nodes: hopNodes }) => (
                    <div key={depth} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#166534', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '4px', textTransform: 'uppercase' }}>
                        ↑ Hop {depth} {depth === upstreamGroups[upstreamGroups.length - 1].depth ? '(source / root)' : ''}
                      </div>
                      {hopNodes.map(n => (
                        <div key={n.id} onClick={() => selectNode(n.id, n.label)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', marginBottom: '3px', cursor: 'pointer', background: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fff')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.7)')}>
                          <span style={{ fontSize: '14px' }}>{n.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#166534' }}>{n.label}</div>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>{typeConfig[n.type].label}{n.rows && n.rows > 0 ? ` · ${fmt(n.rows)} rows` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
              }
            </div>

            {/* DOWNSTREAM — full chain to all leaf consumers */}
            <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11.5px', color: '#c2410c', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⬇ DOWNSTREAM CHAIN ({downstreamAll.length})</span>
                {downstreamGroups.length > 0 && <span style={{ background: '#fff', padding: '1px 8px', borderRadius: '20px', color: '#c2410c', fontSize: '10.5px' }}>{downstreamGroups.length} hop{downstreamGroups.length === 1 ? '' : 's'} to leaf</span>}
              </div>
              {downstreamGroups.length === 0
                ? <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Terminal node — no downstream consumers</div>
                : downstreamGroups.map(({ depth, nodes: hopNodes }) => (
                    <div key={depth} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#c2410c', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '4px', textTransform: 'uppercase' }}>
                        ↓ Hop {depth}
                      </div>
                      {hopNodes.map(n => (
                        <div key={n.id} onClick={() => selectNode(n.id, n.label)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', marginBottom: '3px', cursor: 'pointer', background: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fff')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.7)')}>
                          <span style={{ fontSize: '14px' }}>{n.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#c2410c' }}>{n.label}</div>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>{typeConfig[n.type].label}{n.rows && n.rows > 0 ? ` · ${fmt(n.rows)} rows` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
              }
            </div>
          </div>
          {/* Column-level details for the selected object */}
          <ColumnsPanel selectedNode={selectedNode} tables={tables} schema={connInfo.schema} />

          <div style={{ marginTop: '12px', background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', color: '#475569', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span>📊 <strong>{upstreamAll.length}</strong> total upstream</span>
            <span>📡 <strong>{downstreamAll.length}</strong> total downstream</span>
            <span style={{ color: '#166534' }}>⬆ <strong>{upstreamGroups.length}</strong>-hop path to source</span>
            {selectedNode.rows && selectedNode.rows > 0 && <span style={{ color: '#16a34a' }}>✓ <strong>{fmt(selectedNode.rows)}</strong> live rows</span>}
            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>Click any node in the chain to drill down</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Column details + search panel for a selected node ────────────────── */
const DATA_TYPE_COLOR: Record<string, string> = {
  NUMBER: '#1d4ed8', FLOAT: '#1d4ed8', INT: '#1d4ed8', INTEGER: '#1d4ed8', DECIMAL: '#1d4ed8', NUMERIC: '#1d4ed8',
  TEXT: '#047857', VARCHAR: '#047857', STRING: '#047857', CHAR: '#047857',
  DATE: '#7c3aed', TIMESTAMP_NTZ: '#7c3aed', TIMESTAMP: '#7c3aed', DATETIME: '#7c3aed',
  BOOLEAN: '#c2410c',
}

function ColumnsPanel({ selectedNode, tables, schema }: {
  selectedNode: LNode
  tables: TableMeta[]
  schema: string
}) {
  const [colSearch, setColSearch] = useState('')
  if (selectedNode.id === 'SOURCE') return null

  const tbl = tables.find(t => t.name === selectedNode.label)
  const columns = tbl?.columnDetails ?? []

  const filtered = colSearch.trim()
    ? columns.filter(c => c.name.toLowerCase().includes(colSearch.toLowerCase()) || c.type.toLowerCase().includes(colSearch.toLowerCase()))
    : columns

  const sorted = [...filtered].sort((a, b) => a.position - b.position)
  const nullable = columns.filter(c => c.nullable === 'YES').length

  return (
    <div style={{ marginTop: '14px', background: '#fafaf9', border: '1px solid #ebe8df', borderRadius: '10px', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 700, letterSpacing: '0.06em' }}>
          📋 COLUMNS ({columns.length})
        </span>
        {columns.length > 0 && (
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            {nullable} nullable · {columns.length - nullable} NOT NULL
          </span>
        )}
        <input value={colSearch} onChange={e => setColSearch(e.target.value)}
          placeholder={`Search columns in ${selectedNode.label}…`}
          style={{ marginLeft: 'auto', flex: 1, maxWidth: '320px', padding: '6px 10px', borderRadius: '7px', border: '1px solid #e2e8f0', fontSize: '12px', background: '#fff', color: '#0f172a', boxSizing: 'border-box', fontFamily: 'monospace' }}
        />
        {colSearch && (
          <button onClick={() => setColSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>✕</button>
        )}
      </div>

      {columns.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
          Column metadata unavailable for this object.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
          No columns match &ldquo;{colSearch}&rdquo;.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '8px', overflow: 'hidden', maxHeight: '300px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                {['#', 'Column', 'Type', 'Nullable', 'Path'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 12px', fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(col => {
                const dtColor = DATA_TYPE_COLOR[col.type.toUpperCase()] ?? '#374151'
                const isKey   = col.name.toUpperCase().endsWith('_ID') || col.name.toUpperCase().endsWith('_KEY') || col.name.toUpperCase() === 'ID'
                return (
                  <tr key={col.name} style={{ borderBottom: '1px solid #f3f1ea' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafaf9')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '6px 12px', color: '#94a3b8', fontSize: '11px' }}>{col.position}</td>
                    <td style={{ padding: '6px 12px', fontWeight: isKey ? 700 : 500, color: isKey ? '#1d4ed8' : '#1a1a1a', fontFamily: 'monospace' }}>
                      {isKey && <span title="Key" style={{ marginRight: '4px' }}>🔑</span>}
                      {col.name}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ background: '#f1f5f9', color: dtColor, padding: '1px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>{col.type}</span>
                    </td>
                    <td style={{ padding: '6px 12px', color: col.nullable === 'YES' ? '#94a3b8' : '#16a34a', fontWeight: 500, fontSize: '11.5px' }}>
                      {col.nullable === 'YES' ? '○ Nullable' : '✓ Not Null'}
                    </td>
                    <td style={{ padding: '6px 12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>
                      {schema}.{selectedNode.label}.{col.name}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─── In-graph expandable card with full column list + search ────────── */
function typePrefix(t: string): { ch: string; col: string } {
  const u = (t || '').toUpperCase()
  if (['NUMBER','INT','INTEGER','FLOAT','DECIMAL','NUMERIC'].some(x => u.includes(x))) return { ch: '#', col: '#1d4ed8' }
  if (['DATE','TIMESTAMP','DATETIME','TIME'].some(x => u.includes(x)))                   return { ch: '⌚', col: '#7c3aed' }
  if (['BOOL'].some(x => u.includes(x)))                                                  return { ch: '✓', col: '#c2410c' }
  if (['TEXT','VARCHAR','STRING','CHAR'].some(x => u.includes(x)))                        return { ch: 'A', col: '#047857' }
  return { ch: '?', col: '#475569' }
}

function NodeColumnCard({ node, cfg, cols, schema, columnLineage, tables, onClose, onJumpToTable }: {
  node:    LNode
  cfg:     { bg: string; border: string; color: string; label: string }
  cols:    Column[]
  schema:  string
  columnLineage: ColumnLineageEntry[]
  tables:  TableMeta[]
  onClose: () => void
  onJumpToTable: (name: string) => void
}) {
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery]           = useState('')
  const [selectedCol, setSelectedCol] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the input when the search bar appears
  useEffect(() => { if (showSearch) setTimeout(() => inputRef.current?.focus(), 50) }, [showSearch])
  // Reset column selection whenever the node changes
  useEffect(() => { setSelectedCol(null) }, [node.id])

  const filtered = query.trim()
    ? cols.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.type.toLowerCase().includes(query.toLowerCase()))
    : cols
  const sorted = [...filtered].sort((a, b) => a.position - b.position)

  // Lineage helpers — derived only when a column is selected
  const lineageInfo = (() => {
    if (!selectedCol) return null
    const upstream = columnLineage.find(l => l.view.toUpperCase() === node.label.toUpperCase() && l.column.toUpperCase() === selectedCol.toUpperCase())
    // Downstream: any view that lists this table.column among its upstream
    const downstream = columnLineage.filter(l =>
      l.upstream.some(u => u.table.toUpperCase() === node.label.toUpperCase() && u.column.toUpperCase() === selectedCol.toUpperCase())
    )
    return { upstream, downstream }
  })()

  return (
    <div
      onClick={e => { e.stopPropagation(); onClose() }}
      style={{
        background: '#fff', border: '2px solid #2563eb', borderRadius: '10px',
        boxShadow: '0 4px 14px rgba(37,99,235,0.25)', overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header band */}
      <div onClick={e => e.stopPropagation()}
        style={{ background: cfg.bg, padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{node.icon}</span>
          <span style={{ flex: 1, fontWeight: 700, color: cfg.color, fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.label}
          </span>
          {/* Search-toggle icon */}
          {node.id !== 'SOURCE' && cols.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setShowSearch(s => !s) }}
              title="Search columns"
              style={{
                background: showSearch ? cfg.color : 'rgba(255,255,255,0.6)',
                color: showSearch ? '#fff' : cfg.color,
                border: 'none', cursor: 'pointer',
                width: '22px', height: '22px', borderRadius: '5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, padding: 0,
              }}
            >🔍</button>
          )}
          {/* Live-data dot */}
          {node.rows !== undefined && node.rows > 0 && (
            <span style={{ background: '#16a34a', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>✓</span>
          )}
          {/* Close */}
          <button onClick={e => { e.stopPropagation(); onClose() }}
            title="Collapse"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: cfg.color, fontSize: '14px', padding: 0, width: '18px', height: '18px',
            }}>✕</button>
        </div>
        <div style={{ fontSize: '10px', color: cfg.color, opacity: 0.7, marginTop: '3px' }}>
          {node.id === 'SOURCE' ? node.sub : `${schema} / ${node.label}`}
          {node.rows !== undefined && node.rows > 0 && <span> · {fmt(node.rows)} rows</span>}
        </div>

        {/* Search input (collapsible) */}
        {showSearch && node.id !== 'SOURCE' && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
            <input ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setShowSearch(false) } }}
              placeholder="Filter columns…"
              style={{
                flex: 1, padding: '5px 8px', borderRadius: '5px',
                border: '1px solid #e2e8f0', fontSize: '11px',
                fontFamily: 'monospace', background: '#fff', color: '#0f172a',
                boxSizing: 'border-box', outline: 'none',
              }}
            />
            {query && (
              <button onClick={e => { e.stopPropagation(); setQuery('') }}
                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', padding: '0 8px', borderRadius: '5px', fontSize: '11px', color: '#475569' }}>✕</button>
            )}
          </div>
        )}
      </div>

      {/* Column list — full, scrollable */}
      {node.id !== 'SOURCE' && (
        <div onClick={e => e.stopPropagation()} style={{ maxHeight: '290px', overflowY: 'auto' }}>
          {cols.length === 0 && (
            <div style={{ padding: '12px', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
              Column metadata loading…
            </div>
          )}
          {cols.length > 0 && filtered.length === 0 && (
            <div style={{ padding: '12px', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
              No columns match &ldquo;{query}&rdquo;
            </div>
          )}
          {sorted.map(c => {
            const p        = typePrefix(c.type)
            const isKey    = c.name.toUpperCase().endsWith('_ID') || c.name.toUpperCase().endsWith('_KEY') || c.name.toUpperCase() === 'ID'
            const isPicked = selectedCol === c.name
            return (
              <div key={c.name}
                onClick={e => { e.stopPropagation(); setSelectedCol(isPicked ? null : c.name) }}
                title={`${c.name}  ${c.type}  ${c.nullable === 'YES' ? 'NULL' : 'NOT NULL'} — click for column-level lineage`}
                style={{
                  display: 'grid', gridTemplateColumns: '20px 1fr auto',
                  alignItems: 'center', gap: '6px',
                  padding: '4px 12px', fontFamily: 'monospace', fontSize: '11px',
                  borderBottom: '1px solid #f8fafc',
                  background: isPicked ? '#eef2ff' : 'transparent',
                  borderLeft: `3px solid ${isPicked ? '#6366f1' : 'transparent'}`,
                  cursor: 'pointer',
                }}>
                <span style={{ color: p.col, fontWeight: 700, textAlign: 'center' }}>{p.ch}</span>
                <span style={{ color: isKey ? '#1d4ed8' : '#1a1a1a', fontWeight: isKey ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isKey && <span style={{ marginRight: '3px' }}>🔑</span>}
                  {c.name}
                </span>
                <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>{c.nullable === 'YES' ? '○' : '✓'}</span>
              </div>
            )
          })}
          {/* Footer count */}
          {cols.length > 0 && !selectedCol && (
            <div style={{ padding: '6px 12px', fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', background: '#fafaf9' }}>
              {query ? `${filtered.length} of ${cols.length}` : `${cols.length} columns`} · click any column for lineage
            </div>
          )}

          {/* Column-level lineage panel — only when a column is selected */}
          {selectedCol && lineageInfo && (
            <div onClick={e => e.stopPropagation()}
              style={{ borderTop: '2px solid #6366f1', background: '#eef2ff', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.04em' }}>COLUMN LINEAGE</span>
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#1a1a1a' }}>{selectedCol}</span>
                <button onClick={e => { e.stopPropagation(); setSelectedCol(null) }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: '12px', padding: 0 }}>✕</button>
              </div>

              {/* Upstream — where THIS column is derived from */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '9.5px', color: '#16a34a', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '3px' }}>⬆ DERIVED FROM</div>
                {!lineageInfo.upstream || lineageInfo.upstream.upstream.length === 0 ? (
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                    {/* If this object isn't a view, it IS the source */}
                    {tables.find(t => t.name === node.label && t.type !== 'VIEW' && t.type !== 'MATERIALIZED VIEW')
                      ? 'Source column — defined directly in this base table.'
                      : 'No upstream resolved (may be SELECT *, expression, or external schema reference).'}
                  </div>
                ) : (
                  <>
                    {lineageInfo.upstream.upstream.map((u, i) => (
                      <div key={i}
                        onClick={e => { e.stopPropagation(); onJumpToTable(u.table) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '4px 8px', borderRadius: '5px', cursor: 'pointer',
                          background: '#fff', border: '1px solid #d1fae5',
                          marginBottom: '3px', fontFamily: 'monospace', fontSize: '11px',
                        }}>
                        <span style={{ color: '#16a34a' }}>←</span>
                        <span style={{ color: '#0f766e', fontWeight: 600 }}>{u.table}</span>
                        <span style={{ color: '#94a3b8' }}>.</span>
                        <span style={{ color: '#1a1a1a', fontWeight: 700 }}>{u.column}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#6366f1' }}>open ↗</span>
                      </div>
                    ))}
                    {lineageInfo.upstream.expression && lineageInfo.upstream.expression.toUpperCase() !== selectedCol.toUpperCase() && (
                      <div style={{ marginTop: '4px', padding: '4px 8px', background: '#0f172a', color: '#a5f3fc', borderRadius: '5px', fontFamily: 'monospace', fontSize: '10.5px', wordBreak: 'break-all' }}>
                        {lineageInfo.upstream.expression}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Downstream — which views consume this column */}
              <div>
                <div style={{ fontSize: '9.5px', color: '#ea580c', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '3px' }}>⬇ USED BY</div>
                {lineageInfo.downstream.length === 0 ? (
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No downstream views consume this column yet.
                  </div>
                ) : (
                  lineageInfo.downstream.map((d, i) => (
                    <div key={i}
                      onClick={e => { e.stopPropagation(); onJumpToTable(d.view) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 8px', borderRadius: '5px', cursor: 'pointer',
                        background: '#fff', border: '1px solid #fed7aa',
                        marginBottom: '3px', fontFamily: 'monospace', fontSize: '11px',
                      }}>
                      <span style={{ color: '#ea580c' }}>→</span>
                      <span style={{ color: '#7c3aed', fontWeight: 600 }}>{d.view}</span>
                      <span style={{ color: '#94a3b8' }}>.</span>
                      <span style={{ color: '#1a1a1a', fontWeight: 700 }}>{d.column}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#6366f1' }}>open ↗</span>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: '6px', fontSize: '9px', color: '#6366f1', fontStyle: 'italic', textAlign: 'center' }}>
                Derived from view DDL · click any link to follow the chain
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
