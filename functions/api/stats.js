const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};
const j=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});

export async function onRequest(ctx){
  const{request:req,env}=ctx;
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:H});
  if(!env.DB)return j({ok:false,error:'DB not bound'},500);
  const db=env.DB;
  try{
    const url=new URL(req.url);
    const period=url.searchParams.get('period')||'month';
    const now=Date.now();
    let from=0;
    if(period==='today'){const d=new Date();d.setHours(0,0,0,0);from=d.getTime();}
    else if(period==='week')from=now-7*86400000;
    else if(period==='month')from=now-30*86400000;
    const sm=await db.prepare('SELECT COALESCE(SUM(total),0) income,COALESCE(SUM(cost),0) cost,COALESCE(SUM(profit),0) profit,COUNT(*) cnt FROM sales WHERE created_at>=?').bind(from).first();
    const{results:tops}=await db.prepare('SELECT si.name,SUM(si.qty) total_qty,SUM(si.final_price) revenue FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.created_at>=? GROUP BY si.product_id,si.name ORDER BY total_qty DESC LIMIT 5').bind(from).all();
    // weekly chart — 7 days
    const days=[];
    for(let i=6;i>=0;i--){
      const d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);
      const df=d.getTime(),dt=df+86400000;
      const r=await db.prepare('SELECT COALESCE(SUM(total),0) income,COALESCE(SUM(profit),0) profit FROM sales WHERE created_at>=? AND created_at<?').bind(df,dt).first();
      days.push({label:`${d.getMonth()+1}/${d.getDate()}`,income:r?.income||0,profit:r?.profit||0});
    }
    const inv=await db.prepare('SELECT COUNT(*) total,COALESCE(SUM(qty),0) total_qty,COUNT(CASE WHEN qty>0 AND qty<=3 THEN 1 END) low_stock FROM products').first();
    return j({ok:true,data:{income:sm?.income||0,cost:sm?.cost||0,profit:sm?.profit||0,count:sm?.cnt||0,tops:tops||[],days,inv:inv||{total:0,total_qty:0,low_stock:0}}});
  }catch(e){return j({ok:false,error:e.message},500);}
}
