(()=>{
 'use strict';
 const ticker=document.getElementById('v5-marquee');
 const pause=document.getElementById('v5-ticker-pause');
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const setPaused=(isPaused)=>{if(!ticker||!pause)return;ticker.classList.toggle('paused',isPaused);pause.setAttribute('aria-pressed',String(isPaused));pause.setAttribute('aria-label',isPaused?'Play moving car brand logos':'Pause moving car brand logos');pause.innerHTML=isPaused?'▶ <span>Play</span>':'Ⅱ <span>Pause</span>';};
 if(pause){setPaused(!!reduced?.matches);pause.addEventListener('click',()=>setPaused(!ticker.classList.contains('paused')));reduced?.addEventListener('change',e=>setPaused(e.matches));}
 const year=document.getElementById('v5-year');if(year)year.textContent=String(new Date().getFullYear());
})();
