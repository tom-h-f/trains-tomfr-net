import { DurableObject } from 'cloudflare:workers'
import type { TrainPosition } from '../types/train'

export interface Env {
  TRAIN_HUB: DurableObjectNamespace<TrainHub>
  INGEST_SECRET: string
}

interface IngestBody {
  updates?: TrainPosition[]
  removes?: string[]
}

export class TrainHub extends DurableObject<Env> {
  private trains = new Map<string, TrainPosition>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS trains (
          rid TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)
      const rows = this.ctx.storage.sql
        .exec<{ rid: string; data: string }>('SELECT rid, data FROM trains')
        .toArray()
      for (const row of rows) {
        this.trains.set(row.rid, JSON.parse(row.data))
      }
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
      this.ctx.acceptWebSocket(server)
      server.send(
        JSON.stringify({ type: 'snapshot', trains: Array.from(this.trains.values()) })
      )
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/ingest' && request.method === 'POST') {
      if (request.headers.get('Authorization') !== `Bearer ${this.env.INGEST_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
      }
      const body = (await request.json()) as IngestBody
      for (const train of body.updates ?? []) {
        this.trains.set(train.rid, train)
        this.ctx.storage.sql.exec(
          'INSERT OR REPLACE INTO trains (rid, data, updated_at) VALUES (?, ?, ?)',
          train.rid,
          JSON.stringify(train),
          Date.now()
        )
        this.broadcast({ type: 'update', train })
      }
      for (const rid of body.removes ?? []) {
        this.trains.delete(rid)
        this.ctx.storage.sql.exec('DELETE FROM trains WHERE rid = ?', rid)
        this.broadcast({ type: 'remove', rid })
      }
      return new Response(null, { status: 204 })
    }

    if (url.pathname === '/snapshot') {
      return Response.json({
        trainCount: this.trains.size,
        trains: Array.from(this.trains.values()),
      })
    }

    return new Response('Not found', { status: 404 })
  }

  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {}

  webSocketClose(ws: WebSocket) {
    ws.close()
  }

  private broadcast(msg: object) {
    const json = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(json)
      } catch {
        // client gone
      }
    }
  }
}
