import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { generateId } from '@/lib/utils'
import { Rule } from '@/lib/types'

export async function GET() {
  const rules = store.rules.getAll()
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const rule: Rule = {
    ...body,
    id: generateId('rule'),
    enabled: body.enabled ?? true,
    createdAt: new Date().toISOString()
  }
  store.rules.create(rule)
  return NextResponse.json(rule, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  const updated = store.rules.update(id, updates)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  store.rules.delete(id)
  return NextResponse.json({ success: true })
}
