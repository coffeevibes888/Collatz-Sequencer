import { NextRequest, NextResponse } from "next/server";

const BINANCE_BASE = "https://api.binance.com/api/v3";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const COINGECKO_MAP: Record<string, string> = {
  BTCUSDT: "bitcoin", ETHUSDT: "ethereum", SOLUSDT: "solana",
  DOGEUSDT: "dogecoin", XRPUSDT: "ripple", ADAUSDT: "cardano",
  SHIBUSDT: "shiba-inu", AVAXUSDT: "avalanche-2",
  LINKUSDT: "chainlink", DOTUSDT: "polkadot",
};

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchBinanceAll(symbol: string, interval: string, days: number): Promise<CandleData[]> {
  const intervalMs: Record<string, number> = {
    "1d": 86400000, "4h": 14400000, "1h": 3600000, "1w": 604800000,
  };
  const step = intervalMs[interval] || 86400000;
  const now = Date.now();
  const startTime = now - days * 86400000;
  const allCandles: CandleData[] = [];

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

  if (allCandles.length === 0) throw new Error("No data from Binance");
  return allCandles;
}

async function fetchCoinGeckoOHLC(symbol: string, days: number): Promise<CandleData[]> {
  const coinId = COINGECKO_MAP[symbol];
  if (!coinId) throw new Error(`Unknown symbol: ${symbol}`);

  // CoinGecko free OHLC only supports specific day values
  const validDays = [1, 7, 14, 30, 90, 180, 365];
  const cgDays = validDays.find((d) => d >= days) || 365;

  const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${cgDays}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);
  const data: number[][] = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("Empty CoinGecko OHLC");

  return data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: k[1], high: k[2], low: k[3], close: k[4], volume: 0,
  }));
}

async function fetchCoinGeckoMarketChart(symbol: string, days: number): Promise<CandleData[]> {
  const coinId = COINGECKO_MAP[symbol];
  if (!coinId) throw new Error(`Unknown symbol: ${symbol}`);

  // market_chart gives daily prices for longer periods
  const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CoinGecko market_chart ${res.status}`);
  const data = await res.json();

  if (!data.prices || !Array.isArray(data.prices) || data.prices.length === 0) {
    throw new Error("Empty CoinGecko market_chart");
  }

  // market_chart returns [timestamp, price] pairs — synthesize OHLC from daily prices
  return data.prices.map((p: [number, number], i: number) => {
    const price = p[1];
    const prevPrice = i > 0 ? data.prices[i - 1][1] : price;
    return {
      time: Math.floor(p[0] / 1000),
      open: prevPrice,
      high: Math.max(price, prevPrice) * 1.005, // approximate
      low: Math.min(price, prevPrice) * 0.995,
      close: price,
      volume: 0,
    };
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const days = Math.min(parseInt(searchParams.get("days") || "365"), 365);
  const interval = searchParams.get("interval") || "1d";

  // Try Binance first
  try {
    const candles = await fetchBinanceAll(symbol, interval, days);
    return NextResponse.json({ candles, source: "binance", count: candles.length });
  } catch {
    // Binance failed
  }

  // Try CoinGecko OHLC (best quality, limited to 365 days)
  try {
    const candles = await fetchCoinGeckoOHLC(symbol, days);
    return NextResponse.json({ candles, source: "coingecko-ohlc", count: candles.length });
  } catch {
    // CoinGecko OHLC failed
  }

  // Try CoinGecko market_chart (supports longer periods, lower quality)
  try {
    const candles = await fetchCoinGeckoMarketChart(symbol, days);
    return NextResponse.json({ candles, source: "coingecko-chart", count: candles.length });
  } catch {
    // All failed
  }

  return NextResponse.json(
    { error: "All data sources failed. Binance may be geo-blocked and CoinGecko rate-limited. Try again in a minute." },
    { status: 502 }
  );
}
