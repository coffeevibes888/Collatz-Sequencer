"use client";

import { Candle, Interval } from "./api";

const BINANCE_WS = "wss://stream.binance.com:9443/ws";

type OnCandle = (candle: Candle, isClosed: boolean) => void;

export interface LiveTrade {
  id: number;
  price: number;
  qty: number;
  time: number;       // unix ms
  isBuyerMaker: boolean; // true = sell, false = buy
}

type OnTrade = (trade: LiveTrade) => void;

let ws: WebSocket | null = null;
let currentId = "";

/**
 * Connect to Binance combined stream for live klines + aggTrades.
 */
export function connectLiveStream(
  symbol: string,
  interval: Interval,
  onCandle: OnCandle,
  onTrade: OnTrade
): () => void {
  if (ws) {
    ws.close();
    ws = null;
  }

  const sym = symbol.toLowerCase();
  const streams = `${sym}@kline_${interval}/${sym}@aggTrade`;
  const id = `${sym}_${interval}`;
  currentId = id;
  const url = `${BINANCE_WS}/${streams}`;

  const socket = new WebSocket(url);
  ws = socket;

  socket.onmessage = (event) => {
    if (currentId !== id) return;

    try {
      const msg = JSON.parse(event.data);

      // Kline stream
      if (msg.e === "kline") {
        const k = msg.k;
        const candle: Candle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };
        onCandle(candle, k.x === true);
      }

      // Aggregate trade stream
      if (msg.e === "aggTrade") {
        onTrade({
          id: msg.a,
          price: parseFloat(msg.p),
          qty: parseFloat(msg.q),
          time: msg.T,
          isBuyerMaker: msg.m,
        });
      }
    } catch {
      // Ignore parse errors
    }
  };

  socket.onerror = () => {};

  return () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
    if (ws === socket) ws = null;
  };
}
