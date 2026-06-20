// Cloudflare Pages Function — نرخ درهم از TGJU (به‌روزرسانی فقط یک‌بار در روز)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const resp = (d) => new Response(JSON.stringify(d), {headers: CORS});

// کش روزانه واقعی با Cloudflare Cache API — این کش بین instance های مختلف Worker
// و حتی بعد از خاموش‌شدن Worker هم باقی می‌ماند (برخلاف globalThis که موقتی است)
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'https://internal-cache.whalixir/rate-aed-daily';

function extractRate(text) {
  const nums = [...text.matchAll(/[\d,،]+/g)]
    .map(m => parseFloat(m[0].replace(/[,،\s]/g, '')))
    .filter(n => n >= 30000 && n <= 100000);
  return nums[0] || null;
}

const HEADER_SETS = [
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
    'Referer': 'https://www.tgju.org/',
    'Sec-Fetch-Mode': 'navigate',
  },
  {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'fa-IR,fa;q=0.9',
    'Referer': 'https://tgju.org/',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Accept': '*/*',
    'Accept-Language': 'fa-IR,fa;q=0.9',
    'Referer': 'https://www.tgju.org/profile/price_aed',
  },
];

async function tryFetch(url, headers, label, debug) {
  try {
    const r = await fetch(url, {headers, cf: {cacheTtl: 0, cacheEverything: false}});
    debug.push(`${label}: ${r.status}`);
    if (r.ok) {
      const txt = await r.text();
      return txt;
    }
  } catch (e) {
    debug.push(`${label}-err: ${e.message}`);
  }
  return null;
}

async function fetchFromTGJU(debug) {
  const sources = [
    {url: 'https://api.tgju.org/v1/market/indicator/summary-table-data/price_aed', label: 'api1', isJson: true},
    {url: 'https://www.tgju.org/profile/price_aed', label: 'profile', isJson: false},
    {url: 'https://www.tgju.org/currency', label: 'currency', isJson: false},
    {url: 'https://tgju.org/entry/price_aed', label: 'entry', isJson: false},
  ];

  for (const hdrs of HEADER_SETS) {
    for (const src of sources) {
      const txt = await tryFetch(src.url, hdrs, src.label, debug);
      if (!txt) continue;

      if (src.isJson) {
        try {
          const d = JSON.parse(txt);
          const rows = d?.data?.data || [];
          for (const row of rows) {
            for (const k of ['p', 'price', 'close', 'last', 'high', 'low', 'open', 'value', 'today']) {
              const n = parseFloat(String(row[k] || '').replace(/[,،]/g, ''));
              if (n >= 30000 && n <= 100000) return {rate: n, source: `${src.label}-${k}`};
            }
          }
        } catch (e) { debug.push(`${src.label}-parse-err: ${e.message}`); }
      }

      const jsonMatch = txt.match(/price_aed['":\s]*\{([^}]+)\}/);
      if (jsonMatch) {
        const rate = extractRate(jsonMatch[1]);
        if (rate) return {rate, source: `${src.label}-json`};
      }
      const patterns = [
        /price_aed[^<]{0,300}?([\d,]{5,7})/,
        /درهم امارات[^<]{0,200}?([\d,]{5,7})/,
        /"p":"([\d,]{5,7})"/,
        /"price":"([\d,]{5,7})"/,
        /نرخ فعلی[:\s]*\(?([\d,]{5,7})/,
      ];
      for (const p of patterns) {
        const m = txt.match(p);
        if (m) {
          const n = parseFloat(m[1].replace(/,/g, ''));
          if (n >= 30000 && n <= 100000) return {rate: n, source: `${src.label}-re`};
        }
      }
    }
  }
  return null;
}

export async function onRequest({request}) {
  if (request.method === 'OPTIONS')
    return new Response(null, {status: 204, headers: CORS});

  const debug = [];
  const now = Date.now();
  const cache = caches.default;
  const cacheReq = new Request(CACHE_KEY);

  // ── اول کش روزانه را چک کن ──
  let cached = null;
  try {
    const cachedResp = await cache.match(cacheReq);
    if (cachedResp) cached = await cachedResp.json();
  } catch (e) { debug.push('cache-read-err: ' + e.message); }

  const forceRefresh = new URL(request.url).searchParams.get('refresh') === '1';

  if (cached && cached.rate && !forceRefresh && (now - cached.ts) < DAY_MS) {
    return resp({
      ok: true,
      rate: cached.rate,
      source: cached.source + '-daily-cache',
      ts: cached.ts,
      fresh: false,
      nextUpdateInHours: Math.round((DAY_MS - (now - cached.ts)) / 3600000 * 10) / 10,
    });
  }

  // ── کش روزانه منقضی شده یا وجود ندارد — یک‌بار از TGJU بگیر ──
  const result = await fetchFromTGJU(debug);

  if (result) {
    const payload = {rate: result.rate, ts: now, source: result.source};
    try {
      const cacheResp = new Response(JSON.stringify(payload), {
        headers: {'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + Math.floor(DAY_MS / 1000)},
      });
      await cache.put(cacheReq, cacheResp);
    } catch (e) { debug.push('cache-write-err: ' + e.message); }

    return resp({ok: true, rate: result.rate, source: result.source, ts: now, fresh: true});
  }

  // ── دریافت ناموفق — اگر کش قدیمی (حتی منقضی‌شده) داریم، آن را برگردان ──
  if (cached && cached.rate) {
    return resp({
      ok: true,
      rate: cached.rate,
      source: cached.source + '-stale-cache',
      ts: cached.ts,
      fresh: false,
      cacheAgeHours: Math.round((now - cached.ts) / 3600000 * 10) / 10,
      debug,
    });
  }

  return resp({ok: false, rate: null, debug, ts: now});
}
