import { DEFAULT_SITE } from './defaults.js';
const $=s=>document.querySelector(s);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults={eid:'Eid Mubarak',christmas:'Merry Christmas',halloween:'Happy Halloween',thanksgiving:'Happy Thanksgiving',newyear:'Happy New Year'};
let site=structuredClone(DEFAULT_SITE);
async function getSite(){if(window.__TM_PREVIEW_SITE__)return window.__TM_PREVIEW_SITE__;try{const r=await fetch('/api/site',{cache:'no-store',signal:AbortSignal.timeout(12000)});const d=await r.json();if(d.ok&&d.site)return d.site;}catch(e){console.info('Using fallback storefront settings:',e.message);}return structuredClone(DEFAULT_SITE);}
function setTheme(t){site.theme=t;const active=site.themeProfiles?.[t]||{};document.body.dataset.theme=t;document.body.style.setProperty('--season',/^#[0-9a-f]{6}$/i.test(active.accent||'')?active.accent:'');if(!active.accent)document.body.style.removeProperty('--season');const greeting=active.greeting||defaults[t]||'';const headline=active.headline||'';
 const g=$('#holiday-greeting');if(g){g.textContent=greeting;g.hidden=!greeting;}
 const bar=$('#season-bar');if(bar){bar.hidden=!greeting;$('#season-bar-greeting').textContent=greeting;$('#season-bar-detail').textContent=headline;}
 const hero=$('#hero-art');if(hero){const u=active.heroImage||site.hero?.image||'';const allowed=/^https:\/\/[^\s"'<>]+$/i.test(u)||/^\/api\/media\/[0-9a-f-]{36}$/i.test(u);hero.src=allowed?u:'/assets/showroom-car.svg';hero.alt=allowed?'Featured TM Detailers photograph':'Stylized vehicle illustration';}
 const art=$('#season-art-label');if(art)art.textContent=t==='default'?'TM / THE FINISH':(greeting.toUpperCase()+' / TM DETAILERS');
 const desc=$('#hero-description');if(desc)desc.textContent=t==='default'?site.hero?.description||DEFAULT_SITE.hero.description:active.description||site.hero?.description||DEFAULT_SITE.hero.description;
 const quote=$('#pricing-notice');if(quote){const hasRates=Object.keys(active.prices||{}).length>0;quote.textContent=hasRates?greeting+' · Seasonal rates':'CAD · BY APPOINTMENT';}
}
function priceFor(v){const p=site.themeProfiles?.[site.theme]?.prices?.[v.id];return p!==undefined&&p!==null&&p!==''?Number(p):Number(v.price);}
function render(){setTheme(site.theme||'default');const list=$('#pricing-list');if(list)list.innerHTML=site.vehicles.map(v=>`<article class="price-row"><h3>${escapeHTML(v.name)}</h3><p>${escapeHTML(v.description||'Full detail')}</p><strong>$${priceFor(v).toLocaleString('en-CA')}</strong><a href="/checkout/?vehicle=${encodeURIComponent(v.id)}">Select vehicle ↗</a></article>`).join('');
 const promos=$('#promotion-bar');if(promos){promos.hidden=!site.announcement?.enabled;promos.textContent=[site.announcement?.text,site.announcement?.code&&'Code: '+site.announcement.code].filter(Boolean).join(' · ');}
 const care=$('#care');if(care){care.hidden=site.sections?.services===false;const blocks=[...care.querySelectorAll('.service-brief>div')];(site.services||[]).slice(0,3).forEach((service,i)=>{if(!blocks[i])return;blocks[i].querySelector('h3').textContent=service.name;blocks[i].querySelector('p').textContent=service.description;});}
 const work=$('#our-work');if(work)work.hidden=site.sections?.gallery===false;
 const insta=$('#insta-link');if(insta)insta.href='https://www.instagram.com/'+encodeURIComponent((site.contact?.instagram||'detailers.tm').replace(/^@/,''))+'/';
 const gallery=$('#home-gallery');if(gallery){const first=(site.gallery||[]).find(g=>/^https:\/\/[^\s"'<>]+$/i.test(g.src||'')||/^\/api\/media\/[0-9a-f-]{36}$/i.test(g.src||''));if(first)gallery.innerHTML=`<img src="${escapeHTML(first.src)}" alt="${escapeHTML(first.alt||'Vehicle detailed by TM Detailers')}" loading="lazy">`;}
}
const toggle=$('.mobile-toggle');if(toggle)toggle.addEventListener('click',()=>{const nav=$('#mobile-nav');nav.hidden=!nav.hidden;toggle.setAttribute('aria-expanded',String(!nav.hidden));});
(async()=>{site=await getSite();render();
 // Preview-only controls, never exposed on production.
 const preview=$('#preview-theme');if(preview){preview.value=site.theme||'default';preview.addEventListener('change',()=>{setTheme(preview.value);render();});}
})();
