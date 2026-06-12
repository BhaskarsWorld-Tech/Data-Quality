'use client'
import { useState, useEffect, useCallback } from 'react'
import { ConnectionToolbar, ConnectionBanner, useOverviewData } from '@/components/shared/ConnectionToolbar'

interface Tbl { name: string; rows: number; columns: number; bytes: number; type: string }

interface CustomDomain {
  id:       string
  name:     string
  icon:     string
  color:    string
  bg:       string
  owner:    string
  patterns: string[]
  builtin?: boolean
}

interface ResolvedDomain extends CustomDomain {
  tables:    Tbl[]
  totalRows: number
  populated: number
}

/* ─── Built-in classification (used when no custom domain matches) ─────── */
// Order matters — more specific prefixes first so MARKETING_CUSTOMERS
// doesn't get swallowed by the Sales (CUSTOMER) pattern.
const BUILT_IN: CustomDomain[] = [
  { id: 'b-finance',      name: 'Finance',      icon: '💳', color: '#16a34a', bg: '#f0fdf4', owner: 'Finance Operations',
    patterns: ['FINANCE','BUDGET','INVOICE','PAYMENT','TRANSACTION','LEDGER','GL_','REVENUE','EXPENSE','ACCOUNT'], builtin: true },
  { id: 'b-marketing',    name: 'Marketing',    icon: '📣', color: '#db2777', bg: '#fdf2f8', owner: 'Marketing Team',
    patterns: ['MARKETING','CAMPAIGN','LEAD','AD_SPEND','CHANNEL','AUDIENCE','SEGMENT','ATTRIBUTION','EMAIL_'], builtin: true },
  { id: 'b-hr',           name: 'HR / People',  icon: '👤', color: '#ca8a04', bg: '#fefce8', owner: 'People Team',
    patterns: ['EMPLOYEE','PAYROLL','BENEFITS','HIRE','ONBOARDING'], builtin: true },
  { id: 'b-sales',        name: 'Sales',        icon: '💰', color: '#0891b2', bg: '#ecfeff', owner: 'Sales Operations',
    patterns: ['CUSTOMER','SALE','OPPORTUNITY','PIPELINE','QUOTE'], builtin: true },
  { id: 'b-supply-chain', name: 'Supply Chain', icon: '🚛', color: '#1d4ed8', bg: '#eff6ff', owner: 'Supply Chain Team',
    patterns: ['SUPPLIER','PURCHASE','SHIPMENT','CARRIER','RETURN','FREIGHT','LOGISTICS'], builtin: true },
  { id: 'b-catalog',      name: 'Catalog',      icon: '📦', color: '#7c3aed', bg: '#f5f3ff', owner: 'Product Catalog',
    patterns: ['PRODUCT','CATEGORY','SKU','CATALOG'], builtin: true },
  { id: 'b-operations',   name: 'Operations',   icon: '🏗️', color: '#ea580c', bg: '#fff7ed', owner: 'Operations Team',
    patterns: ['INVENTORY','WAREHOUSE','STOCK'], builtin: true },
]

const ICON_PALETTE = ['💰','🚛','📦','🏗️','📊','🔬','💳','📈','🛒','🏥','📡','🌐','⚙️','🎯','🔐','✈️','🏦','🎓','🍔','📰']
const COLOR_PALETTE = [
  { color: '#16a34a', bg: '#f0fdf4' }, { color: '#1d4ed8', bg: '#eff6ff' }, { color: '#7c3aed', bg: '#f5f3ff' },
  { color: '#ea580c', bg: '#fff7ed' }, { color: '#dc2626', bg: '#fef2f2' }, { color: '#0891b2', bg: '#ecfeff' },
  { color: '#db2777', bg: '#fdf2f8' }, { color: '#475569', bg: '#f8fafc' }, { color: '#ca8a04', bg: '#fefce8' },
]

/** Bucket each table into exactly one domain (first match wins). */
function bucketize(tables: Tbl[], domains: CustomDomain[]): Map<string, Tbl[]> {
  const buckets = new Map<string, Tbl[]>()
  domains.forEach(d => buckets.set(d.id, []))
  const otherKey = '_other'
  buckets.set(otherKey, [])
  tables.forEach(t => {
    const u = t.name.toUpperCase()
    const match = domains.find(d => d.patterns.some(p => u.includes(p)))
    buckets.get(match?.id ?? otherKey)!.push(t)
  })
  return buckets
}

