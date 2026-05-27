"use client";

interface Props {
  filter: string;
  onFilterChange: (v: string) => void;
  trainCount: number;
  totalCount: number;
  connected: boolean;
}

export default function FilterPanel({
  filter,
  onFilterChange,
  trainCount,
  totalCount,
  connected,
}: Props) {
  return (
    <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 bg-white/90 backdrop-blur rounded-lg shadow-lg p-3 w-56">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">
          {trainCount === totalCount
            ? `${totalCount} trains`
            : `${trainCount} / ${totalCount}`}
        </span>
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`}
          title={connected ? "Connected" : "Reconnecting..."}
        />
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Filter by headcode, TOC, destination..."
        className="text-xs px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />

      <div className="flex gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          on time
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          &le;5 min
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          late
        </span>
      </div>
    </div>
  );
}
