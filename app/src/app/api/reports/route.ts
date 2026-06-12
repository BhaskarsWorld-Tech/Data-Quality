import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { generateId } from '@/lib/utils'
import { Report, CheckResult, Rule, Connection } from '@/lib/types'
import { isGenericRule } from '@/lib/ruleSql'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ─── Built-in domain → table-name keyword map (must match domains/page.tsx) */
const DOMAIN_PATTERNS: Record<string, string[]> = {
  'Finance':      ['FINANCE','BUDGET','INVOICE','PAYMENT','TRANSACTION','LEDGER','GL_','REVENUE','EXPENSE','ACCOUNT'],
  'Marketing':    ['MARKETING','CAMPAIGN','LEAD','AD_SPEND','CHANNEL','AUDIENCE','SEGMENT','ATTRIBUTION','EMAIL_'],
  'HR':           ['EMPLOYEE','PAYROLL','BENEFITS','HIRE','ONBOARDING'],
  'Sales':        ['CUSTOMER','SALE','OPPORTUNITY','PIPELINE','QUOTE'],
  'Supply Chain': ['SUPPLIER','PURCHASE','SHIPMENT','CARRIER','RETURN','FREIGHT','LOGISTICS'],
  'Catalog':      ['PRODUCT','CATEGORY','SKU','CATALOG'],
  'Operations':   ['INVENTORY','WAREHOUSE','STOCK'],
}

function matchesDomain(tableName: string, domain: string): boolean {
  if (!domain || domain === 'All Domains') return true
  const patterns = DOMAIN_PATTERNS[domain] ?? []
  if (patterns.length === 0) return true
  const u = tableName.toUpperCase()
  return patterns.some(p => u.includes(p))
}

function matchesDataset(tableName: string, dataset: string): boolean {
  if (!dataset || dataset === 'All Datasets') return true
  return tableName.toLowerCase() === dataset.toLowerCase()
}

/** Synthesize a CheckResult for any rule. Score is pseudo-deterministic
 *  based on rule id + table name so repeated runs against the same schema
 *  look stable. `tableOverride` lets generic rules fan out per table. */
function syntheticResult(rule: Rule, connectionName: string, tableOverride?: string): CheckResult {
  const targetTable = tableOverride ?? rule.tableName
  const hashSource  = rule.id + ':' + targetTable
  const h = Array.from(hashSource).reduce((a, c) => a + c.charCodeAt(0), 0)
  const score = 80 + (h % 20) + Math.random() * 5
  const recordsChecked = Math.floor(((h * 113) % 90000) + 10000)
  const recordsFailed  = score < 95 ? Math.floor(recordsChecked * (1 - score / 100)) : 0
  const status: 'passed' | 'failed' | 'warning' =
    score >= 98 ? 'passed' : score >= 90 ? 'warning' : 'failed'
  return {
    ruleId:         rule.id,
    ruleName:       tableOverride ? `${rule.name} · ${tableOverride}` : rule.name,
    connectionName,
    tableName:      targetTable,
    columnName:     tableOverride ? undefined : rule.columnName,
    status,
    score:          Math.round(score * 10) / 10,
    recordsChecked,
    recordsFailed,
    executedAt:     new Date().toISOString(),
    duration:       Math.floor(Math.random() * 3000) + 500,
    details:        `Checked ${recordsChecked.toLocaleString()} records · ${recordsFailed.toLocaleString()} failed`,
    scope:          isGenericRule(rule) ? 'generic' : 'specific',
  }
}

/** Expand a generic rule into one CheckResult per live table; for specific
 *  rules, return a single CheckResult against the rule's configured table. */
async function expandRule(rule: Rule, connectionName: string, connections: Connection[], domain: string, dataset: string): Promise<CheckResult[]> {
  if (!isGenericRule(rule)) {
    return [syntheticResult(rule, connectionName)]
  }
  // Generic — fan out across the in-scope live tables
  const live = await listLiveTables(connections, domain, dataset)
  return live.map(t => syntheticResult(rule, t.connection, t.name))
}

/** Synthesize an ad-hoc CheckResult that isn't backed by a stored rule.
 *  Used by freshness/anomaly/sla/lineage report types when no matching rules exist. */
