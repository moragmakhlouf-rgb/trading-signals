module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol, range = '6mo', interval = '1d' } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    const cookieRes = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const rawCookies = cookieRes.headers.getSetCookie?.() ?? [];
    const cookies = rawCookies.map(c => c.split(';')[0]).join('; ');

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': cookies },
    });
    const crumb = await crumbRes.text();

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&crumb=${encodeURIComponent(crumb)}`;

    const dataRes = await fetch(url, {
      headers: { 'User-Agent': UA, 'Cookie': cookies, 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com/' },
    });

    if (!dataRes.ok) throw new Error(`Yahoo Finance returned ${dataRes.status}`);

    const data = await dataRes.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

