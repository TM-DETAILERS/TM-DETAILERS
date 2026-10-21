import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/[[path]].js';

const root = process.cwd();
let passes = 0;
function check(condition, label) {
  assert.ok(condition, label);
  passes++;
  console.log('PASS ' + label);
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function staticCheck() {
  const required = [
    'public/index.html', 'public/checkout/index.html', 'public/business/index.html',
    'public/track/index.html', 'public/studio/index.html',
    'public/assets/defaults.js', 'public/assets/app.js',
    'public/assets/checkout.js', 'public/assets/business-portal.js',
    'public/assets/track-pro.js', 'public/assets/studio-pro.js',
    'public/assets/studio-pro.css', 'public/_routes.json',
    'functions/api/[[path]].js'
  ];
  for (const file of required) check(existsSync(join(root, file)), 'required file: ' + file);
  const jsFiles = [...walk(join(root, 'public')), ...walk(join(root, 'functions'))].filter((file) => extname(file) === '.js');
  for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    check(result.status === 0, 'syntax: ' + file.replace(root + '/', '') + (result.status ? '\n' + result.stderr : ''));
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/g)) {
      const actual = resolve(dirname(file), match[1]);
      check(existsSync(actual), 'import: ' + file.replace(root + '/', '') + ' -> ' + match[1]);
    }
  }
  const pages = walk(join(root, 'public')).filter((file) => file.endsWith('.html'));
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const urls = [];
    for (const match of html.matchAll(/<script\b[^>]*\bsrc=['"]([^'"]+)['"]/gi)) urls.push(match[1]);
    for (const match of html.matchAll(/<link\b[^>]*\brel=['"]stylesheet['"][^>]*\bhref=['"]([^'"]+)['"]/gi)) urls.push(match[1]);
    for (const url of urls) {
      if (/^(https?:|\/\/|data:)/i.test(url)) continue;
      const p = url.startsWith('/') ? resolve(root, 'public', url.slice(1)) : resolve(dirname(page), url.split(/[?#]/)[0]);
      check(existsSync(p), 'HTML asset: ' + page.replace(root + '/', '') + ' -> ' + url);
    }
  }
  console.log('Static check completed: ' + passes + ' checks passed.');
}

class TestD1 {
  constructor() { this.db = new DatabaseSync(':memory:'); this.db.exec('PRAGMA foreign_keys=ON;'); }
  prepare(sql) {
    const stmt = this.db.prepare(sql);
    let values = [];
    return {
      bind(...args) { values = args.map(v => v instanceof Uint8Array ? Buffer.from(v) : v); return this; },
      async first() { return stmt.get(...values) || null; },
      async all() { return { results: stmt.all(...values) }; },
      async run() { const result = stmt.run(...values); return { meta: { changes: Number(result.changes) } }; }
    };
  }
}

async function apiCheck() {
  const DB = new TestD1();
  const env = { DB, ADMIN_PASSWORD: 'test-owner-password-not-real', SESSION_SECRET: 'test-session-secret-isolated-only-0123456789' };
  const origin = 'https://tm-testing.invalid';
  async function call(method, path, data, cookie) {
    const headers = { Origin: origin };
    if (cookie) headers.Cookie = cookie;
    const body = data === undefined ? undefined : JSON.stringify(data);
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await onRequest({
      request: new Request(origin + '/api/' + path, { method, headers, body }),
      env,
      waitUntil() {}
    });
    return { status: response.status, data: await response.json(), cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
  }
  let r = await call('GET', 'health');
  check(r.status === 200 && r.data.schema === 'ready', 'empty database automatically receives additive schema upgrade');
  r = await call('POST', 'login', { kind: 'admin', password: env.ADMIN_PASSWORD });
  check(r.status === 200 && r.data.role === 'admin', 'owner signs in to blank test database');
  const ownerCookie = r.cookie;
  check(ownerCookie.includes('tm_session='), 'secure owner session cookie returned');
  r = await call('POST', 'admin/repair-database', {}, ownerCookie);
  check(r.status === 200 && r.data.ok, 'owner initializes blank database through repair endpoint');
  r = await call('GET', 'health');
  check(r.status === 200 && r.data.schema === 'ready', 'database schema now ready');
  r = await call('GET', 'site');
  check(r.status === 200 && r.data.site.booking.timeSlots.length > 0, 'default booking times available');
  const site = r.data.site;
  // Mimic an older saved settings record with missing nested defaults.
  DB.db.prepare('INSERT INTO site_settings (id,config_json) VALUES (1,?)').run(JSON.stringify({booking:{maxPerDay:2},theme:'default'}));
  r = await call('GET', 'site');
  check(r.status === 200 && r.data.site.booking.timeSlots.length > 0, 'legacy settings merge does not lose time slots');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p => [p.type,p.value]));
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 2)).toISOString().slice(0,10);
  const booking = { name:'Sample Customer',email:'customer@example.invalid',phone:'4165550101',vehicle:'sedan',date,time:'11:00',location:'dropoff',address:'',notes:'' };
  r = await call('POST', 'bookings', booking);
  check(r.status === 201 && /^TM-[A-Z0-9]{8}$/.test(r.data.reference), 'regular customer booking creates reference');
  const reference = r.data.reference;
  r = await call('POST', 'lookup', {reference,email:booking.email});
  check(r.status === 200 && r.data.booking.status === 'pending', 'customer can track pending booking');
  r = await call('POST', 'bookings', booking);
  check(r.status === 409, 'cannot double-book an occupied time slot');
  r = await call('POST', 'admin/business', {label:'Sample Fleet Co',code:'TM-BIZ-AUDITCODE123', prices:{sedan:60,suv:65,truck:75,van:75,sprinter:100}}, ownerCookie);
  check(r.status === 201, 'owner creates test business account');
  r = await call('POST', 'admin/business', {label:'Duplicate Co',code:'TM-BIZ-AUDITCODE123',prices:{sedan:60,suv:65,truck:75,van:75,sprinter:100}}, ownerCookie);
  check(r.status === 409 && r.data.error.includes('already'), 'duplicate company code yields clear error');
  r = await call('POST', 'login', {kind:'business',code:'TM-BIZ-AUDITCODE123'});
  check(r.status === 200 && r.data.role === 'business', 'business login works');
  const businessCookie=r.cookie;
  r = await call('POST', 'business/departments', {name:'Operations'}, businessCookie);
  check(r.status === 201, 'business can add department');
  r = await call('POST', 'business/fleet', {vehicle:'suv',make:'Toyota',model:'RAV4',year:2020,label:'Fleet 23'}, businessCookie);
  check(r.status === 201, 'business can register fleet vehicle');
  r = await call('GET', 'business/fleet', undefined, businessCookie);
  check(r.status === 200 && r.data.fleet.length === 1 && r.data.departments.length === 1, 'business fleet and departments load');
  const companyBooking = {...booking, accountContext:'business',vehicle:'suv',time:'13:00'};
  r = await call('POST', 'bookings', companyBooking);
  check(r.status === 401, 'business booking rejects expired or missing business session');
  r = await call('POST', 'bookings', companyBooking, businessCookie);
  check(r.status === 201, 'business booking succeeds with authenticated session');
  const companyRef = r.data.reference;
  r = await call('POST', 'lookup',{reference:companyRef,email:booking.email});
  check(r.status === 200 && r.data.booking.quoted_price === 65 && r.data.booking.company_booking === true, 'business rate and account association saved');
  r = await call('GET', 'admin/business',undefined,ownerCookie);
  check(r.status === 200 && r.data.accounts.some(c => c.label==='Sample Fleet Co'), 'owner sees the company account');
  r = await call('GET', 'admin/bookings',undefined,ownerCookie);
  check(r.status === 200 && r.data.bookings.length >= 2, 'owner sees regular and business appointments');
  // A partially migrated production-like D1 database must retain existing records.
  const olderDB=new TestD1();
  olderDB.db.exec(readFileSync(join(root,'database/schema.sql'),'utf8'));
  olderDB.db.prepare('INSERT INTO business_accounts (id,label,code_hash,pricing_json) VALUES (?,?,?,?)')
    .run('preserved-company','Original Company','test-hash-not-real',JSON.stringify({sedan:60}));
  olderDB.db.prepare('INSERT INTO bookings (id,reference,customer_name,email,phone,service_location,address,vehicle,appointment_date,appointment_time,notes,quoted_price,business_account_id,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('preserved-booking','TM-1234ABCD','Original Customer','existing@example.invalid','4165550145','dropoff','', 'sedan','2026-10-20','11:00','Existing notes',80,'preserved-company','confirmed');
  const legacyEnv={...env,DB:olderDB};
  const legacyResponse=await onRequest({request:new Request(origin+'/api/health'),env:legacyEnv,waitUntil(){}});
  const legacyHealth=await legacyResponse.json();
  check(legacyResponse.status===200&&legacyHealth.schema==='ready','older database upgrades automatically at first request');
  check(olderDB.db.prepare('SELECT COUNT(*) AS n FROM business_accounts').get().n===1,'existing company is preserved');
  const preserved=olderDB.db.prepare("SELECT customer_name,notes,quoted_price,status FROM bookings WHERE id='preserved-booking'").get();
  check(preserved?.customer_name==='Original Customer'&&preserved.notes==='Existing notes'&&preserved.quoted_price===80&&preserved.status==='confirmed','existing booking and all details are preserved');
  const upgradedColumns=olderDB.db.prepare('PRAGMA table_info(bookings)').all().map(x=>x.name);
  check(upgradedColumns.includes('department_id')&&upgradedColumns.includes('fleet_vehicle_id'),'legacy bookings receive missing fleet columns');
  const legacySecond=await onRequest({request:new Request(origin+'/api/health'),env:legacyEnv,waitUntil(){}});
  check(legacySecond.status===200,'automatic migration is safe to run again');
  console.log('Isolated API check completed: ' + passes + ' checks passed.');
}

if (process.argv[2] === 'static') staticCheck();
else if (process.argv[2] === 'api') await apiCheck();
else throw new Error('Specify static or api');
