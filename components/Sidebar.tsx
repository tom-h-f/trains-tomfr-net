"use client";

import { useEffect, useMemo, useState } from "react";
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

function DelayBadge({ minutes, hasData }: { minutes: number; hasData: boolean }) {
  if (!hasData)
    return <span className="delay-badge delay-unknown">—</span>;
  if (minutes <= 0)
    return <span className="delay-badge delay-ontme">ON TIME</span>;
  if (minutes <= 5)
    return <span className="delay-badge delay-minor">+{minutes} min</span>;
  return <span className="delay-badge delay-late">+{minutes} min</span>;
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

  useEffect(() => {
    if (!selectedRid) return;
    document.getElementById(`train-row-${selectedRid}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedRid]);

  return (
    <aside className="sidebar" suppressHydrationWarning>
      {/* Header */}
      <div className="sidebar-header">
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
        <div className="train-rows">
          {sorted.length === 0 && (
            <div className="empty-state">
              {connected ? "Waiting for data…" : "Connecting…"}
            </div>
          )}
          {sorted.map((train) => {
            const hasRoute = train.origin || train.destination;
            const routeLabel = hasRoute
              ? [train.origin, train.destination].filter(Boolean).join(" → ")
              : null;
            return (
              <div
                key={train.rid}
                id={`train-row-${train.rid}`}
                className={`train-row ${train.rid === selectedRid ? "selected" : ""} ${train.delayMinutes > 5 ? "row-late" : train.delayMinutes > 0 ? "row-minor" : ""
                  }`}
                onClick={() => onSelectRid(train.rid === selectedRid ? null : train.rid)}
              >
                <div className="train-name-cell">
                  <span className="train-route">
                    {routeLabel ?? <span className="no-data">Unknown route</span>}
                  </span>
                  <span className="train-meta">
                    {train.headcode ?? train.rid}
                    {train.toc && <span className="train-toc"> · {train.toc}</span>}
                  </span>
                </div>
                <DelayBadge minutes={train.delayMinutes} hasData={!!train.destination || train.delayMinutes !== 0} />
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .sidebar {
          width: 280px;
          min-width: 280px;
          height: 100vh;
          background: var(--surface);
          border-right: 1px solid var(--rule);
          display: flex;
          flex-direction: column;
          font-family: var(--font-mono), 'DM Mono', monospace;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 18px 16px 14px;
          border-bottom: 1px solid var(--rule);
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
          font-family: var(--font-display), 'Playfair Display', Georgia, serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--fg);
          letter-spacing: 0.01em;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .live-dot.live {
          background: #5a7a52;
          animation: pulse-dot 2s ease-in-out infinite;
        }
        .live-dot.dead { background: var(--rule); }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .sidebar-stats {
          display: flex;
          gap: 20px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .stat-num {
          font-family: var(--font-mono), monospace;
          font-size: 20px;
          font-weight: 500;
          color: var(--fg);
          line-height: 1;
        }
        .stat-num.late-num { color: #8b3a3a; }

        .stat-label {
          font-size: 9px;
          letter-spacing: 0.1em;
          color: var(--muted);
          text-transform: uppercase;
        }

        .sidebar-search {
          padding: 10px 12px;
          border-bottom: 1px solid var(--rule);
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg);
        }

        .search-icon {
          font-size: 16px;
          color: var(--muted);
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
          color: var(--fg-2);
          font-family: inherit;
          min-width: 0;
        }
        .search-input::placeholder { color: var(--rule); }
        .search-input:focus { color: var(--fg); }

        .search-clear {
          background: none;
          border: none;
          color: var(--muted);
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          line-height: 1;
        }
        .search-clear:hover { color: var(--fg-2); }

        .sort-tabs {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 0 12px;
          border-bottom: 1px solid var(--rule);
          background: var(--surface);
        }

        .sort-tab {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 8px 10px;
          font-size: 10px;
          font-family: var(--font-mono), monospace;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
          margin-bottom: -1px;
        }
        .sort-tab:hover { color: var(--fg-2); }
        .sort-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .filter-count {
          margin-left: auto;
          font-size: 10px;
          color: var(--muted);
          font-family: var(--font-mono), monospace;
        }

        .train-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg);
        }

        .train-rows {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--rule) transparent;
        }
        .train-rows::-webkit-scrollbar { width: 3px; }
        .train-rows::-webkit-scrollbar-track { background: transparent; }
        .train-rows::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 2px; }

        .empty-state {
          padding: 32px 16px;
          text-align: center;
          font-size: 12px;
          color: var(--muted);
        }

        .train-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          padding: 8px 12px;
          align-items: center;
          cursor: pointer;
          border-bottom: 1px solid var(--surface-dark);
          transition: background 0.1s;
        }
        .train-row:hover { background: var(--surface); }
        .train-row.selected {
          background: var(--surface-dark);
          border-bottom-color: var(--rule);
        }
        .train-row.row-late { border-left: 2px solid #8b3a3a55; }
        .train-row.row-minor { border-left: 2px solid #b8932d55; }

        .train-name-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .train-route {
          font-size: 12px;
          color: var(--fg-2);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .train-row:hover .train-route,
        .train-row.selected .train-route { color: var(--fg); }

        .train-meta {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: var(--accent);
          letter-spacing: 0.04em;
        }
        .train-row.selected .train-meta { color: var(--bark); }

        .train-toc {
          color: var(--muted);
          font-weight: 300;
        }

        .no-data { color: var(--rule); }

        .delay-badge {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.03em;
          padding: 2px 5px;
          border-radius: 2px;
          white-space: nowrap;
          justify-self: end;
        }
        .delay-unknown {
          background: transparent;
          color: var(--rule);
        }
        .delay-ontme {
          background: #e8f0e6;
          color: #3d6636;
        }
        .delay-minor {
          background: #f7f0de;
          color: var(--accent);
        }
        .delay-late {
          background: #f5e6e6;
          color: #8b3a3a;
        }
      `}</style>
    </aside>
  );
}
