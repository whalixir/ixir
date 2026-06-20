// Cloudflare Pages Function — نرخ درهم از TGJU (نسخه پایدارشده)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const resp = (d) => new Response(JSON.stringify(d), {headers: CORS});

// کش در حافظه سراسری Worker — بین درخواست‌های نزدیک به هم حفظ می‌شود
// و فشار درخواست به TGJU را کم می‌کند (که خودش از علل بلاک شدن است)
if (!globalThis.__rateCache) {
  globalThis.__rateCache = {rate: null, ts: 0, source: null};
}
const CACHE_TTL_MS = 25 * 1000; // ۲۵ ثانیه — هماهنگ با ریلود خود TGJU

function extractRate(text) {
  const nums = [...text.matchAll(/[\d,،]+/g)]
    .map(m => parseFloat(m[0].replace(/[,،\s]/g, '')))
    .filter(n => n >= 30000 && n <= 100000);
  return nums[0] || null;
}

// چند ست هدر مختلف — اگر یکی بلاک شد، بعدی را امتحان می‌کنیم
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

export async function onRequest({request}) {
  if (request.method === 'OPTIONS')
    return new Response(null, {status: 204, headers: CORS});

  const debug = [];
  const cache = globalThis.__rateCache;
  const now = Date.now();

  // ── منابع را با چند ست هدر مختلف امتحان کن ──
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
              if (n >= 30000 && n <= 100000) {
                globalThis.__rateCache = {rate: n, ts: now, source: `${src.label}-${k}`};
                return resp({ok: true, rate: n, source: `${src.label}-${k}`, ts: now, fresh: true});
              }
            }
          }
        } catch (e) { debug.push(`${src.label}-parse-err: ${e.message}`); }
      }

      // در هر صورت یک تلاش با regex عمومی هم بکن (برای HTML یا fallback JSON)
      const jsonMatch = txt.match(/price_aed['":\s]*\{([^}]+)\}/);
      if (jsonMatch) {
        const rate = extractRate(jsonMatch[1]);
        if (rate) {
          globalThis.__rateCache = {rate, ts: now, source: `${src.label}-json`};
          return resp({ok: true, rate, source: `${src.label}-json`, ts: now, fresh: true});
        }
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
          if (n >= 30000 && n <= 100000) {
            globalThis.__rateCache = {rate: n, ts: now, source: `${src.label}-re`};
            return resp({ok: true, rate: n, source: `${src.label}-re`, ts: now, fresh: true});
          }
        }
      }
    }
  }

  // ── همه تلاش‌ها ناموفق بود — اگر کش معتبر (کمتر از ۱۰ دقیقه) داریم، همان را برگردان ──
  if (cache.rate && (now - cache.ts) < 10 * 60 * 1000) {
    return resp({
      ok: true,
      rate: cache.rate,
      source: cache.source + '-cached',
      ts: cache.ts,
      fresh: false,
      cacheAgeSec: Math.round((now - cache.ts) / 1000),
      debug,
    });
  }

  // ── هیچ داده‌ای، حتی کش قدیمی هم نداریم ──
  return resp({ok: false, rate: null, debug, ts: now});
}
