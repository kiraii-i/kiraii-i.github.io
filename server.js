const express=require("express"),fs=require("fs"),path=require("path"),crypto=require("crypto"),mail=require("nodemailer");
const E=process.env,PORT=E.PORT||3000,DATA=path.join(__dirname,"data"),F=path.join(DATA,"db.json"),UP=path.join(DATA,"uploads");
const ADMIN=(E.ADMIN_EMAIL||"").toLowerCase();
if(!ADMIN||!E.ADMIN_PASSWORD||!E.SECRET){console.error("Set ADMIN_EMAIL, ADMIN_PASSWORD and SECRET in .env");process.exit(1)}
fs.mkdirSync(UP,{recursive:true});
let db={artworks:[],settings:{shipping:15},team:[],orders:[],commissions:[]};
try{db={...db,...JSON.parse(fs.readFileSync(F))}}catch{}
const save=()=>{fs.writeFileSync(F+".tmp",JSON.stringify(db));fs.renameSync(F+".tmp",F)};
const hash=(p,s=crypto.randomBytes(16).toString("hex"))=>({salt:s,hash:crypto.scryptSync(p,s,64).toString("hex")});
const check=(p,u)=>{if(!u)return false;const h=hash(String(p),u.salt).hash;return crypto.timingSafeEqual(Buffer.from(h),Buffer.from(u.hash))};
const adminU=hash(E.ADMIN_PASSWORD);
const sign=s=>crypto.createHmac("sha256",E.SECRET).update(s).digest("hex");
const mk=e=>{const b=Buffer.from(e+"|"+(Date.now()+7*864e5)).toString("base64url");return b+"."+sign(b)};
const staff=e=>e===ADMIN||db.team.some(t=>t.email===e);
const who=q=>{const c=(q.headers.cookie||"").split(/;\s*/).find(x=>x.startsWith("s="));if(!c)return null;const[b,g]=c.slice(2).split(".");if(!g||sign(b)!==g)return null;const[e,x]=Buffer.from(b,"base64url").toString().split("|");return+x>Date.now()&&staff(e)?e:null};
const auth=(q,r)=>{if(who(q))return true;r.status(401).json({error:"Admin login required"});return false};
const hits={};const limit=(q,k,max,ms)=>{const key=k+q.ip,now=Date.now();hits[key]=(hits[key]||[]).filter(x=>now-x<ms);if(hits[key].length>=max)return false;hits[key].push(now);return true};
const t=(v,n=300)=>String(v??"").slice(0,n),num=v=>Math.max(0,Number(v)||0),SIZE={S:"20×25 cm",M:"30×40 cm",L:"50×70 cm"};
const IMG=/^[a-f0-9]{32}\.(png|jpg|webp|gif)$/,EXT={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif"};
const tx=E.SMTP_HOST?mail.createTransport({host:E.SMTP_HOST,port:+E.SMTP_PORT||587,auth:{user:E.SMTP_USER,pass:E.SMTP_PASS}}):null;
const send=(s,text)=>tx?tx.sendMail({from:E.MAIL_FROM||E.SMTP_USER,to:E.ORDER_TO||ADMIN,subject:s,text}).catch(e=>console.error("mail failed:",e.message)):console.log("[SMTP not set]",s,"\n"+text);
const app=express();app.disable("x-powered-by");app.set("trust proxy",1);
app.use((q,r,n)=>{r.set("X-Content-Type-Options","nosniff");n()});
app.use(express.json({limit:"100kb"}));
app.use(express.static(path.join(__dirname,"public")));

app.post("/api/login",(q,r)=>{
  if(!limit(q,"login",10,9e5))return r.status(429).json({error:"Too many attempts. Try again later."});
  const e=t(q.body.email,200).trim().toLowerCase(),ok=e===ADMIN?check(q.body.password,adminU):check(q.body.password,db.team.find(x=>x.email===e));
  if(!ok)return r.status(401).json({error:"Wrong email or password"});
  r.set("Set-Cookie",`s=${mk(e)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${E.NODE_ENV==="production"?"; Secure":""}`);r.json({ok:1})});
app.post("/api/logout",(q,r)=>{r.set("Set-Cookie","s=; HttpOnly; Path=/; Max-Age=0");r.json({ok:1})});
app.get("/api/me",(q,r)=>{const e=who(q);r.json(e?{email:e,admin:true}:{})});

const PUB=["artworks"],ADM=["orders","commissions","team"];
const docs=c=>c==="orders"||c==="commissions"?db[c].map(o=>({id:o.id,data:{list:[o]}})):c==="team"?db.team.map(x=>({id:x.id,data:{email:x.email}})):db[c].map(({id,...d})=>({id,data:d}));
app.get("/api/data/settings/site",(q,r)=>r.json(db.settings));
app.get("/api/data/:c",(q,r)=>{const c=q.params.c;if(!PUB.includes(c)&&!ADM.includes(c))return r.sendStatus(404);if(ADM.includes(c)&&!auth(q,r))return;r.json(docs(c))});
app.put("/api/data/:c/:id",(q,r)=>{if(!auth(q,r))return;const{c,id}=q.params,b=q.body||{};if(!/^[\w-]{1,40}$/.test(id))return r.sendStatus(400);
  if(c==="settings")db.settings={shipping:num(b.shipping)};
  else if(c==="artworks"){const a={id,title:t(b.title,120),year:num(b.year),price:num(b.price),medium:t(b.medium),dims:t(b.dims),notes:t(b.notes),desc:t(b.desc,2000),imageId:IMG.test(b.imageId||"")?b.imageId:"",sold:!!b.sold,prints:{S:num(b.prints?.S),M:num(b.prints?.M),L:num(b.prints?.L)}},i=db.artworks.findIndex(x=>x.id===id);i<0?db.artworks.push(a):db.artworks[i]=a}
  else if(c==="orders"){const o=db.orders.find(x=>x.id===id),s=b.list?.[0]?.status;if(!o||!["new","shipped"].includes(s))return r.sendStatus(400);o.status=s}
  else return r.sendStatus(404);
  save();r.json({ok:1})});
app.delete("/api/data/:c/:id",(q,r)=>{if(!auth(q,r))return;const{c,id}=q.params;if(!["artworks","team"].includes(c))return r.sendStatus(404);db[c]=db[c].filter(x=>x.id!==id);save();r.json({ok:1})});
app.post("/api/team",(q,r)=>{if(!auth(q,r))return;const e=t(q.body.email,200).trim().toLowerCase(),p=String(q.body.password||"");
  if(!/^\S+@\S+\.\S+$/.test(e)||p.length<8||e===ADMIN||db.team.some(x=>x.email===e))return r.status(400).json({error:"Valid new email and a password of 8+ characters required"});
  db.team.push({id:crypto.randomBytes(6).toString("hex"),email:e,...hash(p)});save();r.json({ok:1})});

app.post("/api/orders",(q,r)=>{
  if(!limit(q,"order",15,36e5))return r.status(429).json({error:"Too many orders. Try later."});
  const b=q.body||{},name=t(b.name,100).trim(),address=t(b.address,500).trim(),phone=t(b.phone,40).trim();
  if(!name||!address||!phone||!Array.isArray(b.items)||!b.items.length||b.items.length>20)return r.status(400).json({error:"Please fill in all details"});
  const items=[];for(const i of b.items){const a=db.artworks.find(x=>x.id===i.id);if(!a)return r.status(400).json({error:"An artwork is no longer available"});
    if(i.k==="O"){if(a.sold||!a.price)return r.status(400).json({error:a.title+" is not available"});items.push({id:a.id,k:"O",title:a.title,label:"Original",price:a.price})}
    else if(SIZE[i.k]&&a.prints[i.k]>0)items.push({id:a.id,k:i.k,title:a.title,label:`Print ${i.k} (${SIZE[i.k]})`,price:a.prints[i.k]});
    else return r.status(400).json({error:"Invalid item"})}
  const subtotal=items.reduce((s,i)=>s+i.price,0),shipping=db.settings.shipping,o={id:crypto.randomBytes(4).toString("hex"),at:Date.now(),name,address,phone,items,subtotal,shipping,total:subtotal+shipping,status:"new"};
  db.orders.push(o);save();
  send("artshop order #"+o.id,`Name: ${name}\nAddress: ${address}\nPhone: ${phone}\n\nItems:\n${items.map(i=>`- ${i.title} (${i.label}) $${i.price}`).join("\n")}\n\nSubtotal: $${subtotal}\nShipping: $${shipping}\nTotal: $${o.total}`);
  r.json({id:o.id})});
app.post("/api/commissions",(q,r)=>{
  if(!limit(q,"comm",10,36e5))return r.status(429).json({error:"Too many requests. Try later."});
  const b=q.body||{},c={id:crypto.randomBytes(4).toString("hex"),at:Date.now(),name:t(b.name,100),contact:t(b.contact,200),size:t(b.size,100),idea:t(b.idea,3000),budget:t(b.budget,60)};
  if(!c.name||!c.contact||!c.idea)return r.status(400).json({error:"Name, contact and idea are required"});
  db.commissions.push(c);save();send("artshop custom request from "+c.name,`Contact: ${c.contact}\nSize/medium: ${c.size}\nBudget: ${c.budget}\n\n${c.idea}`);r.json({id:c.id})});

app.post("/api/upload",express.raw({type:Object.keys(EXT),limit:"10mb"}),(q,r)=>{if(!auth(q,r))return;const x=EXT[q.headers["content-type"]];
  if(!x||!Buffer.isBuffer(q.body)||!q.body.length)return r.status(400).json({error:"PNG, JPG, WEBP or GIF only (max 10 MB)"});
  const id=crypto.randomBytes(16).toString("hex")+"."+x;fs.writeFileSync(path.join(UP,id),q.body);r.json({id})});
app.get("/_blob/:id",(q,r)=>IMG.test(q.params.id)?r.sendFile(path.join(UP,q.params.id)):r.sendStatus(404));
app.listen(PORT,()=>console.log("artshop running on http://localhost:"+PORT));
