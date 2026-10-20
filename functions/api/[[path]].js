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
 c.contact.dropoffAddress=text(obj.contact?.dropoffAddress,240);
 c.booking.blockedDates=(Array.isArray(obj.booking?.blockedDates)?obj.booking.blockedDates:[]).filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0,180);
 c.booking.timeSlots=(Array.isArray(obj.booking?.timeSlots)?obj.booking.timeSlots:DEFAULT_SITE.booking.timeSlots).filter(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x)).slice(0,12);
 c.sections=Object.fromEntries(Object.keys(DEFAULT_SITE.sections).map(k=>[k,obj.sections?.[k]!==false]));
 return c;
}
// Calendar dates are always calculated in the business's Toronto timezone.
const torontoParts=(now=new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
const localToday=()=>{const p=torontoParts();return `${p.year}-${p.month}-${p.day}`;};
const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const dateOk=(d,days=7)=>validDate(d)&&d>=localToday()&&d<=addDays(localToday(),days);
const timePassed=(d,t)=>{const now=torontoParts();return d===localToday()&&t<=now.hour+':'+now.minute;};
const uuidOK=x=>/^[0-9a-f-]{36}$/i.test(x||'');
const bookingRefOK=x=>/^TM-[A-Z0-9]{8}$/.test(x||'');
const publicFields = async (env,bookingId) => {
 const row=await env.DB.prepare('SELECT headline,status_message,next_step,eta_text FROM booking_public_details WHERE booking_id=?').bind(bookingId).first();
 return row||{headline:'',status_message:'',next_step:'',eta_text:''};
};
const photoList=async (env,bookingId)=>{
 const rows=await env.DB.prepare('SELECT id,kind,caption,created_at FROM booking_photos WHERE booking_id=? ORDER BY created_at ASC').bind(bookingId).all();
 return rows.results||[];
};
const customerBooking=async (env,ref,email)=>{
 if(!bookingRefOK(ref)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return null;
 return env.DB.prepare('SELECT * FROM bookings WHERE reference=? AND email=?').bind(ref,email).first();
};
const photoMagic = async f=>{
 const b=new Uint8Array(await f.slice(0,12).arrayBuffer());
 return f.type==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255 || f.type==='image/png'&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71 || f.type==='image/webp'&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
};

const MAIL_SUBJECT='TM Detailers';
async function notify(env,to,subject,message){
 if(!env.RESEND_API_KEY||!env.MAIL_FROM||!to)return {sent:false,reason:'Email provider not configured'};
 try{const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text:message}),signal:AbortSignal.timeout(6000)});if(!resp.ok){console.error('Mail delivery rejected',resp.status);return {sent:false,reason:'Email service rejected the message'};}return {sent:true};}
 catch(e){console.error('Mail connection issue',e);return {sent:false,reason:'Mail temporarily unavailable'};}
}
async function notifyBooking(env,row,kind='requested'){
 const place=row.service_location==='mobile'?'Mobile appointment: '+row.address:'Drop-off: '+(await site(env)).contact.dropoffAddress;
 const lines=['TM Detailers — '+kind,'Booking: '+row.reference,'Status: '+row.status,'Customer: '+row.customer_name,'Vehicle: '+row.vehicle,'Date: '+row.appointment_date,'Time: '+row.appointment_time,'Location: '+place,'Estimated price: $'+row.quoted_price+' CAD','Manage or check: https://tmdetailers.ca/track/'];
 const result=await notify(env,row.email,MAIL_SUBJECT+' — booking '+kind+' ('+row.reference+')',lines.join('\n'));
 if(env.OWNER_NOTIFICATION_EMAIL)await notify(env,env.OWNER_NOTIFICATION_EMAIL,MAIL_SUBJECT+' — '+kind+' '+row.reference,lines.join('\n'));
 return result;
}
async function calendar(env,sess,c){
 const days=sess?.role==='business'?30:7,first=localToday(),last=addDays(first,days);
 const taken=await env.DB.prepare("SELECT appointment_date,appointment_time,COUNT(*) AS n FROM bookings WHERE appointment_date BETWEEN ? AND ? AND status IN ('pending','confirmed','in_progress') GROUP BY appointment_date,appointment_time").bind(first,last).all();
 const map=new Map();for(const r of taken.results||[]){const v=map.get(r.appointment_date)||{};v[r.appointment_time]=Number(r.n);map.set(r.appointment_date,v);}
 const dates=[];for(let i=0;i<=days;i++){
  const d=addDays(first,i),count=map.get(d)||{},dayTotal=Object.values(count).reduce((a,b)=>a+b,0);
  const closed=!c.booking.enabled||c.booking.blockedDates?.includes(d)||dayTotal>=c.booking.maxPerDay;
  const slots=c.booking.timeSlots.map(time=>({time,available:!closed&&!count[time]&&!timePassed(d,time)}));
  dates.push({date:d,available:slots.some(x=>x.available),slots,remaining:Math.max(0,c.booking.maxPerDay-dayTotal)});
 }
 return {ok:true,dates,first,last,windowDays:days};
}
// Database readiness checks never read or expose customer records.
const REQUIRED_TABLES=['site_settings','business_accounts','bookings','media','auth_attempts','booking_requests','fleet_departments','fleet_vehicles','booking_public_details','booking_photos'];
const BOOKING_ADDITIONS=['fleet_vehicle_id','department_id'];
const DDL=[
 `CREATE TABLE IF NOT EXISTS site_settings (id INTEGER PRIMARY KEY CHECK(id=1),config_json TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS business_accounts (id TEXT PRIMARY KEY,label TEXT NOT NULL,code_hash TEXT NOT NULL UNIQUE,pricing_json TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY,reference TEXT NOT NULL UNIQUE,customer_name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,service_location TEXT NOT NULL,address TEXT,vehicle TEXT NOT NULL,appointment_date TEXT NOT NULL,appointment_time TEXT NOT NULL,notes TEXT,quoted_price INTEGER NOT NULL,business_account_id TEXT,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(business_account_id) REFERENCES business_accounts(id))`,
 `CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,mime TEXT NOT NULL,data BLOB NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS auth_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,client_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
 `CREATE TABLE IF NOT EXISTS booking_requests (id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('cancel','reschedule')),message TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','approved','declined')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT,FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE)`,
 `CREATE TABLE IF NOT EXISTS fleet_departments (id TEXT PRIMARY KEY,business_account_id TEXT NOT NULL,name TEXT NOT NULL,FOREIGN KEY(business_account_id) REFERENCES business_accounts(id) ON DELETE CASCADE)`,
 `CREATE TABLE IF NOT EXISTS fleet_vehicles (id TEXT PRIMARY KEY,business_account_id TEXT NOT NULL,department_id TEXT,vehicle TEXT NOT NULL,make TEXT NOT NULL,model TEXT NOT NULL,model_year INTEGER,label TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(business_account_id) REFERENCES business_accounts(id) ON DELETE CASCADE,FOREIGN KEY(department_id) REFERENCES fleet_departments(id) ON DELETE SET NULL)`,
 `CREATE TABLE IF NOT EXISTS booking_public_details (booking_id TEXT PRIMARY KEY,headline TEXT NOT NULL DEFAULT '',status_message TEXT NOT NULL DEFAULT '',next_step TEXT NOT NULL DEFAULT '',eta_text TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE)`,
 `CREATE TABLE IF NOT EXISTS booking_photos (id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('before','after')),caption TEXT NOT NULL DEFAULT '',mime TEXT NOT NULL,data BLOB NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE)`
];
const DDL_INDEXES=[
 `CREATE INDEX IF NOT EXISTS idx_bookings_appointment ON bookings(appointment_date,status)`,
 `CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(reference,email)`,
 `CREATE INDEX IF NOT EXISTS idx_auth_attempts_key_time ON auth_attempts(client_key,created_at)`,
 `CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status,created_at)`,
 `CREATE INDEX IF NOT EXISTS idx_fleet_owner ON fleet_vehicles(business_account_id,active)`,
 `CREATE INDEX IF NOT EXISTS idx_booking_photos_booking ON booking_photos(booking_id,kind)`
];
async function schemaStatus(env){
 const {results:tableRows=[]}=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
 const tables=new Set(tableRows.map(r=>r.name));
 const missingTables=REQUIRED_TABLES.filter(t=>!tables.has(t));
 const missingColumns=[];
 if(tables.has('bookings')){
   const {results:cols=[]}=await env.DB.prepare('PRAGMA table_info(bookings)').all();
   const has=new Set(cols.map(c=>c.name));
   for(const col of BOOKING_ADDITIONS)if(!has.has(col))missingColumns.push('bookings.'+col);
 }
 return {ready:missingTables.length===0&&missingColumns.length===0,missingTables,missingColumns};
}
async function repairSchema(env){
 // Additive, repeatable schema repair. Never drops tables or modifies customer rows.
 const before=await schemaStatus(env);
 for(const sql of DDL) await env.DB.prepare(sql).run();
 const columns=await env.DB.prepare('PRAGMA table_info(bookings)').all();
 const has=new Set((columns.results||[]).map(c=>c.name));
 for(const column of BOOKING_ADDITIONS){
   if(!has.has(column)){
     try{await env.DB.prepare(`ALTER TABLE bookings ADD COLUMN ${column} TEXT`).run();}
     catch(e){const rows=await env.DB.prepare('PRAGMA table_info(bookings)').all();if(!(rows.results||[]).some(x=>x.name===column))throw e;}
   }
 }
 for(const sql of DDL_INDEXES)await env.DB.prepare(sql).run();
 return {before,after:await schemaStatus(env)};
}
function publicError(e){
 const m=String(e?.message||'');
 if(/UNIQUE constraint failed: business_accounts\.code_hash|business_accounts\.code_hash.*UNIQUE/i.test(m))return ['That business access code is already registered. Open the existing company or choose another code.',409,'CODE_IN_USE'];
 if(/no such table|no such column|has no column named|table .* has no column named/i.test(m))return ['The database structure is incomplete. Owner: open Owner Studio → Repair database.',503,'DB_SCHEMA_INCOMPLETE'];
 if(/FOREIGN KEY constraint failed/i.test(m))return ['An associated record was not found. Refresh and try again.',409,'INVALID_RELATION'];
 if(/UNIQUE constraint failed: bookings\.reference/i.test(m))return ['Please try submitting your booking again.',409,'REFERENCE_COLLISION'];
 return null;
}

