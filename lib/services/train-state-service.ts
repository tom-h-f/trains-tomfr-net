import { WebSocket, WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import type { TrainPosition } from '../../types/train'

export class TrainStateService {
  private readonly trains = new Map<string, TrainPosition>()
  private readonly clients = new Map<string, WebSocket>()

  attach(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
      const id = Math.random().toString(36).slice(2)
      this.clients.set(id, ws)

      this.sendSnapshot(ws)

      ws.on('close', () => this.clients.delete(id))
      ws.on('error', () => {
        this.clients.delete(id)
        ws.terminate()
      })
    })
  }

  updateTrain(position: TrainPosition) {
    this.trains.set(position.rid, position)
    this.broadcast({ type: 'update', train: position })
  }

  removeTrain(rid: string) {
    this.trains.delete(rid)
    this.broadcast({ type: 'remove', rid })
  }

  getSnapshot(): TrainPosition[] {
    return Array.from(this.trains.values())
  }

  private sendSnapshot(ws: WebSocket) {
    this.send(ws, { type: 'snapshot', trains: Array.from(this.trains.values()) })
  }

  private broadcast(msg: object) {
    for (const [id, ws] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(id)
        continue
      }
      this.send(ws, msg)
    }
  }

  private send(ws: WebSocket, msg: object) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // client gone
    }
  }
}
