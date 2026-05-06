import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { generateId } from '@/lib/utils'
import { Connection } from '@/lib/types'

export async function GET() {
  const connections = store.connections.getAll()
  return NextResponse.json(connections)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const connection: Connection = {
    ...body,
    id: generateId('conn'),
    status: 'inactive',
    createdAt: new Date().toISOString()
  }
  store.connections.create(connection)
  return NextResponse.json(connection, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  const updated = store.connections.update(id, updates)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  store.connections.delete(id)
  return NextResponse.json({ success: true })
}
