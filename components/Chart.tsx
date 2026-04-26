"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  CrosshairMode,
} from "lightweight-charts";
import { useStore } from "@/lib/store";
import { Candle } from "@/lib/api";

interface CrosshairData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
  change: number;
  changePct: number;
}

export default function Chart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const collatzSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const projectionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candleMapRef = useRef<Map<number, Candle>>(new Map());

  const candles = useStore((s) => s.candles);
  const showCollatz = useStore((s) => s.showCollatz);
  const bestSeeds = useStore((s) => s.bestSeeds);
  const shortSeeds = useStore((s) => s.shortSeeds);
  const activeSeedIdx = useStore((s) => s.activeSeedIdx);
  const activeTab = useStore((s) => s.activeTab);
  const prevLenRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  const [crosshair, setCrosshair] = useState<CrosshairData | null>(null);

  // Build candle lookup map whenever candles change
  useEffect(() => {
    const map = new Map<number, Candle>();
    candles.forEach((c) => map.set(c.time, c));
    candleMapRef.current = map;
  }, [candles]);

  const handleCrosshairMove = useCallback((param: { time?: Time }) => {
    if (!param.time) {
      setCrosshair(null);
      return;
    }
    const t = param.time as number;
    const c = candleMapRef.current.get(t);
    if (!c) {
      setCrosshair(null);
      return;
    }
    const change = c.close - c.open;
    const changePct = c.open !== 0 ? (change / c.open) * 100 : 0;
    setCrosshair({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      time: c.time,
      change,
      changePct,
    });
  }, []);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0a0a0f" },
        textColor: "#6b7280",
        fontFamily: "var(--font-geist-sans), sans-serif",
      },
      grid: {
        vertLines: { color: "#1e1e2e" },
        horzLines: { color: "#1e1e2e" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#448aff44", width: 1, labelBackgroundColor: "#448aff" },
        horzLine: { color: "#448aff44", width: 1, labelBackgroundColor: "#448aff" },
      },
      rightPriceScale: {
        borderColor: "#1e1e2e",
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#1e1e2e",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Subscribe to crosshair movement
    chart.subscribeCrosshairMove(handleCrosshairMove);

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00e676",
      downColor: "#ff1744",
      borderUpColor: "#00e676",
      borderDownColor: "#ff1744",
      wickUpColor: "#00e67688",
      wickDownColor: "#ff174488",
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Collatz overlay — own price scale on the left, auto-scales independently
    const collatzSeries = chart.addSeries(LineSeries, {
      color: "#ffd740",
      lineWidth: 2,
      priceScaleId: "collatz",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    collatzSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.2 },
      visible: false, // hide the left axis — we just want the shape
    });
    collatzSeriesRef.current = collatzSeries;

    const projectionSeries = chart.addSeries(LineSeries, {
      color: "#448aff",
      lineWidth: 2,
      lineStyle: 2,
      priceScaleId: "collatz",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    projectionSeriesRef.current = projectionSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
    };
  }, [handleCrosshairMove]);

  // Update candle data — optimized for live ticks
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    const last = candles[candles.length - 1];
    const isNewCandle = candles.length !== prevLenRef.current;
    prevLenRef.current = candles.length;

    if (isInitialLoadRef.current || isNewCandle) {
      isInitialLoadRef.current = false;

      const candleData: CandlestickData[] = candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const volumeData = candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? "#00e67633" : "#ff174433",
      }));

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);

      if (isNewCandle) {
        chartRef.current?.timeScale().scrollToRealTime();
      }
    } else {
      candleSeriesRef.current.update({
        time: last.time as Time,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
      volumeSeriesRef.current.update({
        time: last.time as Time,
        value: last.volume,
        color: last.close >= last.open ? "#00e67633" : "#ff174433",
      });
    }
  }, [candles]);

  // Update Collatz overlay — separate price scale auto-aligns the shape
  // This is how TradingView does indicator overlays: own y-axis that
  // scales independently so the shape always matches visually.
  useEffect(() => {
    if (!collatzSeriesRef.current || !projectionSeriesRef.current) return;

    const seeds = activeTab === "long" ? bestSeeds : shortSeeds;

    if (!showCollatz || seeds.length === 0 || candles.length === 0) {
      collatzSeriesRef.current.setData([]);
      projectionSeriesRef.current.setData([]);
      return;
    }

    const match = seeds[activeSeedIdx];
    if (!match) return;

    const overlayColor = match.mode === "3n+1" ? "#ffd740" : "#e040fb";
    const projColor = match.mode === "3n+1" ? "#448aff" : "#ff1744";
    collatzSeriesRef.current.applyOptions({ color: overlayColor });
    projectionSeriesRef.current.applyOptions({ color: projColor });

    // Get the matched Collatz window — pass raw values
    // The separate price scale auto-scales to fit the chart area
    const seqWindow = match.sequence.slice(
      match.windowStart,
      match.windowStart + candles.length
    );

    const collatzData: LineData[] = candles.map((c, i) => ({
      time: c.time as Time,
      value: i < seqWindow.length ? seqWindow[i] : seqWindow[seqWindow.length - 1],
    }));
    collatzSeriesRef.current.setData(collatzData);

    // Projection
    if (match.projectedValues.length > 0) {
      const lastTime = candles[candles.length - 1].time;
      const timeStep =
        candles.length > 1
          ? candles[candles.length - 1].time - candles[candles.length - 2].time
          : 86400;

      const projData: LineData[] = match.projectedValues.map((v, i) => ({
        time: (lastTime + timeStep * (i + 1)) as Time,
        value: v,
      }));

      // Bridge from last overlay point
      const bridge: LineData = {
        time: candles[candles.length - 1].time as Time,
        value: collatzData[collatzData.length - 1].value,
      };
      projectionSeriesRef.current.setData([bridge, ...projData]);
    } else {
      projectionSeriesRef.current.setData([]);
    }
  }, [showCollatz, bestSeeds, shortSeeds, activeSeedIdx, activeTab, candles]);

  const fmtPrice = (n: number) =>
    n >= 1
      ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toPrecision(4);

  const fmtVol = (n: number) => {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(2);
  };

  // Show last candle data when crosshair is not active
  const displayData = crosshair
    ? crosshair
    : candles.length > 0
    ? (() => {
        const c = candles[candles.length - 1];
        const change = c.close - c.open;
        const changePct = c.open !== 0 ? (change / c.open) * 100 : 0;
        return { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, time: c.time, change, changePct };
      })()
    : null;

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {/* OHLCV data bar — follows crosshair */}
      {displayData && (
        <div className="absolute top-2 left-3 z-10 flex items-center gap-3 text-[11px] font-mono pointer-events-none">
          <span className="text-[#6b7280]">O</span>
          <span className={displayData.close >= displayData.open ? "text-[#00e676]" : "text-[#ff1744]"}>
            {fmtPrice(displayData.open)}
          </span>
          <span className="text-[#6b7280]">H</span>
          <span className={displayData.close >= displayData.open ? "text-[#00e676]" : "text-[#ff1744]"}>
            {fmtPrice(displayData.high)}
          </span>
          <span className="text-[#6b7280]">L</span>
          <span className={displayData.close >= displayData.open ? "text-[#00e676]" : "text-[#ff1744]"}>
            {fmtPrice(displayData.low)}
          </span>
          <span className="text-[#6b7280]">C</span>
          <span className={displayData.close >= displayData.open ? "text-[#00e676]" : "text-[#ff1744]"}>
            {fmtPrice(displayData.close)}
          </span>
          <span className="text-[#6b7280]">Vol</span>
          <span className="text-[#e0e0e0]">{fmtVol(displayData.volume)}</span>
          <span className={displayData.change >= 0 ? "text-[#00e676]" : "text-[#ff1744]"}>
            {displayData.change >= 0 ? "+" : ""}{displayData.changePct.toFixed(2)}%
          </span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
