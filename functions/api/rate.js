const H={'Access-Control-Allow-Origin':'*','Content-Type':'application/json','Cache-Control':'public,max-age=300'};
const j=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});

export async function onRequest(ctx){
  if(ctx.request.method==='OPTIONS')return new Response(null,{status:204,headers:H});
  try{
    const r=await fetch('https://api.tgju.org/v1/market/indicator/summary-table-data/price_aed',
      {headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});
    if(!r.ok)throw new Error('tgju '+r.status);
    const d=await r.json();
    let rate=null;
    const row=d?.data?.data?.[0];
    if(row?.p)rate=parseFloat(String(row.p).replace(/,/g,''));
    else if(row?.price)rate=parseFloat(String(row.price).replace(/,/g,''));
    if(!rate||isNaN(rate))throw new Error('parse failed');
    return j({ok:true,rate,ts:Date.now()});
  }catch(e){
    return j({ok:false,rate:null,error:e.message,ts:Date.now()});
  }
}
