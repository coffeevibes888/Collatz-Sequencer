"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import Tooltip from "./Tooltip";

export default function SignalPanel() {
  const showCollatz = useStore((s) => s.showCollatz);
  const toggleCollatz = useStore((s) => s.toggleCollatz);
  const runSeedScan = useStore((s) => s.runSeedScan);
  const scanning = useStore((s) => s.scanning);
  const bestSeeds = useStore((s) => s.bestSeeds);
  const shortSeeds = useStore((s) => s.shortSeeds);
  const activeSeedIdx = useStore((s) => s.activeSeedIdx);
  const setActiveSeed = useStore((s) => s.setActiveSeed);
  const candles = useStore((s) => s.candles);
  const maxSeed = useStore((s) => s.maxSeed);
  const setMaxSeed = useStore((s) => s.setMaxSeed);
  const scanMode = useStore((s) => s.scanMode);
  const setScanMode = useStore((s) => s.setScanMode);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const alertTriggered = useStore((s) => s.alertTriggered);
  const clearAlert = useStore((s) => s.clearAlert);

  const SEED_OPTIONS = [3000, 5000, 7500, 10000] as const;
  const seeds = activeTab === "long" ? bestSeeds : shortSeeds;
  const activeSeed = seeds[activeSeedIdx];

  useEffect(() => {
    if (alertTriggered) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } catch {
        /* audio not available */
      }
    }
  }, [alertTriggered]);

  const getSignal = () => {
    if (!activeSeed) return null;
    const pctRemaining = (activeSeed.stepsRemaining / activeSeed.stoppingTime) * 100;
    const isNearPeak = activeSeed.currentStep < activeSeed.peakStep;
    const isInDescent = activeSeed.stepsRemaining < activeSeed.stoppingTime * 0.15;
    const proj = activeSeed.projectedValues;
    const projUp = proj.length >= 2 ? proj[Math.min(proj.length - 1, 5)] > proj[0] : false;
    if (activeSeed.mode === "3n-1") {
      if (activeSeed.isCyclic) return { label: "SHORT CYCLE", color: "#e040fb", desc: "Repeating pattern — range-bound short" };
      if (!projUp) return { label: "SHORT ENTRY", color: "#ff1744", desc: "3N-1 declining — short opportunity" };
      return { label: "SHORT CAUTION", color: "#ffd740", desc: "3N-1 upward pressure — wait" };
    }
    if (isInDescent) return { label: "EXIT ZONE", color: "#ff1744", desc: "Approaching 1 — close position" };
    if (isNearPeak && projUp && pctRemaining > 20) return { label: "HOLD / BUY DIP", color: "#00e676", desc: "Peak ahead — enter on pullbacks" };
    if (!projUp && pctRemaining < 30) return { label: "PREPARE EXIT", color: "#ff9100", desc: "Projection declining — tighten stops" };
    if (pctRemaining > 50) return { label: "EARLY CYCLE", color: "#448aff", desc: "Long runway — accumulate" };
    return { label: "CAUTION", color: "#ffd740", desc: "Mid-cycle — watch for direction" };
  };

  const getEntryPrice = () => {
    if (!activeSeed || candles.length < 2) return null;
    const lastPrice = candles[candles.length - 1].close;
    const proj = activeSeed.projectedValues;
    if (proj.length < 2) return null;
    const seqW = activeSeed.sequence.slice(activeSeed.windowStart, activeSeed.windowStart + candles.length);
    const lastVal = seqW[seqW.length - 1];
    if (lastVal === 0) return null;
    const ratio = lastPrice / lastVal;
    if (activeSeed.mode === "3n+1" && activeSeed.nextDipStep !== null) {
      return { type: "BUY DIP", price: proj[activeSeed.nextDipStep] * ratio, stepsAway: activeSeed.nextDipStep };
    }
    if (activeSeed.mode === "3n-1" && activeSeed.nextSpikeStep !== null) {
      return { type: "SHORT ENTRY", price: proj[activeSeed.nextSpikeStep] * ratio, stepsAway: activeSeed.nextSpikeStep };
    }
    return null;
  };

  const signal = getSignal();
  const entry = getEntryPrice();
  const fmt = (n: number) => (isFinite(n) ? (n * 100).toFixed(1) + "%" : "\u2014");
  const fmtP = (n: number) => n >= 1
    ? "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "$" + n.toPrecision(4);

  return (
    <div className="w-80 border-l border-[#1e1e2e] bg-[#12121a] flex flex-col overflow-y-auto">
      <div className="px-4 py-3 border-b border-[#1e1e2e]">
        <h2 className="text-sm font-semibold text-[#ffd740] tracking-wide">COLLATZ SIGNAL ENGINE</h2>
        <p className="text-[10px] text-[#6b7280] mt-0.5">3N+1 Longs &middot; 3N-1 Shorts</p>
      </div>

      {alertTriggered && (
        <div className="px-4 py-2 bg-[#ffd74022] border-b border-[#ffd740] flex items-center justify-between">
          <span className="text-[11px] text-[#ffd740] font-semibold">&#9889; High confidence signal!</span>
          <button onClick={clearAlert} className="text-[10px] text-[#6b7280] hover:text-[#e0e0e0]">&#10005;</button>
        </div>
      )}

      <div className="px-4 py-3 border-b border-[#1e1e2e] flex flex-col gap-2">
        <div className="flex gap-1">
          {(["long", "short", "both"] as const).map((m) => (
            <button key={m} onClick={() => setScanMode(m)} disabled={scanning}
              className={`flex-1 py-1 text-[10px] font-mono rounded transition-colors ${scanMode === m ? "bg-[#448aff] text-white" : "bg-[#1a1a2e] text-[#6b7280] hover:text-[#e0e0e0]"}`}>
              {m === "long" ? "3N+1" : m === "short" ? "3N-1" : "BOTH"}
            </button>
          ))}
        </div>
        <Tooltip text="How many starting numbers to test. More seeds = deeper scan but slower.">
          <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">Seed Range</span>
        </Tooltip>
        <div className="flex gap-1">
          {SEED_OPTIONS.map((n) => (
            <button key={n} onClick={() => setMaxSeed(n)} disabled={scanning}
              className={`flex-1 py-1 text-[10px] font-mono rounded transition-colors ${maxSeed === n ? "bg-[#448aff] text-white" : "bg-[#1a1a2e] text-[#6b7280] hover:text-[#e0e0e0]"}`}>
              {n / 1000}K
            </button>
          ))}
        </div>
        <button onClick={runSeedScan} disabled={scanning || candles.length < 10}
          className="w-full py-2 rounded text-sm font-semibold bg-[#448aff] text-white hover:bg-[#5a9aff] disabled:opacity-40 transition-colors">
          {scanning ? `Scanning ${maxSeed.toLocaleString()}...` : `Scan ${maxSeed.toLocaleString()} Seeds`}
        </button>
        <button onClick={toggleCollatz}
          className={`w-full py-1.5 rounded text-xs font-mono transition-colors ${showCollatz ? "bg-[#ffd740] text-black" : "bg-[#1a1a2e] text-[#6b7280] hover:text-[#e0e0e0]"}`}>
          {showCollatz ? "Overlay ON" : "Overlay OFF"}
        </button>
      </div>

      {(bestSeeds.length > 0 || shortSeeds.length > 0) && (
        <div className="flex border-b border-[#1e1e2e]">
          <button onClick={() => setActiveTab("long")}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${activeTab === "long" ? "text-[#00e676] border-b-2 border-[#00e676] bg-[#00e67608]" : "text-[#6b7280] hover:text-[#e0e0e0]"}`}>
            LONG 3N+1 {bestSeeds.length > 0 && `(${bestSeeds.length})`}
          </button>
          <button onClick={() => setActiveTab("short")}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${activeTab === "short" ? "text-[#ff1744] border-b-2 border-[#ff1744] bg-[#ff174408]" : "text-[#6b7280] hover:text-[#e0e0e0]"}`}>
            SHORT 3N-1 {shortSeeds.length > 0 && `(${shortSeeds.length})`}
          </button>
        </div>
      )}

      {signal && activeSeed && (
        <div className="px-4 py-3 border-b border-[#1e1e2e]">
          <div className="text-center py-2 rounded font-bold text-sm tracking-wider"
            style={{ backgroundColor: signal.color + "22", color: signal.color }}>
            {signal.label}
          </div>
          <p className="text-[10px] text-[#6b7280] mt-1.5 text-center">{signal.desc}</p>
          <div className="mt-3">
            <Tooltip text="Blended confidence from score, direction, runway, and projection consistency. 75%+ triggers alert.">
              <div className="flex justify-between text-[10px] text-[#6b7280] mb-1">
                <span>Confidence</span>
                <span className="font-mono" style={{ color: activeSeed.confidence >= 75 ? "#00e676" : activeSeed.confidence >= 50 ? "#ffd740" : "#ff1744" }}>
                  {activeSeed.confidence.toFixed(0)}%
                </span>
              </div>
            </Tooltip>
            <div className="h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${activeSeed.confidence}%`,
                backgroundColor: activeSeed.confidence >= 75 ? "#00e676" : activeSeed.confidence >= 50 ? "#ffd740" : "#ff1744",
              }} />
            </div>
          </div>
        </div>
      )}

      {entry && activeSeed && (
        <div className="px-4 py-3 border-b border-[#1e1e2e]">
          <Tooltip text="Projected entry price from the next dip (longs) or spike (shorts) in the Collatz sequence.">
            <h3 className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-2">Entry Target</h3>
          </Tooltip>
          <div className="bg-[#1a1a2e] rounded p-3">
            <div className="text-[10px] text-[#6b7280]">{entry.type}</div>
            <div className="text-lg font-mono font-bold" style={{ color: activeSeed.mode === "3n+1" ? "#00e676" : "#ff1744" }}>
              {fmtP(entry.price)}
            </div>
            <div className="text-[10px] text-[#6b7280] mt-1">
              ~{entry.stepsAway} candle{entry.stepsAway !== 1 ? "s" : ""} away
            </div>
          </div>
        </div>
      )}

      {seeds.length > 0 && (
        <div className="px-4 py-3">
          <Tooltip text="Scanner ranked seeds by how well their bounce pattern matches recent price action.">
            <h3 className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-2">Top Matches</h3>
          </Tooltip>
          <div className="flex flex-col gap-1.5">
            {seeds.map((seed, idx) => (
              <button key={seed.seed} onClick={() => setActiveSeed(idx)}
                className={`text-left px-3 py-2 rounded text-xs transition-colors ${idx === activeSeedIdx ? "bg-[#448aff22] border border-[#448aff]" : "bg-[#1a1a2e] border border-transparent hover:border-[#2a2a3e]"}`}>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[#e0e0e0]">
                    Seed {seed.seed}{seed.isCyclic ? " \u21BB" : ""}
                  </span>
                  <span className="font-mono font-bold" style={{ color: seed.score > 0.7 ? "#00e676" : seed.score > 0.5 ? "#ffd740" : "#6b7280" }}>
                    {fmt(seed.score)}
                  </span>
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[#6b7280]">
                  <span>Conf: {seed.confidence.toFixed(0)}%</span>
                  <span>Left: {seed.stepsRemaining}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeSeed && (
        <div className="px-4 py-3 border-t border-[#1e1e2e]">
          <h3 className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-2">Score Breakdown</h3>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Tooltip text="Overall curve shape match."><span className="text-[10px] text-[#6b7280] w-20">Shape</span></Tooltip>
              <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#ffd740]" style={{ width: `${Math.max(0, activeSeed.shapeCorrelation * 100)}%` }} />
              </div>
              <span className="text-[10px] font-mono text-[#ffd740] w-12 text-right">{fmt(activeSeed.shapeCorrelation)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip text="Candle-by-candle directional precision."><span className="text-[10px] text-[#6b7280] w-20">Direction</span></Tooltip>
              <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#00e676]" style={{ width: `${Math.max(0, activeSeed.directionMatch * 100)}%` }} />
              </div>
              <span className="text-[10px] font-mono text-[#00e676] w-12 text-right">{fmt(activeSeed.directionMatch)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip text="Move magnitude matching."><span className="text-[10px] text-[#6b7280] w-20">Volatility</span></Tooltip>
              <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#448aff]" style={{ width: `${Math.max(0, activeSeed.volatilityMatch * 100)}%` }} />
              </div>
              <span className="text-[10px] font-mono text-[#448aff] w-12 text-right">{fmt(activeSeed.volatilityMatch)}</span>
            </div>
          </div>
        </div>
      )}

      {activeSeed && (
        <div className="px-4 py-3 border-t border-[#1e1e2e]">
          <h3 className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-2">Seed Stats</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Tooltip text="Highest value before collapse.">
              <div className="bg-[#1a1a2e] rounded p-2 w-full">
                <div className="text-[10px] text-[#6b7280]">Peak</div>
                <div className="font-mono text-[#ffd740]">{activeSeed.peak.toLocaleString()}</div>
              </div>
            </Tooltip>
            <Tooltip text="Step where peak occurs.">
              <div className="bg-[#1a1a2e] rounded p-2 w-full">
                <div className="text-[10px] text-[#6b7280]">Peak Step</div>
                <div className="font-mono text-[#e0e0e0]">{activeSeed.peakStep}</div>
              </div>
            </Tooltip>
            <Tooltip text="You are here in the sequence.">
              <div className="bg-[#1a1a2e] rounded p-2 w-full">
                <div className="text-[10px] text-[#6b7280]">Current</div>
                <div className="font-mono text-[#448aff]">{activeSeed.currentStep}</div>
              </div>
            </Tooltip>
            <Tooltip text="Total pattern lifespan.">
              <div className="bg-[#1a1a2e] rounded p-2 w-full">
                <div className="text-[10px] text-[#6b7280]">Stop Time</div>
                <div className="font-mono text-[#e0e0e0]">{activeSeed.stoppingTime}</div>
              </div>
            </Tooltip>
          </div>
          <div className="mt-3">
            <Tooltip text="85%+ turns red = exit zone.">
              <div className="flex justify-between text-[10px] text-[#6b7280] mb-1">
                <span>Progress</span>
                <span>{((activeSeed.currentStep / activeSeed.stoppingTime) * 100).toFixed(0)}%</span>
              </div>
            </Tooltip>
            <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${(activeSeed.currentStep / activeSeed.stoppingTime) * 100}%`,
                backgroundColor: activeSeed.stepsRemaining < activeSeed.stoppingTime * 0.15 ? "#ff1744" : "#448aff",
              }} />
            </div>
          </div>
        </div>
      )}

      {seeds.length === 0 && !scanning && (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-xs text-[#6b7280] text-center">
            Load a chart and hit Scan to find Collatz sequences that correlate with price action.
          </p>
        </div>
      )}
    </div>
  );
}
