"use client";

import { useState } from "react";
import { POPULAR_PAIRS } from "@/lib/api";
import { findBestSeeds, SeedMatch } from "@/lib/collatz";
import Link from "next/link";

interface HistCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  entryIdx: number;
  exitIdx: number;
  entryPrice: number;
  exitPrice: number;
  entryDate: string;
  exitDate: string;
  pnlPct: number;
  seed: number;
  score: number;
  holdCandles: number;
}

interface BacktestResult {
  trades: Trade[];
  totalReturn: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  totalTrades: number;
  winners: number;
  losers: number;
}

const fmtDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function BacktestPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [days, setDays] = useState(365);
  const [windowSize, setWindowSize] = useState(30);
  const [maxSeed, setMaxSeed] = useState(3000);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [candles, setCandles] = useState<HistCandle[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress("Fetching historical data...");

    try {
      const res = await fetch(`/api/history?symbol=${symbol}&days=${days}&interval=1d`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const hist: HistCandle[] = data.candles;
      setCandles(hist);
      setProgress(`Got ${hist.length} candles. Running backtest...`);

      // Run backtest in chunks to not freeze UI
      await new Promise((r) => setTimeout(r, 50));

      const trades: Trade[] = [];
      let i = windowSize;

      while (i < hist.length - 5) {
        setProgress(`Scanning window at candle ${i} / ${hist.length}...`);
        await new Promise((r) => setTimeout(r, 0)); // yield to UI

        const window = hist.slice(i - windowSize, i);
        const seeds = findBestSeeds(window, maxSeed, 1);

        if (seeds.length === 0 || seeds[0].score < 0.5) {
          i += 5; // skip ahead if no good match
          continue;
        }

        const match = seeds[0];
        const entryPrice = hist[i].close;
        const entryDate = fmtDate(hist[i].time);

        // Hold until sequence would end or max hold period
        const maxHold = Math.min(match.stepsRemaining, 60, hist.length - i - 1);
        let exitIdx = i + maxHold;

        // Exit early if we detect the "final descent" pattern
        // (sequence of declining values in projection)
        const proj = match.projectedValues;
        let descentStart = maxHold;
        for (let p = 1; p < Math.min(proj.length, maxHold); p++) {
          if (proj[p] < proj[p - 1] && p > 2) {
            // Check if it's a sustained decline (3+ steps down)
            let declining = true;
            for (let d = p; d < Math.min(p + 3, proj.length); d++) {
              if (d > 0 && proj[d] >= proj[d - 1]) { declining = false; break; }
            }
            if (declining) { descentStart = p; break; }
          }
        }
        exitIdx = Math.min(i + descentStart, i + maxHold, hist.length - 1);
        if (exitIdx <= i) exitIdx = i + 1;

        const exitPrice = hist[exitIdx].close;
        const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;

        trades.push({
          entryIdx: i,
          exitIdx,
          entryPrice,
          exitPrice,
          entryDate,
          exitDate: fmtDate(hist[exitIdx].time),
          pnlPct,
          seed: match.seed,
          score: match.score,
          holdCandles: exitIdx - i,
        });

        // Jump past this trade
        i = exitIdx + windowSize;
      }

      // Calculate stats
      const winners = trades.filter((t) => t.pnlPct > 0);
      const losers = trades.filter((t) => t.pnlPct <= 0);
      const totalReturn = trades.reduce((sum, t) => sum * (1 + t.pnlPct / 100), 1);

      setResult({
        trades,
        totalReturn: (totalReturn - 1) * 100,
        winRate: trades.length > 0 ? (winners.length / trades.length) * 100 : 0,
        avgWin: winners.length > 0 ? winners.reduce((s, t) => s + t.pnlPct, 0) / winners.length : 0,
        avgLoss: losers.length > 0 ? losers.reduce((s, t) => s + t.pnlPct, 0) / losers.length : 0,
        bestTrade: trades.length > 0 ? Math.max(...trades.map((t) => t.pnlPct)) : 0,
        worstTrade: trades.length > 0 ? Math.min(...trades.map((t) => t.pnlPct)) : 0,
        totalTrades: trades.length,
        winners: winners.length,
        losers: losers.length,
      });
      setProgress("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-[#e0e0e0]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e2e] bg-[#0d0d14]">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-bold tracking-wider text-[#ffd740] hover:opacity-80">
            COLLATZ<span className="text-[#448aff]">3N+1</span>
          </Link>
          <span className="text-xs text-[#6b7280]">›</span>
          <span className="text-xs text-[#e0e0e0] font-semibold">BACKTESTER</span>
        </div>
        <Link href="/" className="text-[10px] text-[#448aff] hover:text-[#5a9aff]">
          ← Back to Live Chart
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Controls */}
        <div className="w-72 border-r border-[#1e1e2e] bg-[#12121a] p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider block mb-1">Pair</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-[#1a1a2e] text-[#e0e0e0] border border-[#2a2a3e] rounded px-3 py-1.5 text-sm font-mono"
              aria-label="Select trading pair"
            >
              {POPULAR_PAIRS.map((p) => (
                <option key={p.symbol} value={p.symbol}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider block mb-1">
              History ({days} days / {(days / 365).toFixed(1)} years)
            </label>
            <input
              type="range"
              min={90}
              max={1095}
              step={30}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full accent-[#448aff]"
              aria-label="History range in days"
            />
            <div className="flex justify-between text-[9px] text-[#6b7280] mt-1">
              <span>3 months</span>
              <span>3 years</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider block mb-1">
              Scan Window ({windowSize} candles)
            </label>
            <input
              type="range"
              min={15}
              max={60}
              step={5}
              value={windowSize}
              onChange={(e) => setWindowSize(parseInt(e.target.value))}
              className="w-full accent-[#448aff]"
              aria-label="Scan window size"
            />
            <div className="flex justify-between text-[9px] text-[#6b7280] mt-1">
              <span>15 candles</span>
              <span>60 candles</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#6b7280] uppercase tracking-wider block mb-1">
              Seed Range
            </label>
            <div className="flex gap-1">
              {([3000, 5000, 7500, 10000] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setMaxSeed(n)}
                  disabled={loading}
                  className={`flex-1 py-1 text-[10px] font-mono rounded transition-colors ${
                    maxSeed === n
                      ? "bg-[#448aff] text-white"
                      : "bg-[#1a1a2e] text-[#6b7280] hover:text-[#e0e0e0] hover:bg-[#2a2a3e]"
                  }`}
                >
                  {n / 1000}K
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runBacktest}
            disabled={loading}
            className="w-full py-2.5 rounded text-sm font-semibold bg-[#448aff] text-white hover:bg-[#5a9aff] disabled:opacity-40 transition-colors"
          >
            {loading ? `Running (${maxSeed / 1000}K seeds)...` : `▶ Run Backtest (${maxSeed / 1000}K seeds)`}
          </button>

          {progress && <p className="text-[10px] text-[#448aff] animate-pulse">{progress}</p>}
          {error && <p className="text-[10px] text-[#ff1744]">{error}</p>}

          {/* Summary stats */}
          {result && (
            <div className="flex flex-col gap-2 border-t border-[#1e1e2e] pt-4">
              <h3 className="text-[10px] text-[#6b7280] uppercase tracking-wider">Results Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#1a1a2e] rounded p-2">
                  <div className="text-[10px] text-[#6b7280]">Total Return</div>
                  <div className={`font-mono font-bold ${result.totalReturn >= 0 ? "text-[#00e676]" : "text-[#ff1744]"}`}>
                    {result.totalReturn >= 0 ? "+" : ""}{result.totalReturn.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-[#1a1a2e] rounded p-2">
                  <div className="text-[10px] text-[#6b7280]">Win Rate</div>
                  <div className={`font-mono font-bold ${result.winRate >= 50 ? "text-[#00e676]" : "text-[#ff1744]"}`}>
                    {result.winRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-[#1a1a2e] rounded p-2">
                  <div className="text-[10px] text-[#6b7280]">Trades</div>
                  <div className="font-mono text-[#e0e0e0]">
                    {result.totalTrades}
                    <span className="text-[#00e676] ml-1">W{result.winners}</span>
                    <span className="text-[#ff1744] ml-1">L{result.losers}</span>
                  </div>
                </div>
                <div className="bg-[#1a1a2e] rounded p-2">
                  <div className="text-[10px] text-[#6b7280]">Avg Win / Loss</div>
                  <div className="font-mono text-xs">
                    <span className="text-[#00e676]">+{result.avgWin.toFixed(1)}%</span>
                    {" / "}
                    <span className="text-[#ff1744]">{result.avgLoss.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="bg-[#1a1a2e] rounded p-2">
                  <div className="text-[10px] text-[#6b7280]">Best Trade</div>
                  <div className="font-mono text-[#00e676]">+{result.bestTrade.toFixed(2)}%</div>
                </div>
                <div className="bg-[#1a1a2e] rounded p-2">
                  <div className="text-[10px] text-[#6b7280]">Worst Trade</div>
                  <div className="font-mono text-[#ff1744]">{result.worstTrade.toFixed(2)}%</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trade history table */}
        <div className="flex-1 overflow-y-auto p-4">
          {!result && !loading && (
            <div className="flex items-center justify-center h-full text-sm text-[#6b7280]">
              Pick a pair, set your timeframe, and hit Run Backtest to see if the Collatz signals would have made money.
            </div>
          )}

          {result && result.trades.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#e0e0e0]">Trade History</h2>
                <span className="text-[10px] text-[#6b7280]">{candles.length} candles analyzed</span>
              </div>

              {/* Equity curve */}
              <div className="mb-4 bg-[#12121a] rounded p-3 border border-[#1e1e2e]">
                <div className="text-[10px] text-[#6b7280] mb-2">Equity Curve (cumulative return)</div>
                <div className="flex items-end gap-[2px] h-20">
                  {(() => {
                    let equity = 100;
                    const points = result.trades.map((t) => {
                      equity *= 1 + t.pnlPct / 100;
                      return equity;
                    });
                    const max = Math.max(...points, 100);
                    const min = Math.min(...points, 100);
                    const range = max - min || 1;
                    return points.map((p, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all"
                        style={{
                          height: `${((p - min) / range) * 100}%`,
                          minHeight: "2px",
                          backgroundColor: result.trades[i].pnlPct >= 0 ? "#00e676" : "#ff1744",
                          opacity: 0.8,
                        }}
                        title={`Trade ${i + 1}: ${result.trades[i].pnlPct >= 0 ? "+" : ""}${result.trades[i].pnlPct.toFixed(2)}%`}
                      />
                    ));
                  })()}
                </div>
              </div>

              {/* Table */}
              <div className="border border-[#1e1e2e] rounded overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_1fr_90px_90px_70px_60px_60px] gap-2 px-3 py-2 text-[9px] text-[#6b7280] uppercase tracking-wider bg-[#12121a] border-b border-[#1e1e2e]">
                  <span>#</span>
                  <span>Entry</span>
                  <span>Exit</span>
                  <span>Entry $</span>
                  <span>Exit $</span>
                  <span>P&L</span>
                  <span>Seed</span>
                  <span>Score</span>
                </div>
                {result.trades.map((trade, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[40px_1fr_1fr_90px_90px_70px_60px_60px] gap-2 px-3 py-1.5 text-[11px] font-mono border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors"
                  >
                    <span className="text-[#6b7280]">{idx + 1}</span>
                    <span className="text-[#e0e0e0]">{trade.entryDate}</span>
                    <span className="text-[#e0e0e0]">{trade.exitDate}</span>
                    <span className="text-[#e0e0e0]">${trade.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className="text-[#e0e0e0]">${trade.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className={trade.pnlPct >= 0 ? "text-[#00e676]" : "text-[#ff1744]"}>
                      {trade.pnlPct >= 0 ? "+" : ""}{trade.pnlPct.toFixed(2)}%
                    </span>
                    <span className="text-[#ffd740]">{trade.seed}</span>
                    <span className="text-[#6b7280]">{(trade.score * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && result.trades.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-[#6b7280]">
              No trades found with score above 50%. Try a different pair or longer timeframe.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
