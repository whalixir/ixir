const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};
const j=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});

export async function onRequest(ctx){
  const{request:req,env}=ctx;
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:H});
  if(!env.DB)return j({ok:false,error:'DB not bound'},500);
  const db=env.DB;
  try{
    if(req.method==='GET'){
      const{results}=await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
      return j({ok:true,data:results||[]});
    }
    if(req.method==='POST'){
      let b;try{b=await req.json();}catch{return j({ok:false,error:'bad json'},400);}
      if(!b.name)return j({ok:false,error:'name required'},400);
      const id=crypto.randomUUID(),now=Date.now();
      await db.prepare('INSERT INTO products(id,barcode,name,brand,buy_price,sell_price,qty,volume,description,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id,b.barcode||'',b.name,b.brand||'',Number(b.buyPrice)||0,Number(b.sellPrice)||0,Number(b.qty)||0,Number(b.volume)||0,b.desc||'',now,now).run();
      return j({ok:true,id});
    }
    if(req.method==='PUT'){
      let b;try{b=await req.json();}catch{return j({ok:false,error:'bad json'},400);}
      if(!b.id)return j({ok:false,error:'id required'},400);
      await db.prepare('UPDATE products SET barcode=?,name=?,brand=?,buy_price=?,sell_price=?,qty=?,volume=?,description=?,updated_at=? WHERE id=?')
        .bind(b.barcode||'',b.name||'',b.brand||'',Number(b.buyPrice)||0,Number(b.sellPrice)||0,Number(b.qty)||0,Number(b.volume)||0,b.desc||'',Date.now(),b.id).run();
      return j({ok:true});
    }
    if(req.method==='DELETE'){
      let b;try{b=await req.json();}catch{return j({ok:false,error:'bad json'},400);}
      await db.prepare('DELETE FROM products WHERE id=?').bind(b.id).run();
      return j({ok:true});
    }
    return j({ok:false,error:'method not allowed'},405);
  }catch(e){return j({ok:false,error:e.message},500);}
}