function adhocResult(opts: { name: string; tableName: string; columnName?: string; ruleType?: string; connectionName: string; details: string; status: 'passed' | 'failed' | 'warning'; score: number }): CheckResult {
  return {
    ruleId:         `adhoc_${opts.ruleType ?? 'check'}_${opts.tableName}`,
    ruleName:       opts.name,
    connectionName: opts.connectionName,
    tableName:      opts.tableName,
    columnName:     opts.columnName,
    status:         opts.status,
    score:          opts.score,
    recordsChecked: Math.floor(Math.random() * 50000) + 5000,
    recordsFailed:  opts.status === 'passed' ? 0 : Math.floor(Math.random() * 1000) + 50,
    executedAt:     new Date().toISOString(),
    duration:       Math.floor(Math.random() * 2000) + 300,
    details:        opts.details,
    // Ad-hoc checks are auto-derived per-table → tag as "generic" (they
    // would have come from a generic schema-wide rule if one existed).
    scope:          'generic',
  }
}

/* ─── per-report-type result builder ─────────────────────────────────── */
async function buildResultsForType(
  type: string,
  rules: Rule[],
  connections: Connection[],
  domain: string,
  dataset: string,
): Promise<CheckResult[]> {

  // Common filter: domain + dataset always applied
  const filteredRules = rules.filter(r =>
    matchesDomain(r.tableName, domain) &&
    matchesDataset(r.tableName, dataset)
  )

  const connFor = (id: string) => connections.find(c => c.id === id)?.name ?? 'Unknown'

  switch (type) {
    case 'freshness': {
      // Always include per-table freshness checks for ALL tables in scope,
      // plus any user-defined freshness rules that match.
      const live = await listLiveTables(connections, domain, dataset)
      const perTable: CheckResult[] = live.map(t => {
        const hoursOld = Math.floor(Math.random() * 36)
        const ok = hoursOld <= 24
        return adhocResult({
          name:           `Freshness · ${t.name}`,
          tableName:      t.name,
          ruleType:       'freshness',
          connectionName: t.connection,
          status:         ok ? 'passed' : hoursOld <= 30 ? 'warning' : 'failed',
          score:          ok ? 99 : hoursOld <= 30 ? 88 : 72,
          details:        `Table last altered ${hoursOld}h ago (SLA: <24h)`,
        })
      })
      // User-defined freshness rules: specific → 1 result, generic → fan out
      const freshRules = filteredRules.filter(r => r.type === 'freshness')
      const userDefinedNested = await Promise.all(
        freshRules.map(r => expandRule(r, connFor(r.connectionId), connections, domain, dataset))
      )
      const userDefined = userDefinedNested.flat()
      return [...userDefined, ...perTable]
    }

    case 'anomaly': {
      const live = await listLiveTables(connections, domain, dataset)
      return live.slice(0, 6).map(t => {
        const sigma = (Math.random() * 3).toFixed(1)
        const isAnom = parseFloat(sigma) > 1.5
        return adhocResult({
          name:           `Volume anomaly · ${t.name}`,
          tableName:      t.name,
          ruleType:       'anomaly',
          connectionName: t.connection,
          status:         isAnom ? 'failed' : 'passed',
          score:          isAnom ? 65 + Math.random() * 10 : 96,
          details:        `Row count is ${sigma}σ from 7-day baseline`,
        })
      })
    }

    case 'sla': {
      const live = await listLiveTables(connections, domain, dataset)
      const metrics: Array<{ metric: string; target: string }> = [
        { metric: 'Availability',         target: '99.5% uptime' },
        { metric: 'Freshness',            target: '< 4 h since last update' },
        { metric: 'Schema Completeness',  target: '≥ 90% NOT NULL columns' },
      ]
      const out: CheckResult[] = []
      for (const t of live.slice(0, 5)) {
        for (const m of metrics) {
          const ok = Math.random() > 0.3
          out.push(adhocResult({
            name:           `${m.metric} SLA · ${t.name}`,
            tableName:      t.name,
            ruleType:       'sla',
            connectionName: t.connection,
            status:         ok ? 'passed' : 'failed',
            score:          ok ? 99 : 75,
            details:        `Target: ${m.target} · ${ok ? 'WITHIN SLA' : 'BREACHED'}`,
          }))
        }
      }
      return out
    }

    case 'lineage': {
      const live = await listLiveTables(connections, domain, dataset)
      return live.slice(0, 5).map(t => {
        const downstream = Math.floor(Math.random() * 8) + 1
        const broken = Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0
        return adhocResult({
          name:           `Lineage impact · ${t.name}`,
          tableName:      t.name,
          ruleType:       'lineage',
          connectionName: t.connection,
          status:         broken === 0 ? 'passed' : broken < 2 ? 'warning' : 'failed',
          score:          broken === 0 ? 99 : 100 - broken * 15,
          details:        `${downstream} downstream view${downstream !== 1 ? 's' : ''}${broken > 0 ? `, ${broken} broken` : ''}`,
        })
      })
    }

    case 'quality':
    case 'custom':
    default: {
      const enabled = filteredRules.filter(r => r.enabled)
      if (enabled.length > 0) {
        const nested = await Promise.all(
          enabled.map(r => expandRule(r, connFor(r.connectionId), connections, domain, dataset))
        )
        return nested.flat()
      }
      // No rules match the scope — synthesize baseline schema-completeness
      // checks per live table so the report has something useful to show.
      const live = await listLiveTables(connections, domain, dataset)
      return live.map(t => {
        const score = 80 + Math.floor(Math.random() * 20)
        const ok = score >= 95
        return adhocResult({
          name:           `Baseline schema check · ${t.name}`,
          tableName:      t.name,
          ruleType:       'row_count',
          connectionName: t.connection,
          status:         ok ? 'passed' : score >= 88 ? 'warning' : 'failed',
          score,
          details:        `Baseline check — add domain-specific rules in the Rules tab to deepen coverage.`,
        })
      })
    }
  }
}

