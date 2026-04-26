"use client";

import { useStore } from "@/lib/store";
import { POPULAR_PAIRS, INTERVALS } from "@/lib/api";

export default function Toolbar() {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const setSymbol = useStore((s) => s.setSymbol);
  const setInterval = useStore((s) => s.setInterval);
  const loading = useStore((s) => s.loading);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e1e2e] bg-[#12121a]">
      {/* Symbol selector */}
      <select
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        disabled={loading}
        className="bg-[#1a1a2e] text-[#e0e0e0] border border-[#2a2a3e] rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-[#448aff] cursor-pointer"
        aria-label="Select trading pair"
      >
        {POPULAR_PAIRS.map((p) => (
          <option key={p.symbol} value={p.symbol}>
            {p.label}
          </option>
        ))}
      </select>

      {/* Interval buttons */}
      <div className="flex gap-1">
        {INTERVALS.map((i) => (
          <button
            key={i.value}
            onClick={() => setInterval(i.value)}
            disabled={loading}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              interval === i.value
                ? "bg-[#448aff] text-white"
                : "bg-[#1a1a2e] text-[#6b7280] hover:text-[#e0e0e0] hover:bg-[#2a2a3e]"
            }`}
            aria-label={`Set interval to ${i.label}`}
          >
            {i.label}
          </button>
        ))}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="ml-2 text-xs text-[#448aff] animate-pulse">Loading...</div>
      )}
    </div>
  );
}
