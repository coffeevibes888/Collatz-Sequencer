// ── Collatz Sequence Engine v3 — 3N+1 (long) + 3N-1 (short) ────────

export type CollatzMode = "3n+1" | "3n-1";

export interface CollatzResult {
  sequence: number[];
  stoppingTime: number;
  peak: number;
  peakStep: number;
  trough: number;
  troughStep: number;
  directions: ("up" | "down")[];
  mode: CollatzMode;
  isCyclic: boolean; // 3n-1 can produce cycles
}

/** Generate a Collatz sequence — supports both 3n+1 and 3n-1 variants */
export function generateCollatz(seed: number, mode: CollatzMode = "3n+1"): CollatzResult {
  const sequence: number[] = [seed];
  const directions: ("up" | "down")[] = [];
  let current = seed;
  let peak = seed, peakStep = 0;
  let trough = seed, troughStep = 0;
  const seen = new Set<number>([seed]);
  let isCyclic = false;

  const maxSteps = mode === "3n-1" ? 5000 : 10000;
  const terminator = mode === "3n+1" ? 1 : -1; // 3n-1 doesn't terminate at 1

  while (sequence.length < maxSteps) {
    const prev = current;
    if (current % 2 === 0) {
      current = current / 2;
    } else {
      current = mode === "3n+1" ? 3 * current + 1 : 3 * current - 1;
    }

    // 3n+1 terminates at 1
    if (mode === "3n+1" && current === 1) {
      sequence.push(current);
      directions.push("down");
      break;
    }

    // 3n-1 can cycle — detect and stop
    if (mode === "3n-1" && seen.has(current)) {
      isCyclic = true;
      break;
    }
    seen.add(current);

    sequence.push(current);
    directions.push(current > prev ? "up" : "down");
    if (current > peak) { peak = current; peakStep = sequence.length - 1; }
    if (current < trough) { trough = current; troughStep = sequence.length - 1; }
  }

  return {
    sequence, stoppingTime: sequence.length - 1,
    peak, peakStep, trough, troughStep,
    directions, mode, isCyclic,
  };
}

/** Normalize a number array to 0-1 range. Returns all 0.5 if flat. */
export function normalize(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min;
  if (range === 0) return arr.map(() => 0.5);
  return arr.map((v) => (v - min) / range);
}

/** Pearson correlation between two equal-length arrays */
export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

export function directionAccuracy(
  candleDirections: ("up" | "down")[],
  collatzDirections: ("up" | "down")[]
): number {
  const len = Math.min(candleDirections.length, collatzDirections.length);
  if (len === 0) return 0;
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (candleDirections[i] === collatzDirections[i]) matches++;
  }
  return matches / len;
}

export function volatilityShapeScore(
  priceChanges: number[],
  collatzChanges: number[]
): number {
  const len = Math.min(priceChanges.length, collatzChanges.length);
  if (len < 2) return 0;
  const pAbs = priceChanges.slice(0, len).map(Math.abs);
  const cAbs = collatzChanges.slice(0, len).map(Math.abs);
  const pRange = Math.max(...pAbs) - Math.min(...pAbs);
  const cRange = Math.max(...cAbs) - Math.min(...cAbs);
  if (pRange === 0 || cRange === 0) return 0;
  const pNorm = normalize(pAbs);
  const cNorm = normalize(cAbs);
  const corr = pearsonCorrelation(pNorm, cNorm);
  return isFinite(corr) ? Math.max(0, corr) : 0;
}

export function resample(arr: number[], targetLen: number): number[] {
  if (arr.length === 0) return [];
  if (arr.length === targetLen) return [...arr];
  if (targetLen === 1) return [arr[0]];
  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const pos = (i / (targetLen - 1)) * (arr.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, arr.length - 1);
    const frac = pos - lo;
    result.push(arr[lo] * (1 - frac) + arr[hi] * frac);
  }
  return result;
}

export function getCandleDirections(
  candles: { open: number; close: number }[]
): ("up" | "down")[] {
  return candles.map((c) => (c.close >= c.open ? "up" : "down"));
}

export function getStepChanges(values: number[]): number[] {
  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    changes.push(prev === 0 ? 0 : values[i] / prev - 1);
  }
  return changes;
}

export interface SeedMatch {
  seed: number;
  mode: CollatzMode;
  score: number;
  shapeCorrelation: number;
  directionMatch: number;
  volatilityMatch: number;
  stoppingTime: number;
  peak: number;
  peakStep: number;
  trough: number;
  troughStep: number;
  currentStep: number;
  stepsRemaining: number;
  windowStart: number;
  sequence: number[];
  directions: ("up" | "down")[];
  projectedValues: number[];
  isCyclic: boolean;
  // Entry price calculation
  nextDipStep: number | null;     // next "down" step in projection
  nextSpikeStep: number | null;   // next "up" step in projection
  // Confidence
  confidence: number;             // 0-100 blended confidence
}

/** Calculate entry targets from projection */
function calcEntryTargets(projectedValues: number[]): {
  nextDipStep: number | null;
  nextSpikeStep: number | null;
} {
  let nextDipStep: number | null = null;
  let nextSpikeStep: number | null = null;

  for (let i = 1; i < projectedValues.length; i++) {
    if (projectedValues[i] < projectedValues[i - 1] && nextDipStep === null) {
      nextDipStep = i;
    }
    if (projectedValues[i] > projectedValues[i - 1] && nextSpikeStep === null) {
      nextSpikeStep = i;
    }
    if (nextDipStep !== null && nextSpikeStep !== null) break;
  }

  return { nextDipStep, nextSpikeStep };
}