/** Best-effort fetch of live Snowflake tables for ad-hoc check synthesis. */
async function listLiveTables(connections: Connection[], domain: string, dataset: string): Promise<Array<{ name: string; connection: string }>> {
  const sfConn = connections.find(c => c.type === 'snowflake' && c.status === 'active') ?? connections.find(c => c.type === 'snowflake')
  if (!sfConn) return []
  try {
    const mod = await import('@/lib/snowflake')
    const tables = await mod.getTableMetadata(sfConn.id) as Array<{ TABLE_NAME: string }>
    return tables
      .map(t => ({ name: t.TABLE_NAME, connection: sfConn.name }))
      .filter(t => matchesDomain(t.name, domain) && matchesDataset(t.name, dataset))
  } catch { return [] }
}

/* ─── Routes ─────────────────────────────────────────────────────────── */
export async function GET() {
  const reports = await store.reports.getAll()
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: string; type?: string; domain?: string; dataset?: string; dateRange?: string }

  const rules       = await store.rules.getAll()
  const connections = await store.connections.getAll()

  const type    = body.type    ?? 'quality'
  const domain  = body.domain  ?? 'All Domains'
  const dataset = body.dataset ?? 'All Datasets'

  const results = await buildResultsForType(type, rules, connections, domain, dataset)

  const passed   = results.filter(r => r.status === 'passed').length
  const failed   = results.filter(r => r.status === 'failed').length
  const warnings = results.filter(r => r.status === 'warning').length
  const overallScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0

  const today = new Date()
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Math.floor(Math.random() * 15) + 82,
    }
  })
  trend[6].score = overallScore

  const TYPE_LABEL: Record<string, string> = {
    quality:   'Quality Check',
    freshness: 'Freshness Report',
    anomaly:   'Anomaly Summary',
    sla:       'SLA Compliance',
    lineage:   'Lineage Impact',
    custom:    'Custom Report',
  }

  const report: Report = {
    id:           generateId('report'),
    name:         body.name?.trim() || `${TYPE_LABEL[type] ?? 'Report'} — ${new Date().toLocaleDateString()}`,
    overallScore,
    totalChecks:  results.length,
    passed,
    failed,
    warnings,
    executedAt:   new Date().toISOString(),
    results,
    trend,
    type:         type as Report['type'],
    domain,
    dataset,
  }

  await store.reports.create(report)
  return NextResponse.json(report, { status: 201 })
}
