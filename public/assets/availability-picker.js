/** Shared accessible availability chooser. The server is always the source of truth. */
const asDate=iso=>new Date(iso+'T12:00:00Z');
const dayLabel=iso=>new Intl.DateTimeFormat('en-CA',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(asDate(iso));
const showTime=t=>{let [h,m]=t.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;};
export async function mountCalendar({container,dateInput,timeInput,onSelect=()=>{},daysPerPage=8}){
 const root=typeof container==='string'?document.querySelector(container):container;
 if(!root)return;
 root.innerHTML='<div class="availability-status" role="status">Loading live availability…</div>';
 let dates=[],current=null,index=0;
 try{
  const response=await fetch('/api/calendar',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(14000)});
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Calendar unavailable');dates=result.dates||[];
 }catch(e){root.innerHTML='<p role="alert" class="availability-error">Could not load availability. Please refresh the page or contact TM Detailers. '+String(e.message).replace(/[<>&]/g,'')+'</p>';return;}
 const render=()=>{
  const part=dates.slice(index,index+daysPerPage),active=part.find(d=>d.date===current);
  root.innerHTML=`<div class="availability-head"><div><strong>Available appointments</strong><small>${daysPerPage===8?'Public booking opens 7 days ahead':'Choose from the available dates'}</small></div><div class="availability-nav"><button type="button" data-cal-prev aria-label="Previous dates" ${index===0?'disabled':''}>←</button><button type="button" data-cal-next aria-label="Next dates" ${index+daysPerPage>=dates.length?'disabled':''}>→</button></div></div><div class="availability-days" role="group" aria-label="Choose appointment date">${part.map(d=>`<button type="button" data-cal-day="${d.date}" aria-pressed="${String(current===d.date)}" class="${current===d.date?'selected':''}" ${!d.available?'disabled':''}><span>${dayLabel(d.date)}</span><small>${d.available?d.remaining+' space'+(d.remaining===1?'':'s'):'Full / closed'}</small></button>`).join('')}</div><div class="availability-slots" role="group" aria-label="Available appointment times"><span class="availability-hint">${current?'Select a time for '+dayLabel(current):'Choose an available date above to see times'}</span><div class="slot-buttons">${active?active.slots.map(s=>`<button type="button" data-cal-time="${s.time}" ${!s.available?'disabled':''} aria-pressed="${String(timeInput.value===s.time)}" class="${timeInput.value===s.time?'selected':''}">${showTime(s.time)}${!s.available?' · Full':''}</button>`).join(''):''}</div></div><p class="availability-summary" role="status">${dateInput.value&&timeInput.value?'Your selection: '+dayLabel(dateInput.value)+' · '+showTime(timeInput.value):'A date and time are required to continue.'}</p>`;
  root.querySelector('[data-cal-prev]')?.addEventListener('click',()=>{index=Math.max(0,index-daysPerPage);render();});
  root.querySelector('[data-cal-next]')?.addEventListener('click',()=>{index=Math.min(Math.max(0,dates.length-daysPerPage),index+daysPerPage);render();});
  root.querySelectorAll('[data-cal-day]').forEach(el=>el.addEventListener('click',()=>{current=el.dataset.calDay;dateInput.value=current;timeInput.value='';dateInput.dispatchEvent(new Event('change',{bubbles:true}));render();onSelect();}));
  root.querySelectorAll('[data-cal-time]').forEach(el=>el.addEventListener('click',()=>{timeInput.value=el.dataset.calTime;timeInput.dispatchEvent(new Event('change',{bubbles:true}));render();onSelect();}));
 };
 render();
}