export default function DomainsPage() {
  const { connections, selectedId, setSelectedId, data: ovData, conn, loading, refreshing, error, refresh } =
    useOverviewData<Tbl[]>(json => (json.tables as unknown as Tbl[]) ?? [])

  const tables = ovData ?? []

  /* ─── User-defined domains ──────────────────────────────────────────── */
  const [userDomains, setUserDomains] = useState<CustomDomain[]>([])
  const reloadDomains = useCallback(async () => {
    const r = await fetch('/api/domains', { cache: 'no-store' })
    if (r.ok) setUserDomains(await r.json() as CustomDomain[])
  }, [])
  useEffect(() => { reloadDomains() }, [reloadDomains])

  /* ─── Merge user + built-in ─────────────────────────────────────────── */
  // User-defined come FIRST so they match before built-ins (lets users override).
  const allDomains: CustomDomain[] = [...userDomains, ...BUILT_IN]
  const buckets    = bucketize(tables, allDomains)

  const resolved: ResolvedDomain[] = [
    ...allDomains.map(d => {
      const tbls = buckets.get(d.id) ?? []
      return {
        ...d,
        tables:    tbls,
        totalRows: tbls.reduce((s, t) => s + t.rows, 0),
        populated: tbls.filter(t => t.rows > 0).length,
      }
    }),
    // "Other" bucket — tables that match nothing
    ((): ResolvedDomain => {
      const tbls = buckets.get('_other') ?? []
      return {
        id: '_other', name: 'Unassigned', icon: '❓', color: '#94a3b8', bg: '#f8fafc',
        owner: '— no domain matched —', patterns: [], builtin: true,
        tables: tbls,
        totalRows: tbls.reduce((s, t) => s + t.rows, 0),
        populated: tbls.filter(t => t.rows > 0).length,
      }
    })(),
  ].filter(d => d.tables.length > 0 || !d.builtin)   // hide empty built-ins, keep empty user domains

  /* ─── Modal state ───────────────────────────────────────────────────── */
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CustomDomain>({
    id: '', name: '', icon: '📦', color: '#6366f1', bg: '#eef2ff', owner: '', patterns: [],
  })
  const [patternInput, setPatternInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function openCreate() {
    setForm({ id: '', name: '', icon: '📦', color: '#6366f1', bg: '#eef2ff', owner: '', patterns: [] })
    setPatternInput('')
    setSaveError('')
    setShowModal(true)
  }

  function openEdit(d: CustomDomain) {
    setForm({ ...d })
    setPatternInput('')
    setSaveError('')
    setShowModal(true)
  }

  async function saveForm() {
    if (!form.name.trim()) { setSaveError('Name is required'); return }
    setSaving(true); setSaveError('')
    try {
      const r = await fetch('/api/domains', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'save failed')
      setShowModal(false)
      await reloadDomains()
    } catch (e) { setSaveError((e as Error).message) }
    finally     { setSaving(false) }
  }

  async function deleteDomain(id: string) {
    if (!confirm('Delete this domain? Tables will be re-categorised by built-in rules.')) return
    await fetch(`/api/domains?id=${id}`, { method: 'DELETE' })
    await reloadDomains()
  }

  function addPattern() {
    const p = patternInput.trim().toUpperCase()
    if (!p) return
    if (form.patterns.includes(p)) { setPatternInput(''); return }
    setForm({ ...form, patterns: [...form.patterns, p] })
    setPatternInput('')
  }

  function removePattern(p: string) {
    setForm({ ...form, patterns: form.patterns.filter(x => x !== p) })
  }

  /* ─── Render ────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Domain Management</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
            {resolved.length} domain{resolved.length === 1 ? '' : 's'} ({userDomains.length} custom, {BUILT_IN.length} built-in) · {tables.length} live tables in {conn?.schema ?? ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={openCreate}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', padding: '8px 16px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
            + Add Domain
          </button>
          <ConnectionToolbar selectedId={selectedId} onChange={setSelectedId} onRefresh={refresh} refreshing={refreshing} connections={connections} conn={conn} />
        </div>
      </div>

      <ConnectionBanner conn={conn} />

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>❄️ Grouping tables by domain…</div>}
      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#dc2626' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          {resolved.map(d => {
            const isExpanded = expanded === d.id
            return (
              <div key={d.id} style={{ background: '#fff', border: `1.5px solid ${isExpanded ? d.color : '#ebe8df'}`, borderRadius: '14px', overflow: 'hidden', transition: 'all 0.15s' }}>
                <div style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : d.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: d.bg, border: `1px solid ${d.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{d.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{d.name}</div>
                        {d.builtin
                          ? <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '9.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px', letterSpacing: '0.04em' }}>BUILT-IN</span>
                          : <span style={{ background: '#eef2ff', color: '#6366f1', fontSize: '9.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px', letterSpacing: '0.04em' }}>CUSTOM</span>}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>👥 {d.owner || '—'}</div>
                    </div>
                    {!d.builtin && (
                      <>
                        <button onClick={e => { e.stopPropagation(); openEdit(d) }}
                          style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}>✎ Edit</button>
                        <button onClick={e => { e.stopPropagation(); deleteDomain(d.id) }}
                          style={{ background: '#fff', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}>🗑 Delete</button>
                      </>
                    )}
                    <span style={{ color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div style={{ background: d.bg, padding: '8px 10px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '9.5px', color: d.color, fontWeight: 700 }}>TABLES</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: d.color }}>{d.tables.length}</div>
                    </div>
                    <div style={{ background: d.bg, padding: '8px 10px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '9.5px', color: d.color, fontWeight: 700 }}>POPULATED</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: d.color }}>{d.populated}</div>
                    </div>
                    <div style={{ background: d.bg, padding: '8px 10px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '9.5px', color: d.color, fontWeight: 700 }}>ROWS</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: d.color }}>{d.totalRows.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 20px', background: '#fafaf9' }}>
                    {d.patterns.length > 0 && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '10.5px', color: '#475569', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>Match patterns</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {d.patterns.map(p => (
                            <span key={p} style={{ background: d.bg, color: d.color, padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>Tables in this domain</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {d.tables.length === 0 && (
                        <div style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                          No tables match this domain&apos;s patterns yet.
                        </div>
                      )}
                      {d.tables.map(t => (
                        <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', borderRadius: '8px' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: '12.5px', fontWeight: 600 }}>{t.name}</div>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px', color: '#475569' }}>
                            <span>{t.columns} cols</span>
                            <span style={{ color: t.rows > 0 ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{t.rows.toLocaleString()} rows</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Add/Edit Domain Modal ────────────────────────────────────── */}
      {showModal && (
        <div onClick={() => !saving && setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>{form.id ? 'Edit Domain' : 'Add Domain'}</div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>Group tables into a business domain by matching column patterns against their names.</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '20px' }}>✕</button>
            </div>

            {/* Name + Owner */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Finance, Marketing, HR…" required />
              <Field label="Owner / Team" value={form.owner} onChange={v => setForm({ ...form, owner: v })} placeholder="Finance Operations" />
            </div>

            {/* Icon picker */}
            <div style={{ marginBottom: '14px' }}>
              <Label>Icon</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {ICON_PALETTE.map(ic => (
                  <button key={ic} onClick={() => setForm({ ...form, icon: ic })}
                    style={{ width: '36px', height: '36px', borderRadius: '8px', border: form.icon === ic ? `2px solid ${form.color}` : '1px solid #e2e8f0', background: form.icon === ic ? form.bg : '#fff', fontSize: '18px', cursor: 'pointer' }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div style={{ marginBottom: '14px' }}>
              <Label>Colour theme</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {COLOR_PALETTE.map(c => (
                  <button key={c.color} onClick={() => setForm({ ...form, color: c.color, bg: c.bg })}
                    title={c.color}
                    style={{ width: '36px', height: '36px', borderRadius: '8px', border: form.color === c.color ? `3px solid ${c.color}` : '1px solid #e2e8f0', background: c.bg, cursor: 'pointer', position: 'relative' }}>
                    <span style={{ position: 'absolute', inset: '6px', borderRadius: '50%', background: c.color }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Patterns */}
            <div style={{ marginBottom: '14px' }}>
              <Label>Table-name patterns</Label>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '6px' }}>
                Substrings to match against table names (case-insensitive). A table is assigned to this domain if its name <strong>contains any</strong> of these.
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={patternInput}
                  onChange={e => setPatternInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPattern() } }}
                  placeholder="e.g. INVOICE, PAYMENT, BILLING"
                  style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', boxSizing: 'border-box', color: '#0f172a', fontFamily: 'monospace' }}
                />
                <button onClick={addPattern}
                  style={{ background: form.color, color: '#fff', border: 'none', padding: '0 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>+ Add</button>
              </div>
              {form.patterns.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                  {form.patterns.map(p => (
                    <span key={p} style={{ background: form.bg, color: form.color, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}>
                      {p}
                      <button onClick={() => removePattern(p)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: form.color, fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Live preview */}
            <div style={{ background: form.bg, border: `1px solid ${form.color}40`, borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', color: form.color, fontWeight: 700, marginBottom: '6px' }}>PREVIEW · matches {tables.filter(t => form.patterns.some(p => t.name.toUpperCase().includes(p))).length} live table(s)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff', border: `1px solid ${form.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{form.icon}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: form.color }}>{form.name || '— name —'}</div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>👥 {form.owner || '— no owner —'}</div>
                </div>
              </div>
            </div>

            {saveError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', marginBottom: '12px' }}>{saveError}</div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '14px', borderTop: '1px solid #f3f1ea' }}>
              <button onClick={() => setShowModal(false)} disabled={saving}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveForm} disabled={saving}
                style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: form.color, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : (form.id ? 'Save Changes' : 'Create Domain')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: '11px', color: '#475569', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</label>
}
function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: '#475569', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', boxSizing: 'border-box', color: '#0f172a' }} />
    </div>
  )
}
