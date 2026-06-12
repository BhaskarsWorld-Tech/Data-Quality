import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { store } from '@/lib/store'
import { generateId } from '@/lib/utils'
import { Connection, Rule } from '@/lib/types'
import { resolveApiKeyAsync } from '@/lib/agentConfig'

export const runtime  = 'nodejs'
export const dynamic  = 'force-dynamic'

/** Resolve the API key fresh on every request: Cloudflare secret first,
 *  process.env second, persisted UI-saved key third. */
async function getApiKey(): Promise<string> {
  return resolveApiKeyAsync()
}

/** Validate that we have a plausibly-correct Anthropic key. */
function isValidKey(k: string): boolean {
  return k.length >= 20 && k.startsWith('sk-ant-')
}

const tools: Anthropic.Tool[] = [
  {
    name: 'list_connections',
    description: 'List all data source connections configured in the system',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'create_connection',
    description: 'Create a new data source connection',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Display name for the connection' },
        type: { type: 'string', enum: ['postgresql', 'mysql', 'bigquery', 'snowflake', 'csv', 'api', 'mongodb', 'redshift'], description: 'Database type' },
        host: { type: 'string', description: 'Database host (optional for cloud databases)' },
        port: { type: 'number', description: 'Database port' },
        database: { type: 'string', description: 'Database or project name' },
        username: { type: 'string', description: 'Database username' },
        schema: { type: 'string', description: 'Schema name' }
      },
      required: ['name', 'type']
    }
  },
  {
    name: 'list_rules',
    description: 'List all data quality rules. Can filter by category, connection, or status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Filter by category (completeness, accuracy, uniqueness, validity, timeliness, consistency)' },
        connectionId: { type: 'string', description: 'Filter by connection ID' },
        enabled: { type: 'boolean', description: 'Filter by enabled/disabled status' }
      },
      required: []
    }
  },
  {
    name: 'create_rule',
    description: 'Create a new data quality rule',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Rule name' },
        description: { type: 'string', description: 'What this rule checks' },
        category: { type: 'string', enum: ['completeness', 'accuracy', 'uniqueness', 'validity', 'timeliness', 'consistency'] },
        type: { type: 'string', enum: ['not_null', 'unique', 'range', 'regex', 'custom_sql', 'freshness', 'row_count', 'referential'] },
        connectionId: { type: 'string', description: 'Connection ID to apply this rule to' },
        tableName: { type: 'string', description: 'Table to check' },
        columnName: { type: 'string', description: 'Column to check (optional for table-level rules)' },
        parameters: { type: 'object', description: 'Rule parameters (e.g., min/max for range, pattern for regex, maxAgeHours for freshness)' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }
      },
      required: ['name', 'category', 'type', 'connectionId', 'tableName', 'severity']
    }
  },
  {
    name: 'toggle_rule',
    description: 'Enable or disable a data quality rule',
    input_schema: {
      type: 'object' as const,
      properties: {
        ruleId: { type: 'string', description: 'Rule ID to toggle' },
        enabled: { type: 'boolean', description: 'Set to true to enable, false to disable' }
      },
      required: ['ruleId', 'enabled']
    }
  },
  {
    name: 'run_quality_check',
    description: 'Run data quality checks and generate a new report',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for this quality check run' }
      },
      required: []
    }
  },
  {
    name: 'get_report',
    description: 'Get the latest data quality report with scores and check results',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'get_dashboard_stats',
    description: 'Get overall dashboard statistics including totals, scores, and trends',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  }
]

