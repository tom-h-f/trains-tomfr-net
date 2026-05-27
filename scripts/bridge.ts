import { BerthRepository } from '../lib/repositories/berth-repository'
import { TiplocRepository } from '../lib/repositories/tiploc-repository'
import { TrainRegistry } from '../lib/services/train-registry'
import { startDarwinConsumer } from '../lib/services/kafka-consumer'
import { startTdConsumer } from '../lib/services/td-consumer'
import type { TrainPosition } from '../types/train'

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
    const batch = this.pending
    this.pending = { updates: [], removes: [] }
    if (!batch.updates.length && !batch.removes.length) return

    try {
      const resp = await fetch(`${CF_HUB_URL}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${INGEST_SECRET}`,
        },
        body: JSON.stringify(batch),
      })
      if (!resp.ok) {
        console.warn(`Ingest failed: ${resp.status} ${await resp.text()}`)
      }
    } catch (err) {
      console.error('Ingest request error:', err)
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
