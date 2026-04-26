"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import Chart from "@/components/Chart";
import Toolbar from "@/components/Toolbar";
import SignalPanel from "@/components/SignalPanel";
import TradeFeed from "@/components/TradeFeed";
import Link from "next/link";

export default function Home() {
  const loadCandles = useStore((s) => s.loadCandles);
  const candles = useStore((s) => s.candles);
  const symbol = useStore((s) => s.symbol);
  const error = useStore((s) => s.error);
  const isLive = useStore((s) => s.isLive);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const priceChange = lastCandle && prevCandle ? lastCandle.close - prevCandle.close : 0;
  const pctChange = prevCandle ? (priceChange / prevCandle.close) * 100 : 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e2e] bg-[#0d0d14]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-wider text-[#ffd740]">
            COLLATZ<span className="text-[#448aff]">3N+1</span>
          </h1>
          {lastCandle && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-lg font-mono font-semibold text-[#e0e0e0]">
                ${lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span
                className={`text-xs font-mono ${priceChange >= 0 ? "text-[#00e676]" : "text-[#ff1744]"}`}
              >
                {priceChange >= 0 ? "▲" : "▼"} {Math.abs(pctChange).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <Link
            href="/backtest"
            className="px-2.5 py-1 rounded bg-[#1a1a2e] text-[#ffd740] hover:bg-[#2a2a3e] transition-colors font-semibold"
          >
            📊 Backtester
          </Link>
          {isLive && (
            <span className="flex items-center gap-1 text-[#00e676]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
              LIVE
            </span>
          )}
          <span className="text-[#6b7280]">{symbol} · BINANCE</span>
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart + trade feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            {error && (
              <div className="absolute top-4 left-4 z-10 bg-[#ff174422] border border-[#ff1744] text-[#ff1744] text-xs px-3 py-2 rounded">
                {error}
              </div>
            )}
            <Chart />
          </div>
          <TradeFeed />
        </div>

        {/* Signal panel */}
        <SignalPanel />
      </div>
    </div>
  );
}
