import { NextRequest, NextResponse } from 'next/server'
import { readAlertConfig, markDispatched, Channel, Severity } from '@/lib/alertConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SendRequest {
  alertId?:  string                  // for de-dup tracking on auto-sends
  channels?: Channel[]               // override; otherwise uses all enabled channels
  to?:       string                  // additional email recipient
  subject:   string
  body:      string
  severity:  Severity
  auto?:     boolean                 // if true, respect lastDispatched + autoSend rules
  domain?:   string                  // business domain ("Sales", "Supply Chain", etc.)
  owner?:    string                  // owning team
  table?:    string                  // fully-qualified table name
}

interface DispatchResult { channel: Channel; status: 'sent' | 'queued' | 'skipped' | 'failed'; receipt: string }

/** Post to a generic incoming-webhook URL with JSON payload. */
async function postWebhook(url: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; detail: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, detail: text.slice(0, 200) || res.statusText }
  } catch (e) {
    return { ok: false, status: 0, detail: (e as Error).message }
  }
}

function sevEmoji(s: Severity) { return s === 'critical' ? '🚨' : s === 'warning' ? '⚠️' : 'ℹ️' }
function sevColor(s: Severity) { return s === 'critical' ? '#dc2626' : s === 'warning' ? '#d97706' : '#0284c7' }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendRequest
    const cfg  = readAlertConfig()

    // Auto-send guards: respect severity rules and de-dup
    if (body.auto) {
      if (!cfg.autoSend[body.severity]) {
        return NextResponse.json({ ok: true, dispatched: [], skipped: 'auto-send disabled for this severity' })
      }
      if (body.alertId && cfg.lastDispatched[body.alertId]) {
        return NextResponse.json({ ok: true, dispatched: [], skipped: 'already dispatched' })
      }
    }

    // Decide which channels to dispatch on
    const channels: Channel[] = body.channels && body.channels.length > 0
      ? body.channels
      : (['slack', 'teams', 'webex', 'email', 'pagerduty'] as Channel[]).filter(c => {
          const ch = cfg.channels[c] as { enabled: boolean }
          return ch.enabled
        })

    const dispatched: DispatchResult[] = []
    const ts = new Date().toISOString()

    for (const ch of channels) {
      switch (ch) {
        case 'slack': {
          const c = cfg.channels.slack
          if (!c.enabled) { dispatched.push({ channel: 'slack', status: 'skipped', receipt: 'channel disabled' }); break }
          if (!c.webhookUrl) { dispatched.push({ channel: 'slack', status: 'skipped', receipt: 'no webhook URL configured' }); break }
          const fields: Array<{ title: string; value: string; short: boolean }> = []
          if (body.domain) fields.push({ title: 'Domain', value: body.domain, short: true })
          if (body.owner)  fields.push({ title: 'Owner',  value: body.owner,  short: true })
          if (body.table)  fields.push({ title: 'Table',  value: body.table,  short: false })
          const r = await postWebhook(c.webhookUrl, {
            text: `${sevEmoji(body.severity)} *${body.subject}*`,
            attachments: [{ color: sevColor(body.severity), text: body.body, fields }],
          })
          dispatched.push({ channel: 'slack', status: r.ok ? 'sent' : 'failed', receipt: r.ok ? `posted to ${c.groupName}` : `HTTP ${r.status}: ${r.detail}` })
          break
        }
        case 'teams': {
          const c = cfg.channels.teams
          if (!c.enabled) { dispatched.push({ channel: 'teams', status: 'skipped', receipt: 'channel disabled' }); break }
          if (!c.webhookUrl) { dispatched.push({ channel: 'teams', status: 'skipped', receipt: 'no webhook URL configured' }); break }
          // Microsoft Teams Office 365 Connector "MessageCard" format
          const facts: Array<{ name: string; value: string }> = []
          if (body.domain) facts.push({ name: 'Domain', value: body.domain })
          if (body.owner)  facts.push({ name: 'Owner',  value: body.owner  })
          if (body.table)  facts.push({ name: 'Table',  value: body.table  })
          facts.push({ name: 'Severity', value: body.severity.toUpperCase() })
          const r = await postWebhook(c.webhookUrl, {
            '@type': 'MessageCard',
            '@context': 'https://schema.org/extensions',
            themeColor: sevColor(body.severity).replace('#', ''),
            summary: body.subject,
            title:   `${sevEmoji(body.severity)} ${body.subject}`,
            text:    body.body,
            sections: [{ facts }],
          })
          dispatched.push({ channel: 'teams', status: r.ok ? 'sent' : 'failed', receipt: r.ok ? `posted to ${c.channelName}` : `HTTP ${r.status}: ${r.detail}` })
          break
        }
        case 'webex': {
          const c = cfg.channels.webex
          if (!c.enabled) { dispatched.push({ channel: 'webex', status: 'skipped', receipt: 'channel disabled' }); break }
          if (!c.webhookUrl) { dispatched.push({ channel: 'webex', status: 'skipped', receipt: 'no webhook URL configured' }); break }
          const meta: string[] = []
          if (body.domain) meta.push(`**Domain:** ${body.domain}`)
          if (body.owner)  meta.push(`**Owner:** ${body.owner}`)
          if (body.table)  meta.push(`**Table:** \`${body.table}\``)
          const r = await postWebhook(c.webhookUrl, {
            markdown: `### ${sevEmoji(body.severity)} ${body.subject}\n\n${meta.join(' · ')}\n\n${body.body}`,
          })
          dispatched.push({ channel: 'webex', status: r.ok ? 'sent' : 'failed', receipt: r.ok ? `posted to ${c.spaceName}` : `HTTP ${r.status}: ${r.detail}` })
          break
        }
        case 'email': {
          const c = cfg.channels.email
          if (!c.enabled) { dispatched.push({ channel: 'email', status: 'skipped', receipt: 'channel disabled' }); break }
          const recipients = [...new Set([...(c.recipients ?? []), ...(body.to ? [body.to] : [])])].filter(Boolean)
          if (recipients.length === 0) { dispatched.push({ channel: 'email', status: 'skipped', receipt: 'no recipients' }); break }
          // TODO: real SMTP / SendGrid / SES integration. For now we queue.
          dispatched.push({ channel: 'email', status: 'queued', receipt: `queued for ${recipients.join(', ')} from ${c.fromAddress}` })
          break
        }
        case 'pagerduty': {
          const c = cfg.channels.pagerduty
          if (!c.enabled) { dispatched.push({ channel: 'pagerduty', status: 'skipped', receipt: 'channel disabled' }); break }
          if (!c.routingKey) { dispatched.push({ channel: 'pagerduty', status: 'skipped', receipt: 'no routing key configured' }); break }
          const r = await postWebhook('https://events.pagerduty.com/v2/enqueue', {
            routing_key:  c.routingKey,
            event_action: 'trigger',
            payload: {
              summary:   body.subject,
              severity:  body.severity === 'critical' ? 'critical' : 'warning',
              source:    'DataGuard',
              component: body.table,
              group:     body.domain,
              custom_details: {
                body:   body.body,
                domain: body.domain,
                owner:  body.owner,
                table:  body.table,
              },
            },
          })
          dispatched.push({ channel: 'pagerduty', status: r.ok ? 'sent' : 'failed', receipt: r.ok ? `incident raised` : `HTTP ${r.status}: ${r.detail}` })
          break
        }
      }
    }

    if (body.alertId && dispatched.some(d => d.status === 'sent' || d.status === 'queued')) {
      markDispatched(body.alertId)
    }

    return NextResponse.json({ ok: true, dispatched, ts })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
