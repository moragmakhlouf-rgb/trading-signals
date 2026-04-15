// app.js — Main application logic

import {
  calcRSI, calcMACD, calcBollingerBands,
  calcEMA, calcSMA, calcStochastic,
  calcATR, calcADX, calcWilliamsR,
  calcCCI, calcOBV, calcMFI,
  calcParabolicSAR, calcROC, calcCMF,
  calcIchimoku, calcVWAP, calcSupportResistance,
  emaArray
} from './indicators.js';

import {
  generateSignals, calcSLTP, calcPositionSize, pearsonCorr, getHedge
} from './signals.js';

const CORR_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'GLD', 'USO', 'BTC-USD', '^VIX'];

// ── State ─────────────────────────────────────────────────────────────────────
let chart = null, candleSeries = null, ema50Series = null, ema200Series = null;
let lastResult = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const symbolInput  = document.getElementById('symbolInput');
const analyzeBtn   = document.getElementById('analyzeBtn');
const loadingEl    = document.getElementById('loading');
const errorEl      = document.getElementById('errorMsg');
const dashboard    = document.getElementById('dashboard');
const accountInput = document.getElementById('accountSize');
const riskInput    = document.getElementById('riskPct');

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchQuote(symbol, range = '6mo', interval = '1d') {
  const res = await fetch(
    `/api/quote?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`
  );
  if (!res.ok) throw new Error(`Could not fetch data for "${symbol}" (${res.status})`);
  const json = await res.json();
  if (json.chart?.error) throw new Error(json.chart.error.description ?? 'Symbol not found');
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No data returned for "${symbol}"`);

  const { timestamp, indicators, meta } = result;
  const q = indicators.quote[0];
  const raw = timestamp
    .map((t, i) => ({ t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] ?? 0 }))
    .filter(d => d.c != null && d.h != null && d.l != null && d.o != null);

  return {
    meta,
    symbol,
    timestamps: raw.map(d => d.t),
    opens:      raw.map(d => d.o),
    highs:      raw.map(d => d.h),
    lows:       raw.map(d => d.l),
    closes:     raw.map(d => d.c),
    volumes:    raw.map(d => d.v),
  };
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function initChart() {
  const container = document.getElementById('chartContainer');
  container.innerHTML = '';
  chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 340,
    layout: { background: { color: '#ffffff' }, textColor: '#1e293b' },
    grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#e2e8f0' },
    timeScale: { borderColor: '#e2e8f0', timeVisible: true },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: '#16a34a', downColor: '#dc2626',
    borderUpColor: '#16a34a', borderDownColor: '#dc2626',
    wickUpColor: '#16a34a', wickDownColor: '#dc2626',
  });
  ema50Series  = chart.addLineSeries({ color: '#2563eb', lineWidth: 1, title: 'EMA50', priceLineVisible: false });
  ema200Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'EMA200', priceLineVisible: false });

  new ResizeObserver(() => {
    if (chart) chart.applyOptions({ width: container.clientWidth });
  }).observe(container);
}

function updateChart(data) {
  const candles = data.timestamps.map((t, i) => ({
    time: t, open: data.opens[i], high: data.highs[i], low: data.lows[i], close: data.closes[i]
  }));
  candleSeries.setData(candles);

  const e50  = emaArray(data.closes, 50);
  const e200 = emaArray(data.closes, 200);
  ema50Series.setData(
    data.timestamps.map((t, i) => ({ time: t, value: e50[i] })).filter(d => d.value != null)
  );
  ema200Series.setData(
    data.timestamps.map((t, i) => ({ time: t, value: e200[i] })).filter(d => d.value != null)
  );
}

// ── Analysis ──────────────────────────────────────────────────────────────────
async function analyze() {
  const symbol = symbolInput.value.trim().toUpperCase();
  if (!symbol) return;

  setLoading(true);
  clearError();

  try {
    const data = await fetchQuote(symbol);
    const { highs, lows, closes, volumes } = data;

    const ind = {
      rsi:      calcRSI(closes),
      macd:     calcMACD(closes),
      bb:       calcBollingerBands(closes),
      ema9:     calcEMA(closes, 9),
      ema21:    calcEMA(closes, 21),
      ema50:    calcEMA(closes, 50),
      ema200:   calcEMA(closes, 200),
      sma50:    calcSMA(closes, 50),
      sma200:   calcSMA(closes, 200),
      stoch:    calcStochastic(highs, lows, closes),
      atr:      calcATR(highs, lows, closes),
      adx:      calcADX(highs, lows, closes),
      willR:    calcWilliamsR(highs, lows, closes),
      cci:      calcCCI(highs, lows, closes),
      obv:      calcOBV(closes, volumes),
      mfi:      calcMFI(highs, lows, closes, volumes),
      psar:     calcParabolicSAR(highs, lows),
      roc:      calcROC(closes),
      cmf:      calcCMF(highs, lows, closes, volumes),
      ichimoku: calcIchimoku(highs, lows, closes),
      vwap:     calcVWAP(highs, lows, closes, volumes),
      sr:       calcSupportResistance(highs, lows, closes),
    };

    const price = closes[closes.length - 1];
    const { rows, overallSignal, confidence, buys, sells, neutrals } = generateSignals(ind, price);
    const sltp = ind.atr ? calcSLTP(price, overallSignal, ind.atr, ind.sr) : null;

    const corrData = await fetchCorrelations(closes, '3mo');

    lastResult = { data, ind, price, rows, overallSignal, confidence, buys, sells, neutrals, sltp, corrData, symbol };

    initChart();
    updateChart(data);
    renderMeta(data.meta, symbol);
    renderSignalCard(overallSignal, confidence, buys, sells, neutrals, price, data.meta);
    renderIndicatorTable(rows);
    renderSLTP(sltp, price);
    renderPositionSizing();
    renderCorrelation(corrData);
    renderHedge(overallSignal, corrData, sltp, price, symbol);

    dashboard.classList.remove('hidden');
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

async function fetchCorrelations(targetCloses, range) {
  const results = {};
  const days = range === '3mo' ? 63 : range === '2mo' ? 42 : 21;

  await Promise.allSettled(
    CORR_SYMBOLS.map(async sym => {
      try {
        const d = await fetchQuote(sym, range, '1d');
        results[sym] = pearsonCorr(targetCloses.slice(-days), d.closes.slice(-days));
      } catch {
        results[sym] = NaN;
      }
    })
  );
  return results;
}

// ── Render helpers ────────────────────────────────────────────────────────────
function renderMeta(meta, symbol) {
  document.getElementById('tickerName').textContent   = meta.longName ?? '';
  document.getElementById('tickerSymbol').textContent = symbol;
  document.getElementById('exchangeName').textContent = meta.exchangeName ?? '';
  document.getElementById('currency').textContent     = meta.currency ?? '';
}

function renderSignalCard(signal, confidence, buys, sells, neutrals, price, meta) {
  const colorCls = { BUY: 'signal-buy', SELL: 'signal-sell', NEUTRAL: 'signal-neutral' };
  document.getElementById('signalCard').className = 'signal-card ' + colorCls[signal];
  document.getElementById('signalLabel').textContent     = signal;
  document.getElementById('confidenceValue').textContent = confidence + '%';
  document.getElementById('buyCount').textContent        = buys;
  document.getElementById('sellCount').textContent       = sells;
  document.getElementById('neutralCount').textContent    = neutrals;
  document.getElementById('currentPrice').textContent    = fmt(price);

  const prev = meta.chartPreviousClose ?? meta.regularMarketPreviousClose;
  if (prev) {
    const pct = (price - prev) / prev * 100;
    const chEl = document.getElementById('priceChange');
    chEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
    chEl.className   = pct >= 0 ? 'change-up' : 'change-down';
  }

  const barCls = { BUY: 'bar-buy', SELL: 'bar-sell', NEUTRAL: 'bar-neutral' };
  const bar = document.getElementById('confBar');
  bar.style.width = confidence + '%';
  bar.className   = 'conf-fill ' + barCls[signal];
}

function renderIndicatorTable(rows) {
  document.getElementById('indicatorBody').innerHTML = rows.map(r => `
    <tr>
      <td>${r.name}</td>
      <td><span class="badge badge-${r.signal.toLowerCase()}">${r.signal}</span></td>
      <td class="mono">${r.value}</td>
      <td class="muted">${r.detail}</td>
    </tr>
  `).join('');
}

function renderSLTP(sltp, price) {
  const panel = document.getElementById('sltpPanel');
  if (!sltp) {
    panel.querySelector('.sltp-grid').innerHTML = '<p class="muted" style="padding:16px 0">ATR data unavailable for SL/TP calculation.</p>';
    return;
  }
  document.getElementById('entryPrice').textContent = fmt(price);
  document.getElementById('slPrice').textContent    = fmt(sltp.sl);
  document.getElementById('tp1Price').textContent   = fmt(sltp.tp1);
  document.getElementById('tp2Price').textContent   = fmt(sltp.tp2);
  document.getElementById('tp3Price').textContent   = fmt(sltp.tp3);
  document.getElementById('riskUnit').textContent   = fmt(sltp.riskPerUnit);
  document.getElementById('slPct').textContent      = ((sltp.riskPerUnit / price) * 100).toFixed(2) + '%';
  document.getElementById('rr1').textContent        = sltp.rr1 + ':1';
  document.getElementById('rr2').textContent        = sltp.rr2 + ':1';
}

function renderPositionSizing() {
  if (!lastResult?.sltp) return;
  const acct = parseFloat(accountInput.value) || 10000;
  const risk = parseFloat(riskInput.value) || 1;
  const ps = calcPositionSize(acct, risk, lastResult.price, lastResult.sltp.sl);
  if (!ps) return;
  document.getElementById('psRiskAmt').textContent     = '$' + ps.riskAmount;
  document.getElementById('psRiskPerUnit').textContent = ps.riskPerUnit;
  document.getElementById('psUnits').textContent       = ps.units;
  document.getElementById('psNotional').textContent    = '$' + ps.notional;
  document.getElementById('psAcctPct').textContent     = ps.accountPercent + '%';
  document.getElementById('psKelly').textContent       = ps.kellyPct + '%';
}

function renderCorrelation(corrData) {
  document.getElementById('corrBody').innerHTML = Object.entries(corrData).map(([sym, corr]) => {
    if (isNaN(corr)) return `<tr><td class="mono">${sym}</td><td class="muted">N/A</td><td></td><td class="muted">No data</td></tr>`;
    const cls   = corr > 0.3 ? 'corr-pos' : corr < -0.3 ? 'corr-neg' : 'corr-neu';
    const label = corr > 0.7 ? 'Strong +' : corr > 0.3 ? 'Moderate +' : corr < -0.7 ? 'Strong −' : corr < -0.3 ? 'Moderate −' : 'Weak';
    const fillW = Math.abs(corr) * 50;
    const fillL = corr >= 0 ? 50 : 50 - fillW;
    const bar   = `<div class="corr-bar-bg" style="position:relative;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
      <div style="position:absolute;left:${fillL}%;width:${fillW}%;height:100%;background:${corr >= 0 ? 'var(--green)' : 'var(--red)'};border-radius:3px"></div>
    </div>`;
    return `<tr><td class="mono">${sym}</td><td class="${cls} mono bold">${corr.toFixed(3)}</td><td style="min-width:100px">${bar}</td><td class="muted">${label}</td></tr>`;
  }).join('');
}

function renderHedge(signal, corrData, sltp, price, symbol) {
  const el = document.getElementById('hedgeContent');
  if (!sltp) { el.innerHTML = '<p class="muted">SL/TP required for hedge sizing.</p>'; return; }

  const ps = calcPositionSize(
    parseFloat(accountInput.value) || 10000,
    parseFloat(riskInput.value) || 1,
    price, sltp.sl
  );
  const hedge = getHedge(symbol, corrData, signal, ps?.units ?? 1, price);
  if (!hedge) { el.innerHTML = '<p class="muted">Insufficient correlation data for hedge suggestion.</p>'; return; }

  el.innerHTML = `
    <div class="hedge-grid">
      <div class="hedge-item">
        <span class="hedge-label">Most Correlated</span>
        <span class="hedge-val mono">${hedge.index}</span>
      </div>
      <div class="hedge-item">
        <span class="hedge-label">Pearson r</span>
        <span class="hedge-val mono ${parseFloat(hedge.corr) > 0 ? 'corr-pos' : 'corr-neg'}">${hedge.corr}</span>
      </div>
      <div class="hedge-item">
        <span class="hedge-label">Suggested Futures</span>
        <span class="hedge-val">${hedge.futures}</span>
      </div>
      <div class="hedge-item">
        <span class="hedge-label">Hedge Direction</span>
        <span class="badge badge-${hedge.hedgeDirection === 'LONG' ? 'buy' : 'sell'}">${hedge.hedgeDirection}</span>
      </div>
      <div class="hedge-item">
        <span class="hedge-label">Hedge Ratio</span>
        <span class="hedge-val mono">${hedge.hedgeRatio}</span>
      </div>
      <div class="hedge-item">
        <span class="hedge-label">Hedge Units</span>
        <span class="hedge-val mono">${hedge.hedgeUnits}</span>
      </div>
      <div class="hedge-item">
        <span class="hedge-label">Hedge Notional</span>
        <span class="hedge-val mono">$${parseFloat(hedge.hedgeNotional).toLocaleString()}</span>
      </div>
      <div class="hedge-item">
        <span class="hedge-label">Options Hedge</span>
        <span class="hedge-val muted">${signal === 'BUY' ? 'Protective Put near SL' : 'Covered Call near SL'}</span>
      </div>
    </div>
    <p class="disclaimer">* For reference only. Verify contract specs before trading.</p>
  `;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null || isNaN(n)) return 'N/A';
  if (Math.abs(n) < 0.001) return n.toFixed(6);
  if (Math.abs(n) < 1)     return n.toFixed(4);
  return n.toFixed(2);
}

function setLoading(v) {
  loadingEl.classList.toggle('hidden', !v);
  analyzeBtn.disabled    = v;
  analyzeBtn.textContent = v ? 'Analyzing…' : 'Analyze';
}
function clearError() { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
function showError(msg) { errorEl.textContent = '⚠ ' + msg; errorEl.classList.remove('hidden'); }

// ── Event listeners ───────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', analyze);
symbolInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyze(); });

accountInput.addEventListener('input', () => {
  if (lastResult) { renderPositionSizing(); renderHedge(lastResult.overallSignal, lastResult.corrData, lastResult.sltp, lastResult.price, lastResult.symbol); }
});
riskInput.addEventListener('input', () => {
  if (lastResult) { renderPositionSizing(); renderHedge(lastResult.overallSignal, lastResult.corrData, lastResult.sltp, lastResult.price, lastResult.symbol); }
});

document.querySelectorAll('input[name="corrRange"]').forEach(r => r.addEventListener('change', async () => {
  if (!lastResult) return;
  setLoading(true);
  try {
    const range = document.querySelector('input[name="corrRange"]:checked').value;
    const corrData = await fetchCorrelations(lastResult.data.closes, range);
    lastResult.corrData = corrData;
    renderCorrelation(corrData);
    renderHedge(lastResult.overallSignal, corrData, lastResult.sltp, lastResult.price, lastResult.symbol);
  } finally {
    setLoading(false);
  }
}));
