"use client";

import { create } from "zustand";
import { Candle, Interval, fetchCandles } from "./api";
import { SeedMatch, findBestSeeds, findShortSeeds } from "./collatz";
import { connectLiveStream, LiveTrade } from "./websocket";

export type ScanMode = "long" | "short" | "both";

interface TradingState {
  symbol: string;
  interval: Interval;
  candles: Candle[];
  loading: boolean;
  error: string | null;
  isLive: boolean;
  trades: LiveTrade[];
  // Collatz
  showCollatz: boolean;
  bestSeeds: SeedMatch[];       // long (3n+1)
  shortSeeds: SeedMatch[];      // short (3n-1)
  activeSeedIdx: number;
  scanning: boolean;
  maxSeed: number;
  scanMode: ScanMode;
  activeTab: "long" | "short";
  // Alert
  alertTriggered: boolean;
  // Actions
  setSymbol: (s: string) => void;
  setInterval: (i: Interval) => void;
  loadCandles: () => Promise<void>;
  toggleCollatz: () => void;
  runSeedScan: () => void;
  setActiveSeed: (idx: number) => void;
  setMaxSeed: (n: number) => void;
  setScanMode: (m: ScanMode) => void;
  setActiveTab: (t: "long" | "short") => void;
  clearAlert: () => void;
}

let disconnectWs: (() => void) | null = null;
const MAX_TRADES = 50;

export const useStore = create<TradingState>((set, get) => ({
  symbol: "BTCUSDT",
  interval: "1d",
  candles: [],
  loading: false,
  error: null,
  isLive: false,
  trades: [],
  showCollatz: false,
  bestSeeds: [],
  shortSeeds: [],
  activeSeedIdx: 0,
  scanning: false,
  maxSeed: 3000,
  scanMode: "both",
  activeTab: "long",
  alertTriggered: false,

  setSymbol: (symbol) => {
    set({ symbol, bestSeeds: [], shortSeeds: [], activeSeedIdx: 0, trades: [] });
    get().loadCandles();
  },
  setInterval: (interval) => {
    set({ interval, bestSeeds: [], shortSeeds: [], activeSeedIdx: 0 });
    get().loadCandles();
  },

  loadCandles: async () => {
    const { symbol, interval } = get();
    set({ loading: true, error: null, isLive: false });
    if (disconnectWs) { disconnectWs(); disconnectWs = null; }

    try {
      const candles = await fetchCandles(symbol, interval, 200);
      set({ candles, loading: false });

      disconnectWs = connectLiveStream(symbol, interval,
        (liveCandle, isClosed) => {
          set((state) => {
            const updated = [...state.candles];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].time === liveCandle.time) {
              updated[lastIdx] = liveCandle;
            } else if (isClosed || (lastIdx >= 0 && liveCandle.time > updated[lastIdx].time)) {
              updated.push(liveCandle);
              if (updated.length > 250) updated.shift();
            }
            return { candles: updated, isLive: true };
          });
        },
        (trade) => {
          set((state) => {
            const updated = [trade, ...state.trades];
            if (updated.length > MAX_TRADES) updated.length = MAX_TRADES;
            return { trades: updated, isLive: true };
          });
        }
      );
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  toggleCollatz: () => set((s) => ({ showCollatz: !s.showCollatz })),

  runSeedScan: () => {
    const { candles, maxSeed, scanMode } = get();
    if (candles.length < 10) return;
    set({ scanning: true });

    setTimeout(() => {
      let bestSeeds: SeedMatch[] = [];
      let shortSeeds: SeedMatch[] = [];

      if (scanMode === "long" || scanMode === "both") {
        bestSeeds = findBestSeeds(candles, maxSeed, 5);
      }
      if (scanMode === "short" || scanMode === "both") {
        shortSeeds = findShortSeeds(candles, maxSeed, 5);
      }

      // Check for alert — any match above 75% confidence
      const topConf = Math.max(
        bestSeeds[0]?.confidence ?? 0,
        shortSeeds[0]?.confidence ?? 0
      );
      const alertTriggered = topConf >= 75;

      set({
        bestSeeds, shortSeeds, scanning: false,
        showCollatz: true, activeSeedIdx: 0,
        alertTriggered,
      });
    }, 50);
  },

  setActiveSeed: (idx) => set({ activeSeedIdx: idx }),
  setMaxSeed: (maxSeed) => set({ maxSeed, bestSeeds: [], shortSeeds: [], activeSeedIdx: 0 }),
  setScanMode: (scanMode) => set({ scanMode }),
  setActiveTab: (activeTab) => set({ activeTab, activeSeedIdx: 0 }),
  clearAlert: () => set({ alertTriggered: false }),
}));
