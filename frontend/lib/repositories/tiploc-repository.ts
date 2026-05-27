import { readFileSync } from 'fs'
import { join } from 'path'

export interface TiplocLocation {
  lat: number
  lng: number
  name: string
}

export class TiplocRepository {
  private readonly tiplocs: Map<string, TiplocLocation>

  constructor() {
    const path = join(process.cwd(), 'data', 'tiplocs.json')
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, TiplocLocation>
    this.tiplocs = new Map(Object.entries(raw).map(([k, v]) => [k.toUpperCase(), v]))
  }

  get(tiploc: string): TiplocLocation | null {
    return this.tiplocs.get(tiploc.toUpperCase()) ?? null
  }

  has(tiploc: string): boolean {
    return this.tiplocs.has(tiploc.toUpperCase())
  }
}
