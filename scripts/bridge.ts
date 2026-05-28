import { BerthRepository } from '../lib/repositories/berth-repository'
import { TiplocRepository } from '../lib/repositories/tiploc-repository'
import { TrainRegistry } from '../lib/services/train-registry'
import { startDarwinConsumer } from '../lib/services/kafka-consumer'
import { startTdConsumer } from '../lib/services/td-consumer'
import type { TrainPosition } from '../types/train'
import { WebSocket } from 'ws'

const CF_HUB_URL = process.env.CF_HUB_URL
const INGEST_SECRET = process.env.INGEST_SECRET

if (!CF_HUB_URL || !INGEST_SECRET) {
  console.error('CF_HUB_URL and INGEST_SECRET must be set')
  process.exit(1)
}

class BridgeStateService {
  private pending: { updates: TrainPosition[]; removes: string[] } = {
    updates: [],
    removes: [],
  }
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private ws: WebSocket | null = null
  private wsReady = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.connect()
  }

  private connect() {
    const wsUrl = CF_HUB_URL!.replace(/^http/, 'ws') + '/bridge-ingest'
    console.log('Connecting to ingest WebSocket:', wsUrl)
    this.ws = new WebSocket(wsUrl)

    this.ws.on('open', () => {
      console.log('Ingest WebSocket connected')
      this.wsReady = true
      this.scheduleFlush()
    })

    this.ws.on('close', () => {
      console.warn('Ingest WebSocket closed, reconnecting in 3s...')
      this.wsReady = false
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      console.error('Ingest WebSocket error:', err.message)
      this.ws?.close()
    })
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.connect()
      }, 3000)
    }
  }

  updateTrain(position: TrainPosition) {
    this.pending.updates.push(position)
    this.scheduleFlush()
  }

  removeTrain(rid: string) {
    this.pending.removes.push(rid)
    this.scheduleFlush()
  }

  getSnapshot(): TrainPosition[] {
    return []
  }

  private scheduleFlush() {
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 100)
    }
  }

  private async flush() {
    this.flushTimer = null
    if (!this.wsReady || !this.ws) {
      return
    }
    const batch = this.pending
    this.pending = { updates: [], removes: [] }
    if (!batch.updates.length && !batch.removes.length) return

    try {
      this.ws.send(
        JSON.stringify({
          type: 'ingest',
          secret: INGEST_SECRET,
          updates: batch.updates,
          removes: batch.removes,
        })
      )
    } catch (err) {
      console.error('Failed to send ingest batch:', err)
      this.pending.updates.unshift(...batch.updates)
      this.pending.removes.unshift(...batch.removes)
    }
  }
}


const berthRepo = new BerthRepository()
const tiplocRepo = new TiplocRepository()
const stateService = new BridgeStateService()
const registry = new TrainRegistry(stateService as any)

const kafkaCfg = {
  bootstrapServers: process.env.KAFKA_BOOTSTRAP_SERVERS!,
  username: process.env.KAFKA_USERNAME!,
  password: process.env.KAFKA_PASSWORD!,
}

startDarwinConsumer(
  { ...kafkaCfg, groupId: process.env.KAFKA_GROUP_ID!, topic: process.env.KAFKA_TOPIC! },
  registry,
  tiplocRepo
)

startTdConsumer(
  { ...kafkaCfg, groupId: process.env.KAFKA_TD_GROUP_ID!, topic: process.env.KAFKA_TD_TOPIC! },
  registry,
  berthRepo
)

console.log('Bridge started - posting to', CF_HUB_URL)

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
