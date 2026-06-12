'use client'
import { useState, useEffect } from 'react'
import { Rule, RuleCategory, RuleType, Connection } from '@/lib/types'
import { categoryColors } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { buildRuleSql as sharedBuildRuleSql, ruleMechanics as sharedRuleMechanics, isGenericRule } from '@/lib/ruleSql'

const CATEGORIES: { value: RuleCategory; label: string; icon: string }[] = [
  { value: 'completeness', label: 'Completeness', icon: '📦' },
  { value: 'accuracy', label: 'Accuracy', icon: '🎯' },
  { value: 'uniqueness', label: 'Uniqueness', icon: '🔑' },
  { value: 'validity', label: 'Validity', icon: '✅' },
  { value: 'timeliness', label: 'Timeliness', icon: '⏱' },
  { value: 'consistency', label: 'Consistency', icon: '🔗' },
]

const RULE_TYPES: { value: RuleType; label: string; desc: string }[] = [
  { value: 'not_null', label: 'Not Null', desc: 'Column must not have null values' },
  { value: 'unique', label: 'Unique', desc: 'Values must be unique' },
  { value: 'range', label: 'Range Check', desc: 'Values within min/max range' },
  { value: 'regex', label: 'Regex Pattern', desc: 'Values match a regex pattern' },
  { value: 'custom_sql', label: 'Custom SQL', desc: 'Custom SQL expression check' },
  { value: 'freshness', label: 'Freshness', desc: 'Data updated within time window' },
  { value: 'row_count', label: 'Row Count', desc: 'Table has minimum row count' },
  { value: 'referential', label: 'Referential', desc: 'Referential integrity check' },
]

const SEVERITY_CONFIG = {
  critical: { bg: '#fee2e2', color: '#dc2626', label: '🔴 Critical' },
  high: { bg: '#fff7ed', color: '#ea580c', label: '🟠 High' },
  medium: { bg: '#fef9c3', color: '#ca8a04', label: '🟡 Medium' },
  low: { bg: '#f0fdf4', color: '#16a34a', label: '🟢 Low' }
}

interface Props { initialRules: Rule[]; connections: Connection[] }

/** Build the SQL the rule will execute against the warehouse. */
// Local wrappers — keep call sites unchanged
const buildRuleSql   = sharedBuildRuleSql
const ruleMechanics  = sharedRuleMechanics

// The original implementations are kept as dead code below for reference;
// they're tree-shaken out by the bundler since they're never imported.
function _unused_buildRuleSql(rule: Rule, conn?: Connection): string {
  const schema = conn?.schema ?? '<schema>'
  const fq     = `${schema}.${rule.tableName}`
  const col    = rule.columnName ?? '<column>'
  const params = rule.parameters as Record<string, unknown> | undefined
  switch (rule.type) {
    case 'not_null':
      return `-- Counts how many rows have a NULL in "${col}"\nSELECT\n  COUNT(*)                                      AS total_rows,\n  COUNT(CASE WHEN "${col}" IS NULL THEN 1 END)  AS failing_rows\nFROM ${fq};`
    case 'unique':
      return `-- Detects duplicate values in "${col}"\nSELECT "${col}", COUNT(*) AS dup_count\nFROM ${fq}\nGROUP BY "${col}"\nHAVING COUNT(*) > 1;`
    case 'range': {
      const min = params?.min, max = params?.max
      const where: string[] = []
      if (min !== undefined) where.push(`"${col}" < ${min}`)
      if (max !== undefined) where.push(`"${col}" > ${max}`)
      const cond = where.join(' OR ') || `"${col}" IS NULL`
      return `-- Flags rows where "${col}" is outside [${min ?? '−∞'}, ${max ?? '+∞'}]\nSELECT *\nFROM ${fq}\nWHERE ${cond};`
    }
    case 'regex': {
      const pattern = (params?.pattern as string) ?? '.*'
      return `-- Flags rows whose "${col}" doesn't match /${pattern}/\nSELECT *\nFROM ${fq}\nWHERE NOT REGEXP_LIKE("${col}", '${pattern}');`
    }
    case 'freshness': {
      const hrs = params?.maxAgeHours ?? 24
      return `-- Asserts the table was updated within the last ${hrs}h\nSELECT MAX(LAST_ALTERED) AS last_updated,\n       DATEDIFF('hour', MAX(LAST_ALTERED), CURRENT_TIMESTAMP()) AS hours_old\nFROM INFORMATION_SCHEMA.TABLES\nWHERE TABLE_NAME = '${rule.tableName.toUpperCase()}';`
    }
    case 'row_count': {
      const min = params?.minRows ?? 0
      return `-- Asserts the table has at least ${min} rows\nSELECT COUNT(*) AS row_count,\n       CASE WHEN COUNT(*) >= ${min} THEN 'PASS' ELSE 'FAIL' END AS status\nFROM ${fq};`
    }
    case 'referential':
      return `-- Asserts every "${col}" exists in the parent dimension\nSELECT child."${col}"\nFROM ${fq} child\nLEFT JOIN <parent_table> parent ON child."${col}" = parent.<key>\nWHERE parent.<key> IS NULL;`
    case 'custom_sql':
      return `-- Custom SQL check (defined inline)\n${(params?.sql as string) ?? `SELECT 1 FROM ${fq};`}`
    default:
      return `-- ${rule.type}\nSELECT * FROM ${fq};`
  }
}

