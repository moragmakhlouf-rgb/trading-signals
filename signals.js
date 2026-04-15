// signals.js — Signal aggregation, SL/TP, position sizing, correlation

export function generateSignals(ind, price) {
  const rows = [];
  const add = (name, sig, value, detail) => rows.push({ name, signal: sig, value, detail });

  // 1. RSI
  if (ind.rsi != null) {
    const s = ind.rsi < 30 ? 'BUY' : ind.rsi > 70 ? 'SELL' : 'NEUTRAL';
    add('RSI (14)', s, ind.rsi.toFixed(1), s === 'BUY' ? 'Oversold' : s === 'SELL' ? 'Overbought' : 'Neutral zone');
  }

  // 2. MACD
  if (ind.macd.histogram != null) {
    const s = ind.macd.histogram > 0 && ind.macd.macd > 0 ? 'BUY' :
              ind.macd.histogram < 0 && ind.macd.macd < 0 ? 'SELL' : 'NEUTRAL';
    add('MACD (12,26,9)', s, ind.macd.histogram.toFixed(4), ind.macd.histogram > 0 ? 'Bullish crossover' : 'Bearish crossover');
  }

  // 3. Bollinger Bands
  if (ind.bb) {
    const s = price <= ind.bb.lower ? 'BUY' : price >= ind.bb.upper ? 'SELL' : 'NEUTRAL';
    add('Bollinger Bands', s, `BW ${ind.bb.bandwidth.toFixed(1)}%`, s === 'BUY' ? 'At lower band' : s === 'SELL' ? 'At upper band' : 'Within bands');
  }

  // 4-7. EMAs
  const emas = [[ind.ema9, 9], [ind.ema21, 21], [ind.ema50, 50], [ind.ema200, 200]];
  for (const [val, p] of emas) {
    if (val != null) {
      const s = price > val ? 'BUY' : 'SELL';
      add(`EMA ${p}`, s, val.toFixed(4), `Price ${price > val ? 'above' : 'below'} EMA${p}`);
    }
  }

  // 8-9. SMAs + Golden/Death Cross
  if (ind.sma50 != null) {
    add('SMA 50', price > ind.sma50 ? 'BUY' : 'SELL', ind.sma50.toFixed(4), price > ind.sma50 ? 'Above SMA50' : 'Below SMA50');
  }
  if (ind.sma50 != null && ind.sma200 != null) {
    const s = ind.sma50 > ind.sma200 ? 'BUY' : 'SELL';
    add('SMA 50/200 Cross', s, (ind.sma50 - ind.sma200).toFixed(4), s === 'BUY' ? 'Golden Cross' : 'Death Cross');
  }

  // 10. Stochastic
  if (ind.stoch?.k != null) {
    const s = ind.stoch.k < 20 && ind.stoch.d < 20 ? 'BUY' : ind.stoch.k > 80 && ind.stoch.d > 80 ? 'SELL' : 'NEUTRAL';
    add('Stochastic (14,3)', s, `K:${ind.stoch.k.toFixed(1)} D:${ind.stoch.d.toFixed(1)}`, s === 'BUY' ? 'Oversold' : s === 'SELL' ? 'Overbought' : 'Neutral');
  }

  // 11. ATR — volatility context
  if (ind.atr != null) {
    const pct = (ind.atr / price) * 100;
    add('ATR (14)', 'NEUTRAL', `${ind.atr.toFixed(4)} (${pct.toFixed(1)}%)`, pct > 3 ? 'High volatility' : 'Normal volatility');
  }

  // 12. ADX
  if (ind.adx) {
    const s = ind.adx.adx > 25 ? (ind.adx.plusDI > ind.adx.minusDI ? 'BUY' : 'SELL') : 'NEUTRAL';
    add('ADX (14)', s, ind.adx.adx.toFixed(1), ind.adx.adx > 50 ? 'Very strong trend' : ind.adx.adx > 25 ? 'Strong trend' : 'Weak/no trend');
  }

  // 13. Williams %R
  if (ind.willR != null) {
    const s = ind.willR < -80 ? 'BUY' : ind.willR > -20 ? 'SELL' : 'NEUTRAL';
    add('Williams %R (14)', s, ind.willR.toFixed(1), s === 'BUY' ? 'Oversold' : s === 'SELL' ? 'Overbought' : 'Neutral');
  }

  // 14. CCI
  if (ind.cci != null) {
    const s = ind.cci < -100 ? 'BUY' : ind.cci > 100 ? 'SELL' : 'NEUTRAL';
    add('CCI (20)', s, ind.cci.toFixed(1), s === 'BUY' ? 'Oversold' : s === 'SELL' ? 'Overbought' : 'Neutral');
  }

  // 15. OBV
  if (ind.obv) {
    const s = ind.obv.trend === 'rising' ? 'BUY' : ind.obv.trend === 'falling' ? 'SELL' : 'NEUTRAL';
    add('OBV', s, ind.obv.trend, s === 'BUY' ? 'Volume confirms uptrend' : s === 'SELL' ? 'Volume confirms downtrend' : 'No volume trend');
  }

  // 16. MFI
  if (ind.mfi != null) {
    const s = ind.mfi < 20 ? 'BUY' : ind.mfi > 80 ? 'SELL' : 'NEUTRAL';
    add('MFI (14)', s, ind.mfi.toFixed(1), s === 'BUY' ? 'Oversold + volume' : s === 'SELL' ? 'Overbought + volume' : 'Neutral');
  }

  // 17. Parabolic SAR
  if (ind.psar) {
    const s = ind.psar.trend === 'bullish' ? 'BUY' : 'SELL';
    add('Parabolic SAR', s, ind.psar.sar.toFixed(4), `SAR ${s === 'BUY' ? 'below' : 'above'} price`);
  }

  // 18. ROC
  if (ind.roc != null) {
    const s = ind.roc > 2 ? 'BUY' : ind.roc < -2 ? 'SELL' : 'NEUTRAL';
    add('ROC (12)', s, `${ind.roc.toFixed(2)}%`, ind.roc > 0 ? 'Positive momentum' : 'Negative momentum');
  }

  // 19. CMF
  if (ind.cmf != null) {
    const s = ind.cmf > 0.05 ? 'BUY' : ind.cmf < -0.05 ? 'SELL' : 'NEUTRAL';
    add('Chaikin MF (20)', s, ind.cmf.toFixed(4), ind.cmf > 0 ? 'Money flowing in' : 'Money flowing out');
  }

  // 20. Ichimoku
  if (ind.ichimoku) {
    const s = ind.ichimoku.trend === 'bullish' ? 'BUY' : ind.ichimoku.trend === 'bearish' ? 'SELL' : 'NEUTRAL';
    add('Ichimoku Cloud', s, ind.ichimoku.trend, s === 'BUY' ? 'Above cloud' : s === 'SELL' ? 'Below cloud' : 'Inside cloud');
  }

  const buys = rows.filter(r => r.signal === 'BUY').length;
  const sells = rows.filter(r => r.signal === 'SELL').length;
  const neutrals = rows.filter(r => r.signal === 'NEUTRAL').length;
  const total = rows.length;
  const overallSignal = buys > sells ? 'BUY' : sells > buys ? 'SELL' : 'NEUTRAL';
  const confidence = Math.round((Math.max(buys, sells) / total) * 100);

  return { rows, overallSignal, confidence, buys, sells, neutrals };
}

