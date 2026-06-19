// Cloudflare Pages Function - نرخ درهم از TGJU
const H = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json',
};
const j = (d, s=200) => new Response(JSON.stringify(d), {status:s, headers:H});

function parseRate(text) {
  // پیدا کردن عدد بین 10000 تا 200000 (محدوده منطقی نرخ درهم به تومان)
  const matches = text.match(/[\d,،]+/g) || [];
  for (const m of matches) {
    const n = parseFloat(m.replace(/[,،]/g, ''));
    if (n >= 10000 && n <= 200000) return n;
  }
  return null;
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'OPTIONS')
    return new Response(null, {status:204, headers:H});

  const errors = [];

  // ── روش ۱: TGJU API رسمی ──
  try {
    const r = await fetch(
      'https://api.tgju.org/v1/market/indicator/summary-table-data/price_aed',
      { headers: {'User-Agent':'Mozilla/5.0','Accept':'application/json'}, signal: AbortSignal.timeout(5000) }
    );
    if (r.ok) {
      const d = await r.json();
      // بررسی همه فیلدهای ممکن
      const rows = d?.data?.data || [];
      for (const row of rows) {
        for (const key of ['p','price','value','last','close','open']) {
          const n = parseFloat(String(row[key]||'').replace(/,/g,''));
          if (n >= 10000 && n <= 200000)
            return j({ok:true, rate:n, source:'tgju-api', ts:Date.now()});
        }
      }
      // اگر داده‌های nested داشت
      const flat = d?.data?.price || d?.data?.last || d?.price;
      if (flat) {
        const n = parseFloat(String(flat).replace(/,/g,''));
        if (n >= 10000 && n <= 200000)
          return j({ok:true, rate:n, source:'tgju-api-flat', ts:Date.now()});
      }
    }
    errors.push('tgju-api: status '+r.status);
  } catch(e) { errors.push('tgju-api: '+e.message); }

  // ── روش ۲: صفحه وب TGJU ──
  try {
    const r = await fetch('https://www.tgju.org/currency/price_aed', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fa-IR,fa;q=0.9',
      },
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) {
      const html = await r.text();
      // پیدا کردن قیمت در HTML
      // TGJU معمولاً قیمت را در data-price یا class="price" قرار می‌دهد
      const patterns = [
        /data-price="([\d,]+)"/,
        /class="[^"]*price[^"]*"[^>]*>([\d,\s]+)</,
        /"last":"([\d,]+)"/,
        /"price":"([\d,]+)"/,
        /price_aed[^>]*>([\d,]+)/,
      ];
      for (const pat of patterns) {
        const m = html.match(pat);
        if (m) {
          const n = parseFloat(m[1].replace(/[,\s]/g,''));
          if (n >= 10000 && n <= 200000)
            return j({ok:true, rate:n, source:'tgju-html', ts:Date.now()});
        }
      }
      // جستجوی عمومی‌تر
      const rate = parseRate(html.slice(0, 50000)); // فقط ابتدای صفحه
      if (rate) return j({ok:true, rate, source:'tgju-html-parse', ts:Date.now()});
      errors.push('tgju-html: could not parse rate');
    }
  } catch(e) { errors.push('tgju-html: '+e.message); }

  // ── روش ۳: endpoint دیگر TGJU ──
  try {
    const r = await fetch('https://api.tgju.org/v1/market/currency/price_aed', {
      headers: {'User-Agent':'Mozilla/5.0','Accept':'application/json'},
      signal: AbortSignal.timeout(5000)
    });
    if (r.ok) {
      const text = await r.text();
      const rate = parseRate(text);
      if (rate) return j({ok:true, rate, source:'tgju-currency', ts:Date.now()});
    }
  } catch(e) { errors.push('tgju-currency: '+e.message); }

  // ── روش ۴: navasan.com به عنوان backup ──
  try {
    const r = await fetch('https://navasan.tech/api/?api_key=free&item=aed&type=buy', {
      headers: {'Accept':'application/json'},
      signal: AbortSignal.timeout(5000)
    });
    if (r.ok) {
      const d = await r.json();
      const n = parseFloat(String(d?.value||d?.price||'').replace(/,/g,''));
      if (n >= 10000 && n <= 200000)
        return j({ok:true, rate:n, source:'navasan', ts:Date.now()});
    }
  } catch(e) { errors.push('navasan: '+e.message); }

  return j({ok:false, rate:null, errors, ts:Date.now()});
}
