import { NextRequest, NextResponse } from "next/server";

const BINANCE_BASE = "https://api.binance.com/api/v3";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const COINGECKO_MAP: Record<string, string> = {
  BTCUSDT: "bitcoin", ETHUSDT: "ethereum", SOLUSDT: "solana",
  DOGEUSDT: "dogecoin", XRPUSDT: "ripple", ADAUSDT: "cardano",
  SHIBUSDT: "shiba-inu", AVAXUSDT: "avalanche-2",
  LINKUSDT: "chainlink", DOTUSDT: "polkadot",
};

async function fetchBinanceAll(symbol: string, interval: string, days: number) {
  // Binance max 1000 per request, so we paginate
  const intervalMs: Record<string, number> = {
    "1d": 86400000, "4h": 14400000, "1h": 3600000, "1w": 604800000,
  };
  const step = intervalMs[interval] || 86400000;
  const now = Date.now();
  const startTime = now - days * 86400000;
  const allCandles: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];

  let cursor = startTime;
  while (cursor < now) {
    const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&startTime=${cursor}&limit=1000`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    const data = await res.json();
    if (data.length === 0) break;

    for (const k of data) {
      allCandles.push({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      });
    }

    cursor = data[data.length - 1][0] + step;
    if (data.length < 1000) break;
  }

  return allCandles;
}

async function fetchCoinGeckoLong(symbol: string, days: number) {
  const coinId = COINGECKO_MAP[symbol];
  if (!coinId) throw new Error(`Unknown symbol: ${symbol}`);
  const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data: number[][] = await res.json();
  return data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: k[1], high: k[2], low: k[3], close: k[4], volume: 0,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const days = Math.min(parseInt(searchParams.get("days") || "365"), 1095); // max 3 years
  const interval = searchParams.get("interval") || "1d";

  try {
    const candles = await fetchBinanceAll(symbol, interval, days);
    return NextResponse.json({ candles, source: "binance", count: candles.length });
  } catch {
    // fallback
  }

  try {
    const candles = await fetchCoinGeckoLong(symbol, days);
    return NextResponse.json({ candles, source: "coingecko", count: candles.length });
  } catch {
    return NextResponse.json({ error: "Failed to fetch historical data" }, { status: 502 });
  }
}
