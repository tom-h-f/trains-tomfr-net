"use client";

import { useEffect, useRef, useState } from "react";
import type { TrainPosition, WsMessage } from "@/types/train";

const WS_URL = process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:5000/ws";

export function useTrains() {
  const [trains, setTrains] = useState<Map<string, TrainPosition>>(new Map());
  const [connected, setConnected] = useState(false);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSnapshot() {
      try {
        const res = await fetch("/api/snapshot");
        if (!res.ok) throw new Error("Failed to fetch snapshot");
        const trainsList = (await res.json()) as TrainPosition[];
        if (active) {
          setTrains((prev) => {
            const next = new Map(prev);
            for (const t of trainsList) {
              next.set(t.rid, t);
            }
            return next;
          });
        }
      } catch (err) {
        console.error("Error loading snapshot:", err);
      } finally {
        if (active) {
          setSnapshotLoaded(true);
        }
      }
    }
    loadSnapshot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!snapshotLoaded) return;

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
            if (msg.removes) {
              for (const rid of msg.removes) {
                next.delete(rid);
              }
              for (const t of msg.trains) {
                next.set(t.rid, t);
              }
            } else {
              next.clear();
              for (const t of msg.trains) {
                next.set(t.rid, t);
              }
            }
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
  }, [snapshotLoaded]);

  return { trains, connected };
}
