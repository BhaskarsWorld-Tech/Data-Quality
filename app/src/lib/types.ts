export type ConnectionType = 'postgresql' | 'mysql' | 'bigquery' | 'snowflake' | 'csv' | 'api' | 'mongodb' | 'redshift'

export interface Connection {
  id: string
  name: string
  type: ConnectionType
  // Common fields
  host?: string
  port?: number
  database?: string
  username?: string
  schema?: string
  // Snowflake-specific
  account?: string
  warehouse?: string
  role?: string
  // BigQuery-specific
  project?: string
  keyFile?: string
  // MongoDB / API
  connectionString?: string
  baseUrl?: string
  authType?: string
  delimiter?: string
  filePath?: string
  status: 'active' | 'inactive' | 'error'
  lastTested?: string
  createdAt: string
  [key: string]: unknown   // allow extra fields without TS errors
}

export type RuleCategory = 'completeness' | 'accuracy' | 'uniqueness' | 'validity' | 'timeliness' | 'consistency'
export type RuleType = 'not_null' | 'unique' | 'range' | 'regex' | 'custom_sql' | 'freshness' | 'row_count' | 'referential'

export interface Rule {
  id: string
  name: string
  description: string
  category: RuleCategory
  type: RuleType
  connectionId: string
  tableName: string
  columnName?: string
  parameters: Record<string, unknown>
  enabled: boolean
  severity: 'critical' | 'high' | 'medium' | 'low'
  createdAt: string
}

export interface CheckResult {
  ruleId: string
  ruleName: string
  connectionName: string
  tableName: string
  columnName?: string
  status: 'passed' | 'failed' | 'warning'
  score: number
  recordsChecked: number
  recordsFailed: number
  executedAt: string
  duration: number
  details?: string
  /** Whether the rule applied to a single table ("specific") or expanded
   *  across every table in the schema ("generic"). Derived from the rule's
   *  tableName at execution time. */
  scope?: 'generic' | 'specific'
}

export interface Report {
  id: string
  name: string
  overallScore: number
  totalChecks: number
  passed: number
  failed: number
  warnings: number
  executedAt: string
  results: CheckResult[]
  trend: { date: string; score: number }[]
  /** Report-type filter applied at creation time. */
  type?:    'quality' | 'freshness' | 'anomaly' | 'sla' | 'lineage' | 'custom'
  /** Domain scope applied at creation time (e.g. "Finance"). */
  domain?:  string
  /** Dataset / table scope applied at creation time. */
  dataset?: string
}

export interface DashboardStats {
  totalRules: number
  activeConnections: number
  checksToday: number
  overallScore: number
  trend: { date: string; score: number }[]
  recentChecks: CheckResult[]
  rulesByCategory: { category: string; count: number; color: string }[]
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolsUsed?: string[]
}
