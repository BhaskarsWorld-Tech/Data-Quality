'use client'
import { useState } from 'react'

type HealthFilter = 'all' | 'healthy' | 'at-risk' | 'critical'

interface DatasetIssue {
  severity: 'critical' | 'warning' | 'info'
  rule: string
  detail: string
  records: string
}

interface Dataset {
  name: string; source: string; score: number; freshness: string
  issues: number; issueSev: string; owner: string; rows: string
  domain: string; late: boolean; columns: number; lastUpdated: string
  schema: string; description: string
  rootCause: string; impact: string; recommendation: string
  issueList: DatasetIssue[]
}

const ALL_DATASETS: Dataset[] = [
  {
    name: 'prod.orders_fact', source: 'Snowflake', score: 71, freshness: '14m ago',
    issues: 5, issueSev: 'critical', owner: 'Data platform', rows: '4.2M',
    domain: 'Finance', late: false, columns: 38, lastUpdated: '2026-05-05 17:46',
    schema: 'prod', description: 'Core transactional orders table — source of truth for all revenue and GMV reporting.',
    rootCause: 'Three concurrent data quality failures: (1) 412 rows have negative order_total due to an ETL sign-flip bug. (2) 1,843 orders have NULL customer_id because the identity-resolution service is missing its guest-order handler. (3) A duplicate webhook fired 2,100 duplicate order_ids before Redis recovered. All three issues originated in the 2026-05-04 to 2026-05-05 window.',
    impact: 'Revenue dashboards understate GMV by ~$38K. Customer LTV models are missing 1,843 orders. Duplicate orders inflate daily volume by ~0.05%. Finance BI report is producing incorrect channel splits.',
    recommendation: 'Run dedup script sql/fixes/dedup_orders.sql. Apply sign-fix patch PR #4421. Deploy IDR guest-order handler. Add pre-load assertions for order_total > 0 and customer_id NOT NULL.',
    issueList: [
      { severity: 'critical', rule: 'order_total > 0', detail: '412 rows have negative order_total — ETL sign-flip bug in ERP import at 01:00 UTC', records: '412' },
      { severity: 'critical', rule: 'customer_id NOT NULL', detail: '1,843 orders have NULL customer_id — IDR service missing guest-order handler', records: '1,843' },
      { severity: 'critical', rule: 'order_id UNIQUE', detail: '2,100 duplicate order_ids — Redis outage bypassed idempotency check', records: '2,100' },
      { severity: 'warning', rule: 'order_date ≤ today', detail: '23 rows have future order dates — timezone conversion bug in mobile SDK', records: '23' },
      { severity: 'warning', rule: 'currency_code in ISO 4217', detail: '14 rows have unrecognised currency code "GBP2" from legacy ERP', records: '14' },
    ],
  },
  {
    name: 'prod.returns', source: 'Postgres', score: 74, freshness: '3h ago',
    issues: 3, issueSev: 'critical', owner: 'Operations', rows: '340K',
    domain: 'Operations', late: false, columns: 22, lastUpdated: '2026-05-05 14:00',
    schema: 'prod', description: 'Product returns and refunds fact table — used for ops KPIs and finance reconciliation.',
    rootCause: 'New regional call center operators used a free-text returns portal instead of the validated dropdown, introducing 15 unrecognised enum values. Additionally 94 records have NULL return_reason and 28 have refund_amount > original order_amount due to a refund calculation bug.',
    impact: 'Returns analytics show an "Unknown" category spike of 15%. Finance reconciliation flags 28 over-refunded transactions worth $4,200. Ops KPI dashboard shows inflated return rate.',
    recommendation: 'Map the 15 free-text values to canonical enums. Add dropdown validation to the returns portal. Fix the refund calculation formula. Add a constraint: refund_amount ≤ order_amount.',
    issueList: [
      { severity: 'critical', rule: 'return_reason in allowed set', detail: '15 new unexpected enum values from regional call center free-text portal', records: '~4,200' },
      { severity: 'critical', rule: 'refund_amount ≤ order_amount', detail: '28 records have refund exceeding original order — refund calculation bug', records: '28' },
      { severity: 'warning', rule: 'return_reason NOT NULL', detail: '94 records missing return_reason — operators skipped required field', records: '94' },
    ],
  },
  {
    name: 'ops.incidents', source: 'MongoDB', score: 78, freshness: '5m ago',
    issues: 4, issueSev: 'critical', owner: 'Engineering', rows: '78K',
    domain: 'Operations', late: false, columns: 18, lastUpdated: '2026-05-05 17:55',
    schema: 'ops', description: 'Engineering incident tracker — source for SRE dashboards and post-mortem reporting.',
    rootCause: 'A new MongoDB schema migration added nullable fields without updating the data quality rules. 3,200 incident records have NULL severity_level after a bulk import from the legacy PagerDuty system. Additionally 180 records have resolved_at before created_at (inverted timestamps from timezone mishandling).',
    impact: 'SRE dashboards cannot segment incidents by severity for 4.1% of records. MTTR calculations are incorrect for 180 incidents. Post-mortem report for May is incomplete.',
    recommendation: 'Backfill NULL severity_level from the PagerDuty API using incident IDs. Fix the timezone conversion in the PagerDuty importer. Add created_at ≤ resolved_at constraint.',
    issueList: [
      { severity: 'critical', rule: 'severity_level NOT NULL', detail: '3,200 records (4.1%) have NULL severity — bulk import from PagerDuty skipped field mapping', records: '3,200' },
      { severity: 'critical', rule: 'created_at ≤ resolved_at', detail: '180 records have resolved_at before created_at — timezone conversion bug in PagerDuty importer', records: '180' },
      { severity: 'warning', rule: 'assignee_id valid', detail: '420 records reference deactivated user IDs from team restructuring', records: '420' },
      { severity: 'warning', rule: 'incident_type in allowed set', detail: '37 records have type "P0-SEV1" — deprecated format not in current enum set', records: '37' },
    ],
  },
  {
    name: 'crm.users_dim', source: 'Postgres', score: 82, freshness: '1h ago',
    issues: 3, issueSev: 'warning', owner: 'Growth', rows: '125K',
    domain: 'Marketing', late: false, columns: 31, lastUpdated: '2026-05-05 17:00',
    schema: 'crm', description: 'Customer dimension table — core identity source for marketing segmentation and attribution.',
    rootCause: 'CRM batch import from a lead-gen vendor on 2026-05-05 skipped email validation and consent flag assignment for 14,500 records. Compliance has been declining for 3 days.',
    impact: 'Marketing CDP sync has 14,500 invalid records. Email campaigns risk hard bounces. GDPR compliance at risk for records without consent flags.',
    recommendation: 'Quarantine the 14,500 affected records. Request corrected data from vendor. Add mandatory email validation to the CRM import pipeline.',
    issueList: [
      { severity: 'warning', rule: 'email format valid', detail: '8,200 records have malformed emails — vendor import skipped validation', records: '8,200' },
      { severity: 'warning', rule: 'consent_flag NOT NULL', detail: '6,300 records missing consent_flag — import script omitted default value', records: '6,300' },
      { severity: 'info', rule: 'phone format valid', detail: '920 records have non-E.164 phone numbers — legacy format from old CRM', records: '920' },
    ],
  },
  {
    name: 'ga.sessions_daily', source: 'BigQuery', score: 85, freshness: '7h late',
    issues: 2, issueSev: 'warning', owner: 'Marketing', rows: '890K',
    domain: 'Marketing', late: true, columns: 24, lastUpdated: '2026-05-05 09:00',
    schema: 'ga', description: 'GA4 daily session aggregates — used by Marketing for campaign attribution and paid media optimisation.',
    rootCause: 'The GA4 → BigQuery pipeline stalled at 00:15 UTC. The Pub/Sub subscription hit its 7-day retention limit and stopped forwarding events. The Dataflow job is alive but processing nothing. Table is now 7h overdue on its expected 2h refresh.',
    impact: 'Marketing team has no same-day campaign performance data. Paid media algorithms are running on 7h-old data — risk of ~$12K in overspend on underperforming channels. Attribution model for today is incomplete.',
    recommendation: 'Purge the Pub/Sub backlog and restart the Dataflow job. Increase subscription retention to 14 days. Add a freshness alert at 2h (not just the 6h SLA breach). ETA to resolve: 45 minutes.',
    issueList: [
      { severity: 'warning', rule: 'freshness < 2h', detail: 'Table is 7h overdue — GA4 Pub/Sub subscription hit retention limit, Dataflow stalled', records: '1 pipeline' },
      { severity: 'warning', rule: 'session_duration ≥ 0', detail: '190K sessions with session_duration < 0 — midnight timestamp reset bug in web SDK', records: '190,000' },
    ],
  },
  {
    name: 'inv.items_stock', source: 'Databricks', score: 89, freshness: '22m ago',
    issues: 1, issueSev: 'warning', owner: 'Supply chain', rows: '52K',
    domain: 'Operations', late: false, columns: 16, lastUpdated: '2026-05-05 17:38',
    schema: 'inv', description: 'Inventory stock levels — source for SCM API and reorder point calculations.',
    rootCause: '94 inventory records were created via the warehouse mobile app without barcode scanning. Operators entered items by name only, leaving the sku field blank. No validation exists on the mobile app form.',
    impact: '94 records cannot be joined to dim_products, creating blind spots in reorder calculations. SCM API v2 may make incorrect reorder decisions for these SKUs. Risk of undetected stockouts.',
    recommendation: 'Add mandatory barcode scan validation to the warehouse mobile app (JIRA WH-892). Manually reconcile the 94 records. Add NOT NULL constraint to sku column.',
    issueList: [
      { severity: 'warning', rule: 'sku NOT NULL', detail: '94 records missing SKU — warehouse operators skipped barcode scan on mobile app', records: '94' },
    ],
  },
  {
    name: 'mkt.campaigns', source: 'BigQuery', score: 88, freshness: '2h ago',
    issues: 2, issueSev: 'warning', owner: 'Marketing', rows: '320K',
    domain: 'Marketing', late: false, columns: 19, lastUpdated: '2026-05-05 16:00',
    schema: 'mkt', description: 'Marketing campaign performance data — used for ROI reporting and budget allocation.',
    rootCause: 'Two quality issues: (1) 2,800 campaign records have spend_usd = 0 after a Google Ads API timeout caused null spend data to be stored as zero. (2) 150 records have campaign_end < campaign_start due to a UI bug in the campaign management tool.',
    impact: 'ROI calculations for 2,800 campaigns show infinite ROI (revenue / $0 spend). Budget allocation recommendations based on ROI are unreliable. Campaign duration reports for 150 campaigns are inverted.',
    recommendation: 'Re-pull spend data for the affected campaigns from Google Ads API. Add a check: spend_usd > 0 for active campaigns. Fix the campaign management UI to prevent inverted dates.',
    issueList: [
      { severity: 'warning', rule: 'spend_usd > 0 for active campaigns', detail: '2,800 records have spend_usd = 0 — Google Ads API timeout stored nulls as zero', records: '2,800' },
      { severity: 'warning', rule: 'campaign_start ≤ campaign_end', detail: '150 records have inverted campaign dates — UI bug in campaign management tool', records: '150' },
    ],
  },
  {
    name: 'mkt.email_events', source: 'BigQuery', score: 92, freshness: '45m ago',
    issues: 1, issueSev: 'warning', owner: 'Marketing', rows: '5.6M',
    domain: 'Marketing', late: false, columns: 14, lastUpdated: '2026-05-05 17:15',
    schema: 'mkt', description: 'Email send, open, click and bounce events from the marketing automation platform.',
    rootCause: '45,000 bounce events are missing bounce_type classification — the email platform API v2 deprecated the bounce_type field without providing a replacement, and the ingestion pipeline does not handle the new response format.',
    impact: 'Hard vs. soft bounce analysis is incomplete for 45K events. Sender reputation scoring cannot distinguish permanent failures from temporary ones. Email deliverability reports show inflated "unknown" category.',
    recommendation: 'Update the email platform API client to v3 which restores bounce_type as bounce_category. Add a mapping layer for legacy bounce codes. Add NOT NULL validation for bounce_type on bounce events.',
    issueList: [
      { severity: 'warning', rule: 'bounce_type NOT NULL for bounces', detail: '45K bounce events missing bounce_type — email platform API v2 deprecated the field', records: '45,000' },
    ],
  },
  {
    name: 'sales.pipeline', source: 'Snowflake', score: 93, freshness: '10m ago',
    issues: 0, issueSev: 'none', owner: 'Sales', rows: '18K',
    domain: 'Sales', late: false, columns: 28, lastUpdated: '2026-05-05 17:50',
    schema: 'sales', description: 'Sales pipeline and CRM opportunity data — source for revenue forecasting and quota tracking.',
    rootCause: 'No issues detected. All quality checks passing.',
    impact: 'No business impact. Sales pipeline data is healthy and feeding forecast models correctly.',
    recommendation: 'No action needed. Consider adding a pipeline_value > 0 check for active opportunities to catch potential zero-value entries early.',
    issueList: [],
  },
  {
    name: 'fin.ledger_gl', source: 'Oracle', score: 96, freshness: '3m ago',
    issues: 0, issueSev: 'none', owner: 'Finance', rows: '2.1M',
    domain: 'Finance', late: false, columns: 42, lastUpdated: '2026-05-05 17:57',
    schema: 'fin', description: 'General ledger — single source of truth for all accounting entries and financial reporting.',
    rootCause: 'No issues detected. All quality checks passing. The ledger has maintained 100% quality score for 14 consecutive days.',
    impact: 'No business impact. Finance reporting and reconciliation is operating normally.',
    recommendation: 'No action needed. Maintain current monitoring schedule. Consider adding inter-company elimination checks before month-end close.',
    issueList: [],
  },
  {
    name: 'fin.revenue', source: 'Snowflake', score: 97, freshness: '30m ago',
    issues: 0, issueSev: 'none', owner: 'Finance', rows: '980K',
    domain: 'Finance', late: false, columns: 26, lastUpdated: '2026-05-05 17:30',
    schema: 'fin', description: 'Recognized revenue by product line, region and channel — used for P&L and board reporting.',
    rootCause: 'No issues detected. FX rate range checks and revenue validation all passing.',
    impact: 'No business impact.',
    recommendation: 'No action needed. The recent JPY FX rate issue (ISS-008) is resolved. The ±3σ range check is working as expected.',
    issueList: [],
  },
  {
    name: 'hr.employees', source: 'Postgres', score: 99, freshness: '1d ago',
    issues: 0, issueSev: 'none', owner: 'HR', rows: '4.8K',
    domain: 'HR', late: false, columns: 35, lastUpdated: '2026-05-04 18:00',
    schema: 'hr', description: 'Employee master table — used for headcount reporting, payroll validation and access control.',
    rootCause: 'No issues detected. HR data refreshes daily and all checks are passing.',
    impact: 'No business impact.',
    recommendation: 'No action needed. 1d freshness is expected for HR data (daily batch). Consider adding a tenure calculation check to catch negative values.',
    issueList: [],
  },
]

