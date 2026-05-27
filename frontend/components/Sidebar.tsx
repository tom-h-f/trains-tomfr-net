"use client";

import { useMemo, useState } from "react";
import type { TrainPosition } from "@/types/train";

interface Props {
  trains: Map<string, TrainPosition>;
  connected: boolean;
  filter: string;
  onFilterChange: (v: string) => void;
  selectedRid: string | null;
  onSelectRid: (rid: string | null) => void;
}

type SortKey = "headcode" | "delay" | "destination";

function DelayBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0)
    return (
      <span className="delay-badge delay-ontme">
        ON TIME
      </span>
    );
  if (minutes <= 5)
    return (
      <span className="delay-badge delay-minor">
        +{minutes}
      </span>
    );
  return (
    <span className="delay-badge delay-late">
      +{minutes}
    </span>
  );
}

export default function Sidebar({
  trains,
  connected,
  filter,
  onFilterChange,
  selectedRid,
  onSelectRid,
}: Props) {
  const [sort, setSort] = useState<SortKey>("delay");

  const sorted = useMemo(() => {
    const all = [...trains.values()];
    const filtered = filter
      ? all.filter(
          (t) =>
            t.headcode?.toLowerCase().includes(filter.toLowerCase()) ||
            t.toc?.toLowerCase().includes(filter.toLowerCase()) ||
            t.destination?.toLowerCase().includes(filter.toLowerCase())
        )
      : all;

    return filtered.sort((a, b) => {
      if (sort === "delay") return b.delayMinutes - a.delayMinutes;
      if (sort === "headcode") return (a.headcode ?? "").localeCompare(b.headcode ?? "");
      return (a.destination ?? "").localeCompare(b.destination ?? "");
    });
  }, [trains, filter, sort]);

  const lateCount = useMemo(
    () => [...trains.values()].filter((t) => t.delayMinutes > 5).length,
    [trains]
  );

  return (
    <aside className="sidebar" suppressHydrationWarning>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="title-text">TRAINS</span>
          <span className={`live-dot ${connected ? "live" : "dead"}`} />
        </div>
        <div className="sidebar-stats">
          <span className="stat">
            <span className="stat-num">{trains.size}</span>
            <span className="stat-label">active</span>
          </span>
          {lateCount > 0 && (
            <span className="stat">
              <span className="stat-num late-num">{lateCount}</span>
              <span className="stat-label">delayed</span>
            </span>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="sidebar-search">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          className="search-input"
          type="text"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="headcode, operator, destination…"
          spellCheck={false}
        />
        {filter && (
          <button className="search-clear" onClick={() => onFilterChange("")}>
            ×
          </button>
        )}
      </div>

      {/* Sort tabs */}
      <div className="sort-tabs">
        {(["delay", "headcode", "destination"] as SortKey[]).map((k) => (
          <button
            key={k}
            className={`sort-tab ${sort === k ? "active" : ""}`}
            onClick={() => setSort(k)}
          >
            {k === "delay" ? "delay" : k === "headcode" ? "train" : "dest"}
          </button>
        ))}
        {filter && (
          <span className="filter-count">{sorted.length} shown</span>
        )}
      </div>

      {/* Table */}
      <div className="train-list">
        <div className="train-list-header">
          <span>TRAIN</span>
          <span>DESTINATION</span>
          <span>STATUS</span>
        </div>

        <div className="train-rows">
          {sorted.length === 0 && (
            <div className="empty-state">
              {connected ? "Waiting for data…" : "Connecting…"}
            </div>
          )}
          {sorted.map((train) => (
            <div
              key={train.rid}
              className={`train-row ${train.rid === selectedRid ? "selected" : ""} ${
                train.delayMinutes > 5 ? "row-late" : train.delayMinutes > 0 ? "row-minor" : ""
              }`}
              onClick={() => onSelectRid(train.rid === selectedRid ? null : train.rid)}
            >
              <span className="train-headcode">{train.headcode ?? train.rid}</span>
              <span className="train-dest">
                {train.destination
                  ? train.destination.length > 18
                    ? train.destination.slice(0, 17) + "…"
                    : train.destination
                  : <span className="no-data">—</span>}
              </span>
              <DelayBadge minutes={train.delayMinutes} />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .sidebar {
          width: 280px;
          min-width: 280px;
          height: 100vh;
          background: #0b0f14;
          border-right: 1px solid #1a2332;
          display: flex;
          flex-direction: column;
          font-family: var(--font-geist-sans), system-ui, sans-serif;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 18px 16px 14px;
          border-bottom: 1px solid #1a2332;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sidebar-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .title-text {
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          color: #f59e0b;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .live-dot.live {
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80aa;
          animation: pulse-dot 2s ease-in-out infinite;
        }
        .live-dot.dead { background: #374151; }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .sidebar-stats {
          display: flex;
          gap: 16px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .stat-num {
          font-family: var(--font-geist-mono), monospace;
          font-size: 22px;
          font-weight: 600;
          color: #e2e8f0;
          line-height: 1;
        }
        .stat-num.late-num { color: #f87171; }

        .stat-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #4b5563;
          text-transform: uppercase;
        }

        .sidebar-search {
          padding: 10px 12px;
          border-bottom: 1px solid #1a2332;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-icon {
          font-size: 16px;
          color: #374151;
          flex-shrink: 0;
          line-height: 1;
          user-select: none;
        }

        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 12px;
          color: #9ca3af;
          font-family: inherit;
          min-width: 0;
        }
        .search-input::placeholder { color: #374151; }
        .search-input:focus { color: #e2e8f0; }

        .search-clear {
          background: none;
          border: none;
          color: #4b5563;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          line-height: 1;
        }
        .search-clear:hover { color: #9ca3af; }

        .sort-tabs {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 0 12px;
          border-bottom: 1px solid #1a2332;
        }

        .sort-tab {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 8px 10px;
          font-size: 11px;
          font-family: inherit;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #4b5563;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
          margin-bottom: -1px;
        }
        .sort-tab:hover { color: #9ca3af; }
        .sort-tab.active {
          color: #f59e0b;
          border-bottom-color: #f59e0b;
        }

        .filter-count {
          margin-left: auto;
          font-size: 10px;
          color: #4b5563;
          font-family: var(--font-geist-mono), monospace;
        }

        .train-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .train-list-header {
          display: grid;
          grid-template-columns: 56px 1fr 68px;
          gap: 8px;
          padding: 6px 12px;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #374151;
          border-bottom: 1px solid #111820;
          flex-shrink: 0;
        }

        .train-rows {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #1a2332 transparent;
        }
        .train-rows::-webkit-scrollbar { width: 3px; }
        .train-rows::-webkit-scrollbar-track { background: transparent; }
        .train-rows::-webkit-scrollbar-thumb { background: #1a2332; border-radius: 2px; }

        .empty-state {
          padding: 32px 16px;
          text-align: center;
          font-size: 12px;
          color: #374151;
        }

        .train-row {
          display: grid;
          grid-template-columns: 56px 1fr 68px;
          gap: 8px;
          padding: 7px 12px;
          align-items: center;
          cursor: pointer;
          border-bottom: 1px solid #0d1117;
          transition: background 0.1s;
        }
        .train-row:hover { background: #111820; }
        .train-row.selected {
          background: #111d2c;
          border-bottom-color: #1a2d4a;
        }
        .train-row.row-late { border-left: 2px solid #f8717133; }
        .train-row.row-minor { border-left: 2px solid #fbbf2433; }

        .train-headcode {
          font-family: var(--font-geist-mono), monospace;
          font-size: 13px;
          font-weight: 600;
          color: #f59e0b;
          letter-spacing: 0.03em;
        }
        .train-row.selected .train-headcode { color: #fcd34d; }

        .train-dest {
          font-size: 12px;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .train-row:hover .train-dest,
        .train-row.selected .train-dest { color: #9ca3af; }

        .no-data { color: #1f2937; }

        .delay-badge {
          font-family: var(--font-geist-mono), monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 2px 6px;
          border-radius: 3px;
          white-space: nowrap;
          justify-self: end;
        }
        .delay-ontme {
          background: #052e16;
          color: #4ade80;
        }
        .delay-minor {
          background: #1c1403;
          color: #fbbf24;
        }
        .delay-late {
          background: #1f0606;
          color: #f87171;
        }
      `}</style>
    </aside>
  );
}
