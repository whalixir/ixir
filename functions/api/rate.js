// Cloudflare Pages Function — نرخ درهم از TGJU
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const resp = (d) => new Response(JSON.stringify(d), {headers: CORS});

function extractRate(text) {
  // پیدا کردن اعداد بین 30000 تا 100000 (محدوده واقعی نرخ درهم به تومان در بازار ایران)
  const nums = [...text.matchAll(/[\d,،]+/g)]
    .map(m => parseFloat(m[0].replace(/[,،\s]/g, '')))
    .filter(n => n >= 30000 && n <= 100000);
  return nums[0] || null;
}

export async function onRequest({request}) {
  if (request.method === 'OPTIONS')
    return new Response(null, {status:204, headers: CORS});

  const hdrs = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'fa-IR,fa;q=0.9',
    'Referer': 'https://tgju.org/',
    'Origin': 'https://tgju.org',
  };

  const debug = [];

  // ══ ۱. TGJU API اصلی ══
  try {
    const r = await fetch(
      'https://api.tgju.org/v1/market/indicator/summary-table-data/price_aed',
      {headers: hdrs}
    );
    debug.push('api1: '+r.status);
    if (r.ok) {
      const txt = await r.text();
      debug.push('api1-body: '+txt.slice(0,200));
      const d = JSON.parse(txt);
      const rows = d?.data?.data || [];
      for (const row of rows) {
        for (const k of ['p','price','close','last','high','low','open','value','today']) {
          const n = parseFloat(String(row[k]||'').replace(/[,،]/g,''));
          if (n >= 30000 && n <= 100000)
            return resp({ok:true, rate:n, source:'tgju-api-'+k, ts:Date.now()});
        }
      }
      // اگر هیچ فیلدی نبود، کل text را parse کن
      const rate = extractRate(txt);
      if (rate) return resp({ok:true, rate, source:'tgju-api-parse', ts:Date.now()});
    }
  } catch(e) { debug.push('api1-err: '+e.message); }

  // ══ ۲. TGJU صفحه currency ══
  try {
    const r = await fetch('https://www.tgju.org/currency', {headers: hdrs});
    debug.push('html1: '+r.status);
    if (r.ok) {
      const txt = await r.text();
      // جستجو برای price_aed در JSON داخل HTML
      const jsonMatch = txt.match(/price_aed['":\s]*\{([^}]+)\}/);
      if (jsonMatch) {
        const rate = extractRate(jsonMatch[1]);
        if (rate) return resp({ok:true, rate, source:'tgju-html-json', ts:Date.now()});
      }
      // جستجو با regex
      const patterns = [
        /price_aed[^<]{0,300}?([\d,]{5,7})/,
        /درهم امارات[^<]{0,200}?([\d,]{5,7})/,
        /"p":"([\d,]{5,7})"/,
        /"price":"([\d,]{5,7})"/,
      ];
      for (const p of patterns) {
        const m = txt.match(p);
        if (m) {
          const n = parseFloat(m[1].replace(/,/g,''));
          if (n >= 30000 && n <= 100000)
            return resp({ok:true, rate:n, source:'tgju-html-re', ts:Date.now()});
        }
      }
    }
  } catch(e) { debug.push('html1-err: '+e.message); }

  // ══ ۳. TGJU entry page ══
  try {
    const r = await fetch('https://tgju.org/entry/price_aed', {headers: hdrs});
    debug.push('entry: '+r.status);
    if (r.ok) {
      const txt = await r.text();
      const rate = extractRate(txt);
      if (rate) return resp({ok:true, rate, source:'tgju-entry', ts:Date.now()});
    }
  } catch(e) { debug.push('entry-err: '+e.message); }

  // ══ ۴. TGJU live data API ══
  try {
    const r = await fetch(
      'https://api.tgju.org/v1/market/live-data/price_aed',
      {headers: hdrs}
    );
    debug.push('live: '+r.status);
    if (r.ok) {
      const txt = await r.text();
      debug.push('live-body: '+txt.slice(0,200));
      const rate = extractRate(txt);
      if (rate) return resp({ok:true, rate, source:'tgju-live', ts:Date.now()});
    }
  } catch(e) { debug.push('live-err: '+e.message); }

  return resp({ok:false, rate:null, debug, ts:Date.now()});
}
