import { readFileSync } from 'fs'
import { join } from 'path'

interface BerthLocation {
  lat: number
  lng: number
}

export class BerthRepository {
  private readonly berths: Map<string, BerthLocation>

  constructor() {
    const path = join(process.cwd(), 'data', 'berths.json')
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, BerthLocation>
    this.berths = new Map(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]))
  }

  get(areaId: string, berthId: string): BerthLocation | null {
    return this.berths.get(`${areaId}_${berthId}`.toLowerCase()) ?? null
  }
}
