// indicators.js — Pure technical indicator calculations

// ── Array utilities ──────────────────────────────────────────────────────────

export function smaArray(values, period) {
  const result = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result[i] = sum / period;
  }
  return result;
}

export function emaArray(values, period) {
  const result = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

// Last non-null value helper
function last(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
}

// ── 1. RSI ───────────────────────────────────────────────────────────────────
export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss += Math.abs(d);
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
  }
  const rs = avgLoss === 0 ? 9999 : avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ── 2. MACD ──────────────────────────────────────────────────────────────────
export function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const e12 = emaArray(closes, fast);
  const e26 = emaArray(closes, slow);
  const macdLine = e12.map((v, i) => v !== null && e26[i] !== null ? v - e26[i] : null);
  const validMacd = macdLine.filter(v => v !== null);
  if (validMacd.length < signal) return { macd: null, signal: null, histogram: null };
  const sigArr = emaArray(validMacd, signal);
  const macdVal = validMacd[validMacd.length - 1];
  const sigVal = sigArr[sigArr.length - 1];
  return { macd: macdVal, signal: sigVal, histogram: macdVal - sigVal };
}

// ── 3. Bollinger Bands ───────────────────────────────────────────────────────
export function calcBollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mean + mult * std, middle: mean, lower: mean - mult * std, bandwidth: (4 * std / mean) * 100 };
}

// ── 4-9. EMA / SMA single values ─────────────────────────────────────────────
export function calcEMA(closes, period) { return last(emaArray(closes, period)); }
export function calcSMA(closes, period) { return last(smaArray(closes, period)); }

// ── 10. Stochastic Oscillator ────────────────────────────────────────────────
export function calcStochastic(highs, lows, closes, kPer = 14, dPer = 3) {
  const kArr = [];
  for (let i = kPer - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - kPer + 1, i + 1));
    const ll = Math.min(...lows.slice(i - kPer + 1, i + 1));
    kArr.push(((closes[i] - ll) / (hh - ll || 1)) * 100);
  }
  const dArr = smaArray(kArr, dPer);
  return { k: kArr[kArr.length - 1], d: last(dArr) };
}

// ── 11. ATR ──────────────────────────────────────────────────────────────────
export function calcATR(highs, lows, closes, period = 14) {
  const tr = [];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (tr.length < period) return null;
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < tr.length; i++) atr = (atr * (period - 1) + tr[i]) / period;
  return atr;
}

// ── 12. ADX ──────────────────────────────────────────────────────────────────
export function calcADX(highs, lows, closes, period = 14) {
  if (closes.length < period * 2) return null;
  const pDM = [], mDM = [], trArr = [];
  for (let i = 1; i < closes.length; i++) {
    const up = highs[i] - highs[i - 1], down = lows[i - 1] - lows[i];
    pDM.push(up > down && up > 0 ? up : 0);
    mDM.push(down > up && down > 0 ? down : 0);
    trArr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const wilder = (arr) => {
    let v = arr.slice(0, period).reduce((a, b) => a + b, 0);
    const r = [v];
    for (let i = period; i < arr.length; i++) { v = v - v / period + arr[i]; r.push(v); }
    return r;
  };
  const sTR = wilder(trArr), sPDM = wilder(pDM), sMDM = wilder(mDM);
  const diPlus = sTR.map((t, i) => (sPDM[i] / (t || 1)) * 100);
  const diMinus = sTR.map((t, i) => (sMDM[i] / (t || 1)) * 100);
  const dx = diPlus.map((p, i) => (Math.abs(p - diMinus[i]) / ((p + diMinus[i]) || 1)) * 100);
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) adx = (adx * (period - 1) + dx[i]) / period;
  return { adx, plusDI: diPlus[diPlus.length - 1], minusDI: diMinus[diMinus.length - 1] };
}

// ── 13. Williams %R ──────────────────────────────────────────────────────────
export function calcWilliamsR(highs, lows, closes, period = 14) {
  if (closes.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  return ((hh - closes[closes.length - 1]) / (hh - ll || 1)) * -100;
}

// ── 14. CCI ──────────────────────────────────────────────────────────────────
export function calcCCI(highs, lows, closes, period = 20) {
  if (closes.length < period) return null;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const slice = tp.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const mad = slice.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
  return (tp[tp.length - 1] - mean) / (0.015 * (mad || 1));
}

// ── 15. OBV ──────────────────────────────────────────────────────────────────
export function calcOBV(closes, volumes) {
  let obv = 0;
  const arr = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    arr.push(obv);
  }
  const slope = arr[arr.length - 1] - arr[Math.max(0, arr.length - 11)];
  return { value: obv, trend: slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'flat' };
}

