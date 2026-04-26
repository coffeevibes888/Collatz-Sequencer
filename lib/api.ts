// ── Crypto API (server-side proxy with Binance + CoinGecko fallback) ─

export interface Candle {
  time: number;   // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export async function fetchCandles(
  symbol: string,
  interval: Interval = "1d",
  limit: number = 200
): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit: String(limit),
  });
  const res = await fetch(`/api/candles?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch candles");
  return data.candles;
}

export const POPULAR_PAIRS = [
  { symbol: "BTCUSDT", label: "BTC/USDT" },
  { symbol: "ETHUSDT", label: "ETH/USDT" },
  { symbol: "SOLUSDT", label: "SOL/USDT" },
  { symbol: "DOGEUSDT", label: "DOGE/USDT" },
  { symbol: "XRPUSDT", label: "XRP/USDT" },
  { symbol: "ADAUSDT", label: "ADA/USDT" },
  { symbol: "SHIBUSDT", label: "SHIB/USDT" },
  { symbol: "AVAXUSDT", label: "AVAX/USDT" },
  { symbol: "LINKUSDT", label: "LINK/USDT" },
  { symbol: "DOTUSDT", label: "DOT/USDT" },
];

export const INTERVALS: { value: Interval; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
];
