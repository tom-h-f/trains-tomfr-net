import type { TrainStateService } from './train-state-service'
import type { TrainPosition } from '../../types/train'

interface TdBerth {
  areaId: string
  berthId: string
}

interface TrainEntry {
  rid: string
  headcode: string | null
  toc: string | null
  origin: string | null
  destination: string | null
  delayMinutes: number
  berth: TdBerth | null
  lat: number | null
  lng: number | null
  destLat: number | null
  destLng: number | null
  updatedAt: string
}

export interface DebugInfo {
  tdMessages: number
  darwinMessages: number
  berthHits: number
  berthMisses: number
  trainsWithPosition: number
  trainsTotal: number
  lastTdSample: string | null
  lastDarwinSample: string | null
}

export class TrainRegistry {
  private readonly trains = new Map<string, TrainEntry>()
  private readonly headcodeToRid = new Map<string, string>()
  private readonly state: TrainStateService

  private tdMessages = 0
  private darwinMessages = 0
  private berthHits = 0
  private berthMisses = 0
  private lastTdSample: string | null = null
  private lastDarwinSample: string | null = null

  constructor(state: TrainStateService) {
    this.state = state
  }

  getDebugInfo(): DebugInfo {
    return {
      tdMessages: this.tdMessages,
      darwinMessages: this.darwinMessages,
      berthHits: this.berthHits,
      berthMisses: this.berthMisses,
      trainsWithPosition: [...this.trains.values()].filter(t => t.lat !== null).length,
      trainsTotal: this.trains.size,
      lastTdSample: this.lastTdSample,
      lastDarwinSample: this.lastDarwinSample,
    }
  }

  updateFromTd(headcode: string, berth: TdBerth, lat: number | null, lng: number | null) {
    this.tdMessages++
    if (lat !== null) this.berthHits++
    else this.berthMisses++

    if (this.tdMessages <= 5)
      this.lastTdSample = `headcode=${headcode} area=${berth.areaId} berth=${berth.berthId} lat=${lat} lng=${lng}`

    const rid = this.headcodeToRid.get(headcode) ?? headcode
    const existing = this.trains.get(rid)

    const entry: TrainEntry = existing
      ? { ...existing, headcode, berth, lat, lng, updatedAt: new Date().toISOString() }
      : { rid, headcode, toc: null, origin: null, destination: null, delayMinutes: 0, berth, lat, lng, destLat: null, destLng: null, updatedAt: new Date().toISOString() }

    this.trains.set(rid, entry)

    if (lat !== null && lng !== null)
      this.publishPosition(rid, entry)
  }

  updateFromDarwin(
    rid: string,
    headcode: string | null,
    toc: string | null,
    origin: string | null,
    destination: string | null,
    delayMinutes: number,
    destLat?: number | null,
    destLng?: number | null,
  ) {
    this.darwinMessages++
    if (this.darwinMessages <= 5)
      this.lastDarwinSample = `rid=${rid} headcode=${headcode} toc=${toc} origin=${origin} dest=${destination} delay=${delayMinutes}`

    if (headcode) this.headcodeToRid.set(headcode, rid)

    const existing = this.trains.get(rid)
    const entry: TrainEntry = existing
      ? {
          ...existing,
          headcode: headcode ?? existing.headcode,
          toc: toc ?? existing.toc,
          origin: origin ?? existing.origin,
          destination: destination ?? existing.destination,
          delayMinutes,
          destLat: destLat ?? existing.destLat,
          destLng: destLng ?? existing.destLng,
        }
      : { rid, headcode, toc, origin, destination, delayMinutes, berth: null, lat: null, lng: null, destLat: destLat ?? null, destLng: destLng ?? null, updatedAt: new Date().toISOString() }

    this.trains.set(rid, entry)

    if (entry.lat !== null && entry.lng !== null)
      this.publishPosition(rid, entry)
  }

  removeFromTd(headcode: string) {
    const rid = this.headcodeToRid.get(headcode) ?? headcode
    if (this.trains.delete(rid))
      this.state.removeTrain(rid)
  }

  removeByRid(rid: string) {
    if (this.trains.delete(rid))
      this.state.removeTrain(rid)
  }

  private publishPosition(rid: string, entry: TrainEntry) {
    if (entry.lat === null || entry.lng === null) return

    let heading: number | null = null
    if (entry.destLat !== null && entry.destLng !== null)
      heading = bearingDeg(entry.lat, entry.lng, entry.destLat, entry.destLng)

    const position: TrainPosition = {
      rid,
      headcode: entry.headcode ?? rid,
      toc: entry.toc,
      lat: entry.lat,
      lng: entry.lng,
      fromTiploc: entry.berth?.areaId ?? null,
      toTiploc: entry.berth?.berthId ?? null,
      origin: entry.origin,
      destination: entry.destination,
      delayMinutes: entry.delayMinutes,
      heading,
      updatedAt: entry.updatedAt,
    }

    this.state.updateTrain(position)
  }
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}