export function calcSLTP(price, signal, atr, sr) {
  const isLong = signal === 'BUY';
  const sl = isLong
    ? Math.min(price - atr * 1.5, sr.support ? sr.support * 0.998 : price - atr * 1.5)
    : Math.max(price + atr * 1.5, sr.resistance ? sr.resistance * 1.002 : price + atr * 1.5);

  const risk = Math.abs(price - sl);

  const tp1 = isLong ? price + risk * 1.5 : price - risk * 1.5;
  const tp2 = isLong
    ? (sr.resistance ?? price + risk * 2.5)
    : (sr.support ?? price - risk * 2.5);
  const tp3 = isLong
    ? (sr.resistance2 ?? price + risk * 4)
    : (sr.support2 ?? price - risk * 4);

  return {
    sl, tp1, tp2, tp3, riskPerUnit: risk,
    rr1: (Math.abs(tp1 - price) / risk).toFixed(2),
    rr2: (Math.abs(tp2 - price) / risk).toFixed(2),
  };
}

export function calcPositionSize(accountSize, riskPct, entry, sl) {
  const riskAmt = accountSize * (riskPct / 100);
  const riskUnit = Math.abs(entry - sl);
  if (riskUnit === 0) return null;
  const units = riskAmt / riskUnit;
  const notional = units * entry;
  const kelly = Math.max(0, 0.55 - 0.45 / 2) * 100; // simplified Kelly
  return {
    riskAmount: riskAmt.toFixed(2),
    riskPerUnit: riskUnit.toFixed(4),
    units: units.toFixed(4),
    notional: notional.toFixed(2),
    accountPercent: ((notional / accountSize) * 100).toFixed(1),
    kellyPct: kelly.toFixed(1),
  };
}

export function pearsonCorr(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 5) return NaN;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  return num / (Math.sqrt(dx2 * dy2) || 1);
}

export function getHedge(symbol, correlations, signal, units, price) {
  const FUTURES = {
    SPY: 'ES (S&P 500 Futures)', QQQ: 'NQ (Nasdaq-100 Futures)',
    DIA: 'YM (Dow Futures)', GLD: 'GC (Gold Futures)',
    USO: 'CL (Crude Oil Futures)', 'BTC-USD': 'BTC Perpetual Futures',
  };
  const sorted = Object.entries(correlations)
    .filter(([, v]) => !isNaN(v))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (!sorted.length) return null;
  const [idx, corr] = sorted[0];
  const hedgeDir = (signal === 'BUY') === (corr > 0) ? 'SHORT' : 'LONG';
  const ratio = Math.abs(corr);
  return {
    index: idx,
    corr: corr.toFixed(3),
    futures: FUTURES[idx] ?? `${idx} Futures`,
    hedgeDirection: hedgeDir,
    hedgeRatio: ratio.toFixed(2),
    hedgeUnits: (parseFloat(units) * ratio).toFixed(4),
    hedgeNotional: (parseFloat(units) * ratio * price).toFixed(2),
  };
}
