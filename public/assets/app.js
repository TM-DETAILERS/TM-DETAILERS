import { DEFAULT_SITE } from './defaults.js';
const $ = s => document.querySelector(s);
const esc = value => String(value??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanURL = (src, allowMedia=false) => typeof src==='string' && (/^https:\/\/[^\s"'<>]+$/i.test(src)||(allowMedia&&/^\/api\/media\/[0-9a-f-]{36}$/i.test(src))) ? src : '';
const money = p => '$'+Number(p??0).toLocaleString('en-CA',{maximumFractionDigits:0});
const copyObj = val => JSON.parse(JSON.stringify(val));
let site=copyObj(DEFAULT_SITE), draft=null, backendReady=false, session=null, accounts=[], bookings=[], activeTab='overview';
async function api(endpoint, opts={}){
 const response=await fetch('/api/'+endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(18000),...opts,headers:{...(opts.body && typeof opts.body==='string'?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});
 let data;try{data=await response.json();}catch{throw Error('The server did not return valid data');}
 if(!response.ok||!data.ok)throw Error(data.error||'Request failed');
 return data;
}
const send=(endpoint,body,method='POST')=>api(endpoint,{method,body:JSON.stringify(body)});
function changeAlert(el,message,problem=false){if(!el)return;el.textContent=message;el.hidden=!message;el.classList.toggle('error',problem);}
function titleCase(s){return (s||'').replace(/(^|\s)\S/g,c=>c.toUpperCase());}
function renderTitle(){
 const profile=site.themeProfiles?.[site.theme];
 const title=(profile?.headline||site.hero.title)||'';
 const dot=title.indexOf('. ');
 $('#hero-title').innerHTML=dot<0?esc(title):esc(title.slice(0,dot+1))+'<br><em>'+esc(title.slice(dot+2))+'</em>';
}
function renderSite(){
 document.body.dataset.theme=site.theme||'default';
 const profile=site.themeProfiles?.[site.theme]||{};
 for(const [key,variable] of [['accent','--atelier-accent'],['background','--atelier-bg']]){document.body.style.removeProperty(variable);if(/^#[0-9a-fA-F]{6}$/.test(profile[key]||''))document.body.style.setProperty(variable,profile[key]);}
 document.documentElement.style.setProperty('--blue',/^#[0-9a-fA-F]{6}$/.test(site.accent)?site.accent:'#b49b78');
 renderTitle();
 $('#hero-eyebrow').textContent=site.theme==='default'?site.hero.eyebrow:'TM / '+site.theme.toUpperCase()+' EDITION';
 $('#hero-description').textContent=profile.description||site.hero.description;
 const heroSrc=cleanURL(profile.heroImage,true)||cleanURL(site.hero.image,true);
 $('#hero-image').src=heroSrc||'/assets/tm-logo.jpg';
 const illustration=$('.hero-vehicle-drawing');if(illustration){illustration.src=heroSrc||'/assets/atelier-vehicle.svg';illustration.style.filter=heroSrc?'brightness(.68) contrast(1.08)':'grayscale(.15)';}
 $('#announcement').hidden=!site.announcement.enabled;
 $('#announcement').textContent=[site.announcement.text,site.announcement.code&&'CODE: '+site.announcement.code].filter(Boolean).join(' · ');
 $('#services-intro').textContent=site.servicesIntro;
 $('#service-list').innerHTML=site.services.map((s,i)=>`<article class="service-card reveal"><div class="service-top"><span class="service-no">${esc(s.number||String(i+1).padStart(2,'0'))} / TM</span><span class="service-icon" aria-hidden="true">${['✧','✦','◈','◎','◉'][i%5]}</span></div><div class="service-bottom"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></div></article>`).join('');
 $('#pricing-intro').textContent=site.pricingIntro;
 $('#pricing-heading').innerHTML=session?.role==='business'?'Your business <span class="soft">rates.</span>':'Straightforward <span class="soft">pricing.</span>';
 $('#business-banner').hidden=session?.role!=='business';
 $('#nav-business').innerHTML='Business access <span aria-hidden="true">↗</span>'; 
 if(session?.role==='business')$('#business-welcome').textContent=session.label+' · Business rates';
 $('#pricing-grid').innerHTML=site.vehicles.map((v,i)=>{
  const price=(site.themeProfiles?.[site.theme]?.prices||{})[v.id]??v.price;
  return `<article class="price-card reveal"><span class="price-n">0${i+1} / VEHICLE</span><h3>${esc(v.name)}</h3><p class="price-sub">${esc(v.description)}</p><div class="price-money">${money(price)}<small>CAD</small></div><a href="#book" data-vehicle="${esc(v.id)}">BOOK THIS VEHICLE <span>↗</span></a></article>`;
 }).join('');
 $('#gallery-heading').textContent=site.galleryTitle;
 $('#gallery-subtitle').textContent=site.gallerySubtitle;
 $('#gallery-grid').innerHTML=site.gallery.length?site.gallery.map(g=>{
  const src=cleanURL(g.src,true);if(!src)return '';
  const link=cleanURL(g.link)||src;
  return `<a class="gallery-item reveal" href="${esc(link)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${esc(src)}" alt="${esc(g.alt||g.caption||'TM Detailers work')}"><span class="gallery-caption">${esc(g.caption||'TM Detailers')}</span></a>`;
 }).join(''):'<div class="gallery-empty reveal"><span class="gallery-empty-icon">✦</span><h3>Details worth showing.</h3><p>Our latest transformations are on the way.</p></div>';
 $('#about-eyebrow').textContent=site.about.eyebrow;
 $('#about-title').textContent=site.about.title;
 $('#about-body').textContent=site.about.body;
 $('#about-points').innerHTML=site.about.points.map(p=>`<div><span aria-hidden="true">✓</span>${esc(p)}</div>`).join('');
 $('#booking-note').textContent=site.booking.notice;
 $('#book-vehicle').innerHTML=site.vehicles.map(v=>`<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');
 $('#book-time').innerHTML='<option value="">Choose a time</option>'+site.booking.timeSlots.map(t=>`<option value="${esc(t)}">${esc(formatTime(t))}</option>`).join('');
 $('#contact-phone').innerHTML=esc(site.contact.phone)+' <span>↗</span>';
 $('#contact-phone').href='tel:'+site.contact.phone.replace(/[^+\d]/g,'');
 $('#contact-email').innerHTML=esc(site.contact.email)+' <span>↗</span>';
 $('#contact-email').href='mailto:'+encodeURIComponent(site.contact.email);
 const instagram='https://www.instagram.com/'+encodeURIComponent(site.contact.instagram.replace(/^@/,''))+'/';
 $('#contact-instagram').innerHTML='@'+esc(site.contact.instagram.replace(/^@/,''))+' <span>↗</span>';
 $('#contact-instagram').href=instagram;$('#instagram-link').href=instagram;
 $('#contact-city').textContent=site.contact.city+' · '+site.contact.hours;
 $('#footer-tagline').textContent=site.brandTagline.toUpperCase();
 for(const [name,show] of Object.entries(site.sections)){
  const id=name==='booking'?'book':name;
  const el=$('#'+id);if(el)el.hidden=!show;
 }
 $('#book-submit').disabled=!backendReady||!site.booking.enabled;
 $('#book-submit').innerHTML=!backendReady?'Booking setup in progress':!site.booking.enabled?'Bookings temporarily closed':'Request appointment <span>↗</span>';
 if(!backendReady)changeAlert($('#booking-alert'),'Online booking will open when the secure database is connected. For now, contact us directly to book.');
 calcQuote();revealSetup();
}
const formatTime = t => { const [h,m]=(t||'00:00').split(':').map(Number);return String(h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' AM':' PM'); };
function calcQuote(){const id=$('#book-vehicle')?.value;const v=site.vehicles.find(x=>x.id===id);$('#book-quote').textContent=money((site.themeProfiles?.[site.theme]?.prices||{})[id]??v?.price)+' CAD';}
function revealSetup(){
 if(!('IntersectionObserver' in window)){document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-visible'));return;}
 const obs=new IntersectionObserver((entries,o)=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');o.unobserve(e.target);}}),{threshold:.08,rootMargin:'0px 0px 25px 0px'});
 document.querySelectorAll('.reveal:not(.is-visible)').forEach(el=>obs.observe(el));
}
function openDialog(content){$('#dialog-body').innerHTML=content;$('#dialog-backdrop').hidden=false;document.body.style.overflow='hidden';$('#dialog-close').focus();}
function closeDialog(){ $('#dialog-backdrop').hidden=true;document.body.style.overflow=$('#admin-panel').hidden?'':'hidden';}
function authDialog(kind){
 const admin=kind==='admin';
 openDialog(`<div class="dialog-eyebrow">${admin?'PRIVATE / OWNER ACCESS':'PRIVATE / BUSINESS ACCOUNT'}</div><h2 id="dialog-title">${admin?'Welcome back.':'Your business rates.'}</h2><p>${admin?'Sign in to manage your TM Detailers website, bookings and client accounts.':'Enter your company’s assigned booking code to access its vehicle pricing.'}</p><form id="login-form"><label>${admin?'Owner password':'Business account code'}<input id="login-field" type="${admin?'password':'text'}" autocomplete="off" required placeholder="${admin?'Enter password':'TM-BIZ-...'}" maxlength="150"></label><button class="button button-solid button-full" type="submit">${admin?'Open dashboard':'Unlock business pricing'} <span>↗</span></button><div id="dialog-alert" class="inline-alert" hidden role="status"></div></form><small class="dialog-small">${admin?'Admin credentials are checked securely on the server.':'Only accounts approved by TM Detailers can access private business rates.'}</small>`);
 $('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;
  try{
   const val=$('#login-field').value;const r=await send('login',admin?{kind:'admin',password:val}:{kind:'business',code:val});
   session={role:r.role,label:r.label||null,prices:r.prices||null};closeDialog();
   if(admin)await openAdmin();else{renderSite();document.querySelector('#pricing').scrollIntoView({behavior:'smooth'});}
  }catch(error){changeAlert($('#dialog-alert'),error.message,true);}finally{button.disabled=false;}
 });
 $('#login-field').focus();
}
function lookupDialog(){
 openDialog('<div class="dialog-eyebrow">APPOINTMENT TRACKER</div><h2 id="dialog-title">Check your booking.</h2><p>Use your booking reference and the email you booked with.</p><form id="lookup-form"><label>Booking reference<input id="lookup-reference" placeholder="TM-XXXXXXXX" required></label><label>Email address<input id="lookup-email" type="email" placeholder="you@example.com" required></label><button class="button button-solid button-full" type="submit">Check booking status <span>↗</span></button><div id="dialog-alert" class="inline-alert" hidden role="status"></div><div id="lookup-result"></div></form>');
 $('#lookup-form').addEventListener('submit',async e=>{
  e.preventDefault();try{
   const {booking:b}=await send('lookup',{reference:$('#lookup-reference').value,email:$('#lookup-email').value});
   const v=site.vehicles.find(v=>v.id===b.vehicle);
   $('#lookup-result').innerHTML=`<div class="booking-result"><strong>${esc(b.reference)}</strong><p>Status: <b>${esc(titleCase(b.status))}</b></p><p>${esc(v?.name||b.vehicle)} · ${esc(b.appointment_date)} at ${esc(formatTime(b.appointment_time))}</p><p>Estimated price: ${money(b.quoted_price)} CAD</p></div>`;
   changeAlert($('#dialog-alert'),'');
  }catch(ex){$('#lookup-result').innerHTML='';changeAlert($('#dialog-alert'),ex.message,true);}
 });
}
async function logout(){try{await send('logout',{});}catch{}session=null;$('#admin-panel').hidden=true;document.body.style.overflow='';renderSite();window.scrollTo({top:0,behavior:'smooth'});}
async function book(e){e.preventDefault();if(!backendReady)return;
 const f=new FormData(e.currentTarget),date=String(f.get('date')||'');
 const b={name:f.get('name'),email:f.get('email'),phone:f.get('phone'),vehicle:f.get('vehicle'),date,time:f.get('time'),location:f.get('location'),address:f.get('address')||'',notes:f.get('notes')||''};
 const button=$('#book-submit');button.disabled=true;
 try{
  const check=await api('availability?date='+encodeURIComponent(date));
  if(!check.available)throw Error(check.reason||'That date is unavailable. Please choose another date.');
  const reply=await send('bookings',b);
  openDialog(`<div class="dialog-eyebrow">REQUEST RECEIVED</div><h2 id="dialog-title">You're on our list.</h2><span class="success-mark">✓</span><p>Thanks for booking with TM Detailers! We’ll contact you to confirm the appointment.</p><div class="booking-result"><strong>${esc(reply.reference)}</strong><p>Save this reference to check your booking status later.</p><a class="text-button" href="/track/?ref=${encodeURIComponent(reply.reference)}">Find this booking ↗</a></div><button class="button button-outline button-full" id="copy-booking-ref">Copy booking reference ↗</button>`);
  $('#copy-booking-ref').onclick=()=>navigator.clipboard?.writeText(reply.reference);
  $('#booking-form').reset();$('#mobile-address').hidden=true;wizardStep=0;updateBookingWizard();calcQuote();changeAlert($('#booking-alert'),'');
 }catch(error){changeAlert($('#booking-alert'),error.message,true);}finally{button.disabled=!backendReady||!site.booking.enabled;}
}
const getPath=(root,path)=>String(path).split('.').reduce((o,k)=>o?.[k],root);
function setPath(root,path,value){let parts=String(path).split('.'),cur=root;for(let i=0;i<parts.length-1;i++){cur=cur[parts[i]];}cur[parts.at(-1)]=value;}
const inputField=(label,path,kind='text',opts={})=>{
 const value=getPath(draft,path);
 const inside=kind==='textarea'?`<textarea class="admin-textarea" data-path="${esc(path)}" rows="${opts.rows||3}">${esc(value??'')}</textarea>`:kind==='checkbox'?`<input type="checkbox" data-path="${esc(path)}" ${value?'checked':''}>`:kind==='color'?`<input class="admin-input admin-color" type="color" data-path="${esc(path)}" value="${esc(/^#[0-9a-fA-F]{6}$/.test(value||'')?value:'#b9a27d')}">`:`<input class="admin-input" type="${kind}" data-path="${esc(path)}" value="${esc(value??'')}" ${kind==='number'?'min="0" max="10000" step="1"':''}>`;
 return `<label class="admin-field ${opts.full?'full':''}">${esc(label)}${inside}</label>`;
};
const saveBtn=()=>'<div class="admin-actions"><button class="admin-btn" data-admin-action="save-site">Save website changes ↗</button><span class="admin-note">Changes go live on your site after saving.</span></div>';
function adminStatus(msg,bad=false){const e=$('#admin-save-state');e.textContent=msg;e.style.color=bad?'#ff8d9c':'#85d8ad';}
async function openAdmin(){
 if(session?.role!=='admin')return;
 $('#admin-panel').hidden=false;document.body.style.overflow='hidden';
 try{site=(await api('admin/site')).site;}catch(ex){console.error(ex);}
 draft=copyObj(site);activeTab='overview';
 const buttons=document.querySelectorAll('.admin-sidebar button');buttons.forEach(x=>x.classList.toggle('active',x.dataset.tab==='overview'));
 await drawAdmin();
}
async function drawAdmin(){
 const names={overview:'Owner overview',content:'Content & brand',services:'Your services',pricing:'Pricing studio',gallery:'Your photography',business:'Business accounts',bookings:'Booking operations',settings:'Seasonal design studio'};
 $('#admin-heading').textContent=names[activeTab]||'Overview';adminStatus('');
 const c=$('#admin-content');
 if(activeTab==='overview'){
  c.innerHTML='<div class="admin-help"><strong>QUICK ACTIONS</strong> — Make the changes you need without searching through settings. <button class="admin-btn secondary" data-switch-tab="bookings">Open bookings ↗</button> <button class="admin-btn secondary" data-switch-tab="gallery">Manage photos ↗</button> <button class="admin-btn secondary" data-switch-tab="settings">Seasonal redesign ↗</button> <button class="admin-btn secondary" data-switch-tab="business">Business pricing ↗</button></div><div class="admin-grid"><div class="admin-stat"><span>Total bookings</span><strong id="s-total">—</strong></div><div class="admin-stat"><span>Pending bookings</span><strong id="s-pending">—</strong></div><div class="admin-stat"><span>Confirmed</span><strong id="s-confirmed">—</strong></div><div class="admin-stat"><span>Active business accounts</span><strong id="s-business">—</strong></div></div><div class="admin-section"><div class="admin-card"><h3>Welcome to TM Studio.</h3><p>This is your control centre. Edit the public website in Site content, manage your photos in Photo gallery, set special business rates and codes in Business accounts, and review all booking requests in Bookings.</p><p><b>Important:</b> customer bookings are requests until you mark them confirmed.</p><button class="admin-btn secondary" data-switch-tab="bookings">View bookings ↗</button></div></div>';
  try{const r=await api('admin/overview');for(const k of ['total','pending','confirmed'])$('#s-'+k).textContent=r.stats[k]||0;$('#s-business').textContent=r.stats.accounts||0;}catch(ex){adminStatus(ex.message,true);}
 } else if(activeTab==='content'){
  c.innerHTML=`<div class="admin-rows"><div class="admin-card"><h3>Hero · First impression</h3><div class="admin-fields">${inputField('Hero label','hero.eyebrow')}${inputField('Headline (use a period to split into two lines)','hero.title')}${inputField('Description','hero.description','textarea',{full:true})}${inputField('Hero photo URL (optional)','hero.image','text',{full:true})}</div><p>To use your own image, upload it below and it will become the hero image.</p><input type="file" accept="image/jpeg,image/png,image/webp" id="hero-upload-file"><button class="admin-btn secondary" data-admin-action="upload-hero">Upload hero image</button><div id="hero-upload-status" class="admin-note"></div></div>
  <div class="admin-card"><h3>About / Story</h3><div class="admin-fields">${inputField('Small heading','about.eyebrow')}${inputField('Section headline','about.title')}${inputField('Our story','about.body','textarea',{full:true})}${draft.about.points.map((p,i)=>inputField('Value '+(i+1),'about.points.'+i)).join('')}</div></div>
  <div class="admin-card"><h3>Customer-facing contact details</h3><div class="admin-fields">${inputField('Phone number','contact.phone')}${inputField('Email address','contact.email')}${inputField('Instagram username','contact.instagram')}${inputField('City / location','contact.city')}${inputField('Service area','contact.serviceArea')}${inputField('Appointment hours','contact.hours')}${inputField('Mobile service information','contact.locationNote','textarea',{full:true})}</div></div>
  <div class="admin-card"><h3>Branding & announcement</h3><div class="admin-fields">${inputField('Business name','businessName')}${inputField('Footer tagline','brandTagline')}${inputField('Services intro','servicesIntro','textarea',{full:true})}${inputField('Pricing intro','pricingIntro','textarea',{full:true})}</div><div class="admin-actions"><label class="admin-switch"><input type="checkbox" data-path="announcement.enabled" ${draft.announcement.enabled?'checked':''}> Show promotion banner</label></div><div class="admin-fields">${inputField('Banner message','announcement.text')}${inputField('Promo code (display only)','announcement.code')}</div></div>${saveBtn()}</div>`;
 } else if(activeTab==='services'){
  c.innerHTML=`<div class="admin-help">Edit your service names and descriptions. These appear on the public homepage.</div><div class="admin-rows admin-section">${draft.services.map((v,i)=>`<div class="admin-entry"><div class="admin-entry-head"><strong>Service ${i+1}</strong><button class="admin-btn danger" data-admin-action="remove-service" data-index="${i}">Remove</button></div><div class="admin-fields">${inputField('Service title',`services.${i}.name`)}${inputField('Description',`services.${i}.description`,'textarea',{full:true})}</div></div>`).join('')}</div><div class="admin-actions"><button class="admin-btn secondary" data-admin-action="add-service">+ Add service</button></div>${saveBtn()}`;
 } else if(activeTab==='pricing'){
  c.innerHTML=`<div class="admin-help">These are your standard public prices and your default corporate price template. Individual business accounts can have their own prices.</div><div class="admin-rows admin-section">${draft.vehicles.map((v,i)=>`<div class="admin-entry"><div class="admin-entry-head"><strong>${esc(v.name)}</strong><span class="admin-pill">${esc(v.id.toUpperCase())}</span></div><div class="admin-fields">${inputField('Vehicle display name',`vehicles.${i}.name`)}${inputField('Vehicle description',`vehicles.${i}.description`)}${inputField('Public price (CAD)',`vehicles.${i}.price`,'number')}${inputField('Default business price (CAD)',`businessPrices.${v.id}`,'number')}</div></div>`).join('')}</div>${saveBtn()}`;
 } else if(activeTab==='gallery'){
  c.innerHTML=`<div class="admin-card"><h3>Your work, your photos.</h3><p>Upload real TM Detailers pictures from your device. They're stored in your Cloudflare database, then displayed on your public website after you save. Photos are compressed for faster loading.</p><div class="upload-zone"><input id="gallery-upload-file" type="file" accept="image/jpeg,image/png,image/webp" multiple><p>Choose JPG, PNG or WebP files. Up to 20 gallery photos total.</p><button class="admin-btn" data-admin-action="upload-gallery">Upload selected photos</button><p id="gallery-upload-status"></p></div></div><div class="admin-card"><h3>Gallery heading & introduction</h3><div class="admin-fields">${inputField('Gallery heading','galleryTitle')}${inputField('Gallery description','gallerySubtitle','textarea',{full:true})}</div></div><div class="admin-rows admin-section">${draft.gallery.map((g,i)=>`<div class="admin-entry"><div class="admin-entry-head"><strong>Photo ${i+1}</strong><button class="admin-btn danger" data-admin-action="remove-photo" data-index="${i}">Remove</button></div>${cleanURL(g.src,true)?`<img class="admin-photo-preview" src="${esc(g.src)}" alt="">`:''}<div class="admin-photo-control"><button class="admin-btn secondary" data-admin-action="move-photo-up" data-index="${i}" ${i===0?'disabled':''}>↑ Move up</button><button class="admin-btn secondary" data-admin-action="move-photo-down" data-index="${i}" ${i===draft.gallery.length-1?'disabled':''}>↓ Move down</button></div><div class="admin-fields">${inputField('Photo URL',`gallery.${i}.src`,'text',{full:true})}${inputField('Caption',`gallery.${i}.caption`)}${inputField('Alt text / accessibility',`gallery.${i}.alt`)}${inputField('Photo link (optional)',`gallery.${i}.link`,'text',{full:true})}</div></div>`).join('')}</div><div class="admin-actions"><button class="admin-btn secondary" data-admin-action="add-url-photo">+ Add photo by URL</button></div>${saveBtn()}`;
 } else if(activeTab==='settings'){
  const themes=[['default','Signature atelier','Graphite · warm metal'],['eid','Eid edition','Emerald · moonlight · gold'],['thanksgiving','Thanksgiving','Copper · amber · walnut'],['christmas','Winter holidays','Burgundy · evergreen'],['halloween','Halloween','Aubergine · ember'],['newyear','New Year','Midnight blue · silver']];
  const current=draft.theme||'default';const path='themeProfiles.'+current;
  c.innerHTML=`<div class="admin-help"><strong>SEASONAL DESIGN STUDIO</strong> — Switch the full site's backgrounds, hero treatment, typography accents, panels, booking and footer. Then customize the campaign headline, image and the prices customers will actually be quoted. Click Save to publish.</div>
  <div class="theme-studio-grid">${themes.map(([id,name,caption])=>`<button type="button" data-theme-choice="${id}" class="theme-option ${current===id?'selected':''}" data-style="${id}"><span>${esc(caption)}</span><strong>${esc(name)}</strong><span>${current===id?'● ACTIVE DESIGN':'↗ SELECT DESIGN'}</span></button>`).join('')}</div>
  <div class="admin-card admin-section"><h3>${esc(themes.find(t=>t[0]===current)[1])} / Campaign editor</h3><p>Leave the fields empty to use the standard website copy and prices. To change an individual vehicle price for this holiday, enter a rate below.</p><div class="admin-fields">${inputField('Holiday greeting (e.g. Eid Mubarak)',path+'.greeting','text',{full:true})}${inputField('Holiday headline',path+'.headline','text',{full:true})}${inputField('Holiday description',path+'.description','textarea',{full:true})}${inputField('Holiday hero image URL',path+'.heroImage','text',{full:true})}${inputField('Seasonal highlight colour',path+'.accent','color')}${inputField('Seasonal background colour',path+'.background','color')}</div><div class="theme-editor-note">The layout and entire site palette change with the theme. The campaign image overrides the standard hero photo; you can upload your own photograph in Site content and paste its URL here.</div><h3>Season-specific public prices</h3><div class="theme-rate-grid">${draft.vehicles.map(v=>inputField(v.name+' (CAD) — default '+money(v.price),path+'.prices.'+v.id,'number')).join('')}</div></div>
  <div class="admin-card admin-section"><h3>Booking operations</h3><label class="admin-switch"><input type="checkbox" data-path="booking.enabled" ${draft.booking.enabled?'checked':''}> Accept online booking requests</label><div class="admin-fields" style="margin-top:18px">${inputField('Maximum bookings per day','booking.maxPerDay','number')}${inputField('Customer booking note','booking.notice','textarea',{full:true})}</div><label class="admin-field">Blocked dates (YYYY-MM-DD, comma-separated)<input class="admin-input" id="blocked-editor" value="${esc((draft.booking.blockedDates||[]).join(', '))}" placeholder="2026-12-25, 2026-12-26"></label><label class="admin-field">Available time slots (24-hour, comma-separated)<input class="admin-input" id="slot-editor" value="${esc(draft.booking.timeSlots.join(', '))}"></label></div>
  <div class="admin-card admin-section"><h3>Homepage sections</h3><div class="admin-fields">${Object.keys(draft.sections).map(x=>`<label class="admin-switch"><input type="checkbox" data-path="sections.${x}" ${draft.sections[x]?'checked':''}> ${esc(titleCase(x))}</label>`).join('')}</div></div><div class="admin-help admin-section">The owner password, security key, and D1 database stay in Cloudflare. Customer booking details and company access codes are never stored in public website source.</div>${saveBtn()}`;
 } else if(activeTab==='business'){
  c.innerHTML=`<div class="admin-help">Each company gets its own login code and can have its own rates. Codes are shown only once when created; share them privately with your client. Disable an account any time.</div><div class="admin-card admin-section"><h3>Create a business account</h3><div class="admin-fields"><label class="admin-field">Company or client name<input id="new-business-name" class="admin-input" placeholder="e.g. Corporate Fleet Client"></label><label class="admin-field">Custom access code (optional)<input id="new-business-code" class="admin-input" placeholder="TM-BIZ976112" maxlength="60" autocomplete="off"></label></div><div class="admin-fields" style="margin-top:17px">${draft.vehicles.map(v=>`<label class="admin-field">${esc(v.name)} rate (CAD)<input class="admin-input" type="number" min="0" max="10000" id="new-price-${esc(v.id)}" value="${esc(draft.businessPrices[v.id])}"></label>`).join('')}</div><div class="admin-actions"><button class="admin-btn" data-admin-action="create-business">Create private account + code ↗</button></div><div id="new-business-result"></div></div><div id="business-accounts" class="admin-rows admin-section"></div>`;
  await drawBusiness();
 } else if(activeTab==='bookings'){
  c.innerHTML='<div class="admin-help">Incoming appointments are requests. Review customer details and change their status here; contact customers directly to confirm.</div><div class="admin-section"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Reference / customer</th><th>Contact</th><th>Vehicle</th><th>Date / time</th><th>Details</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody id="bookings-table"><tr><td colspan="8">Loading...</td></tr></tbody></table></div></div>';
  await drawBookings();
 }
}
async function drawBusiness(){
 const el=$('#business-accounts');if(!el)return;
 try{
  const data=await api('admin/business');accounts=data.accounts;
  el.innerHTML=!accounts.length?'<div class="admin-card"><p>No business accounts yet. Create your first account above.</p></div>':accounts.map(a=>`<div class="admin-entry" data-business-id="${esc(a.id)}"><div class="admin-entry-head"><strong>${esc(a.label)}</strong><span class="admin-pill">${a.active?'ACTIVE':'DISABLED'}</span></div><div class="admin-fields"><label class="admin-field">Company name<input class="admin-input" data-business-field="label" value="${esc(a.label)}"></label>${draft.vehicles.map(v=>`<label class="admin-field">${esc(v.name)} (CAD)<input class="admin-input" type="number" min="0" max="10000" data-business-price="${esc(v.id)}" value="${esc(a.prices[v.id])}"></label>`).join('')}</div><div class="admin-actions"><label class="admin-switch"><input type="checkbox" data-business-field="active" ${a.active?'checked':''}> Account active</label><button class="admin-btn secondary" data-admin-action="update-business" data-id="${esc(a.id)}">Save this account ↗</button><button class="admin-btn secondary" data-admin-action="rotate-business" data-id="${esc(a.id)}">Generate new access code</button></div></div>`).join('');
 }catch(ex){el.innerHTML='<div class="admin-card">'+esc(ex.message)+'</div>';}
}
async function drawBookings(){
 try{const r=await api('admin/bookings');bookings=r.bookings;
  $('#bookings-table').innerHTML=bookings.length?bookings.map(b=>`<tr><td><strong>${esc(b.reference)}</strong><br>${esc(b.customer_name)} ${b.business_account_id?'<br><small>Business account</small>':''}</td><td>${esc(b.phone)}<br><small>${esc(b.email)}</small></td><td>${esc(site.vehicles.find(v=>v.id===b.vehicle)?.name||b.vehicle)}</td><td>${esc(b.appointment_date)}<br><small>${esc(formatTime(b.appointment_time))}</small></td><td>${esc(b.service_location)} ${b.address?'<br><small>'+esc(b.address)+'</small>':''}${b.notes?'<br><small>'+esc(b.notes)+'</small>':''}</td><td>${money(b.quoted_price)}</td><td><select data-booking-id="${esc(b.id)}">${['pending','confirmed','completed','cancelled'].map(s=>`<option value="${s}" ${b.status===s?'selected':''}>${titleCase(s)}</option>`).join('')}</select></td><td><button type="button" class="admin-btn danger delete-booking-button" data-admin-action="delete-booking" data-id="${esc(b.id)}" aria-label="Delete booking ${esc(b.reference)}">Delete</button></td></tr>`).join(''):'<tr><td colspan="8" class="admin-empty">No bookings yet.</td></tr>';
 }catch(ex){$('#bookings-table').innerHTML='<tr><td colspan="8">'+esc(ex.message)+'</td></tr>';}
}
function confirmBookingDeletion(id){
 const booking=bookings.find(b=>b.id===id);
 if(!booking){adminStatus('Booking not found. Refresh the list.',true);return;}
 const ref=booking.reference;
 openDialog(`<div class="dialog-eyebrow">OWNER STUDIO / PERMANENT ACTION</div><h2 id="dialog-title">Delete this booking?</h2><p><strong>${esc(ref)}</strong> — ${esc(booking.customer_name)}.</p><p>This permanently removes the booking from the database and disables customer reference lookup. This cannot be undone in Owner Studio. Only delete records you no longer need.</p><form id="delete-booking-form"><label for="delete-booking-ref">Type <strong>${esc(ref)}</strong> to confirm<input id="delete-booking-ref" name="reference" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(ref)}"></label><div id="delete-booking-alert" class="inline-alert" role="status" hidden></div><div class="admin-actions"><button type="button" class="admin-btn secondary" id="cancel-booking-delete">Keep booking</button><button type="submit" class="admin-btn danger" id="confirm-booking-delete" disabled>Delete permanently</button></div></form>`);
 const input=$('#delete-booking-ref'),submit=$('#confirm-booking-delete');
 input.addEventListener('input',()=>{submit.disabled=input.value.trim().toUpperCase()!==ref;});
 $('#cancel-booking-delete').addEventListener('click',closeDialog);
 $('#delete-booking-form').addEventListener('submit',async e=>{
  e.preventDefault();if(input.value.trim().toUpperCase()!==ref)return;
  submit.disabled=true;submit.textContent='Deleting…';
  try{
   await send('admin/bookings/'+encodeURIComponent(id),{reference:ref},'DELETE');
   closeDialog();await drawBookings();adminStatus('Booking '+ref+' permanently deleted ✓');
  }catch(ex){changeAlert($('#delete-booking-alert'),ex.message,true);submit.textContent='Delete permanently';submit.disabled=false;}
 });
 input.focus();
}
function resizeImage(file){return new Promise((resolve,reject)=>{
 const img=new Image(),url=URL.createObjectURL(file);
 img.onload=()=>{
  try{const max=1200,ratio=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
   canvas.toBlob(blob=>{URL.revokeObjectURL(url);if(!blob)return reject(Error('Image compression failed'));if(blob.size>750000)return reject(Error('Image still too large. Try a smaller photo.'));resolve(blob);},'image/jpeg',.73);
  }catch(ex){URL.revokeObjectURL(url);reject(ex);}
 };
 img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not open the selected image'));};img.src=url;
});}
async function uploadImage(file){
 const blob=await resizeImage(file),form=new FormData();form.append('image',blob,'photo.jpg');
 const r=await api('admin/media',{method:'POST',body:form});return r.url;
}
async function handleAdminClick(e){
 const tab=e.target.closest('[data-switch-tab]');if(tab){switchAdmin(tab.dataset.switchTab);return;}
 const themeButton=e.target.closest('[data-theme-choice]');if(themeButton){draft.theme=themeButton.dataset.themeChoice;drawAdmin();return;}
 const button=e.target.closest('[data-admin-action]');if(!button)return;
 const action=button.dataset.adminAction;
 try{
  if(action==='delete-booking'){
   confirmBookingDeletion(button.dataset.id);return;
  }
  if(action==='save-site'){
   if(activeTab==='settings'){draft.booking.timeSlots=($('#slot-editor')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);draft.booking.blockedDates=($('#blocked-editor')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);}
   button.disabled=true;const result=await send('admin/site',{site:draft},'PUT');site=result.site;draft=copyObj(site);renderSite();adminStatus('Saved and published ✓');button.disabled=false;return;
  }
  if(action==='add-service'){
   if(draft.services.length>=8)throw Error('Maximum 8 services');draft.services.push({id:'s'+Date.now(),name:'New service',description:'Describe this service.',number:'',icon:'complete'});drawAdmin();return;
  }
  if(action==='remove-service'){draft.services.splice(Number(button.dataset.index),1);drawAdmin();return;}
  if(action==='remove-photo'){draft.gallery.splice(Number(button.dataset.index),1);drawAdmin();return;}
  if(action==='move-photo-up'||action==='move-photo-down'){const i=Number(button.dataset.index),j=i+(action==='move-photo-up'?-1:1);if(j>=0&&j<draft.gallery.length){[draft.gallery[i],draft.gallery[j]]=[draft.gallery[j],draft.gallery[i]];}drawAdmin();return;}
  if(action==='add-url-photo'){
   if(draft.gallery.length>=20)throw Error('Maximum 20 photos');draft.gallery.push({id:'g'+Date.now(),src:'',caption:'',alt:'',link:''});drawAdmin();return;
  }
  if(action==='upload-hero'){
   const f=$('#hero-upload-file')?.files?.[0];if(!f)throw Error('Select a photo first');button.disabled=true;$('#hero-upload-status').textContent='Uploading...';draft.hero.image=await uploadImage(f);$('#hero-upload-status').textContent='Uploaded. Click Save website changes to publish.';button.disabled=false;return;
  }
  if(action==='upload-gallery'){
   const fs=Array.from($('#gallery-upload-file')?.files||[]);if(!fs.length)throw Error('Select photos first');if(draft.gallery.length+fs.length>20)throw Error('Gallery can hold up to 20 photos');button.disabled=true;
   let count=0;for(const f of fs){$('#gallery-upload-status').textContent=`Uploading ${count+1} of ${fs.length}...`;const src=await uploadImage(f);draft.gallery.push({id:'g'+Date.now()+count,src,caption:'TM Detailers work',alt:'Detailed vehicle',link:''});count++;}
   drawAdmin();adminStatus('Uploaded '+count+' photos. Click Save website changes to publish.');return;
  }
  if(action==='create-business'){
   const label=$('#new-business-name').value.trim(),customCode=$('#new-business-code').value.trim(),prices=Object.fromEntries(draft.vehicles.map(v=>[v.id,Number($('#new-price-'+v.id).value)]));
   button.disabled=true;const r=await send('admin/business',{label,prices,code:customCode});button.disabled=false;
   $('#new-business-result').innerHTML=`<div class="booking-result"><strong>Account created!</strong><p>Copy this code now. It will not be shown again.</p><div class="code-display"><span>${esc(r.code)}</span><button id="copy-created-code">Copy code</button></div></div>`;
   $('#copy-created-code').onclick=()=>navigator.clipboard?.writeText(r.code);
   await drawBusiness();return;
  }
  if(action==='rotate-business'){
   if(!confirm('Generate a new code? The previous business code will stop working.'))return;
   const id=button.closest('[data-business-id]').dataset.businessId;
   const r=await send('admin/business/'+encodeURIComponent(id)+'/rotate',{});
   adminStatus('New access code: '+r.code+' — copy it now; it will not be shown again.');return;
  }
  if(action==='update-business'){
   const el=button.closest('[data-business-id]'),id=el.dataset.businessId;
   const label=el.querySelector('[data-business-field="label"]').value,active=el.querySelector('[data-business-field="active"]').checked;
   const prices=Object.fromEntries([...el.querySelectorAll('[data-business-price]')].map(x=>[x.dataset.businessPrice,Number(x.value)]));
   await send('admin/business/'+encodeURIComponent(id),{label,active,prices},'PUT');adminStatus('Business account saved ✓');await drawBusiness();return;
  }
 }catch(ex){adminStatus(ex.message,true);button.disabled=false;}
}
function switchAdmin(tab){activeTab=tab;document.querySelectorAll('.admin-sidebar button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));$('#admin-main')?.scrollTo?.(0,0);drawAdmin();}
function onEdit(e){
 const el=e.target;if(!el.dataset.path||!draft)return;
 let val=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?'':Number(el.value)):el.value;
 setPath(draft,el.dataset.path,val);
}
let wizardStep=0;
function updateBookingWizard(){
 const pages=[...document.querySelectorAll('.booking-wizard-page')];
 pages.forEach((node,i)=>{node.hidden=i!==wizardStep;});
 document.querySelectorAll('[data-booking-step]').forEach((node,i)=>node.classList.toggle('active',i===wizardStep));
 const prev=$('#booking-prev'),next=$('#booking-next');if(prev)prev.hidden=wizardStep===0;if(next)next.hidden=wizardStep===3;
 const header=$('#booking-wizard-index');if(header)header.textContent=String(wizardStep+1).padStart(2,'0')+' / 04';
}
function setupBookingWizard(){
 const form=$('#booking-form');if(!form||form.querySelector('.booking-wizard-navigation'))return;
 const grid=form.querySelector('.form-grid'),labels=[...grid.querySelectorAll(':scope > label')];
 const steps=['Your details','Vehicle & date','Service location','Review'];
 const nav=document.createElement('div');nav.className='booking-wizard-navigation';nav.innerHTML=steps.map((x,i)=>`<button type="button" data-booking-step="${i}"><span>0${i+1}</span>${x}</button>`).join('');
 form.querySelector('.form-top').after(nav);
 const pages=steps.map((x,i)=>{const section=document.createElement('div');section.className='booking-wizard-page';section.dataset.wizardStep=String(i);section.innerHTML=`<div class="wizard-title"><span>STEP 0${i+1}</span><h3>${x}</h3></div>`;nav.after(section);return section;});
 const first=document.createElement('div');first.className='form-grid';labels.slice(0,3).forEach(el=>first.append(el));pages[0].append(first);
 const second=document.createElement('div');second.className='form-grid';labels.slice(3).forEach(el=>second.append(el));pages[1].append(second);grid.remove();
 for(const sel of ['.location-fieldset','#mobile-address','label:has(#book-notes)']){let node=form.querySelector(sel);if(node)pages[2].append(node);}
 for(const sel of ['.quote-line','.form-disclaimer','#book-submit']){let node=form.querySelector(sel);if(node)pages[3].append(node);}
 const footer=document.createElement('div');footer.className='wizard-controls';footer.innerHTML='<button type="button" class="button button-outline" id="booking-prev">← Back</button><span id="booking-wizard-index">01 / 04</span><button type="button" class="button button-solid" id="booking-next">Continue ↗</button>';form.append(footer);
 $('#booking-prev').addEventListener('click',()=>{wizardStep=Math.max(0,wizardStep-1);updateBookingWizard();});
 $('#booking-next').addEventListener('click',()=>{
  const visible=pages[wizardStep];for(const el of visible.querySelectorAll('input,select,textarea')){if(!el.checkValidity()){el.reportValidity();return;}}
  wizardStep=Math.min(3,wizardStep+1);updateBookingWizard();
 });
 document.querySelectorAll('[data-booking-step]').forEach(btn=>btn.addEventListener('click',()=>{const target=Number(btn.dataset.bookingStep);if(target<wizardStep){wizardStep=target;updateBookingWizard();}}));
 updateBookingWizard();
}
function bindEvents(){
 setupBookingWizard();
 $('#year').textContent=new Date().getFullYear();
 document.querySelectorAll('[data-action="admin"]').forEach(e=>e.addEventListener('click',()=>{if(session?.role==='admin')openAdmin();else authDialog('admin');}));
 document.body.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='business'){window.location.assign('/business/');}
  if(action==='lookup')window.location.assign('/track/');
  if(action==='logout')logout();
  const chosen=e.target.closest('[data-vehicle]');if(chosen){$('#book-vehicle').value=chosen.dataset.vehicle;calcQuote();}
 });
 $('#dialog-close').onclick=closeDialog;
 $('#dialog-backdrop').addEventListener('click',e=>{if(e.target===$('#dialog-backdrop'))closeDialog();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#dialog-backdrop').hidden)closeDialog();});
 $('#menu-toggle').onclick=()=>{$('#mobile-nav').hidden=!$('#mobile-nav').hidden;$('#menu-toggle').setAttribute('aria-expanded',String(!$('#mobile-nav').hidden));};
 $('#mobile-nav').addEventListener('click',e=>{if(e.target.closest('a,button')){$('#mobile-nav').hidden=true;$('#menu-toggle').setAttribute('aria-expanded','false');}});
 $('#book-vehicle').addEventListener('change',calcQuote);
 $('#booking-form').addEventListener('submit',book);
 $('#booking-form').addEventListener('change',e=>{if(e.target.name==='location'){$('#mobile-address').hidden=e.target.value!=='mobile';$('#book-address').required=e.target.value==='mobile';}});
 $('#admin-logout').onclick=logout;
 $('#admin-preview').onclick=()=>{$('#admin-panel').hidden=true;document.body.style.overflow='';};
 $('#admin-content').addEventListener('input',onEdit);
 $('#admin-content').addEventListener('change',async e=>{
  onEdit(e);if(!e.target.dataset.bookingId)return;
  try{await send('admin/bookings/'+encodeURIComponent(e.target.dataset.bookingId),{status:e.target.value},'PUT');adminStatus('Booking status updated ✓');}catch(ex){adminStatus(ex.message,true);await drawBookings();}
 });
 $('#admin-content').addEventListener('click',handleAdminClick);
 document.querySelectorAll('.admin-sidebar button').forEach(x=>x.onclick=()=>switchAdmin(x.dataset.tab));
 window.addEventListener('scroll',()=>{
  const max=document.documentElement.scrollHeight-innerHeight;$('#scroll-meter').style.width=(max>0?(100*scrollY/max):0)+'%';$('#site-header').classList.toggle('compact',scrollY>50);
 },{passive:true});
}
async function init(){
 bindEvents();
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'});$('#book-date').min=date;
 const maxDate=new Date(Date.now()+120*86400000).toLocaleDateString('en-CA',{timeZone:'America/Toronto'});$('#book-date').max=maxDate;
 try{await send('logout',{});const settings=await api('site');site=settings.site;session=null;backendReady=true;}catch(ex){console.info('TM Studio: Backend not yet configured. Public preview uses default content.',ex.message);backendReady=false;}
 renderSite();
 // Owner and business sessions intentionally end on navigation or refresh.
 if(location.pathname.startsWith('/studio/') && new URLSearchParams(location.search).has('admin')) authDialog('admin');
}
init();
