"use client";

import { useStore } from "@/lib/store";

export default function TradeFeed() {
  const trades = useStore((s) => s.trades);
  const symbol = useStore((s) => s.symbol);

  const fmtPrice = (n: number) =>
    n >= 1
      ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toPrecision(4);

  const fmtQty = (n: number) => {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    if (n >= 1) return n.toFixed(4);
    return n.toPrecision(4);
  };

  const fmtTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="h-44 border-t border-[#1e1e2e] bg-[#0d0d14] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#1e1e2e] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-[#e0e0e0] uppercase tracking-wider">
            Live Trades
          </span>
          <span className="text-[10px] text-[#6b7280] font-mono">{symbol}</span>
        </div>
        <span className="text-[10px] text-[#6b7280]">{trades.length} recent</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr_80px_60px] gap-2 px-4 py-1 text-[9px] text-[#6b7280] uppercase tracking-wider border-b border-[#1e1e2e] shrink-0">
        <span>Price</span>
        <span>Quantity</span>
        <span>Total</span>
        <span>Time</span>
        <span className="text-right">Side</span>
      </div>

      {/* Trade rows */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[10px] text-[#6b7280]">
            Waiting for live trades...
          </div>
        ) : (
          trades.map((trade) => {
            const isBuy = !trade.isBuyerMaker;
            const total = trade.price * trade.qty;
            return (
              <div
                key={trade.id}
                className="grid grid-cols-[1fr_1fr_1fr_80px_60px] gap-2 px-4 py-0.5 text-[11px] font-mono hover:bg-[#1a1a2e] transition-colors"
              >
                <span className={isBuy ? "text-[#00e676]" : "text-[#ff1744]"}>
                  {fmtPrice(trade.price)}
                </span>
                <span className="text-[#e0e0e0]">{fmtQty(trade.qty)}</span>
                <span className="text-[#6b7280]">${fmtQty(total)}</span>
                <span className="text-[#6b7280]">{fmtTime(trade.time)}</span>
                <span
                  className={`text-right text-[10px] font-semibold ${
                    isBuy ? "text-[#00e676]" : "text-[#ff1744]"
                  }`}
                >
                  {isBuy ? "BUY" : "SELL"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
