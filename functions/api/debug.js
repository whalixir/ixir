// /api/debug — برای تست نرخ
export async function onRequest(ctx) {
  const r = await fetch('https://api.tgju.org/v1/market/indicator/summary-table-data/price_aed', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      'Accept': 'application/json',
      'Referer': 'https://tgju.org/',
    }
  });
  const body = await r.text();
  return new Response(JSON.stringify({
    status: r.status,
    ok: r.ok,
    body_sample: body.slice(0, 500),
    headers: Object.fromEntries(r.headers),
  }), {
    headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}
  });
}
