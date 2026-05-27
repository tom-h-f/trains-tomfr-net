import { Kafka, logLevel } from 'kafkajs'
import type { TrainRegistry } from './train-registry'
import type { BerthRepository } from '../repositories/berth-repository'

interface KafkaConfig {
  bootstrapServers: string
  username: string
  password: string
  groupId: string
  topic: string
}

interface TdCaMsg {
  area_id: string
  from: string
  to: string
  descr: string
}

interface TdCbMsg {
  area_id: string
  from: string
  descr: string
}

interface TdCcMsg {
  area_id: string
  to: string
  descr: string
}

export function startTdConsumer(cfg: KafkaConfig, registry: TrainRegistry, berths: BerthRepository) {
  const kafka = new Kafka({
    clientId: 'trains-td',
    brokers: [cfg.bootstrapServers],
    ssl: true,
    sasl: { mechanism: 'plain', username: cfg.username, password: cfg.password },
    logLevel: logLevel.WARN,
  })

  const consumer = kafka.consumer({ groupId: cfg.groupId })
  let rawCount = 0

  const run = async () => {
    await consumer.connect()
    await consumer.subscribe({ topic: cfg.topic, fromBeginning: false })
    console.log(`TD consumer started, topic: ${cfg.topic}`)

    await consumer.run({
      eachMessage: async ({ message }) => {
        const value = message.value?.toString()
        if (!value) return

        if (++rawCount <= 3)
          console.log('TD raw sample:', value.slice(0, 500))

        try {
          const array = JSON.parse(value) as Record<string, unknown>[]
          if (!Array.isArray(array)) return

          for (const item of array) {
            if (!item) continue
            for (const [key, val] of Object.entries(item)) {
              if (!val || typeof val !== 'object') continue
              if (key === 'CA_MSG') processCa(val as TdCaMsg)
              else if (key === 'CB_MSG') processCb(val as TdCbMsg)
              else if (key === 'CC_MSG') processCc(val as TdCcMsg)
            }
          }
        } catch (err) {
          console.debug('Failed to parse TD message:', err)
        }
      },
    })
  }

  const processCa = (msg: TdCaMsg) => {
    if (!msg.descr?.trim() || msg.descr === '0000') return
    const loc = berths.get(msg.area_id, msg.to)
    registry.updateFromTd(msg.descr, { areaId: msg.area_id, berthId: msg.to }, loc?.lat ?? null, loc?.lng ?? null)
  }

  const processCb = (msg: TdCbMsg) => {
    if (!msg.descr?.trim() || msg.descr === '0000') return
    registry.removeFromTd(msg.descr)
  }

  const processCc = (msg: TdCcMsg) => {
    if (!msg.descr?.trim() || msg.descr === '0000') return
    const loc = berths.get(msg.area_id, msg.to)
    registry.updateFromTd(msg.descr, { areaId: msg.area_id, berthId: msg.to }, loc?.lat ?? null, loc?.lng ?? null)
  }

  run().catch(err => console.error('TD consumer fatal:', err))

  return () => consumer.disconnect()
}
