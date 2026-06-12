/**
 * Persistent configuration for automated alerts.
 * Stored at data/alerts-config.json.
 */
import fs from 'fs'
import path from 'path'

export type Channel = 'slack' | 'teams' | 'webex' | 'email' | 'pagerduty'
export type Severity = 'critical' | 'warning' | 'info'

export interface SlackConfig    { enabled: boolean; webhookUrl: string; groupName:   string }
export interface TeamsConfig    { enabled: boolean; webhookUrl: string; channelName: string }
export interface WebexConfig    { enabled: boolean; webhookUrl: string; spaceName:   string }
export interface EmailConfig    { enabled: boolean; recipients: string[]; fromAddress: string }
export interface PagerDutyConfig{ enabled: boolean; routingKey: string }

export interface AlertConfig {
  channels: {
    slack:     SlackConfig
    teams:     TeamsConfig
    webex:     WebexConfig
    email:     EmailConfig
    pagerduty: PagerDutyConfig
  }
  autoSend: Record<Severity, boolean>
  /** Map of alert id → last dispatch ISO timestamp (de-dupes auto-sends). */
  lastDispatched: Record<string, string>
}

const DEFAULT_CONFIG: AlertConfig = {
  channels: {
    slack:     { enabled: false, webhookUrl: '',  groupName:   '#data-alerts' },
    teams:     { enabled: false, webhookUrl: '',  channelName: 'Data Quality' },
    webex:     { enabled: false, webhookUrl: '',  spaceName:   'Data Alerts' },
    email:     { enabled: true,  recipients: ['yourschinnu@gmail.com'], fromAddress: 'alerts@dataguard.io' },
    pagerduty: { enabled: false, routingKey: '' },
  },
  autoSend: { critical: true, warning: false, info: false },
  lastDispatched: {},
}

const FILE = path.join(process.cwd(), 'data', 'alerts-config.json')

export function readAlertConfig(): AlertConfig {
  if (!fs.existsSync(FILE)) return DEFAULT_CONFIG
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Partial<AlertConfig>
    return {
      channels: { ...DEFAULT_CONFIG.channels, ...(raw.channels ?? {}) },
      autoSend: { ...DEFAULT_CONFIG.autoSend, ...(raw.autoSend ?? {}) },
      lastDispatched: raw.lastDispatched ?? {},
    }
  } catch { return DEFAULT_CONFIG }
}

export function writeAlertConfig(cfg: AlertConfig): void {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2))
}

export function markDispatched(alertId: string) {
  const cfg = readAlertConfig()
  cfg.lastDispatched[alertId] = new Date().toISOString()
  writeAlertConfig(cfg)
}