const SOURCES = ['All sources', 'Snowflake', 'Postgres', 'BigQuery', 'Databricks', 'Oracle', 'MongoDB']
const DOMAINS = ['All domains', 'Finance', 'Marketing', 'Sales', 'Operations', 'HR', 'Engineering']

const sevCfg = {
  critical: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  warning:  { bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
  info:     { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 90 ? '#16a34a' : score >= 80 ? '#d97706' : '#dc2626'
  const bg    = score >= 90 ? '#dcfce7' : score >= 80 ? '#fef3c7' : '#fee2e2'
  return <span style={{ background: bg, color, padding: '3px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>{score}</span>
}

export default function DatasetsPage() {
  const [search, setSearch]       = useState('')
  const [source, setSource]       = useState('All sources')
  const [domain, setDomain]       = useState('All domains')
  const [sort, setSort]           = useState<'score' | 'name' | 'issues'>('score')
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all')
  const [expanded, setExpanded]   = useState<string | null>(null)

  const healthy  = ALL_DATASETS.filter(d => d.score >= 90).length
  const atRisk   = ALL_DATASETS.filter(d => d.score >= 80 && d.score < 90).length
  const critical = ALL_DATASETS.filter(d => d.score < 80).length

  const filtered = ALL_DATASETS
    .filter(d => {
      if (healthFilter === 'healthy')  return d.score >= 90
      if (healthFilter === 'at-risk')  return d.score >= 80 && d.score < 90
      if (healthFilter === 'critical') return d.score < 80
      return true
    })
    .filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    .filter(d => source === 'All sources' || d.source === source)
    .filter(d => domain === 'All domains' || d.domain === domain)
    .sort((a, b) =>
      sort === 'score'  ? a.score - b.score :
      sort === 'issues' ? b.issues - a.issues :
      a.name.localeCompare(b.name))

  const sel: React.CSSProperties = { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: '#fff', color: '#475569', cursor: 'pointer', outline: 'none' }

  const statCards = [
    { key: 'all'      as HealthFilter, label: 'Total Datasets', value: ALL_DATASETS.length, color: '#1a1a1a',  bg: '#fff',     activeBg: '#1a1a1a' },
    { key: 'healthy'  as HealthFilter, label: 'Healthy (≥90)',  value: healthy,              color: '#16a34a',  bg: '#dcfce7',  activeBg: '#16a34a' },
    { key: 'at-risk'  as HealthFilter, label: 'At Risk (80–89)',value: atRisk,               color: '#d97706',  bg: '#fef3c7',  activeBg: '#d97706' },
    { key: 'critical' as HealthFilter, label: 'Critical (<80)', value: critical,             color: '#dc2626',  bg: '#fee2e2',  activeBg: '#dc2626' },
  ]

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1300px' }}>
      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '8px' }}>
        Workspace · <span style={{ color: '#475569' }}>Analytics platform</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Datasets</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            {filtered.length} of {ALL_DATASETS.length} datasets · {ALL_DATASETS.filter(d => d.issues > 0).length} with open issues
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['score', 'name', 'issues'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: sort === s ? 600 : 400, borderColor: sort === s ? '#2563eb' : '#e2e8f0', background: sort === s ? '#eff6ff' : '#fff', color: sort === s ? '#2563eb' : '#475569' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Clickable stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {statCards.map((card, idx) => {
          const isActive = healthFilter === card.key && idx !== 0
          return (
            <div key={card.key}
              onClick={() => idx === 0 ? setHealthFilter('all') : setHealthFilter(isActive ? 'all' : card.key)}
              style={{
                background: isActive ? card.activeBg : card.bg,
                border: `2px solid ${isActive ? card.activeBg : '#ebe8df'}`,
                borderRadius: '12px', padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: isActive ? `0 4px 14px ${card.activeBg}40` : 'none',
                transition: 'all 0.18s',
              }}>
              <div style={{ fontSize: '11.5px', color: isActive ? 'rgba(255,255,255,0.8)' : '#64748b', marginBottom: '6px', fontWeight: 600 }}>{card.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: isActive ? '#fff' : card.color }}>{card.value}</div>
              {isActive && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)', marginTop: '3px' }}>Click to clear</div>}
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search datasets..." style={{ ...sel, flex: 1, minWidth: '180px' }} />
        <select value={source} onChange={e => setSource(e.target.value)} style={sel}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
        <select value={domain} onChange={e => setDomain(e.target.value)} style={sel}>{DOMAINS.map(d => <option key={d}>{d}</option>)}</select>
      </div>

      {/* Dataset list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(ds => {
          const adColor   = ds.score >= 90 ? '#16a34a' : ds.score >= 80 ? '#d97706' : '#dc2626'
          const borderCol = ds.score >= 90 ? '#d1fae5' : ds.score >= 80 ? '#fde68a' : '#fca5a5'
          const isOpen    = expanded === ds.name

          return (
            <div key={ds.name} style={{
              background: '#fff',
              border: `1.5px solid ${isOpen ? '#6366f1' : borderCol}`,
              borderRadius: '12px', overflow: 'hidden',
              boxShadow: isOpen ? '0 6px 24px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.2s',
            }}>

              {/* Summary row */}
              <div onClick={() => setExpanded(isOpen ? null : ds.name)}
                style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', userSelect: 'none' }}>

                <div style={{ width: '4px', alignSelf: 'stretch', background: adColor, borderRadius: '2px', flexShrink: 0 }} />

                {/* Name */}
                <div style={{ minWidth: '190px', flexShrink: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700 }}>
                    <span style={{ color: '#94a3b8' }}>{ds.name.split('.')[0]}.</span>
                    <span style={{ color: '#1a1a1a' }}>{ds.name.split('.')[1]}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{ds.schema} · {ds.columns} cols · {ds.domain}</div>
                </div>

                {/* Source */}
                <div style={{ minWidth: '80px', flexShrink: 0 }}>
                  <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '5px', fontSize: '11.5px', color: '#475569', fontWeight: 500 }}>{ds.source}</span>
                </div>

                {/* Score */}
                <div style={{ flexShrink: 0 }}><ScorePill score={ds.score} /></div>

                {/* Rows */}
                <div style={{ minWidth: '60px', flexShrink: 0, color: '#475569', fontSize: '12.5px' }}>{ds.rows}</div>

                {/* Freshness */}
                <div style={{ minWidth: '80px', flexShrink: 0, color: ds.late ? '#d97706' : '#475569', fontWeight: ds.late ? 600 : 400, fontSize: '12.5px' }}>
                  {ds.late && '⚠ '}{ds.freshness}
                </div>

                {/* Issues */}
                <div style={{ flex: 1, fontSize: '12.5px' }}>
                  {ds.issues > 0
                    ? <span style={{ color: ds.issueSev === 'critical' ? '#dc2626' : '#d97706', fontWeight: 600 }}>● {ds.issues} {ds.issueSev}</span>
                    : <span style={{ color: '#94a3b8' }}>—</span>}
                </div>

                {/* Owner */}
                <div style={{ flexShrink: 0, color: '#64748b', fontSize: '12px', minWidth: '90px', textAlign: 'right' }}>{ds.owner}</div>

                {/* Toggle */}
                <div style={{
                  width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                  background: isOpen ? '#6366f1' : '#f1f5f9',
                  color: isOpen ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', transition: 'all 0.18s',
                }}>{isOpen ? '▲' : '▼'}</div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafd' }}>

                  {/* Metadata bar */}
                  <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                    {[
                      { label: 'Source',      value: ds.source },
                      { label: 'Domain',      value: ds.domain },
                      { label: 'Rows',        value: ds.rows },
                      { label: 'Columns',     value: String(ds.columns) },
                      { label: 'Last Updated',value: ds.lastUpdated },
                    ].map((m, i) => (
                      <div key={i} style={{ flex: 1, padding: '10px 16px', borderRight: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{m.label}</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Description */}
                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>{ds.description}</div>

                    {/* Issues checklist (if any) */}
                    {ds.issueList.length > 0 && (
                      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #fca5a5', overflow: 'hidden' }}>
                        <div style={{ background: '#fee2e2', padding: '10px 16px', borderBottom: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px' }}>⚠️</span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            Active Issues — {ds.issueList.length} check{ds.issueList.length > 1 ? 's' : ''} failing
                          </span>
                        </div>
                        <div style={{ padding: '8px 0' }}>
                          {ds.issueList.map((issue, j) => {
                            const sc = sevCfg[issue.severity]
                            return (
                              <div key={j} style={{
                                padding: '10px 16px',
                                background: sc.bg + '44',
                                borderLeft: `3px solid ${sc.color}`,
                                marginLeft: '0',
                                borderBottom: j < ds.issueList.length - 1 ? '1px solid #f3f1ea' : 'none',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                  <span style={{ background: sc.bg, color: sc.color, padding: '1px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, flexShrink: 0, marginTop: '2px' }}>{issue.severity}</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>{issue.rule}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>{issue.detail}</div>
                                  </div>
                                  <code style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{issue.records} records</code>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Root Cause + Impact + Fix */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e0e7ff', overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(90deg,#eef2ff,#f5f3ff)', padding: '9px 14px', borderBottom: '1px solid #e0e7ff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span>🔍</span>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Root Cause</span>
                        </div>
                        <div style={{ padding: '12px 14px', fontSize: '12.5px', color: '#1e293b', lineHeight: '1.7' }}>{ds.rootCause}</div>
                      </div>

                      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #bbf7d0', overflow: 'hidden' }}>
                        <div style={{ background: '#f0fdf4', padding: '9px 14px', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span>✅</span>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recommended Fix</span>
                        </div>
                        <div style={{ padding: '12px 14px', fontSize: '12.5px', color: '#1e293b', lineHeight: '1.7' }}>{ds.recommendation}</div>
                      </div>
                    </div>

                    {ds.issues > 0 && (
                      <div style={{ background: '#fff', borderRadius: '12px', border: '#fca5a540 1px solid', overflow: 'hidden' }}>
                        <div style={{ background: '#fff7f7', padding: '9px 14px', borderBottom: '1px solid #fca5a540', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span>💥</span>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Business Impact</span>
                        </div>
                        <div style={{ padding: '12px 14px', fontSize: '12.5px', color: '#1e293b', lineHeight: '1.7' }}>{ds.impact}</div>
                      </div>
                    )}

                    <div>
                      <button onClick={() => setExpanded(null)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}>
                        ▲ Collapse
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
            No datasets match your filters
          </div>
        )}
      </div>
    </div>
  )
}