// ── 16. MFI ──────────────────────────────────────────────────────────────────
export function calcMFI(highs, lows, closes, volumes, period = 14) {
  if (closes.length < period + 1) return null;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  let pos = 0, neg = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const mf = tp[i] * volumes[i];
    if (tp[i] >= tp[i - 1]) pos += mf; else neg += mf;
  }
  return neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
}

// ── 17. Parabolic SAR ────────────────────────────────────────────────────────
export function calcParabolicSAR(highs, lows, step = 0.02, max = 0.2) {
  if (highs.length < 3) return null;
  let bull = true, sar = lows[0], ep = highs[0], af = step;
  for (let i = 1; i < highs.length; i++) {
    sar = sar + af * (ep - sar);
    if (bull) {
      sar = Math.min(sar, lows[i - 1], i > 1 ? lows[i - 2] : lows[i - 1]);
      if (lows[i] < sar) { bull = false; sar = ep; af = step; ep = lows[i]; }
      else if (highs[i] > ep) { ep = highs[i]; af = Math.min(af + step, max); }
    } else {
      sar = Math.max(sar, highs[i - 1], i > 1 ? highs[i - 2] : highs[i - 1]);
      if (highs[i] > sar) { bull = true; sar = ep; af = step; ep = highs[i]; }
      else if (lows[i] < ep) { ep = lows[i]; af = Math.min(af + step, max); }
    }
  }
  return { sar, trend: bull ? 'bullish' : 'bearish' };
}

// ── 18. ROC ──────────────────────────────────────────────────────────────────
export function calcROC(closes, period = 12) {
  if (closes.length <= period) return null;
  const past = closes[closes.length - 1 - period];
  return ((closes[closes.length - 1] - past) / past) * 100;
}

// ── 19. Chaikin Money Flow ────────────────────────────────────────────────────
export function calcCMF(highs, lows, closes, volumes, period = 20) {
  if (closes.length < period) return null;
  let mfvSum = 0, volSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const hl = highs[i] - lows[i] || 1;
    const clv = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / hl;
    mfvSum += clv * volumes[i];
    volSum += volumes[i];
  }
  return volSum === 0 ? 0 : mfvSum / volSum;
}

// ── 20. Ichimoku Cloud ───────────────────────────────────────────────────────
export function calcIchimoku(highs, lows, closes) {
  if (closes.length < 52) return null;
  const mid = (h, l, n) => (Math.max(...h.slice(-n)) + Math.min(...l.slice(-n))) / 2;
  const tenkan = mid(highs, lows, 9);
  const kijun = mid(highs, lows, 26);
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = mid(highs, lows, 52);
  const price = closes[closes.length - 1];
  const cloudTop = Math.max(senkouA, senkouB);
  const cloudBot = Math.min(senkouA, senkouB);
  return {
    tenkan, kijun, senkouA, senkouB,
    trend: price > cloudTop ? 'bullish' : price < cloudBot ? 'bearish' : 'neutral'
  };
}

// ── Support & Resistance ─────────────────────────────────────────────────────
export function calcSupportResistance(highs, lows, closes, lookback = 50) {
  const rH = highs.slice(-lookback), rL = lows.slice(-lookback);
  const price = closes[closes.length - 1];
  const pivots = [];
  for (let i = 2; i < rH.length - 2; i++) {
    if (rH[i] > rH[i-1] && rH[i] > rH[i-2] && rH[i] > rH[i+1] && rH[i] > rH[i+2]) pivots.push(rH[i]);
    if (rL[i] < rL[i-1] && rL[i] < rL[i-2] && rL[i] < rL[i+1] && rL[i] < rL[i+2]) pivots.push(rL[i]);
  }
  const below = pivots.filter(p => p < price).sort((a, b) => b - a);
  const above = pivots.filter(p => p > price).sort((a, b) => a - b);
  return {
    support: below[0] ?? Math.min(...rL),
    support2: below[1] ?? null,
    resistance: above[0] ?? Math.max(...rH),
    resistance2: above[1] ?? null,
  };
}