async function executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case 'list_connections': {
      const connections = await store.connections.getAll()
      return { connections, total: connections.length }
    }
    case 'create_connection': {
      const conn: Connection = {
        id: generateId('conn'),
        name: input.name as string,
        type: input.type as Connection['type'],
        host: input.host as string | undefined,
        port: input.port as number | undefined,
        database: input.database as string | undefined,
        username: input.username as string | undefined,
        schema: input.schema as string | undefined,
        status: 'inactive',
        createdAt: new Date().toISOString()
      }
      await store.connections.create(conn)
      return { success: true, connection: conn, message: `Connection "${conn.name}" created successfully!` }
    }
    case 'list_rules': {
      let rules = await store.rules.getAll()
      if (input.category) rules = rules.filter(r => r.category === input.category)
      if (input.connectionId) rules = rules.filter(r => r.connectionId === input.connectionId)
      if (input.enabled !== undefined) rules = rules.filter(r => r.enabled === input.enabled)
      const connections = await store.connections.getAll()
      const enriched = rules.map(r => ({
        ...r,
        connectionName: connections.find(c => c.id === r.connectionId)?.name || 'Unknown'
      }))
      return { rules: enriched, total: enriched.length }
    }
    case 'create_rule': {
      const rule: Rule = {
        id: generateId('rule'),
        name: input.name as string,
        description: (input.description as string) || '',
        category: input.category as Rule['category'],
        type: input.type as Rule['type'],
        connectionId: input.connectionId as string,
        tableName: input.tableName as string,
        columnName: input.columnName as string | undefined,
        parameters: (input.parameters as Record<string, unknown>) || {},
        enabled: true,
        severity: input.severity as Rule['severity'],
        createdAt: new Date().toISOString()
      }
      await store.rules.create(rule)
      return { success: true, rule, message: `Rule "${rule.name}" created successfully!` }
    }
    case 'toggle_rule': {
      const updated = await store.rules.update(input.ruleId as string, { enabled: input.enabled as boolean })
      if (!updated) return { error: 'Rule not found' }
      return { success: true, rule: updated, message: `Rule "${updated.name}" ${updated.enabled ? 'enabled' : 'disabled'}` }
    }
    case 'run_quality_check': {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.name || `Quality Check - ${new Date().toLocaleDateString()}` })
      })
      const report = await res.json()
      return {
        success: true,
        summary: {
          score: report.overallScore,
          passed: report.passed,
          failed: report.failed,
          warnings: report.warnings,
          total: report.totalChecks
        },
        message: `Quality check completed! Overall score: ${report.overallScore}%`
      }
    }
    case 'get_report': {
      const latest = await store.reports.getLatest()
      if (!latest) return { message: 'No reports found. Run a quality check first.' }
      return {
        report: {
          name: latest.name,
          overallScore: latest.overallScore,
          passed: latest.passed,
          failed: latest.failed,
          warnings: latest.warnings,
          total: latest.totalChecks,
          executedAt: latest.executedAt,
          topIssues: latest.results
            .filter(r => r.status !== 'passed')
            .sort((a, b) => a.score - b.score)
            .slice(0, 3)
        }
      }
    }
    case 'get_dashboard_stats': {
      const connections = await store.connections.getAll()
      const rules = await store.rules.getAll()
      const latest = await store.reports.getLatest()
      return {
        totalConnections: connections.length,
        activeConnections: connections.filter(c => c.status === 'active').length,
        totalRules: rules.length,
        enabledRules: rules.filter(r => r.enabled).length,
        overallScore: latest?.overallScore || 0,
        lastRunAt: latest?.executedAt || null,
        rulesByCategory: Object.entries(
          rules.reduce((acc, r) => {
            acc[r.category] = (acc[r.category] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        ).map(([cat, count]) => ({ category: cat, count }))
      }
    }
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  const apiKey = await getApiKey()
  if (!apiKey) {
    return NextResponse.json({
      response: "⚠️ **API Key not found.** Two ways to fix:\n\n1. **In the app (easiest)** — go to **Settings → API Keys → Anthropic AI Agent** and paste your key.\n2. **Or via env file** — add `ANTHROPIC_API_KEY=sk-ant-…` to `.env.local` in the project root, then **restart the Next.js server**. Note: an empty `ANTHROPIC_API_KEY` set in your shell will override `.env.local` — `unset ANTHROPIC_API_KEY` first.\n\nI can still show you around the app! Try the sidebar to explore Connections, Rules, and Reports.",
      toolsUsed: []
    })
  }
  if (!isValidKey(apiKey)) {
    return NextResponse.json({
      response: `⚠️ **API Key looks malformed.** Expected something starting with \`sk-ant-\` and at least 20 chars; got ${apiKey.length} chars starting with \`${apiKey.slice(0, 6)}…\`. Double-check \`.env.local\` for stray quotes, spaces, or line breaks, then restart the server.`,
      toolsUsed: []
    })
  }

  // Build the client per-request so a key swap takes effect on next call.
  const anthropic = new Anthropic({ apiKey })

  const systemPrompt = `You are DataGuard AI, an expert Data Quality assistant. You help users manage their data quality platform by:

- Adding and managing data source connections (PostgreSQL, MySQL, BigQuery, Snowflake, CSV, etc.)
- Creating and configuring data quality rules (null checks, uniqueness, range validation, regex patterns, freshness checks)
- Running quality checks and analyzing reports
- Explaining data quality best practices

You have access to tools to perform actions directly in the system. When a user asks to add a connection or rule, use the appropriate tool to actually create it.

Be conversational, helpful, and proactive. When creating rules or connections, confirm what you created with the user. Always explain the data quality impact of the actions you take.

Format responses with markdown for readability. Use emojis sparingly to highlight key points.`

  // Agentic loop
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content
  }))

  let finalResponse = ''
  const toolsUsed: string[] = []
  let currentMessages = [...anthropicMessages]

  try {
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages: currentMessages
    })

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of toolUseBlocks) {
        if (block.type === 'tool_use') {
          toolsUsed.push(block.name)
          const result = await executeTool(block.name, block.input as Record<string, unknown>)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          })
        }
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ]
    } else {
      const textBlock = response.content.find(b => b.type === 'text')
      if (textBlock && textBlock.type === 'text') {
        finalResponse = textBlock.text
      }
      break
    }
  }
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    if (e.status === 401) {
      return NextResponse.json({
        response: '⚠️ **Anthropic rejected the API key (HTTP 401).** The key in `.env.local` is invalid, expired, or revoked. Generate a new one at console.anthropic.com → API Keys, paste it into `.env.local`, then restart the server.',
        toolsUsed,
      })
    }
    if (e.status === 429) {
      return NextResponse.json({
        response: '⚠️ **Rate limited by Anthropic (HTTP 429).** Wait a few seconds and try again. If this happens often, check your usage at console.anthropic.com.',
        toolsUsed,
      })
    }
    return NextResponse.json({
      response: `⚠️ **Agent error:** ${e.message ?? 'unknown error'}${e.status ? ` (HTTP ${e.status})` : ''}`,
      toolsUsed,
    })
  }

  return NextResponse.json({ response: finalResponse, toolsUsed })
}

/** GET /api/agent — quick health check used by the UI to detect missing/invalid keys. */
export async function GET() {
  const k = await getApiKey()
  return NextResponse.json({
    configured: k.length > 0,
    valid:      isValidKey(k),
    keyLength:  k.length,
    keyPrefix:  k ? k.slice(0, 7) : null,
  })
}
