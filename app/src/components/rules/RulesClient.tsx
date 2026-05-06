'use client'
import { useState } from 'react'
import { Rule, RuleCategory, RuleType, Connection } from '@/lib/types'
import { categoryColors } from '@/lib/utils'
import { useRouter } from 'next/navigation'

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

export default function RulesClient({ initialRules, connections }: Props) {
  const [rules, setRules] = useState(initialRules)
  const [showModal, setShowModal] = useState(false)
  const [activeCategory, setActiveCategory] = useState<RuleCategory | 'all'>('all')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const [form, setForm] = useState({
    name: '', description: '', category: 'completeness' as RuleCategory,
    type: 'not_null' as RuleType, connectionId: connections[0]?.id || '',
    tableName: '', columnName: '', severity: 'high' as Rule['severity'],
    paramMin: '', paramMax: '', paramPattern: '', paramAge: '', paramRows: ''
  })

  const filtered = activeCategory === 'all' ? rules : rules.filter(r => r.category === activeCategory)

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
          const cat = CATEGORIES.find(c => c.value === rule.category)
          const sev = SEVERITY_CONFIG[rule.severity]
          const conn = connections.find(c => c.id === rule.connectionId)
          return (
            <div key={rule.id} className="fade-in" style={{
              background: '#fff', borderRadius: '14px', padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${rule.enabled ? '#f1f5f9' : '#f8fafc'}`,
              opacity: rule.enabled ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: '16px'
            }}>
              {/* Toggle */}
              <div onClick={() => toggleRule(rule)} style={{
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{rule.name}</span>
                  <span style={{ background: sev.bg, color: sev.color, padding: '1px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{sev.label}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{rule.description}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>📌 {conn?.name || 'Unknown'}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>📊 {rule.tableName}{rule.columnName ? `.${rule.columnName}` : ''}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'capitalize' }}>🏷 {rule.category}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <span style={{ padding: '4px 10px', borderRadius: '8px', background: '#f8fafc', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>
                  {RULE_TYPES.find(t => t.value === rule.type)?.label}
                </span>
                <button onClick={() => deleteRule(rule.id)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>🗑</button>
              </div>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Table *</label>
                  <input value={form.tableName} onChange={e => setForm(f => ({ ...f, tableName: e.target.value }))} placeholder="customers" style={inp()} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>Column</label>
                  <input value={form.columnName} onChange={e => setForm(f => ({ ...f, columnName: e.target.value }))} placeholder="email (optional)" style={inp()} />
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
