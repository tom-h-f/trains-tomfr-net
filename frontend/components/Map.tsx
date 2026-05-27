"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { TrainPosition } from "@/types/train";
import L from "leaflet";

interface Props {
  trains: TrainPosition[];
  selectedRid: string | null;
  onSelectRid?: (rid: string | null) => void;
}

// UK fastest service (HS1 Eurostar) ~83 m/s; 1.2× headroom
const MAX_SPEED_MPS = 100;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const dφ = (lat2 - lat1) * Math.PI / 180;
  const dλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dλ = (lng2 - lng1) * Math.PI / 180;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function delayColor(minutes: number): string {
  const t = Math.min(1, Math.max(0, minutes / 30));
  const hue = Math.round(120 * (1 - t));
  return `hsl(${hue},60%,34%)`;
}

function iconPx(zoom: number): number {
  // 7px at zoom 5, grows to 20px at zoom 13+
  return Math.max(7, Math.min(20, Math.round(zoom * 1.8 - 2)));
}

function trainIcon(color: string, headingDeg: number, selected: boolean, zoom: number): L.DivIcon {
  const base = iconPx(zoom) * (selected ? 1.35 : 1);
  const w = Math.round(base), h = Math.round(base * 1.5);
  const stroke = selected ? "rgba(26,34,27,0.9)" : "rgba(255,255,255,0.75)";
  const sw = selected ? 2 : 1.5;
  const shadow = selected ? "drop-shadow(0 0 4px rgba(26,34,27,0.5))" : "none";
  // Details only legible above zoom 9
  const showDetail = zoom >= 9;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 16 24">
    <path d="M8,1 C4,1 2,5 2,9 L2,20 Q2,23.5 8,23.5 Q14,23.5 14,20 L14,9 C14,5 12,1 8,1 Z"
          fill="${color}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
    ${showDetail ? `
    <circle cx="5.5" cy="4.5" r="1.3" fill="rgba(255,255,255,0.88)"/>
    <circle cx="10.5" cy="4.5" r="1.3" fill="rgba(255,255,255,0.88)"/>
    <rect x="3.5" y="9" width="3.6" height="3" rx="0.9" fill="rgba(255,255,255,0.4)"/>
    <rect x="8.9" y="9" width="3.6" height="3" rx="0.9" fill="rgba(255,255,255,0.4)"/>` : ""}
  </svg>`;
  return L.divIcon({
    html: `<div style="width:${w}px;height:${h}px;transform:rotate(${Math.round(headingDeg)}deg);transform-origin:center;line-height:0;filter:${shadow}">${svg}</div>`,
    className: "",
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
}

function tooltipHtml(t: TrainPosition): string {
  const route = [t.origin, t.destination].filter(Boolean).join(" → ") || t.headcode || t.rid;
  const delay = t.delayMinutes !== 0
    ? `<span style="color:${delayColor(t.delayMinutes)}">${t.delayMinutes > 0 ? "+" : ""}${t.delayMinutes} min</span>`
    : "";
  const meta = [t.headcode ?? t.rid, t.toc].filter(Boolean).join(" · ");
  const lines = [
    `<span style="color:#1a221b;font-size:12px">${route}</span>`,
    `<span style="color:#b8932d">${meta}</span>`,
    delay,
  ].filter(Boolean).join("<br>");
  return `<div style="font-family:'DM Mono',monospace;font-size:11px;line-height:1.7;color:#44403c">${lines}</div>`;
}

interface TrainAnim {
  marker: L.Marker;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  startMs: number;
  catchMs: number;
  heading: number;
  lastUpdateMs: number;
  color: string;
}

function TrainMarkersLayer({ trains, selectedRid, onSelectRid }: Props) {
  const map = useMap();
  const anims = useRef<globalThis.Map<string, TrainAnim>>(new globalThis.Map());
  const raf = useRef<number | null>(null);
  const trainsRef = useRef(trains);
  const selectedRidRef = useRef(selectedRid);
  const onSelectRidRef = useRef(onSelectRid);
  const zoomRef = useRef(map.getZoom());

  useEffect(() => { trainsRef.current = trains; }, [trains]);
  useEffect(() => { selectedRidRef.current = selectedRid; }, [selectedRid]);
  useEffect(() => { onSelectRidRef.current = onSelectRid; }, [onSelectRid]);

  // Zoom → resize all icons
  useMapEvents({
    zoom: () => {
      zoomRef.current = map.getZoom();
      for (const [rid, anim] of anims.current) {
        const isSelected = selectedRidRef.current === rid;
        anim.marker.setIcon(trainIcon(anim.color, anim.heading, isSelected, zoomRef.current));
      }
    },
  });

  // RAF catch-up animation only — no extrapolation (track geometry unknown)
  useEffect(() => {
    function tick(now: number) {
      for (const anim of anims.current.values()) {
        const t = Math.min(1, (now - anim.startMs) / anim.catchMs);
        if (t >= 1) continue;
        const et = easeInOut(t);
        anim.marker.setLatLng([lerp(anim.fromLat, anim.toLat, et), lerp(anim.fromLng, anim.toLng, et)]);
      }
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, []);

  // Sync trains → markers
  useEffect(() => {
    const now = performance.now();
    const zoom = zoomRef.current;
    const nextRids = new Set(trains.map(t => t.rid));

    for (const [rid, anim] of anims.current) {
      if (!nextRids.has(rid)) {
        anim.marker.remove();
        anims.current.delete(rid);
      }
    }

    for (const train of trains) {
      const color = delayColor(train.delayMinutes);
      const isSelected = train.rid === selectedRid;

      if (anims.current.has(train.rid)) {
        const anim = anims.current.get(train.rid)!;
        const posChanged = train.lat !== anim.toLat || train.lng !== anim.toLng;

        if (posChanged) {
          const dist = haversineM(anim.toLat, anim.toLng, train.lat, train.lng);
          const dtMs = now - anim.lastUpdateMs;
          const maxPlausibleM = MAX_SPEED_MPS * (dtMs / 1000);
          const heading = dist > 10 ? bearingDeg(anim.toLat, anim.toLng, train.lat, train.lng) : anim.heading;

          let fromLat: number, fromLng: number, catchMs: number;
          if (dist > maxPlausibleM) {
            // Position jump exceeds what's physically possible — teleport, reset heading
            fromLat = train.lat; fromLng = train.lng; catchMs = 1;
          } else {
            // Grab current mid-animation display position
            const t = Math.min(1, (now - anim.startMs) / anim.catchMs);
            const et = easeInOut(t);
            fromLat = lerp(anim.fromLat, anim.toLat, et);
            fromLng = lerp(anim.fromLng, anim.toLng, et);
            // Animate over the same duration the train actually took, capped sensibly
            catchMs = Math.min(6000, Math.max(1000, dtMs));
          }

          Object.assign(anim, {
            fromLat, fromLng,
            toLat: train.lat, toLng: train.lng,
            startMs: now, catchMs, heading,
            lastUpdateMs: now, color,
          });
          anim.marker.setIcon(trainIcon(color, heading, isSelected, zoom));
          anim.marker.setZIndexOffset(isSelected ? 1000 : 0);
        } else {
          // If we only have a dest-computed heading and no observed one yet, accept server update
          const serverHeading = train.heading ?? anim.heading;
          const headingChanged = serverHeading !== anim.heading && anim.heading === 0;
          const iconChanged = color !== anim.color
            || isSelected !== (anim.marker.options.zIndexOffset === 1000)
            || headingChanged;
          if (iconChanged) {
            anim.color = color;
            if (headingChanged) anim.heading = serverHeading;
            anim.marker.setIcon(trainIcon(color, anim.heading, isSelected, zoom));
            anim.marker.setZIndexOffset(isSelected ? 1000 : 0);
          }
        }
      } else {
        const rid = train.rid;
        const initialHeading = train.heading ?? 0;
        const marker = L.marker([train.lat, train.lng], {
          icon: trainIcon(color, initialHeading, isSelected, zoom),
          zIndexOffset: isSelected ? 1000 : 0,
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRidRef.current?.(rid === selectedRidRef.current ? null : rid);
        });
        marker.bindTooltip(() => {
          const t = trainsRef.current.find(x => x.rid === rid);
          return t ? tooltipHtml(t) : "";
        }, { direction: "top", offset: [0, -14] });
        marker.addTo(map);

        anims.current.set(rid, {
          marker,
          fromLat: train.lat, fromLng: train.lng,
          toLat: train.lat, toLng: train.lng,
          startMs: now, catchMs: 1,
          heading: initialHeading,
          lastUpdateMs: now, color,
        });
      }
    }
  }, [trains, selectedRid, map]);

  useEffect(() => {
    return () => {
      for (const { marker } of anims.current.values()) marker.remove();
      anims.current.clear();
    };
  }, []);

  return null;
}

export default function Map({ trains, selectedRid, onSelectRid }: Props) {
  return (
    <MapContainer
      center={[54.0, -2.5]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />
      <TrainMarkersLayer trains={trains} selectedRid={selectedRid} onSelectRid={onSelectRid} />
    </MapContainer>
  );
}
