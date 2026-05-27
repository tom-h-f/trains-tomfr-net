import { NextResponse } from 'next/server'
import { getRegistry } from '../../../lib/global-state'

export function GET() {
  const registry = getRegistry()
  if (!registry) return NextResponse.json({ error: 'not initialized' }, { status: 503 })
  return NextResponse.json(registry.getDebugInfo())
}