export async function onRequest({request,env,waitUntil}){
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');
 if(request.method==='GET'&&path==='health'){
  const response={ok:true,version:'V6.2',api:'online',database:env.DB?'bound':'missing',security:(Boolean(env.SESSION_SECRET&&env.SESSION_SECRET.length>=32&&env.ADMIN_PASSWORD&&env.ADMIN_PASSWORD.length>=12)?'configured':'incomplete'),schema:'unknown'};
  if(env.DB)try{const status=await schemaStatus(env);response.schema=status.ready?'ready':'needs_repair';}catch(e){console.error('Health check database failed',e);response.schema='unavailable';}
  response.ok=response.database==='bound'&&response.security==='configured'&&response.schema==='ready';
  return json(response,response.ok?200:503);
 }

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
   let attempt;
   try{attempt=await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_attempts WHERE client_key=? AND created_at>datetime('now','-15 minutes')").bind(clientKey).first();}
   catch(e){
    if(!/no such table: auth_attempts/i.test(String(e.message)))throw e;
    // A legacy/empty D1 database can still authenticate its owner to run the explicit repair.
    await env.DB.prepare(DDL[4]).run();
    await env.DB.prepare(DDL_INDEXES[2]).run();
    attempt={n:0};
   }
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
  if(method==='GET'&&path==='calendar'){const sess=await readSession(request,env);return json(await calendar(env,sess,await site(env)));}
  if(method==='GET'&&path==='availability'){
   const date=url.searchParams.get('date'),sess=await readSession(request,env);if(!dateOk(date,sess?.role==='business'?30:7))return err('Choose a date within the booking window');
   const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE appointment_date=? AND status IN ('pending','confirmed','in_progress')").bind(date).first();
   const c=await site(env),blocked=(c.booking.blockedDates||[]).includes(date);return json({ok:true,booked:Number(row.n),max:c.booking.maxPerDay,available:c.booking.enabled&&!blocked&&Number(row.n)<c.booking.maxPerDay,reason:blocked?'That date is not accepting bookings.':!c.booking.enabled?'Online bookings are currently closed.':Number(row.n)>=c.booking.maxPerDay?'That date is fully booked.':null});
  }
  if(method==='POST'&&path==='bookings'){
   const b=await readBody(request),sess=await readSession(request,env),c=await site(env);
   if(!b)return err('Invalid booking');if(!c.booking.enabled)return err('Bookings are temporarily closed',403);
   const name=text(b.name,90),phone=text(b.phone,35),email=text(b.email,180).toLowerCase(),vehicle=text(b.vehicle,40),date=text(b.date,15),time=text(b.time,10),service_location=text(b.location,20),address=text(b.address,240),notes=text(b.notes,500);
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7||!c.vehicles.some(v=>v.id===vehicle)||!dateOk(date,sess?.role==='business'?30:7)||timePassed(date,time)||!c.booking.timeSlots.includes(time)||!['mobile','dropoff'].includes(service_location))return err('Please complete all required fields');
   if(service_location==='mobile'&&address.length<8)return err('Please enter the mobile detailing address');
   if(service_location==='mobile'&&b.utilitiesOK!==true)return err('Please confirm access to an outdoor water tap and power outlet.');
   if((c.booking.blockedDates||[]).includes(date))return err('This date is not available',409);
   const holiday=c.themeProfiles?.[c.theme]?.prices||{};
   let p=Number.isFinite(holiday[vehicle])?holiday[vehicle]:c.vehicles.find(v=>v.id===vehicle).price,accountId=null;
   if(sess?.role==='business'){p=Number(sess.prices[vehicle]);accountId=sess.id;if(!Number.isFinite(p)||p<0)return err('Price unavailable');}
   let fleetId=null,deptId=null;
   if(b.fleetId){
    if(sess?.role!=='business'||!uuidOK(b.fleetId))return err('Please sign into the company fleet first',401);
    const fleet=await env.DB.prepare('SELECT f.id,f.department_id,f.vehicle FROM fleet_vehicles f WHERE f.id=? AND f.business_account_id=? AND f.active=1').bind(b.fleetId,sess.id).first();
    if(!fleet||fleet.vehicle!==vehicle)return err('Selected fleet vehicle does not match the vehicle category',400);
    fleetId=fleet.id;deptId=fleet.department_id;
   }
   const id=crypto.randomUUID(),reference='TM-'+crypto.randomUUID().slice(0,8).toUpperCase();
   const inserted=await env.DB.prepare(`INSERT INTO bookings (id,reference,customer_name,email,phone,service_location,address,vehicle,appointment_date,appointment_time,notes,quoted_price,business_account_id,fleet_vehicle_id,department_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM bookings WHERE appointment_date=? AND status IN ('pending','confirmed','in_progress')) < ? AND NOT EXISTS (SELECT 1 FROM bookings WHERE appointment_date=? AND appointment_time=? AND status IN ('pending','confirmed','in_progress'))`).bind(id,reference,name,email,phone,service_location,address,vehicle,date,time,notes,Math.round(p),accountId,fleetId,deptId,date,c.booking.maxPerDay,date,time).run();
   if(!inserted.meta?.changes)return err('That date or time is unavailable. Please choose another appointment.',409);
   const emailQueued=Boolean(env.RESEND_API_KEY&&env.MAIL_FROM);if(emailQueued&&waitUntil)waitUntil(notifyBooking(env,{reference,customer_name:name,email,phone,service_location,address,vehicle,appointment_date:date,appointment_time:time,quoted_price:Math.round(p),status:'pending'},'requested'));
   return json({ok:true,reference,emailQueued,notice:'Request recorded. Await confirmation from TM Detailers.'},201);
  }
  if(method==='POST'&&path==='lookup'){
   const b=await readBody(request);if(!b)return err('Invalid request');
   const ref=text(b.reference,40).toUpperCase(),email=text(b.email,180).toLowerCase();
   const booking=await customerBooking(env,ref,email);
   if(!booking)return err('Booking not found',404);
   const c=await site(env),publicInfo=await publicFields(env,booking.id);
   const requests=await env.DB.prepare('SELECT id,kind,message,status,created_at,reviewed_at FROM booking_requests WHERE booking_id=? ORDER BY created_at DESC LIMIT 20').bind(booking.id).all();
   const visible={reference:booking.reference,customer_name:booking.customer_name,vehicle:booking.vehicle,appointment_date:booking.appointment_date,appointment_time:booking.appointment_time,service_location:booking.service_location,service_address:booking.service_location==='dropoff'?c.contact.dropoffAddress:booking.address,status:booking.status,quoted_price:booking.quoted_price,notes:booking.notes,company_booking:Boolean(booking.business_account_id),public_info:publicInfo,photos:await photoList(env,booking.id),requests:requests.results||[]};
   return json({ok:true,booking:visible});
  }
  // Booking photos are PRIVATE: image bytes require a verified booking reference/email or owner session.
  if(method==='POST'&&path==='booking-photos/upload'){
   const form=await request.formData(),f=form.get('image'),kind=text(form.get('kind'),20),sess=await readSession(request,env),isOwner=sess?.role==='admin';
   if(!['before','after'].includes(kind))return err('Choose a photo category');
   if(!isOwner&&kind!=='before')return err('Only TM Detailers can add after photos',403);
   if(!f||typeof f.arrayBuffer!=='function'||f.size<100||f.size>500000||!await photoMagic(f))return err('Upload a JPEG, PNG or WebP under 500 KB. Your phone can resize larger photos.');
   const bid=text(form.get('bookingId'),50),ref=text(form.get('reference'),40).toUpperCase(),email=text(form.get('email'),180).toLowerCase();
   let booking=isOwner&&uuidOK(bid)?await env.DB.prepare('SELECT id,status FROM bookings WHERE id=?').bind(bid).first():await customerBooking(env,ref,email);
   if(!booking)return err('Booking not found or access denied',404);
   if(!isOwner&&['completed','cancelled'].includes(booking.status))return err('Photos cannot be added after the appointment is closed',403);
   const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM booking_photos WHERE booking_id=? AND kind=?').bind(booking.id,kind).first();
   if(Number(count.n)>=4)return err('Maximum four '+kind+' photos per booking. Ask TM Detailers to change these photos.');
   const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO booking_photos (id,booking_id,kind,caption,mime,data) VALUES (?,?,?,?,?,?)').bind(id,booking.id,kind,text(form.get('caption'),160),f.type,new Uint8Array(await f.arrayBuffer())).run();
   return json({ok:true,photo:{id,kind,caption:text(form.get('caption'),160)}},201);
  }
  if(method==='POST'&&path==='booking-photos/view'){
   const b=await readBody(request);if(!b||!uuidOK(b.id))return err('Image not found',404);
   const r=await env.DB.prepare('SELECT p.id,p.booking_id,p.mime,p.data,b.reference,b.email FROM booking_photos p JOIN bookings b ON b.id=p.booking_id WHERE p.id=?').bind(b.id).first();
   if(!r)return err('Image not found',404);
   const sess=await readSession(request,env);
   const customerAllowed=bookingRefOK(text(b.reference,40).toUpperCase())&&text(b.reference,40).toUpperCase()===r.reference&&text(b.email,180).toLowerCase()===r.email;
   if(sess?.role!=='admin'&&!customerAllowed)return err('Not authorized',403);
   return new Response(new Uint8Array(r.data),{status:200,headers:{'content-type':r.mime,'cache-control':'no-store, private','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",'referrer-policy':'no-referrer'}});
  }
  if(method==='POST'&&path==='booking-request'){
   const payload=await readBody(request);if(!payload)return err('Invalid request');
   const ref=text(payload.reference,40).toUpperCase(),email=text(payload.email,180).toLowerCase();
   const type=payload.type==='cancel'?'CANCELLATION REQUEST':payload.type==='reschedule'?'DATE / TIME CHANGE REQUEST':null;
   const message=text(payload.message,350);
   if(!type||!/^TM-[A-Z0-9]{8}$/.test(ref)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err('Invalid request');
   if(type==='DATE / TIME CHANGE REQUEST'&&message.length<8)return err('Describe your requested change');
   const booking=await env.DB.prepare("SELECT id,reference,email,status FROM bookings WHERE reference=? AND email=? AND status NOT IN ('completed','cancelled')").bind(ref,email).first();
   if(!booking)return err('Booking not found or no longer eligible for changes',404);
   const existing=await env.DB.prepare("SELECT COUNT(*) AS n FROM booking_requests WHERE booking_id=? AND status='open'").bind(booking.id).first();
   if(Number(existing?.n)>=3)return err('You already have several open requests. Contact TM Detailers.',429);
   await env.DB.prepare('INSERT INTO booking_requests (id,booking_id,kind,message) VALUES (?,?,?,?)').bind(crypto.randomUUID(),booking.id,type==='CANCELLATION REQUEST'?'cancel':'reschedule',message).run();
   if(env.OWNER_NOTIFICATION_EMAIL&&waitUntil)waitUntil(notify(env,env.OWNER_NOTIFICATION_EMAIL,MAIL_SUBJECT+' — booking change request '+ref,`${ref}\n${type}\n${message}\nOpen Owner Studio to review.`));
   return json({ok:true,message:'Your request was sent to the owner review queue.'});
  }
  // Business-only fleet management; membership is checked in every query.
  if((path==='business/fleet'||path==='business/departments') && ['GET','POST'].includes(method)){
   const sess=await readSession(request,env);if(sess?.role!=='business')return err('Business login required',401);
   if(method==='GET'){
    const d=await env.DB.prepare('SELECT id,name FROM fleet_departments WHERE business_account_id=? ORDER BY name').bind(sess.id).all();
    const vehicles=await env.DB.prepare('SELECT f.id,f.department_id,f.vehicle,f.make,f.model,f.model_year,f.label,d.name department FROM fleet_vehicles f LEFT JOIN fleet_departments d ON d.id=f.department_id WHERE f.business_account_id=? AND f.active=1 ORDER BY d.name,f.make,f.model').bind(sess.id).all();
    return json({ok:true,departments:d.results||[],fleet:vehicles.results||[]});
   }
   const b=await readBody(request);if(!b)return err('Invalid request');
   if(path==='business/departments'){
    const name=text(b.name,70);if(name.length<2)return err('Enter a department name');
    const existing=await env.DB.prepare('SELECT COUNT(*) AS n FROM fleet_departments WHERE business_account_id=?').bind(sess.id).first();if(existing.n>=25)return err('Department limit reached',429);
    await env.DB.prepare('INSERT INTO fleet_departments (id,business_account_id,name) VALUES (?,?,?)').bind(crypto.randomUUID(),sess.id,name).run();return json({ok:true},201);
   }
   const vehicle=text(b.vehicle,35),make=text(b.make,55),model=text(b.model,55),label=text(b.label,70),year=Number(b.year)||null;
   const cfg=await site(env);if(!cfg.vehicles.some(v=>v.id===vehicle)||!make||!model||year&&(!Number.isInteger(year)||year<1980||year>2100))return err('Enter a valid fleet vehicle');
   let depId=null;if(b.departmentId){const dept=await env.DB.prepare('SELECT id FROM fleet_departments WHERE id=? AND business_account_id=?').bind(b.departmentId,sess.id).first();if(!dept)return err('Invalid department');depId=dept.id;}
   const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM fleet_vehicles WHERE business_account_id=? AND active=1').bind(sess.id).first();if(count.n>=300)return err('Fleet vehicle limit reached',429);
   await env.DB.prepare('INSERT INTO fleet_vehicles (id,business_account_id,department_id,vehicle,make,model,model_year,label) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),sess.id,depId,vehicle,make,model,year,label).run();return json({ok:true},201);
  }
  if(method==='DELETE'&&/^business\/fleet\/[0-9a-f-]{36}$/.test(path)){
   const sess=await readSession(request,env);if(sess?.role!=='business')return err('Business login required',401);
   const done=await env.DB.prepare('UPDATE fleet_vehicles SET active=0 WHERE id=? AND business_account_id=?').bind(path.split('/')[2],sess.id).run();return done.meta.changes?json({ok:true}):err('Vehicle not found',404);
  }
  const sess=await readSession(request,env);
  if(!path.startsWith('admin/')||sess?.role!=='admin')return err('Not authorized',401);
  if(method==='GET'&&path==='admin/diagnostics')return json({ok:true,...await schemaStatus(env)});
  if(method==='POST'&&path==='admin/repair-database'){
   const state=await repairSchema(env);
   return json({ok:state.after.ready, ...state, note:'Additive changes only. Existing bookings and company records were not deleted.'},state.after.ready?200:503);
  }

  if(method==='GET'&&path==='admin/track'){
   const ref=text(url.searchParams.get('reference'),40).toUpperCase();if(!bookingRefOK(ref))return err('Enter a booking reference');
   const booking=await env.DB.prepare('SELECT * FROM bookings WHERE reference=?').bind(ref).first();
   if(!booking)return err('Booking not found',404);
   const c=await site(env),reqs=await env.DB.prepare('SELECT id,kind,message,status,created_at,reviewed_at FROM booking_requests WHERE booking_id=? ORDER BY created_at DESC LIMIT 30').bind(booking.id).all();
   return json({ok:true,booking:{...booking,service_address:booking.service_location==='dropoff'?c.contact.dropoffAddress:booking.address,public_info:await publicFields(env,booking.id),photos:await photoList(env,booking.id),requests:reqs.results||[]}});
  }
  if(method==='PUT'&&/^admin\/track\/[0-9a-f-]{36}$/.test(path)){
   const id=path.split('/')[2],b=await readBody(request);
   if(!b)return err('Invalid tracking details');
   const exists=await env.DB.prepare('SELECT id FROM bookings WHERE id=?').bind(id).first();if(!exists)return err('Booking not found',404);
   const headline=text(b.headline,140),message=text(b.status_message,650),next=text(b.next_step,500),eta=text(b.eta_text,120);
   await env.DB.prepare('INSERT INTO booking_public_details (booking_id,headline,status_message,next_step,eta_text,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(booking_id) DO UPDATE SET headline=excluded.headline,status_message=excluded.status_message,next_step=excluded.next_step,eta_text=excluded.eta_text,updated_at=CURRENT_TIMESTAMP').bind(id,headline,message,next,eta).run();
   return json({ok:true,message:'Customer-visible tracker updated'});
  }
  if(method==='DELETE'&&/^admin\/booking-photos\/[0-9a-f-]{36}$/.test(path)){
   const id=path.split('/')[2],r=await env.DB.prepare('DELETE FROM booking_photos WHERE id=?').bind(id).run();
   return r.meta?.changes?json({ok:true}):err('Photo not found',404);
  }
  if(method==='PATCH'&&/^admin\/booking-photos\/[0-9a-f-]{36}$/.test(path)){
   const id=path.split('/')[2],b=await readBody(request);if(!b)return err('Invalid caption');
   const r=await env.DB.prepare('UPDATE booking_photos SET caption=? WHERE id=?').bind(text(b.caption,160),id).run();
   return r.meta?.changes?json({ok:true}):err('Photo not found',404);
  }
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
   const id=crypto.randomUUID(),hashedCode=await codeHash(code,env);
   const existing=await env.DB.prepare('SELECT id FROM business_accounts WHERE code_hash=?').bind(hashedCode).first();
   if(existing)return err('This access code already belongs to a business account. Find that company in the list, or choose another code.',409);
   try{await env.DB.prepare('INSERT INTO business_accounts (id,label,code_hash,pricing_json) VALUES (?,?,?,?)').bind(id,label,hashedCode,JSON.stringify(prices)).run();}
   catch(e){if(/UNIQUE constraint failed/.test(String(e.message)))return err('Access code already exists. Choose another code.',409);throw e;}

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
  if(method==='GET'&&/^admin\/business\/[0-9a-f-]{36}\/fleet$/.test(path)){
   const id=path.split('/')[2];const departments=await env.DB.prepare('SELECT id,name FROM fleet_departments WHERE business_account_id=? ORDER BY name').bind(id).all();
   const fleet=await env.DB.prepare('SELECT f.*,d.name AS department FROM fleet_vehicles f LEFT JOIN fleet_departments d ON d.id=f.department_id WHERE f.business_account_id=? AND f.active=1 ORDER BY f.make,f.model').bind(id).all();
   return json({ok:true,departments:departments.results||[],fleet:fleet.results||[]});
  }
  if(method==='GET'&&path==='admin/bookings'){
   const rows=await env.DB.prepare('SELECT b.*,a.label AS business_label,f.make AS fleet_make,f.model AS fleet_model,f.label AS fleet_label,d.name AS department_name FROM bookings b LEFT JOIN business_accounts a ON a.id=b.business_account_id LEFT JOIN fleet_vehicles f ON f.id=b.fleet_vehicle_id LEFT JOIN fleet_departments d ON d.id=b.department_id ORDER BY b.appointment_date DESC,b.appointment_time DESC LIMIT 500').all();
   return json({ok:true,bookings:rows.results});
  }
  if(method==='GET'&&path==='admin/requests'){
   const rows=await env.DB.prepare(`SELECT r.id,r.booking_id,r.kind,r.message,r.status,r.created_at,r.reviewed_at,b.reference,b.customer_name,b.email,b.appointment_date,b.appointment_time FROM booking_requests r JOIN bookings b ON b.id=r.booking_id ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 500`).all();
   return json({ok:true,requests:rows.results||[]});
  }
  if(method==='PUT'&&/^admin\/requests\/[0-9a-f-]{36}$/.test(path)){
   const id=path.split('/')[2],b=await readBody(request);
   if(!['approved','declined'].includes(b?.status))return err('Choose approved or declined');
   const requestRow=await env.DB.prepare('SELECT id,booking_id,status FROM booking_requests WHERE id=?').bind(id).first();if(!requestRow||requestRow.status!=='open')return err('Request already reviewed',409);
   const result=await env.DB.prepare("UPDATE booking_requests SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'").bind(b.status,id).run();
   if(!result.meta.changes)return err('Request already handled',409);
   return json({ok:true,message:'Request marked '+b.status+'. Edit or cancel the booking separately if approved.'});
  }
  if(method==='PUT'&&/^admin\/bookings\/[0-9a-f-]{36}$/.test(path)){
   const id=path.split('/')[2],b=await readBody(request);if(!b)return err('Invalid booking');
   const old=await env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first();if(!old)return err('Booking not found',404);
   const name=text(b.name,90),email=text(b.email,180).toLowerCase(),phone=text(b.phone,35),vehicle=text(b.vehicle,40),date=text(b.date,15),time=text(b.time,10),address=text(b.address,240),notes=text(b.notes,1800),location=text(b.location,20),status=text(b.status,20),price=Number(b.price);
   const c=await site(env);
   if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7||!c.vehicles.some(v=>v.id===vehicle)||!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!['pending','confirmed','in_progress','completed','cancelled'].includes(status)||!['mobile','dropoff'].includes(location)||!Number.isFinite(price)||price<0||price>10000)return err('Please correct the booking fields');
   if(location==='mobile'&&address.length<8)return err('Enter the mobile service address');
   if(status==='pending'||status==='confirmed'){
    const conflict=await env.DB.prepare("SELECT id FROM bookings WHERE id!=? AND appointment_date=? AND appointment_time=? AND status IN ('pending','confirmed','in_progress') LIMIT 1").bind(id,date,time).first();
    if(conflict)return err('Another booking already occupies that date and time',409);
   }
   await env.DB.prepare('UPDATE bookings SET customer_name=?,email=?,phone=?,vehicle=?,appointment_date=?,appointment_time=?,service_location=?,address=?,notes=?,quoted_price=?,status=? WHERE id=?').bind(name,email,phone,vehicle,date,time,location,address,notes,Math.round(price),status,id).run();
   const updated=await env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first();
   const emailQueued=Boolean(env.RESEND_API_KEY&&env.MAIL_FROM);if(emailQueued&&waitUntil)waitUntil(notifyBooking(env,updated,old.status!==status?status:'updated'));
   return json({ok:true,emailQueued});
  }
  if(method==='DELETE'&&/^admin\/bookings\/[0-9a-f-]{36}$/.test(path)){
   const id=path.split('/')[2],body=await readBody(request);
   const reference=text(body?.reference,40).toUpperCase();
   if(!/^TM-[A-Z0-9]{8}$/.test(reference))return err('Confirm the booking reference to delete this booking.');
   // Match both the internal ID and the owner-confirmed reference to prevent deleting a different row.
   const deleted=await env.DB.prepare('DELETE FROM bookings WHERE id=? AND reference=?').bind(id,reference).run();
   if(!deleted.meta?.changes)return err('Booking not found or reference did not match. Refresh the booking list.',404);
   return json({ok:true,message:'Booking permanently deleted.'});
  }
  return err('Not found',404);
 }catch(e){
  const known=publicError(e);if(known){console.error('TM API structured error',known[2],e);return json({ok:false,error:known[0],code:known[2]},known[1]);}
  const incident=crypto.randomUUID().slice(0,8).toUpperCase();
  console.error('TM API failure',incident,method,path,e);
  return json({ok:false,error:'Server error. Cloudflare logs will show incident '+incident+'.',code:'SERVER_FAILURE',incident},500);
 }
}
