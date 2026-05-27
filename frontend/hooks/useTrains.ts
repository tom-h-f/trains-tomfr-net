"use client";

import { useEffect, useRef, useState } from "react";
import type { TrainPosition, WsMessage } from "@/types/train";

const WS_URL = process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:5000/ws";

export function useTrains() {
  const [trains, setTrains] = useState<Map<string, TrainPosition>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as WsMessage;

        setTrains((prev) => {
          const next = new Map(prev);
          if (msg.type === "snapshot") {
            next.clear();
            for (const t of msg.trains) next.set(t.rid, t);
          } else if (msg.type === "update") {
            next.set(msg.train.rid, msg.train);
          } else if (msg.type === "remove") {
            next.delete(msg.rid);
          }
          return next;
        });
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { trains, connected };
}
