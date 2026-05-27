import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET() {
  try {
    const { env } = getCloudflareContext()
    const resp = await (env as any).TRAINS_HUB.fetch('https://trains-hub/snapshot')
    if (!resp.ok) return NextResponse.json({ error: 'hub unavailable' }, { status: 503 })
    return NextResponse.json(await resp.json())
  } catch {
    return NextResponse.json({ error: 'not available in this environment' }, { status: 503 })
  }
}
