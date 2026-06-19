// Cloudflare Pages Function — نرخ درهم به تومان
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
};

const ok  = (rate, src) => new Response(JSON.stringify({ok:true, rate, source:src, ts:Date.now()}), {headers:CORS});
const err = (msg, dbg)  => new Response(JSON.stringify({ok:false, rate:null, error:msg, debug:dbg, ts:Date.now()}), {headers:CORS});

function clean(str){ return parseFloat(String(str||'').replace(/[^0-9.]/g,'')); }
function valid(n)  { return n && n >= 5000 && n <= 500000; }

export async function onRequest({request}) {
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:CORS});

  const log = [];

  // ══ ۱. TGJU API — price_aed ══
  try {
    const r = await fetch('https://api.tgju.org/v1/market/indicator/summary-table-data/price_aed', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://tgju.org/',
        'Origin': 'https://tgju.org',
      },
    });
    log.push(`tgju-api: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const rows = d?.data?.data || [];
      for (const row of rows) {
        for (const k of ['p','price','close','last','value','high','low']) {
          const n = clean(row[k]);
          if (valid(n)) return ok(n, 'tgju-summary-'+k);
        }
      }
      // ساختار flat
      for (const k of ['price','last','close','value']) {
        const n = clean(d?.data?.[k] || d?.[k]);
        if (valid(n)) return ok(n, 'tgju-flat-'+k);
      }
      log.push('tgju-api: parsed but no valid rate, sample: '+JSON.stringify(rows[0]||{}).slice(0,100));
    }
  } catch(e) { log.push('tgju-api-ex: '+e.message); }

  // ══ ۲. TGJU صفحه اصلی + regex ══
  try {
    const r = await fetch('https://tgju.org/currency', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
      },
    });
    log.push(`tgju-html: ${r.status}`);
    if (r.ok) {
      const html = await r.text();
      // پیدا کردن نرخ درهم در HTML
      const patterns = [
        /price_aed[^}]*?"price"\s*:\s*"?([\d,]+)/,
        /price_aed[^}]*?"p"\s*:\s*"?([\d,]+)/,
        /"aed"[^}]*?"price"\s*:\s*"?([\d,]+)/,
        /درهم[^<]{0,200}([\d,]{5,9})/,
        /AED[^<]{0,100}([\d,]{5,9})/,
      ];
      for (const pat of patterns) {
        const m = html.match(pat);
        if (m) {
          const n = clean(m[1]);
          if (valid(n)) return ok(n, 'tgju-html-regex');
        }
      }
      log.push('tgju-html: no match in '+html.length+' chars');
    }
  } catch(e) { log.push('tgju-html-ex: '+e.message); }

  // ══ ۳. TGJU JSON endpoint دیگر ══
  try {
    const r = await fetch('https://api.tgju.org/v1/market/currency/price_aed/summary', {
      headers: {'User-Agent':'Mozilla/5.0','Accept':'application/json'},
    });
    log.push(`tgju-summary2: ${r.status}`);
    if (r.ok) {
      const text = await r.text();
      const nums = text.match(/\b(\d{4,6})\b/g)||[];
      for (const n of nums.map(Number)) {
        if (valid(n)) return ok(n, 'tgju-summary2-parse');
      }
    }
  } catch(e) { log.push('tgju2-ex: '+e.message); }

  // ══ ۴. Navasan (free tier) ══
  try {
    const r = await fetch('https://navasan.tech/api/?api_key=free&item=usd_sell', {
      headers: {'Accept':'application/json'},
    });
    log.push(`navasan: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      // USD rate را گرفته، AED را محاسبه می‌کنیم (1 AED ≈ 0.272 USD)
      const usd = clean(d?.value);
      if (usd > 10000) {
        const aed = Math.round(usd * 0.272);
        if (valid(aed)) return ok(aed, 'navasan-calc');
      }
    }
  } catch(e) { log.push('navasan-ex: '+e.message); }

  // ══ ۵. ExchangeRate-API (رایگان، بدون key) ══
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/AED', {
      headers: {'Accept':'application/json'},
    });
    log.push(`exchangerate: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      // IRR نرخ ریال، تقسیم بر ۱۰ = تومان
      const irr = d?.rates?.IRR;
      if (irr && irr > 50000) {
        const toman = Math.round(irr / 10);
        if (valid(toman)) return ok(toman, 'exchangerate-irr');
      }
    }
  } catch(e) { log.push('exchangerate-ex: '+e.message); }

  // ══ ۶. Fixer.io fallback ══
  try {
    const r = await fetch('https://api.fxratesapi.com/latest?currencies=IRR&base=AED', {
      headers: {'Accept':'application/json'},
    });
    log.push(`fxrates: ${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const irr = d?.rates?.IRR;
      if (irr > 50000) {
        const toman = Math.round(irr / 10);
        if (valid(toman)) return ok(toman, 'fxrates-irr');
      }
    }
  } catch(e) { log.push('fxrates-ex: '+e.message); }

  return err('همه منابع ناموفق', log);
}
