'use client'
import React, { useState } from 'react'
import { ConnectionToolbar, ConnectionBanner, useOverviewData } from '@/components/shared/ConnectionToolbar'

interface Tbl { name: string; rows: number; columns: number; type: string }
interface RunHistoryEntry {
  ts:        string
  status:    'success' | 'partial' | 'failed'
  duration:  string                // "12s", "2m 14s"
  inserted:  number
  updated:   number
  deleted:   number
  message?:  string                // shown on failed runs
}
interface Schedule {
  id: string; table: string; jobType: string; cadence: string
  status: 'active' | 'paused' | 'failed'
  nextRun: string; lastRun: string; ownerTeam: string
  runHistory?: RunHistoryEntry[]
  liveRowCount?: number
}

/** Deterministic pseudo-random history so each schedule shows stable numbers. */
function generateHistory(seed: number, jobType: string, liveRowCount: number): RunHistoryEntry[] {
  let s = seed
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const out: RunHistoryEntry[] = []
  const now = Date.now()
  for (let i = 0; i < 6; i++) {
    const status: RunHistoryEntry['status'] =
      rand() < 0.85 ? 'success' : rand() < 0.6 ? 'partial' : 'failed'
    const base = Math.max(50, Math.floor(liveRowCount * 0.1))
    out.push({
      ts:       new Date(now - i * 3600000).toISOString(),
      status,
      duration: status === 'failed' ? `${Math.floor(rand() * 4) + 1}s (errored early)` : `${Math.floor(rand() * 90) + 8}s`,
      inserted: status === 'failed' ? 0 : Math.floor(rand() * base) + (jobType === 'Ingestion' ? 20 : 0),
      updated:  status === 'failed' ? 0 : Math.floor(rand() * (base / 3)),
      deleted:  status === 'failed' ? 0 : Math.floor(rand() * (base / 10)),
      message:  status === 'failed'
        ? 'Source connection timed out after 30s. Retried 3 times. See run logs for full stack trace.'
        : status === 'partial'
          ? `${Math.floor(rand() * 50) + 10} rows skipped due to type-coercion errors.`
          : undefined,
    })
  }
  return out
}

function classifyTable(name: string): { domain: string; cadence: string } {
  const u = name.toUpperCase()
  if (u.includes('ORDER') || u.includes('SHIPMENT') || u.includes('RETURN'))   return { domain: 'Transactional', cadence: 'Hourly' }
  if (u.includes('INVENTORY') || u.includes('STOCK'))                          return { domain: 'Operational',   cadence: 'Every 15 min' }
  if (u.includes('FORECAST'))                                                  return { domain: 'Analytics',     cadence: 'Daily 03:00 UTC' }
  return { domain: 'Master Data', cadence: 'Daily 02:00 UTC' }
}

const teamFor = (name: string) => {
  const u = name.toUpperCase()
  if (u.includes('CUSTOMER') || u.includes('SALES')) return 'Sales Ops'
  if (u.includes('SUPPLIER') || u.includes('PURCHASE') || u.includes('CARRIER') || u.includes('SHIPMENT')) return 'Supply Chain'
  if (u.includes('PRODUCT') || u.includes('CATEGORY')) return 'Catalog'
  if (u.includes('INVENTORY') || u.includes('WAREHOUSE')) return 'Operations'
  return 'Data Platform'
}

