const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};
const j=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});

export async function onRequest(ctx){
  const{request:req,env}=ctx;
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:H});
  if(!env.DB)return j({ok:false,error:'DB not bound'},500);
  const db=env.DB;
  try{
    if(req.method==='GET'){
      const{results}=await db.prepare('SELECT id,name,role FROM users ORDER BY created_at ASC').all();
      return j({ok:true,data:results||[]});
    }
    if(req.method==='POST'){
      let b;try{b=await req.json();}catch{return j({ok:false,error:'bad json'},400);}
      // verify login
      if(b.action==='login'){
        const u=await db.prepare('SELECT id,name,role FROM users WHERE name=? AND pin=?').bind(b.name,b.pin).first();
        if(u)return j({ok:true,user:u});
        return j({ok:false,error:'invalid'},401);
      }
      // add user
      if(!b.name||!b.pin)return j({ok:false,error:'name and pin required'},400);
      const id=crypto.randomUUID();
      await db.prepare('INSERT INTO users(id,name,pin,role,created_at)VALUES(?,?,?,?,?)').bind(id,b.name.toUpperCase(),b.pin,b.role||'user',Date.now()).run();
      return j({ok:true,id});
    }
    if(req.method==='PUT'){
      let b;try{b=await req.json();}catch{return j({ok:false,error:'bad json'},400);}
      if(!b.id||!b.pin)return j({ok:false,error:'id and pin required'},400);
      await db.prepare('UPDATE users SET pin=? WHERE id=?').bind(b.pin,b.id).run();
      return j({ok:true});
    }
    if(req.method==='DELETE'){
      let b;try{b=await req.json();}catch{return j({ok:false,error:'bad json'},400);}
      await db.prepare('DELETE FROM users WHERE id=? AND role!=?').bind(b.id,'admin').run();
      return j({ok:true});
    }
    return j({ok:false,error:'method not allowed'},405);
  }catch(e){return j({ok:false,error:e.message},500);}
}