/** Calculate confidence 0-100 from multiple signals */
function calcConfidence(
  score: number,
  shapeCorr: number,
  dirMatch: number,
  stepsRemaining: number,
  stoppingTime: number,
  projectedValues: number[]
): number {
  // Base from composite score (0-40)
  const scoreConf = Math.min(40, score * 50);

  // Direction agreement bonus (0-25)
  const dirConf = dirMatch * 25;

  // Runway bonus — more steps remaining = more confident (0-15)
  const runwayPct = stepsRemaining / Math.max(stoppingTime, 1);
  const runwayConf = Math.min(15, runwayPct * 20);

  // Projection consistency — are the next few steps mostly same direction? (0-20)
  let projConf = 0;
  if (projectedValues.length >= 3) {
    let sameDir = 0;
    const firstDir = projectedValues[1] > projectedValues[0] ? "up" : "down";
    for (let i = 1; i < Math.min(projectedValues.length, 6); i++) {
      const dir = projectedValues[i] > projectedValues[i - 1] ? "up" : "down";
      if (dir === firstDir) sameDir++;
    }
    projConf = (sameDir / Math.min(projectedValues.length - 1, 5)) * 20;
  }

  return Math.min(100, Math.max(0, scoreConf + dirConf + runwayConf + projConf));
}

/**
 * Core scanner — works for both 3n+1 and 3n-1.
 */
function scanSeeds(
  candles: { open: number; high: number; low: number; close: number }[],
  mode: CollatzMode,
  maxSeed: number,
  topN: number
): SeedMatch[] {
  const closes = candles.map((c) => c.close);
  const priceNorm = normalize(closes);
  const priceLen = candles.length;
  const candleDirs = getCandleDirections(candles);
  const priceChanges = getStepChanges(closes);
  const matches: SeedMatch[] = [];

  for (let seed = 2; seed <= maxSeed; seed++) {
    const result = generateCollatz(seed, mode);
    if (result.stoppingTime < priceLen) continue;

    const maxStart = result.stoppingTime - priceLen;
    let bestScore = -Infinity;
    let bestStart = 0;

    const coarseStep = Math.max(1, Math.floor(maxStart / 100));
    for (let start = 0; start <= maxStart; start += coarseStep) {
      const w = result.sequence.slice(start, start + priceLen);
      const wn = normalize(w);
      const corr = pearsonCorrelation(priceNorm, wn);
      if (corr > bestScore) { bestScore = corr; bestStart = start; }
    }

    const fineFrom = Math.max(0, bestStart - coarseStep * 2);
    const fineTo = Math.min(maxStart, bestStart + coarseStep * 2);
    for (let start = fineFrom; start <= fineTo; start++) {
      const w = result.sequence.slice(start, start + priceLen);
      const wn = normalize(w);
      const corr = pearsonCorrelation(priceNorm, wn);
      if (corr > bestScore) { bestScore = corr; bestStart = start; }
    }

    if (bestScore < 0.4) continue;

    const window = result.sequence.slice(bestStart, bestStart + priceLen);
    const windowNorm = normalize(window);
    const shapeCorrelation = pearsonCorrelation(priceNorm, windowNorm);

    const collatzDirs = result.directions.slice(bestStart, bestStart + priceLen - 1);
    const candleDirsSlice = candleDirs.slice(1);
    const dirMatch = directionAccuracy(candleDirsSlice, collatzDirs);

    const collatzChanges = getStepChanges(window);
    const volMatch = Math.max(0, volatilityShapeScore(priceChanges, collatzChanges));

    const rawScore = shapeCorrelation * 0.40 + dirMatch * 0.35 + volMatch * 0.25;
    const score = isFinite(rawScore) ? rawScore : 0;

    const currentStep = bestStart + priceLen - 1;
    const stepsRemaining = result.stoppingTime - currentStep;

    const projLen = Math.min(stepsRemaining, Math.ceil(priceLen * 0.5));
    const projectedValues = result.sequence.slice(currentStep + 1, currentStep + 1 + projLen);

    const { nextDipStep, nextSpikeStep } = calcEntryTargets(projectedValues);
    const confidence = calcConfidence(score, shapeCorrelation, dirMatch, stepsRemaining, result.stoppingTime, projectedValues);

    matches.push({
      seed, mode, score, shapeCorrelation,
      directionMatch: dirMatch, volatilityMatch: volMatch,
      stoppingTime: result.stoppingTime,
      peak: result.peak, peakStep: result.peakStep,
      trough: result.trough, troughStep: result.troughStep,
      currentStep, stepsRemaining, windowStart: bestStart,
      sequence: result.sequence, directions: result.directions,
      projectedValues, isCyclic: result.isCyclic,
      nextDipStep, nextSpikeStep, confidence,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, topN);
}

/** Scan for LONG signals (3n+1) */
export function findBestSeeds(
  candles: { open: number; high: number; low: number; close: number }[],
  maxSeed: number = 3000,
  topN: number = 5
): SeedMatch[] {
  return scanSeeds(candles, "3n+1", maxSeed, topN);
}

/** Scan for SHORT signals (3n-1) */
export function findShortSeeds(
  candles: { open: number; high: number; low: number; close: number }[],
  maxSeed: number = 3000,
  topN: number = 5
): SeedMatch[] {
  return scanSeeds(candles, "3n-1", maxSeed, topN);
}
