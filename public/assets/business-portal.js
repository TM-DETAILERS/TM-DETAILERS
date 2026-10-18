const $=s=>document.querySelector(s);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let site=null,prices=null,company='',activeTab='rates';
async function api(path,body){const o=body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};const r=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...o});const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Request failed');return data;}
function formatTime(t){let [h,m]=t.split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' AM':' PM');}
function feedback(id,msg){$(id).textContent=msg;}
async function closeSession(){await api('logout',{}).catch(()=>{});prices=null;$('#business-workspace').hidden=true;$('#business-login-panel').hidden=false;$('#business-login').reset();}
function selectTab(tab){activeTab=tab;$('#rates-view').hidden=tab!=='rates';$('#reserve-view').hidden=tab!=='reserve';document.querySelectorAll('[data-portal-tab]').forEach(b=>b.classList.toggle('active',b.dataset.portalTab===tab));}
function showWorkspace(){
 $('#business-login-panel').hidden=true;$('#business-workspace').hidden=false;$('#client-company').textContent=company;
 $('#client-rates').innerHTML=site.vehicles.map((v,i)=>`<article class="client-rate"><span class="eyebrow">0${i+1} / BUSINESS RATE</span><h3>${escapeHTML(v.name)}</h3><p>${escapeHTML(v.description)}</p><div class="client-price">$${Number(prices?.[v.id]??v.price)} <small>CAD</small></div><button class="portal-ghost" data-book-vehicle="${escapeHTML(v.id)}">Book this vehicle ↗</button></article>`).join('');
 $('#business-vehicle').innerHTML=site.vehicles.map(v=>`<option value="${escapeHTML(v.id)}">${escapeHTML(v.name)}</option>`).join('');
 $('#business-time').innerHTML='<option value="">Select a time</option>'+site.booking.timeSlots.map(t=>`<option value="${escapeHTML(t)}">${escapeHTML(formatTime(t))}</option>`).join('');
 $('#business-book-submit').disabled=!site.booking.enabled;updatePrice();selectTab('rates');
}
function updatePrice(){let key=$('#business-vehicle').value;$('#business-total').textContent='$'+Number(prices?.[key]??0)+' CAD';}
$('#business-login').addEventListener('submit',async ev=>{ev.preventDefault();const b=$('#access-submit');b.disabled=true;feedback('#business-error','Verifying your account…');try{const r=await api('login',{kind:'business',code:$('#business-code').value});prices=r.prices;company=r.label;showWorkspace();feedback('#business-error','');}catch(e){feedback('#business-error',e.message);}finally{b.disabled=false;}});
$('#business-exit').addEventListener('click',closeSession);
document.querySelectorAll('[data-portal-tab]').forEach(x=>x.addEventListener('click',()=>selectTab(x.dataset.portalTab)));
$('#client-rates').addEventListener('click',e=>{const b=e.target.closest('[data-book-vehicle]');if(!b)return;selectTab('reserve');$('#business-vehicle').value=b.dataset.bookVehicle;updatePrice();$('#reserve-view').scrollIntoView({behavior:'smooth'});});
$('#business-vehicle').addEventListener('change',updatePrice);
$('#business-book-form').addEventListener('change',e=>{if(e.target.name==='location'){let mobile=e.target.value==='mobile';$('#business-address-wrap').hidden=!mobile;$('#business-address').required=mobile;}});
$('#business-book-form').addEventListener('submit',async ev=>{
 ev.preventDefault();const btn=$('#business-book-submit');btn.disabled=true;feedback('#business-book-feedback','Checking availability and submitting your request…');
 try{const f=new FormData(ev.target);const obj={name:f.get('name'),email:f.get('email'),phone:f.get('phone'),vehicle:f.get('vehicle'),date:f.get('date'),time:f.get('time'),location:f.get('location'),address:f.get('address')||'',notes:f.get('notes')||''};const r=await api('bookings',obj);feedback('#business-book-feedback','Request received! Your reference is '+r.reference+'. Save it and check progress under Find a booking.');ev.target.reset();$('#business-address-wrap').hidden=true;updatePrice();}
 catch(e){feedback('#business-book-feedback',e.message);}finally{btn.disabled=false;}
});
(async()=>{await api('logout',{}).catch(()=>{});try{const r=await api('site');site=r.site;document.body.dataset.theme=site.theme||'default';const holiday=(site.themeProfiles?.[site.theme]?.greeting||{eid:'Eid Mubarak',christmas:'Merry Christmas',thanksgiving:'Happy Thanksgiving',halloween:'Happy Halloween',newyear:'Happy New Year'}[site.theme]);if(holiday){$('#portal-season-greeting').hidden=false;$('#portal-season-greeting').textContent=holiday+' · TM Detailers';}const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'});$('#business-date').min=date;$('#business-date').max=new Date(Date.now()+120*86400000).toLocaleDateString('en-CA',{timeZone:'America/Toronto'});}catch(e){feedback('#business-error','Service temporarily unavailable: '+e.message);$('#access-submit').disabled=true;}})();
