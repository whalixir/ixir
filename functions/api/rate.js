const H={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET,OPTIONS',
  'Content-Type':'application/json',
  'Cache-Control':'public,max-age=180',
};
const j=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});

export async function onRequest(ctx){
  if(ctx.request.method==='OPTIONS')return new Response(null,{status:204,headers:H});
  
  // چند URL مختلف از TGJU امتحان می‌کنیم
  const urls=[
    'https://api.tgju.org/v1/market/indicator/summary-table-data/price_aed',
    'https://api.tgju.org/v1/market/summary/price_aed',
    'https://api.tgju.org/v1/market/indicator/price_aed',
  ];
  
  for(const url of urls){
    try{
      const r=await fetch(url,{
        headers:{'User-Agent':'Mozilla/5.0 (compatible)','Accept':'application/json','Referer':'https://tgju.org/'},
        cf:{cacheTtl:180},
      });
      if(!r.ok)continue;
      const d=await r.json();
      
      // تلاش برای خواندن قیمت از ساختارهای مختلف
      let rate=null;
      
      // ساختار اول
      if(d?.data?.data?.[0]){
        const row=d.data.data[0];
        rate=parseFloat(String(row.p||row.price||row.value||'').replace(/,/g,''))||null;
      }
      // ساختار دوم  
      if(!rate&&d?.data?.price)
        rate=parseFloat(String(d.data.price).replace(/,/g,''))||null;
      // ساختار سوم
      if(!rate&&d?.price)
        rate=parseFloat(String(d.price).replace(/,/g,''))||null;
      // ساختار چهارم - اگر عدد مستقیم داشت
      if(!rate&&d?.data?.last)
        rate=parseFloat(String(d.data.last).replace(/,/g,''))||null;
        
      if(rate&&rate>1000){ // قیمت درهم باید بیشتر از ۱۰۰۰ تومان باشه
        return j({ok:true,rate,source:'tgju',ts:Date.now()});
      }
    }catch(e){continue;}
  }
  
  // اگر همه URLها کار نکردن، یک fallback معقول برمیگردونیم
  // قیمت تقریبی درهم به تومان (کاربر باید دستی آپدیت کنه)
  return j({ok:false,rate:null,error:'TGJU در دسترس نیست',ts:Date.now()},200);
}
