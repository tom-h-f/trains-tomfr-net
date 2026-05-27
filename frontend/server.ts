import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import next from 'next'
import { BerthRepository } from './lib/repositories/berth-repository'
import { TiplocRepository } from './lib/repositories/tiploc-repository'
import { TrainStateService } from './lib/services/train-state-service'
import { TrainRegistry } from './lib/services/train-registry'
import { startDarwinConsumer } from './lib/services/kafka-consumer'
import { startTdConsumer } from './lib/services/td-consumer'
import { setRegistry } from './lib/global-state'

const port = parseInt(process.env.PORT ?? '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

const berthRepo = new BerthRepository()
const tiplocRepo = new TiplocRepository()
const stateService = new TrainStateService()
const registry = new TrainRegistry(stateService)
setRegistry(registry)

const app = next({ dev, port })
const handle = app.getRequestHandler()

await app.prepare()

const httpServer = createServer((req, res) => {
  handle(req, res)
})

const wss = new WebSocketServer({ server: httpServer, path: '/ws' })
stateService.attach(wss)

httpServer.listen(port, () => {
  console.log(`> Server listening at http://localhost:${port} (${dev ? 'dev' : 'production'})`)
})

const darwinCfg = {
  bootstrapServers: process.env.KAFKA_BOOTSTRAP_SERVERS!,
  username: process.env.KAFKA_USERNAME!,
  password: process.env.KAFKA_PASSWORD!,
  groupId: process.env.KAFKA_GROUP_ID!,
  topic: process.env.KAFKA_TOPIC!,
}

const tdCfg = {
  bootstrapServers: process.env.KAFKA_BOOTSTRAP_SERVERS!,
  username: process.env.KAFKA_USERNAME!,
  password: process.env.KAFKA_PASSWORD!,
  groupId: process.env.KAFKA_TD_GROUP_ID!,
  topic: process.env.KAFKA_TD_TOPIC!,
}

startDarwinConsumer(darwinCfg, registry, tiplocRepo)
startTdConsumer(tdCfg, registry, berthRepo)