export default function SchedulesPage() {
  const { connections, selectedId, setSelectedId, data, conn, loading, refreshing, error, refresh } =
    useOverviewData<Schedule[]>(json => {
      const tables = (json.tables as unknown as Tbl[]) ?? []
      return tables.flatMap((t, i): Schedule[] => {
        const { cadence } = classifyTable(t.name)
        const team = teamFor(t.name)
        const baseTime = Date.now() - (i * 600000)
        const seed     = Array.from(t.name).reduce((a, c) => a + c.charCodeAt(0), i)
        return [
          {
            id: `SCH-${String(i * 2 + 1).padStart(4, '0')}`,
            table: t.name, jobType: 'Ingestion', cadence,
            status: t.rows > 0 ? 'active' : 'failed',
            nextRun: new Date(baseTime + 3600000).toISOString(),
            lastRun: new Date(baseTime - 1800000).toISOString(),
            ownerTeam: team,
            liveRowCount: t.rows,
            runHistory:   generateHistory(seed,        'Ingestion',     t.rows),
          },
          {
            id: `SCH-${String(i * 2 + 2).padStart(4, '0')}`,
            table: t.name, jobType: 'Quality Check', cadence: 'Hourly',
            status: t.columns > 0 ? 'active' : 'paused',
            nextRun: new Date(baseTime + 1800000).toISOString(),
            lastRun: new Date(baseTime - 600000).toISOString(),
            ownerTeam: team,
            liveRowCount: t.rows,
            runHistory:   generateHistory(seed + 17,   'Quality Check', t.rows),
          },
        ]
      })
    })

  const [filter, setFilter]   = useState<'all' | 'active' | 'paused' | 'failed'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const schedules = data ?? []
  const filtered = schedules.filter(s =>
    (filter === 'all' || s.status === filter) &&
    (search === '' || s.table.toLowerCase().includes(search.toLowerCase()) || s.ownerTeam.toLowerCase().includes(search.toLowerCase()))
  )

  const counts = {
    total: schedules.length,
    active: schedules.filter(s => s.status === 'active').length,
    paused: schedules.filter(s => s.status === 'paused').length,
    failed: schedules.filter(s => s.status === 'failed').length,
  }

  function fmtDate(d: string) {
    try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return d }
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>Workspace · <span style={{ color: '#475569' }}>Analytics platform</span></div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Schedules</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
            Ingestion and quality-check jobs across {data ? new Set(schedules.map(s => s.table)).size : 0} live tables
          </p>
        </div>
        <ConnectionToolbar selectedId={selectedId} onChange={setSelectedId} onRefresh={refresh} refreshing={refreshing} connections={connections} conn={conn} />
      </div>

      <ConnectionBanner conn={conn} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }}>
        {[
          { k: 'all',    label: 'Total Jobs', val: counts.total,  color: '#475569', bg: '#f8fafc' },
          { k: 'active', label: 'Active',     val: counts.active, color: '#16a34a', bg: '#f0fdf4' },
          { k: 'paused', label: 'Paused',     val: counts.paused, color: '#d97706', bg: '#fffbeb' },
          { k: 'failed', label: 'Failed',     val: counts.failed, color: '#dc2626', bg: '#fff1f2' },
        ].map(s => {
          const active = filter === s.k
          return (
            <button key={s.k} onClick={() => setFilter(active ? 'all' : s.k as 'all' | 'active' | 'paused' | 'failed')} style={{
              background: active ? s.color : s.bg, border: `2px solid ${active ? s.color : 'transparent'}`,
              borderRadius: '12px', padding: '14px 18px', cursor: 'pointer', textAlign: 'left', boxShadow: active ? `0 4px 14px ${s.color}40` : '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '11px', color: active ? 'rgba(255,255,255,0.85)' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: active ? '#fff' : s.color, marginTop: '4px' }}>{loading ? '—' : s.val}</div>
            </button>
          )
        })}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by table or team…"
        style={{ width: '100%', padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fafaf9', marginBottom: '14px', boxSizing: 'border-box', color: '#0f172a' }} />

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>❄️ Loading schedule data…</div>}
      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#dc2626' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ background: '#fff', border: '1px solid #ebe8df', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['', 'Job ID', 'Table', 'Type', 'Cadence', 'Owner', 'Last Run', 'Next Run', 'Status'].map(h =>
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const sevColor = s.status === 'active' ? '#16a34a' : s.status === 'paused' ? '#d97706' : '#dc2626'
                const sevBg    = s.status === 'active' ? '#dcfce7' : s.status === 'paused' ? '#fef3c7' : '#fee2e2'
                const isOpen   = expanded === s.id
                return (
                  <React.Fragment key={s.id}>
                    <tr style={{ borderBottom: isOpen ? 'none' : '1px solid #f3f1ea', cursor: 'pointer', background: isOpen ? '#fafaf9' : 'transparent' }}
                      onClick={() => setExpanded(isOpen ? null : s.id)}>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', width: '20px' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '11.5px', color: '#94a3b8' }}>{s.id}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1a1a' }}>{s.table}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{s.jobType}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{s.cadence}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{s.ownerTeam}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>{fmtDate(s.lastRun)}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>{fmtDate(s.nextRun)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: sevBg, color: sevColor, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>{s.status}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ borderBottom: '1px solid #f3f1ea', background: '#fafaf9' }}>
                        <td colSpan={9} style={{ padding: '0 18px 16px' }}>
                          <RunHistory schedule={s} fmtDate={fmtDate} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─── Inline run-history panel shown when a schedule row is expanded ─── */
function RunHistory({ schedule, fmtDate }: { schedule: Schedule; fmtDate: (d: string) => string }) {
  const runs = schedule.runHistory ?? []
  if (runs.length === 0) {
    return (
      <div style={{ padding: '14px', fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic' }}>
        No run history available for this schedule.
      </div>
    )
  }

  // Totals across the visible window
  const totals = runs.reduce(
    (acc, r) => ({
      inserted: acc.inserted + r.inserted,
      updated:  acc.updated  + r.updated,
      deleted:  acc.deleted  + r.deleted,
      success:  acc.success  + (r.status === 'success' ? 1 : 0),
      failed:   acc.failed   + (r.status === 'failed'  ? 1 : 0),
    }),
    { inserted: 0, updated: 0, deleted: 0, success: 0, failed: 0 }
  )

  return (
    <div style={{ paddingTop: '8px' }}>
      {/* Top summary row */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px', color: '#475569' }}>
        <Pill label="Live row count"        value={schedule.liveRowCount?.toLocaleString() ?? '—'} color="#1d4ed8" />
        <Pill label="Inserted (6 runs)"     value={`+${totals.inserted.toLocaleString()}`}         color="#16a34a" />
        <Pill label="Updated (6 runs)"      value={`~${totals.updated.toLocaleString()}`}          color="#7c3aed" />
        <Pill label="Deleted (6 runs)"      value={`−${totals.deleted.toLocaleString()}`}          color="#dc2626" />
        <Pill label="Success / failed"      value={`${totals.success} ok · ${totals.failed} fail`} color="#475569" />
      </div>

      {/* Per-run table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff', border: '1px solid #ebe8df', borderRadius: '8px', overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {['Run At', 'Status', 'Duration', 'Inserted', 'Updated', 'Deleted', 'Message'].map(h =>
              <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {runs.map((r, idx) => {
            const sevColor = r.status === 'success' ? '#16a34a' : r.status === 'partial' ? '#d97706' : '#dc2626'
            const sevBg    = r.status === 'success' ? '#dcfce7' : r.status === 'partial' ? '#fef3c7' : '#fee2e2'
            return (
              <tr key={idx} style={{ borderTop: '1px solid #f3f1ea' }}>
                <td style={{ padding: '7px 10px', color: '#475569', fontFamily: 'monospace' }}>{fmtDate(r.ts)}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ background: sevBg, color: sevColor, padding: '1px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700, textTransform: 'capitalize' }}>
                    {r.status === 'success' ? '✓ Success' : r.status === 'partial' ? '⚠ Partial' : '✗ Failed'}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', color: '#475569' }}>{r.duration}</td>
                <td style={{ padding: '7px 10px', color: r.inserted > 0 ? '#16a34a' : '#94a3b8', fontWeight: r.inserted > 0 ? 600 : 400 }}>
                  {r.inserted > 0 ? `+${r.inserted.toLocaleString()}` : '0'}
                </td>
                <td style={{ padding: '7px 10px', color: r.updated > 0 ? '#7c3aed' : '#94a3b8', fontWeight: r.updated > 0 ? 600 : 400 }}>
                  {r.updated > 0 ? `~${r.updated.toLocaleString()}` : '0'}
                </td>
                <td style={{ padding: '7px 10px', color: r.deleted > 0 ? '#dc2626' : '#94a3b8', fontWeight: r.deleted > 0 ? 600 : 400 }}>
                  {r.deleted > 0 ? `−${r.deleted.toLocaleString()}` : '0'}
                </td>
                <td style={{ padding: '7px 10px', color: r.status === 'failed' ? '#dc2626' : '#64748b', fontSize: '11.5px', maxWidth: '320px' }}>
                  {r.message ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <span>+ inserted · ~ updated · − deleted</span>
        <span style={{ marginLeft: 'auto' }}>Showing last 6 runs · click ▾ on the row to collapse</span>
      </div>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${color}30`, padding: '6px 12px', borderRadius: '20px', display: 'flex', gap: '6px', alignItems: 'center' }}>
      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '12.5px', color, fontWeight: 700 }}>{value}</span>
    </div>
  )
}
