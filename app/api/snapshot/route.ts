import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET() {
  try {
    const { env } = getCloudflareContext()
    if (env && (env as any).TRAINS_KV) {
      const snapshot = await (env as any).TRAINS_KV.get('snapshot:hourly')
      if (snapshot) {
        return new NextResponse(snapshot, {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
  } catch (e) {
    console.warn('KV not available, falling back', e)
  }

  try {
    const { env } = getCloudflareContext()
    if (env && (env as any).TRAINS_HUB) {
      const resp = await (env as any).TRAINS_HUB.fetch('https://trains-hub/snapshot')
      if (resp.ok) {
        const data = await resp.json()
        return NextResponse.json(data.trains || [])
      }
    }
  } catch (e) {
    console.warn('Durable Object fallback failed or not available', e)
  }

  return NextResponse.json([])
}
