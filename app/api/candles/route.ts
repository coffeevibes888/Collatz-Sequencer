import { NextRequest, NextResponse } from "next/server";

const BINANCE_BASE = "https://api.binance.com/api/v3";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Map Binance symbols to CoinGecko IDs
const COINGECKO_MAP: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana",
  DOGEUSDT: "dogecoin",
  XRPUSDT: "ripple",
  ADAUSDT: "cardano",
  SHIBUSDT: "shiba-inu",
  AVAXUSDT: "avalanche-2",
  LINKUSDT: "chainlink",
  DOTUSDT: "polkadot",
};

// Map interval to CoinGecko days parameter
const INTERVAL_TO_DAYS: Record<string, number> = {
  "1m": 1,
  "5m": 1,
  "15m": 1,
  "1h": 2,
  "4h": 14,
  "1d": 90,
  "1w": 365,
};

interface BinanceKline {
  0: number; // open time
  1: string; // open
  2: string; // high
  3: string; // low
  4: string; // close
  5: string; // volume
}

async function fetchFromBinance(symbol: string, interval: string, limit: number) {
  const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data: BinanceKline[] = await res.json();

  return data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchFromCoinGecko(symbol: string, interval: string) {
  const coinId = COINGECKO_MAP[symbol];
  if (!coinId) throw new Error(`Unknown symbol: ${symbol}`);

  const days = INTERVAL_TO_DAYS[interval] || 90;
  const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data: number[][] = await res.json();

  return data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: 0,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const interval = searchParams.get("interval") || "1d";
  const limit = parseInt(searchParams.get("limit") || "200");

  // Try Binance first, fall back to CoinGecko
  try {
    const candles = await fetchFromBinance(symbol, interval, limit);
    return NextResponse.json({ candles, source: "binance" });
  } catch {
    // Binance failed — try CoinGecko
  }

  try {
    const candles = await fetchFromCoinGecko(symbol, interval);
    return NextResponse.json({ candles, source: "coingecko" });
  } catch {
    return NextResponse.json(
      { error: "Both Binance and CoinGecko APIs failed. Check your connection." },
      { status: 502 }
    );
  }
}
