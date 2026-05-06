import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { generateId } from '@/lib/utils'
import { Report, CheckResult } from '@/lib/types'

export async function GET() {
  const reports = store.reports.getAll()
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Simulate running checks and generating report
  const rules = store.rules.getAll()
  const connections = store.connections.getAll()
  const enabledRules = rules.filter(r => r.enabled)

  const results: CheckResult[] = enabledRules.map(rule => {
    const conn = connections.find(c => c.id === rule.connectionId)
    const score = Math.random() * 20 + 80 // 80-100
    const recordsChecked = Math.floor(Math.random() * 100000) + 10000
    const recordsFailed = score < 95 ? Math.floor(recordsChecked * (1 - score / 100)) : 0
    const status = score >= 98 ? 'passed' : score >= 90 ? 'warning' : 'failed'

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      connectionName: conn?.name || 'Unknown',
      tableName: rule.tableName,
      columnName: rule.columnName,
      status: status as 'passed' | 'failed' | 'warning',
      score: Math.round(score * 10) / 10,
      recordsChecked,
      recordsFailed,
      executedAt: new Date().toISOString(),
      duration: Math.floor(Math.random() * 3000) + 500,
      details: `Checked ${recordsChecked.toLocaleString()} records`
    }
  })

  const passed = results.filter(r => r.status === 'passed').length
  const failed = results.filter(r => r.status === 'failed').length
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
      score: Math.floor(Math.random() * 15) + 82
    }
  })
  trend[6].score = overallScore

  const report: Report = {
    id: generateId('report'),
    name: body.name || `Quality Check - ${new Date().toLocaleDateString()}`,
    overallScore,
    totalChecks: results.length,
    passed,
    failed,
    warnings,
    executedAt: new Date().toISOString(),
    results,
    trend
  }

  store.reports.create(report)
  return NextResponse.json(report, { status: 201 })
}
