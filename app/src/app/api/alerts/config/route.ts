import { NextRequest, NextResponse } from 'next/server'
import { readAlertConfig, writeAlertConfig, AlertConfig } from '@/lib/alertConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Return config but redact webhook URLs and routing keys so they aren't
  // round-tripped to the client in full plaintext on every fetch.
  const cfg = readAlertConfig()
  const masked = (s: string) => s.length > 12 ? s.slice(0, 8) + '…' + s.slice(-4) : s
  return NextResponse.json({
    channels: {
      slack:     { ...cfg.channels.slack,     webhookUrl: cfg.channels.slack.webhookUrl     ? masked(cfg.channels.slack.webhookUrl)     : '' },
      teams:     { ...cfg.channels.teams,     webhookUrl: cfg.channels.teams.webhookUrl     ? masked(cfg.channels.teams.webhookUrl)     : '' },
      webex:     { ...cfg.channels.webex,     webhookUrl: cfg.channels.webex.webhookUrl     ? masked(cfg.channels.webex.webhookUrl)     : '' },
      email:     cfg.channels.email,
      pagerduty: { ...cfg.channels.pagerduty, routingKey: cfg.channels.pagerduty.routingKey ? masked(cfg.channels.pagerduty.routingKey) : '' },
    },
    autoSend: cfg.autoSend,
    lastDispatched: cfg.lastDispatched,
  })
}

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.json() as Partial<AlertConfig>
    const current  = readAlertConfig()

    // Merge — only overwrite a webhook URL / routing key if the incoming value
    // does not look like a redacted mask ("xxxxx…yyyy").
    const isMaskedValue = (s: string) => /\…/.test(s)

    const merged: AlertConfig = {
      channels: {
        slack: {
          ...current.channels.slack,
          ...(incoming.channels?.slack ?? {}),
          webhookUrl: incoming.channels?.slack?.webhookUrl && !isMaskedValue(incoming.channels.slack.webhookUrl)
            ? incoming.channels.slack.webhookUrl
            : current.channels.slack.webhookUrl,
        },
        teams: {
          ...current.channels.teams,
          ...(incoming.channels?.teams ?? {}),
          webhookUrl: incoming.channels?.teams?.webhookUrl && !isMaskedValue(incoming.channels.teams.webhookUrl)
            ? incoming.channels.teams.webhookUrl
            : current.channels.teams.webhookUrl,
        },
        webex: {
          ...current.channels.webex,
          ...(incoming.channels?.webex ?? {}),
          webhookUrl: incoming.channels?.webex?.webhookUrl && !isMaskedValue(incoming.channels.webex.webhookUrl)
            ? incoming.channels.webex.webhookUrl
            : current.channels.webex.webhookUrl,
        },
        email:     { ...current.channels.email,     ...(incoming.channels?.email     ?? {}) },
        pagerduty: {
          ...current.channels.pagerduty,
          ...(incoming.channels?.pagerduty ?? {}),
          routingKey: incoming.channels?.pagerduty?.routingKey && !isMaskedValue(incoming.channels.pagerduty.routingKey)
            ? incoming.channels.pagerduty.routingKey
            : current.channels.pagerduty.routingKey,
        },
      },
      autoSend: { ...current.autoSend, ...(incoming.autoSend ?? {}) },
      lastDispatched: current.lastDispatched,
    }
    writeAlertConfig(merged)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