/** Plain-English explanation of what failure means + how it's evaluated. */
function _unused_ruleMechanics(rule: Rule): { failureMeans: string; passCondition: string; runFrequency: string; impact: string } {
  const params = rule.parameters as Record<string, unknown> | undefined
  switch (rule.type) {
    case 'not_null':
      return {
        passCondition: `0% of rows have NULL in "${rule.columnName ?? 'column'}"`,
        failureMeans: 'One or more rows have a NULL value in the required column.',
        runFrequency: 'On every quality-check run (typically every hour).',
        impact: 'Downstream joins / aggregations on this column will silently drop these rows or produce incorrect results.',
      }
    case 'unique':
      return {
        passCondition: `Every value of "${rule.columnName ?? 'column'}" appears exactly once`,
        failureMeans: 'There are duplicate values where there should be none — typically a primary key or business identifier.',
        runFrequency: 'On every quality-check run.',
        impact: 'Joins on this column will multiply rows; revenue/count reports will be inflated.',
      }
    case 'range':
      return {
        passCondition: `All values of "${rule.columnName ?? 'column'}" are between ${params?.min ?? '−∞'} and ${params?.max ?? '+∞'}`,
        failureMeans: 'One or more rows have a value outside the configured numeric range.',
        runFrequency: 'On every quality-check run.',
        impact: 'Out-of-band values often indicate data-entry errors, fx-rate bugs, or a schema misinterpretation.',
      }
    case 'regex':
      return {
        passCondition: `All values of "${rule.columnName ?? 'column'}" match the pattern ${(params?.pattern as string) ?? ''}`,
        failureMeans: 'One or more rows have a value that doesn\'t match the required pattern (e.g. malformed email).',
        runFrequency: 'On every quality-check run.',
        impact: 'Marketing campaigns and integrations that rely on a strict format will reject or silently drop these records.',
      }
    case 'freshness':
      return {
        passCondition: `Table was updated within the last ${params?.maxAgeHours ?? 24} hours`,
        failureMeans: 'The table\'s LAST_ALTERED timestamp is older than the SLA — the load pipeline likely stalled.',
        runFrequency: 'Hourly (or more often for streaming tables).',
        impact: 'Reports built on this table show stale data; decisions are made on outdated numbers.',
      }
    case 'row_count':
      return {
        passCondition: `Table has at least ${params?.minRows ?? 0} rows`,
        failureMeans: 'Row count dropped below the threshold — partial load, bad ETL filter, or upstream outage.',
        runFrequency: 'On every quality-check run.',
        impact: 'Downstream aggregations under-count; KPI dashboards show drops that aren\'t real business changes.',
      }
    case 'referential':
      return {
        passCondition: `Every "${rule.columnName ?? 'foreign key'}" value exists in its parent dimension`,
        failureMeans: 'Orphan child records reference a parent that no longer exists or never did.',
        runFrequency: 'On every quality-check run.',
        impact: 'Broken joins return NULL for the parent attributes; categorisation and roll-ups become inconsistent.',
      }
    case 'custom_sql':
      return {
        passCondition: 'Custom SQL returns 0 failing rows',
        failureMeans: 'The custom SQL check returned at least one violating row.',
        runFrequency: 'On every quality-check run.',
        impact: 'Defined by the rule author — see the rule description.',
      }
    default:
      return { passCondition: '—', failureMeans: '—', runFrequency: '—', impact: '—' }
  }
}

