import { Kafka, logLevel } from 'kafkajs'
import type { TrainRegistry } from './train-registry'
import type { TiplocRepository } from '../repositories/tiploc-repository'

interface KafkaConfig {
  bootstrapServers: string
  username: string
  password: string
  groupId: string
  topic: string
}

// Darwin message shapes
interface DarwinEnvelope {
  bytes?: string
}

interface TimingDetail {
  at?: string
  et?: string
}

interface LocationStatus {
  tpl: string
  pta?: string
  ptd?: string
  arr?: TimingDetail
  dep?: TimingDetail
}

interface TrainStatus {
  rid: string
  trainId?: string
  Location?: LocationStatus | LocationStatus[]
}

interface ScheduleLocation {
  tpl?: string
}

interface Schedule {
  rid: string
  trainId?: string
  toc?: string
  OR?: ScheduleLocation | ScheduleLocation[]
  DT?: ScheduleLocation | ScheduleLocation[]
  OPOR?: ScheduleLocation | ScheduleLocation[]
  OPDT?: ScheduleLocation | ScheduleLocation[]
}

interface UpdateResponse {
  TS?: TrainStatus | TrainStatus[]
  schedule?: Schedule | Schedule[]
  deactivated?: { rid?: string } | { rid?: string }[]
}

interface DarwinMessage {
  uR?: UpdateResponse
}

function unwrap<T>(val: T | T[] | undefined): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

function minutesDiff(actual: string, planned: string): number {
  const parseTime = (t: string) => {
    const [h, m, s = '0'] = t.split(':').map(Number)
    return h * 60 + m + Number(s) / 60
  }
  try {
    return Math.round(parseTime(actual) - parseTime(planned))
  } catch {
    return 0
  }
}

function calculateDelay(locations: LocationStatus[]): number {
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i]
    if (loc.dep?.at && loc.ptd) return minutesDiff(loc.dep.at, loc.ptd)
    if (loc.arr?.at && loc.pta) return minutesDiff(loc.arr.at, loc.pta)
  }
  return 0
}

function originTiploc(s: Schedule): string | null {
  for (const locs of [s.OR, s.OPOR]) {
    for (const l of unwrap(locs)) {
      if (l.tpl) return l.tpl
    }
  }
  return null
}

function destinationTiploc(s: Schedule): string | null {
  for (const locs of [s.DT, s.OPDT]) {
    for (const l of unwrap(locs)) {
      if (l.tpl) return l.tpl
    }
  }
  return null
}

export function startDarwinConsumer(cfg: KafkaConfig, registry: TrainRegistry, tiplocs: TiplocRepository) {
  const kafka = new Kafka({
    clientId: 'trains-darwin',
    brokers: [cfg.bootstrapServers],
    ssl: true,
    sasl: { mechanism: 'plain', username: cfg.username, password: cfg.password },
    logLevel: logLevel.WARN,
  })

  const consumer = kafka.consumer({ groupId: cfg.groupId })
  const ridToHeadcode = new Map<string, string>()
  let rawCount = 0

  const run = async () => {
    await consumer.connect()
    await consumer.subscribe({ topic: cfg.topic, fromBeginning: false })
    console.log(`Darwin consumer started, topic: ${cfg.topic}`)

    await consumer.run({
      eachMessage: async ({ message }) => {
        const value = message.value?.toString()
        if (!value) return
        try {
          const envelope = JSON.parse(value) as DarwinEnvelope
          if (!envelope.bytes) return

          if (++rawCount <= 3)
            console.log('Darwin inner sample:', envelope.bytes.slice(0, 600))

          const msg = JSON.parse(envelope.bytes) as DarwinMessage
          const ur = msg.uR
          if (!ur) return

          for (const s of unwrap(ur.schedule)) indexSchedule(s)
          for (const ts of unwrap(ur.TS)) processTrainStatus(ts)
          for (const d of unwrap(ur.deactivated)) {
            if (d.rid) registry.removeByRid(d.rid)
          }
        } catch (err) {
          console.warn('Failed to parse Darwin message:', err)
        }
      },
    })
  }

  const indexSchedule = (s: Schedule) => {
    if (s.trainId) ridToHeadcode.set(s.rid, s.trainId)

    const oTiploc = originTiploc(s)
    const oName = oTiploc ? tiplocs.get(oTiploc)?.name ?? null : null

    const dTiploc = destinationTiploc(s)
    const dLoc = dTiploc ? tiplocs.get(dTiploc) : null

    registry.updateFromDarwin(s.rid, s.trainId ?? null, s.toc ?? null, oName, dLoc?.name ?? null, 0, dLoc?.lat, dLoc?.lng)
  }

  const processTrainStatus = (ts: TrainStatus) => {
    const locations = unwrap(ts.Location)
    if (!locations.length) return

    const headcode = ts.trainId ?? ridToHeadcode.get(ts.rid) ?? null
    const delay = calculateDelay(locations)

    const destTiploc =
      [...locations].reverse().find(l => l.pta)?.tpl ?? locations[locations.length - 1].tpl
    const destName = tiplocs.get(destTiploc)?.name ?? null

    registry.updateFromDarwin(ts.rid, headcode, null, null, destName, delay)
  }

  run().catch(err => console.error('Darwin consumer fatal:', err))

  return () => consumer.disconnect()
}
