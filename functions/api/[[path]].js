import { DEFAULT_SITE } from '../../public/assets/defaults.js';

const json = (value, status=200, headers={}) => new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',...headers}});
const err = (message, status=400) => json({ok:false,error:message},status);
const text = (v,max=1000) => typeof v==='string' ? v.trim().slice(0,max) : '';
const isId = id => /^[a-z0-9_-]{1,50}$/i.test(id||'');
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const validURL = (v) => typeof v==='string' && (v==='' || /^https:\/\/[^\s"'<>]+$/i.test(v) || /^\/api\/media\/[0-9a-f-]{36}$/i.test(v));
const originCheck = (req) => {let origin=req.headers.get('origin'); return !origin || origin===new URL(req.url).origin;};
const safeEqual = async (a,b) => {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const digest=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)));
  let x=await digest(a),y=await digest(b),diff=0;
  for(let i=0;i<x.length;i++) diff|=x[i]^y[i];
  return diff===0;
};
const hex = buf => [...new Uint8Array(buf)].map(v=>v.toString(16).padStart(2,'0')).join('');
const codeHash=async (code,env)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.SESSION_SECRET+'|code|'+code.trim().toUpperCase())));
const b64url = arr => btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const fromb64url = str => Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function signer(env){return crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function makeToken(payload,env){
 const part=b64url(new TextEncoder().encode(JSON.stringify(payload)));
 const signature=b64url(new Uint8Array(await crypto.subtle.sign('HMAC',await signer(env),new TextEncoder().encode(part))));
 return `${part}.${signature}`;
}
async function readSession(req,env){
 try{
  const cookie=req.headers.get('cookie')||'';
  const raw=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-tm_session='));
  if(!raw)return null;
  const [part,sig]=raw.split('=')[1].split('.');
  if(!part||!sig)return null;
  if(!await crypto.subtle.verify('HMAC',await signer(env),fromb64url(sig),new TextEncoder().encode(part)))return null;
  const data=JSON.parse(new TextDecoder().decode(fromb64url(part)));
  if(data.exp<Date.now()||!['admin','business'].includes(data.role))return null;
  if(data.role==='business'){
   const a=await env.DB.prepare('SELECT id,label,pricing_json FROM business_accounts WHERE id=? AND active=1').bind(data.id).first();
   if(!a)return null;
   return {...data,label:a.label,prices:JSON.parse(a.pricing_json)};
  }
  return data;
 } catch {return null;}
}
const setCookie=(token,seconds)=>`__Host-tm_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
async function readBody(req){
 if(Number(req.headers.get('content-length'))>100000)return null;
 try{return await req.json();}catch{return null;}
}
async function site(env){
 const r=await env.DB.prepare('SELECT config_json FROM site_settings WHERE id=1').first();
 if(!r)return structuredClone(DEFAULT_SITE);
 try{return {...structuredClone(DEFAULT_SITE),...JSON.parse(r.config_json)};}catch{return structuredClone(DEFAULT_SITE);}
}
function cleanConfig(obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Invalid settings');
 let c=structuredClone(DEFAULT_SITE);
 c.businessName=text(obj.businessName,60)||c.businessName;
 c.brandTagline=text(obj.brandTagline,110);
 for(const key of ['hero','contact','about','announcement','booking']){
  const src=obj[key]||{};
  for(const field of Object.keys(c[key])){
   if(typeof c[key][field]==='string')c[key][field]=text(src[field],field==='description'||field==='body'?1200:300);
   if(typeof c[key][field]==='boolean')c[key][field]=Boolean(src[field]);
  }
 }
 if(!validURL(c.hero.image))throw Error('Invalid hero image URL');
 c.servicesIntro=text(obj.servicesIntro,400);
 c.pricingIntro=text(obj.pricingIntro,400);
 c.galleryTitle=text(obj.galleryTitle,120);
 c.gallerySubtitle=text(obj.gallerySubtitle,400);
 c.theme=['default','eid','thanksgiving','christmas','halloween','newyear'].includes(obj.theme)?obj.theme:'default';
 c.accent=/^#[0-9a-fA-F]{6}$/.test(obj.accent||'')?obj.accent:DEFAULT_SITE.accent;
 c.themeProfiles={};
 for(const [id,base] of Object.entries(DEFAULT_SITE.themeProfiles)){
  const src=obj.themeProfiles?.[id]||{};
  const heroImage=text(src.heroImage,500);if(!validURL(heroImage))throw Error('Invalid seasonal hero photo');
  const prices={};for(const v of DEFAULT_SITE.vehicles){const n=src.prices?.[v.id];if(n!==undefined&&n!==null&&String(n)!==''){const price=Number(n);if(!Number.isFinite(price)||price<0||price>10000)throw Error('Invalid holiday pricing');prices[v.id]=Math.round(price);}}
  c.themeProfiles[id]={greeting:text(src.greeting,90)||base.greeting||'',headline:text(src.headline,180),description:text(src.description,380),heroImage,accent:/^#[0-9a-fA-F]{6}$/.test(src.accent||'')?src.accent:'',background:/^#[0-9a-fA-F]{6}$/.test(src.background||'')?src.background:'',prices};
 }
 c.about.points=(Array.isArray(obj.about?.points)?obj.about.points:[]).slice(0,5).map(x=>text(x,120));
 c.services=(Array.isArray(obj.services)?obj.services:[]).slice(0,8).map((s,i)=>({id:text(s.id,40)||`s${i}`,number:String(i+1).padStart(2,'0'),name:text(s.name,80),description:text(s.description,400),icon:text(s.icon,50)}));
 c.vehicles=DEFAULT_SITE.vehicles.map(v=>{
  let src=(obj.vehicles||[]).find(x=>x.id===v.id)||v;
  return {...v,name:text(src.name,60)||v.name,description:text(src.description,110),price:Math.min(10000,Math.max(0,Math.round(Number(src.price)||0)))};
 });
 c.businessPrices=Object.fromEntries(c.vehicles.map(v=>[v.id,Math.min(10000,Math.max(0,Math.round(Number(obj.businessPrices?.[v.id])||0)))]));
 c.gallery=(Array.isArray(obj.gallery)?obj.gallery:[]).slice(0,20).map((g,i)=>({id:text(g.id,45)||`g${i}`,src:text(g.src,500),caption:text(g.caption,120),alt:text(g.alt,120),link:text(g.link,500)}));
 if(c.gallery.some(g=>!validURL(g.src)||!validURL(g.link)))throw Error('Invalid gallery URL');
 c.booking.maxPerDay=Math.min(6,Math.max(1,Math.round(Number(obj.booking?.maxPerDay)||2)));
 c.booking.blockedDates=(Array.isArray(obj.booking?.blockedDates)?obj.booking.blockedDates:[]).filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0,180);
 c.booking.timeSlots=(Array.isArray(obj.booking?.timeSlots)?obj.booking.timeSlots:DEFAULT_SITE.booking.timeSlots).filter(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x)).slice(0,12);
 c.sections=Object.fromEntries(Object.keys(DEFAULT_SITE.sections).map(k=>[k,obj.sections?.[k]!==false]));
 return c;
}
function dateOk(d){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return false;
 const dt=new Date(d+'T12:00:00Z');
 const today=new Date(new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'})+'T12:00:00Z');
 return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===d&&dt>=today&&dt<=new Date(today.getTime()+120*86400000);
}
const result=async (statement) => {try{return await statement;}catch(e){console.error('D1 error',e);throw e;}};
export async function onRequest({request,env}){
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');
 if(!env.DB)return err('Database not configured yet. See SETUP.md.',503);
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<12)return err('Site security setup incomplete. See SETUP.md.',503);
 const method=request.method;
 if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))return err('Method not allowed',405);
 if(method!=='GET'&&!originCheck(request))return err('Origin not allowed',403);
 try {
  if(method==='GET'&&path==='site'){
   const c=await site(env);delete c.businessPrices;
   return json({ok:true,site:c});
  }
  if(method==='GET'&&path.startsWith('media/')){
   const id=path.split('/')[1];if(!/^[0-9a-f-]{36}$/.test(id||''))return err('Not found',404);
   const media=await env.DB.prepare('SELECT mime,data FROM media WHERE id=?').bind(id).first();
   if(!media)return err('Not found',404);
   const bytes=media.data instanceof ArrayBuffer?new Uint8Array(media.data):new Uint8Array(media.data);
   return new Response(bytes,{headers:{'Content-Type':media.mime,'Content-Length':String(bytes.length),'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }
  if(method==='GET'&&path==='session'){
   const sess=await readSession(request,env);
   return json({ok:true,role:sess?.role||null,label:sess?.label||null,prices:sess?.role==='business'?sess.prices:null});
  }
  if(method==='POST'&&path==='login'){
   const ip=request.headers.get('CF-Connecting-IP')||'unknown';
   const clientKey=await codeHash('login:'+ip,env);
   const attempt=await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_attempts WHERE client_key=? AND created_at>datetime('now','-15 minutes')").bind(clientKey).first();
   if(Number(attempt?.n||0)>=12)return err('Too many login attempts. Try again in 15 minutes.',429);
   const b=await readBody(request);if(!b)return err('Invalid request');
   const kind=b.kind==='admin'?'admin':'business';
   if(kind==='admin'){
    if(!await safeEqual(text(b.password,300),env.ADMIN_PASSWORD)){await env.DB.prepare('INSERT INTO auth_attempts (client_key) VALUES (?)').bind(clientKey).run();return err('Incorrect login',401);}
    const duration=4*60*60;return json({ok:true,role:'admin'},200,{'Set-Cookie':setCookie(await makeToken({role:'admin',exp:Date.now()+duration*1000},env),duration)});
   }
   const code=text(b.code,100).toUpperCase();if(code.length<8)return err('Invalid account code',401);
   const hash=await codeHash(code,env);
   const a=await env.DB.prepare('SELECT id,label,pricing_json FROM business_accounts WHERE code_hash=? AND active=1').bind(hash).first();
   if(!a){await env.DB.prepare('INSERT INTO auth_attempts (client_key) VALUES (?)').bind(clientKey).run();return err('Invalid account code',401);}
   const duration=24*3600;
   return json({ok:true,role:'business',label:a.label,prices:JSON.parse(a.pricing_json)},200,{'Set-Cookie':setCookie(await makeToken({role:'business',id:a.id,exp:Date.now()+duration*1000},env),duration)});
  }
  if(method==='POST'&&path==='logout')return json({ok:true},200,{'Set-Cookie':setCookie('',0)});
  if(method==='GET'&&path==='availability'){
   const date=url.searchParams.get('date');if(!dateOk(date))return err('Pick a valid appointment date');
   const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE appointment_date=? AND status IN ('pending','confirmed')").bind(date).first();
   const c=await site(env),blocked=(c.booking.blockedDates||[]).includes(date);return json({ok:true,booked:Number(row.n),max:c.booking.maxPerDay,available:c.booking.enabled&&!blocked&&Number(row.n)<c.booking.maxPerDay,reason:blocked?'That date is not accepting bookings.':!c.booking.enabled?'Online bookings are currently closed.':Number(row.n)>=c.booking.maxPerDay?'That date is fully booked.':null});
  }
  if(method==='POST'&&path==='bookings'){
   const b=await readBody(request),sess=await readSession(request,env),c=await site(env);
   if(!b)return err('Invalid booking');if(!c.booking.enabled)return err('Bookings are temporarily closed',403);
   const name=text(b.name,90),phone=text(b.phone,35),email=text(b.email,180).toLowerCase(),vehicle=text(b.vehicle,40),date=text(b.date,15),time=text(b.time,10),service_location=text(b.location,20),address=text(b.address,240),notes=text(b.notes,500);
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7||!c.vehicles.some(v=>v.id===vehicle)||!dateOk(date)||!c.booking.timeSlots.includes(time)||!['mobile','dropoff'].includes(service_location))return err('Please complete all required fields');
   if(service_location==='mobile'&&address.length<8)return err('Please enter the mobile detailing address');
   if((c.booking.blockedDates||[]).includes(date))return err('This date is not available',409);
   const holiday=c.themeProfiles?.[c.theme]?.prices||{};
   let p=Number.isFinite(holiday[vehicle])?holiday[vehicle]:c.vehicles.find(v=>v.id===vehicle).price,accountId=null;
   if(sess?.role==='business'){p=Number(sess.prices[vehicle]);accountId=sess.id;if(!Number.isFinite(p)||p<0)return err('Price unavailable');}
   const id=crypto.randomUUID(),reference='TM-'+crypto.randomUUID().slice(0,8).toUpperCase();
   const inserted=await env.DB.prepare(`INSERT INTO bookings (id,reference,customer_name,email,phone,service_location,address,vehicle,appointment_date,appointment_time,notes,quoted_price,business_account_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM bookings WHERE appointment_date=? AND status IN ('pending','confirmed')) < ? AND NOT EXISTS (SELECT 1 FROM bookings WHERE appointment_date=? AND appointment_time=? AND status IN ('pending','confirmed'))`).bind(id,reference,name,email,phone,service_location,address,vehicle,date,time,notes,Math.round(p),accountId,date,c.booking.maxPerDay,date,time).run();
   if(!inserted.meta?.changes)return err('That date or time is unavailable. Please choose another appointment.',409);
   return json({ok:true,reference,notice:'Request received. TM Detailers will contact you to confirm.'},201);
  }
  if(method==='POST'&&path==='lookup'){
   const b=await readBody(request);if(!b)return err('Invalid request');
   const ref=text(b.reference,40).toUpperCase(),email=text(b.email,180).toLowerCase();
   if(!/^TM-[A-Z0-9]{8}$/.test(ref)||!/^\S+@\S+\.\S+$/.test(email))return err('Booking not found',404);
   const r=await env.DB.prepare('SELECT reference,vehicle,appointment_date,appointment_time,service_location,status,quoted_price,notes FROM bookings WHERE reference=? AND email=?').bind(ref,email).first();
   return r?json({ok:true,booking:r}):err('Booking not found',404);
  }
  if(method==='POST'&&path==='booking-request'){
   const payload=await readBody(request);if(!payload)return err('Invalid request');
   const ref=text(payload.reference,40).toUpperCase(),email=text(payload.email,180).toLowerCase();
   const type=payload.type==='cancel'?'CANCELLATION REQUEST':payload.type==='reschedule'?'DATE / TIME CHANGE REQUEST':null;
   const message=text(payload.message,350);
   if(!type||!/^TM-[A-Z0-9]{8}$/.test(ref)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err('Invalid request');
   if(type==='DATE / TIME CHANGE REQUEST'&&message.length<8)return err('Describe your requested change');
   const entry='['+type+' — '+new Date().toISOString().slice(0,16)+' UTC] '+message;
   const row=await env.DB.prepare("UPDATE bookings SET notes=substr(COALESCE(notes,'') || char(10) || ?, 1, 1800) WHERE reference=? AND email=? AND status NOT IN ('completed','cancelled')").bind(entry,ref,email).run();
   return row.meta?.changes?json({ok:true,message:'Your request has been recorded. TM Detailers will review it.'}):err('Booking not found or already completed',404);
  }
  const sess=await readSession(request,env);
  if(!path.startsWith('admin/')||sess?.role!=='admin')return err('Not authorized',401);
  if(method==='GET'&&path==='admin/site')return json({ok:true,site:await site(env)});
  if(method==='GET'&&path==='admin/overview'){
   const data=await env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) AS confirmed FROM bookings").first();
   const accounts=await env.DB.prepare('SELECT COUNT(*) AS total FROM business_accounts WHERE active=1').first();
   return json({ok:true,stats:{...data,accounts:accounts.total}});
  }
  if(method==='PUT'&&path==='admin/site'){
   const body=await readBody(request);if(!body)return err('Invalid request');
   let cleaned;try{cleaned=cleanConfig(body.site);}catch(e){return err(e.message);}
   await env.DB.prepare('INSERT INTO site_settings (id,config_json,updated_at) VALUES (1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json,updated_at=CURRENT_TIMESTAMP').bind(JSON.stringify(cleaned)).run();
   return json({ok:true,site:cleaned});
  }
  if(method==='POST'&&path==='admin/media'){
   const form=await request.formData(),file=form.get('image');
   if(!file||typeof file.arrayBuffer!=='function'||file.size>750000||file.size<100)return err('Image must be smaller than 750 KB');
   if(!['image/jpeg','image/png','image/webp'].includes(file.type))return err('Unsupported file type');
   const magic=new Uint8Array(await file.slice(0,12).arrayBuffer());
   const isJpg=magic[0]===255&&magic[1]===216&&magic[2]===255;
   const isPng=magic[0]===137&&magic[1]===80&&magic[2]===78&&magic[3]===71;
   const isWebp=String.fromCharCode(...magic.slice(0,4))==='RIFF'&&String.fromCharCode(...magic.slice(8,12))==='WEBP';
   if(!(file.type==='image/jpeg'&&isJpg||file.type==='image/png'&&isPng||file.type==='image/webp'&&isWebp))return err('Image format does not match its contents');
   const id=crypto.randomUUID(),bytes=new Uint8Array(await file.arrayBuffer());
   await env.DB.prepare('INSERT INTO media (id,mime,data) VALUES (?,?,?)').bind(id,file.type,bytes).run();
   return json({ok:true,url:'/api/media/'+id},201);
  }
  if(method==='GET'&&path==='admin/business'){
   const rows=await env.DB.prepare('SELECT id,label,pricing_json,active,created_at FROM business_accounts ORDER BY created_at DESC').all();
   return json({ok:true,accounts:rows.results.map(x=>({...x,prices:JSON.parse(x.pricing_json),pricing_json:undefined}))});
  }
  if(method==='POST'&&path==='admin/business'){
   const b=await readBody(request);if(!b)return err('Invalid request');
   const label=text(b.label,100);if(!label)return err('Enter a company name');
   const c=await site(env),prices={};
   for(const v of c.vehicles){const n=Number(b.prices?.[v.id]);if(!Number.isFinite(n)||n<0||n>10000)return err('Invalid business price');prices[v.id]=Math.round(n);}
   const custom=text(b.code,60).toUpperCase();
   if(custom&&!/^TM-[A-Z0-9-]{7,56}$/.test(custom))return err('Custom codes must start with TM- and use at least 7 more letters, numbers or hyphens');
   const code=custom||'TM-BIZ-'+b64url(crypto.getRandomValues(new Uint8Array(12))).replace(/[^A-Z0-9]/gi,'').slice(0,15).toUpperCase();
   const id=crypto.randomUUID();
   await env.DB.prepare('INSERT INTO business_accounts (id,label,code_hash,pricing_json) VALUES (?,?,?,?)').bind(id,label,await codeHash(code,env),JSON.stringify(prices)).run();
   return json({ok:true,id,code},201);
  }
  if(method==='POST'&&/^admin\/business\/[0-9a-f-]{36}\/rotate$/.test(path)){
   const id=path.split('/')[2];
   const code='TM-BIZ-'+b64url(crypto.getRandomValues(new Uint8Array(14))).replace(/[^A-Z0-9]/gi,'').slice(0,18).toUpperCase();
   const row=await env.DB.prepare('UPDATE business_accounts SET code_hash=? WHERE id=?').bind(await codeHash(code,env),id).run();
   return row.meta?.changes?json({ok:true,code}):err('Business account not found',404);
  }
  if(method==='PUT'&&path.startsWith('admin/business/')){
   const id=path.split('/')[2],b=await readBody(request);if(!isId(id)&&!/^[0-9a-f-]{36}$/.test(id))return err('Invalid account');
   const c=await site(env),prices={};for(const v of c.vehicles){const n=Number(b?.prices?.[v.id]);if(!Number.isFinite(n)||n<0||n>10000)return err('Invalid business price');prices[v.id]=Math.round(n);}
   await env.DB.prepare('UPDATE business_accounts SET label=?,pricing_json=?,active=? WHERE id=?').bind(text(b.label,100),JSON.stringify(prices),b.active?1:0,id).run();
   return json({ok:true});
  }
  if(method==='GET'&&path==='admin/bookings'){
   const rows=await env.DB.prepare('SELECT * FROM bookings ORDER BY appointment_date DESC,appointment_time DESC LIMIT 300').all();
   return json({ok:true,bookings:rows.results});
  }
  if(method==='PUT'&&path.startsWith('admin/bookings/')){
   const id=path.split('/')[2],b=await readBody(request);
   if(!/^[0-9a-f-]{36}$/.test(id||'')||!['pending','confirmed','completed','cancelled'].includes(b?.status))return err('Invalid status');
   await env.DB.prepare('UPDATE bookings SET status=? WHERE id=?').bind(b.status,id).run();
   return json({ok:true});
  }
  return err('Not found',404);
 }catch(e){console.error(e);return err('Server error. Check your Cloudflare deployment and D1 database.',500);}
}