export default function RulesClient({ initialRules, connections }: Props) {
  const [rules, setRules] = useState(initialRules)
  const [showModal, setShowModal] = useState(false)
  const [activeCategory, setActiveCategory] = useState<RuleCategory | 'all'>('all')
  const [scopeFilter, setScopeFilter] = useState<'all' | 'generic' | 'specific'>('all')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()

  const [form, setForm] = useState({
    name: '', description: '', category: 'completeness' as RuleCategory,
    type: 'not_null' as RuleType, connectionId: connections[0]?.id || '',
    tableName: '', columnName: '', severity: 'high' as Rule['severity'],
    paramMin: '', paramMax: '', paramPattern: '', paramAge: '', paramRows: ''
  })

  // Cascading dropdown state — pull tables on connection change, columns on table change
  const [tableList,  setTableList]  = useState<string[]>([])
  const [columnList, setColumnList] = useState<string[]>([])
  const [loadingTables,  setLoadingTables]  = useState(false)
  const [loadingColumns, setLoadingColumns] = useState(false)
  const [introspectError, setIntrospectError] = useState<string | null>(null)

  // Fetch tables whenever the connection changes (and modal is open)
  useEffect(() => {
    if (!showModal || !form.connectionId) return
    setLoadingTables(true); setIntrospectError(null); setTableList([]); setColumnList([])
    fetch(`/api/snowflake/tables?connectionId=${encodeURIComponent(form.connectionId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setIntrospectError(d.error); return }
        const names = (d.tables ?? []).map((t: Record<string, unknown>) =>
          String(t.TABLE_NAME ?? t.table_name ?? '')
        ).filter(Boolean)
        setTableList(names)
      })
      .catch(e => setIntrospectError(String(e?.message ?? e)))
      .finally(() => setLoadingTables(false))
  }, [form.connectionId, showModal])

  // Fetch columns whenever the selected table changes
  useEffect(() => {
    if (!showModal || !form.connectionId || !form.tableName || form.tableName === '*') {
      setColumnList([]); return
    }
    setLoadingColumns(true); setColumnList([])
    fetch(`/api/snowflake/columns?connectionId=${encodeURIComponent(form.connectionId)}&table=${encodeURIComponent(form.tableName)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) return
        const names = (d.columns ?? []).map((c: Record<string, unknown>) =>
          String(c.COLUMN_NAME ?? c.column_name ?? '')
        ).filter(Boolean)
        setColumnList(names)
      })
      .catch(() => {})
      .finally(() => setLoadingColumns(false))
  }, [form.tableName, form.connectionId, showModal])

  const filtered = rules
    .filter(r => activeCategory === 'all' || r.category === activeCategory)
    .filter(r => {
      if (scopeFilter === 'all')      return true
      if (scopeFilter === 'generic')  return isGenericRule(r)
      return !isGenericRule(r)
    })

  const genericCount  = rules.filter(r => isGenericRule(r)).length
  const specificCount = rules.length - genericCount

  async function toggleRule(rule: Rule) {
    await fetch('/api/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, enabled: !rule.enabled })
    })
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    router.refresh()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
    setRules(prev => prev.filter(r => r.id !== id))
    router.refresh()
  }

  async function save() {
    if (!form.name || !form.connectionId || !form.tableName) return
    setSaving(true)
    const params: Record<string, unknown> = {}
    if (form.type === 'range') { if (form.paramMin) params.min = parseFloat(form.paramMin); if (form.paramMax) params.max = parseFloat(form.paramMax) }
    if (form.type === 'regex') params.pattern = form.paramPattern
    if (form.type === 'freshness') params.maxAgeHours = parseInt(form.paramAge || '24')
    if (form.type === 'row_count') params.minRows = parseInt(form.paramRows || '0')

    const res = await fetch('/api/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, description: form.description, category: form.category, type: form.type, connectionId: form.connectionId, tableName: form.tableName, columnName: form.columnName || undefined, severity: form.severity, parameters: params })
    })
    const newRule = await res.json()
    setRules(prev => [...prev, newRule])
    setShowModal(false)
    setSaving(false)
    router.refresh()
  }

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
    fontSize: '14px', color: '#0f172a', background: '#f8fafc', outline: 'none', ...style
  })

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = rules.filter(r => r.category === cat.value).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Quality Rules</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>{rules.filter(r => r.enabled).length} active rules across {rules.length} total</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none',
          padding: '12px 22px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)'
        }}>+ Add Rule</button>
      </div>

      {/* Scope filter — generic vs specific rules */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: '4px' }}>Scope</span>
        {([
          { k: 'all',      label: '🔍 All Rules', val: rules.length,  color: '#0f172a', desc: '' },
          { k: 'generic',  label: '🌐 Generic',   val: genericCount,  color: '#7c3aed', desc: 'apply to every table in the schema' },
          { k: 'specific', label: '🎯 Specific',  val: specificCount, color: '#1d4ed8', desc: 'target one specific table or column' },
        ] as const).map(s => {
          const active = scopeFilter === s.k
          return (
            <button key={s.k} onClick={() => setScopeFilter(active ? 'all' : s.k)}
              title={s.desc}
              style={{
                padding: '7px 14px', borderRadius: '20px', border: '1px solid',
                fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                background:  active ? s.color : '#fff',
                color:       active ? '#fff'  : s.color,
                borderColor: active ? s.color : `${s.color}30`,
                boxShadow:   active ? `0 2px 8px ${s.color}40` : 'none',
                transition: 'all 0.15s',
              }}>
              {s.label} <span style={{ marginLeft: 4, opacity: 0.85 }}>({s.val})</span>
            </button>
          )
        })}
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveCategory('all')} style={{
          padding: '8px 16px', borderRadius: '20px', border: '1px solid', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
          background: activeCategory === 'all' ? '#0f172a' : '#fff', color: activeCategory === 'all' ? '#fff' : '#64748b', borderColor: activeCategory === 'all' ? '#0f172a' : '#e2e8f0'
        }}>All ({rules.length})</button>
        {CATEGORIES.map(cat => (
          <button key={cat.value} onClick={() => setActiveCategory(cat.value)} style={{
            padding: '8px 16px', borderRadius: '20px', border: '1px solid', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            background: activeCategory === cat.value ? categoryColors[cat.value] : '#fff',
            color: activeCategory === cat.value ? '#fff' : '#64748b',
            borderColor: activeCategory === cat.value ? categoryColors[cat.value] : '#e2e8f0'
          }}>{cat.icon} {cat.label} ({categoryCounts[cat.value] || 0})</button>
        ))}
      </div>

      {/* Rules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(rule => {
          const cat  = CATEGORIES.find(c => c.value === rule.category)
          const sev  = SEVERITY_CONFIG[rule.severity]
          const conn = connections.find(c => c.id === rule.connectionId)
          const ruleType = RULE_TYPES.find(t => t.value === rule.type)
          const isExpanded = expandedId === rule.id
          const sql       = buildRuleSql(rule, conn)
          const mech      = ruleMechanics(rule)
          return (
            <div key={rule.id} className="fade-in" style={{
              background: '#fff', borderRadius: '14px',
              boxShadow: isExpanded ? '0 0 0 3px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
              border: `1px solid ${isExpanded ? '#a5b4fc' : (rule.enabled ? '#f1f5f9' : '#f8fafc')}`,
              opacity: rule.enabled ? 1 : 0.6, overflow: 'hidden', transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : rule.id)}>
                {/* Toggle */}
                <div onClick={e => { e.stopPropagation(); toggleRule(rule) }} style={{
                  width: '42px', height: '24px', borderRadius: '12px', cursor: 'pointer', flexShrink: 0,
                  background: rule.enabled ? categoryColors[rule.category] : '#e2e8f0',
                  position: 'relative', transition: 'background 0.3s'
                }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: '3px', left: rule.enabled ? '21px' : '3px',
                    transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>

                {/* Category Icon */}
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${categoryColors[rule.category]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                  {cat?.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{rule.name}</span>
                    <span style={{ background: sev.bg, color: sev.color, padding: '1px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{sev.label}</span>
                    {isGenericRule(rule)
                      ? <span title="Applies to every table in the schema" style={{ background: '#f5f3ff', color: '#7c3aed', padding: '1px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em' }}>🌐 GENERIC</span>
                      : <span title="Applies to one specific table or column" style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em' }}>🎯 SPECIFIC</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{rule.description}</div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>📌 {conn?.name || 'Unknown'}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      📊 {isGenericRule(rule) ? 'all tables in schema' : `${rule.tableName}${rule.columnName ? `.${rule.columnName}` : ''}`}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'capitalize' }}>🏷 {rule.category}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ padding: '4px 10px', borderRadius: '8px', background: '#f8fafc', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>
                    {ruleType?.label}
                  </span>
                  <button onClick={e => { e.stopPropagation(); deleteRule(rule.id) }} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>🗑</button>
                  <span style={{ color: '#94a3b8', fontSize: '14px', marginLeft: '4px' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f1f5f9', background: '#fafaf9', padding: '20px 24px' }}>
                  {/* Three columns: What / Where / How */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    {/* WHAT */}
                    <Block icon="🎯" title="What this rule checks" color="#7c3aed" bg="#f5f3ff">
                      <Row k="Definition" v={ruleType?.desc ?? '—'} />
                      <Row k="Pass When" v={mech.passCondition} />
                      <Row k="Description" v={rule.description || '— no description —'} />
                    </Block>

                    {/* WHERE */}
                    <Block icon="📍" title="Where it runs" color="#16a34a" bg="#f0fdf4">
                      <Row k="Connection" v={conn?.name ?? 'Unknown'} mono />
                      <Row k="Type" v={(conn?.type ?? '—').toString().toUpperCase()} />
                      <Row k="Database" v={conn?.database ?? '—'} mono />
                      <Row k="Schema" v={conn?.schema ?? '—'} mono />
                      <Row k="Table" v={rule.tableName} mono />
                      {rule.columnName && <Row k="Column" v={rule.columnName} mono />}
                      <Row k="Full Path" v={`${conn?.database ?? '?'}.${conn?.schema ?? '?'}.${rule.tableName}${rule.columnName ? '.' + rule.columnName : ''}`} mono />
                    </Block>

                    {/* HOW */}
                    <Block icon="⚙️" title="How it works" color="#1d4ed8" bg="#eff6ff">
                      <Row k="Severity" v={sev.label} />
                      <Row k="Run Frequency" v={mech.runFrequency} />
                      <Row k="On Failure" v={mech.failureMeans} />
                      <Row k="Business Impact" v={mech.impact} />
                      {Object.keys((rule.parameters ?? {}) as Record<string, unknown>).length > 0 && (
                        <Row k="Parameters" v={JSON.stringify(rule.parameters)} mono />
                      )}
                    </Block>
                  </div>

                  {/* SQL */}
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: 700, letterSpacing: '0.06em' }}>📜 SQL EXECUTED AGAINST {(conn?.type ?? 'WAREHOUSE').toString().toUpperCase()}</div>
                    <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(sql) }}
                      style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', color: '#475569', fontWeight: 500, cursor: 'pointer' }}>
                      📋 Copy SQL
                    </button>
                  </div>
                  <pre style={{ margin: 0, padding: '14px 16px', background: '#0f172a', color: '#e2e8f0', borderRadius: '8px', fontSize: '12px', lineHeight: 1.55, fontFamily: 'monospace', overflow: 'auto', whiteSpace: 'pre' }}>
                    {sql}
                  </pre>

                  {/* Footer metadata */}
                  <div style={{ display: 'flex', gap: '14px', marginTop: '12px', fontSize: '11px', color: '#94a3b8' }}>
                    <span>🆔 <span style={{ fontFamily: 'monospace' }}>{rule.id}</span></span>
                    <span>📅 Created {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                    <span>{rule.enabled ? '🟢 Active — will run on next check' : '⚪ Disabled — will not run'}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>No rules yet</div>
            <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Create your first quality rule or ask the AI Agent to help</div>
            <button onClick={() => setShowModal(true)} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>
              + Add Rule
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div className="slide-up" style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Add Quality Rule</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Define a new data quality check</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#f8fafc', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Rule Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Customer Email Not Null" style={inp()} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this rule check?" style={inp()} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as RuleCategory }))} style={inp()}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Rule Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as RuleType }))} style={inp()}>
                    {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Connection *</label>
                <select value={form.connectionId} onChange={e => setForm(f => ({ ...f, connectionId: e.target.value }))} style={inp()}>
                  {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Scope toggle — generic (all tables) vs specific (one table) */}
              <div style={{ background: '#fafaf9', border: '1px solid #ebe8df', borderRadius: '10px', padding: '10px 12px', marginBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={form.tableName === '*'}
                    onChange={e => setForm(f => ({ ...f, tableName: e.target.checked ? '*' : '', columnName: e.target.checked ? '' : f.columnName }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#7c3aed' }} />
                  <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 600 }}>
                    🌐 Generic rule — apply to <strong>every table</strong> in the schema
                  </span>
                </label>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '24px', marginTop: '2px' }}>
                  When the check runs, the engine fans this rule out across every table in the active schema and produces one result per table.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>
                    Table {form.tableName === '*' ? '(all tables)' : '*'}
                    {loadingTables && <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>loading…</span>}
                  </label>
                  {form.tableName === '*' ? (
                    <input value="* (all tables in schema)" disabled style={{ ...inp(), opacity: 0.6 }} />
                  ) : (
                    <select
                      value={form.tableName}
                      onChange={e => setForm(f => ({ ...f, tableName: e.target.value, columnName: '' }))}
                      style={inp()}>
                      <option value="">{loadingTables ? 'Loading tables…' : (tableList.length ? '— select a table —' : 'No tables found')}</option>
                      {tableList.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                  {introspectError && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>⚠ {introspectError}</div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>
                    Column
                    {loadingColumns && <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>loading…</span>}
                  </label>
                  <select
                    value={form.columnName}
                    disabled={form.tableName === '*' || !form.tableName}
                    onChange={e => setForm(f => ({ ...f, columnName: e.target.value }))}
                    style={{ ...inp(), opacity: (form.tableName === '*' || !form.tableName) ? 0.6 : 1 }}>
                    <option value="">
                      {form.tableName === '*' ? 'n/a for generic rules'
                        : !form.tableName ? 'pick a table first'
                        : loadingColumns ? 'Loading columns…'
                        : columnList.length ? '— optional — any column —'
                        : 'No columns found'}
                    </option>
                    {columnList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Dynamic params */}
              {form.type === 'range' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Min Value</label><input value={form.paramMin} onChange={e => setForm(f => ({ ...f, paramMin: e.target.value }))} placeholder="0" style={inp()} /></div>
                  <div><label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Max Value</label><input value={form.paramMax} onChange={e => setForm(f => ({ ...f, paramMax: e.target.value }))} placeholder="100000" style={inp()} /></div>
                </div>
              )}
              {form.type === 'regex' && (
                <div><label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Regex Pattern</label><input value={form.paramPattern} onChange={e => setForm(f => ({ ...f, paramPattern: e.target.value }))} placeholder="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" style={inp()} /></div>
              )}
              {form.type === 'freshness' && (
                <div><label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Max Age (hours)</label><input value={form.paramAge} onChange={e => setForm(f => ({ ...f, paramAge: e.target.value }))} placeholder="24" style={inp()} /></div>
              )}
              {form.type === 'row_count' && (
                <div><label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Minimum Rows</label><input value={form.paramRows} onChange={e => setForm(f => ({ ...f, paramRows: e.target.value }))} placeholder="1000" style={inp()} /></div>
              )}

              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Severity</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(Object.keys(SEVERITY_CONFIG) as Rule['severity'][]).map(sev => (
                    <button key={sev} onClick={() => setForm(f => ({ ...f, severity: sev }))} style={{
                      padding: '8px', borderRadius: '8px', border: '1px solid', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      background: form.severity === sev ? SEVERITY_CONFIG[sev].bg : '#fff',
                      color: form.severity === sev ? SEVERITY_CONFIG[sev].color : '#64748b',
                      borderColor: form.severity === sev ? SEVERITY_CONFIG[sev].color : '#e2e8f0'
                    }}>{SEVERITY_CONFIG[sev].label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button onClick={save} disabled={saving || !form.name || !form.connectionId || !form.tableName} style={{
                  flex: 2, padding: '12px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600,
                  cursor: (form.name && form.connectionId && form.tableName) ? 'pointer' : 'not-allowed',
                  background: (form.name && form.connectionId && form.tableName) ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e2e8f0',
                  color: (form.name && form.connectionId && form.tableName) ? '#fff' : '#94a3b8'
                }}>{saving ? '⏳ Saving...' : '+ Add Rule'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── helpers used by the expanded rule panel ──────────────────────────── */
function Block({ icon, title, color, bg, children }: { icon: string; title: string; color: string; bg: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${color}30`, borderRadius: '10px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', paddingBottom: '8px', borderBottom: `1px solid ${color}20` }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  )
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '2px' }}>{k.toUpperCase()}</div>
      <div style={{ fontSize: '12.5px', color: '#1a1a1a', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-word', lineHeight: 1.45 }}>{v}</div>
    </div>
  )
}
