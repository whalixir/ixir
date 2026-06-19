const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};
const j=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});

export async function onRequest(ctx){
  const{request:req,env}=ctx;
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:H});
  if(!env.DB)return j({ok:false,error:'DB not bound'},500);
  const db=env.DB;
  try{
    if(req.method==='GET'){
      const url=new URL(req.url);
      const period=url.searchParams.get('period')||'all';
      const now=Date.now();
      let from=0;
      if(period==='today'){const d=new Date();d.setHours(0,0,0,0);from=d.getTime();}
      else if(period==='week')from=now-7*86400000;
      else if(period==='month')from=now-30*86400000;
      const{results:sales}=await db.prepare('SELECT * FROM sales WHERE created_at>=? ORDER BY created_at DESC').bind(from).all();
      for(const s of(sales||[])){
        const{results:items}=await db.prepare('SELECT * FROM sale_items WHERE sale_id=?').bind(s.id).all();
        s.items=(items||[]).map(i=>({productId:i.product_id,name:i.name,qty:i.qty,sellPrice:i.sell_price,buyPrice:i.buy_price,discount:i.discount||0,finalPrice:i.final_price||i.qty*i.sell_price}));
      }
      return j({ok:true,data:sales||[]});
    }
    if(req.method==='POST'){
      let b;try{b=await req.json();}catch{return j({ok:false,error:'bad json'},400);}
      const items=b.items||[];
      if(!items.length)return j({ok:false,error:'no items'},400);
      // validate stock
      for(const it of items){
        const p=await db.prepare('SELECT qty FROM products WHERE id=?').bind(it.productId).first();
        if(!p||p.qty<it.qty)return j({ok:false,error:`موجودی "${it.name}" کافی نیست`},409);
      }
      const total=items.reduce((s,i)=>s+(i.finalPrice||i.qty*i.sellPrice),0);
      const cost=items.reduce((s,i)=>s+i.qty*(i.buyPrice||0),0);
      const id=crypto.randomUUID(),now=Date.now();
      await db.prepare('INSERT INTO sales(id,total,cost,profit,date_j,user_name,created_at)VALUES(?,?,?,?,?,?,?)')
        .bind(id,total,cost,total-cost,b.dateJ||'',b.user||'',now).run();
      for(const it of items){
        await db.prepare('INSERT INTO sale_items(id,sale_id,product_id,name,qty,sell_price,buy_price,discount,final_price)VALUES(?,?,?,?,?,?,?,?,?)')
          .bind(crypto.randomUUID(),id,it.productId,it.name,it.qty,it.sellPrice,it.buyPrice||0,it.discount||0,it.finalPrice||it.qty*it.sellPrice).run();
        await db.prepare('UPDATE products SET qty=MAX(0,qty-?),updated_at=? WHERE id=?').bind(it.qty,now,it.productId).run();
      }
      return j({ok:true,id,total,profit:total-cost});
    }
    if(req.method==='DELETE'){
      let b;try{b=await req.json();}catch{return j({ok:false,error:'bad json'},400);}
      if(!b.id)return j({ok:false,error:'id required'},400);
      await db.prepare('DELETE FROM sale_items WHERE sale_id=?').bind(b.id).run();
      await db.prepare('DELETE FROM sales WHERE id=?').bind(b.id).run();
      return j({ok:true});
    }
    return j({ok:false,error:'method not allowed'},405);
  }catch(e){return j({ok:false,error:e.message},500);}
}
