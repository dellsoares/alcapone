/* Al Capone Barbearia — navegação e efeitos visuais. */
(() => {
 'use strict';
 const $=(s,root=document)=>root.querySelector(s);
 const $$=(s,root=document)=>[...root.querySelectorAll(s)];
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const header=$('#site-header'), progress=$('#reading-progress'), toggle=$('#menu-toggle'), mobileNav=$('#mobile-nav');
 function closeMenu(){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menu');mobileNav.classList.remove('is-open');mobileNav.inert=true;document.body.classList.remove('menu-open');}
 toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';if(open){closeMenu();return;}toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Fechar menu');mobileNav.inert=false;mobileNav.classList.add('is-open');document.body.classList.add('menu-open');});
 $$('a',mobileNav).forEach(a=>a.addEventListener('click',closeMenu));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
 window.addEventListener('resize',()=>{if(innerWidth>980)closeMenu();},{passive:true});
 let rafPending=false;
 const updateScroll=()=>{const y=window.scrollY;header.classList.toggle('has-scrolled',y>40);const total=document.documentElement.scrollHeight-window.innerHeight;progress.style.width=(total>0?Math.min(100,y/total*100):0)+'%';rafPending=false;};
 window.addEventListener('scroll',()=>{if(!rafPending){rafPending=true;requestAnimationFrame(updateScroll);}},{passive:true});updateScroll();
 if('IntersectionObserver'in window&&!reduced){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{rootMargin:'0px 0px -55px 0px',threshold:.08});$$('[data-reveal]').forEach(el=>{el.classList.add('will-reveal');observer.observe(el);});}
 if('IntersectionObserver'in window){const links=$$('.desktop-nav .nav-link');const obs=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){links.forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')==='#'+entry.target.id));}}),{rootMargin:'-25% 0px -60% 0px'});$$('main section[id]').forEach(el=>obs.observe(el));}
 const video=$('.hero-video');if(video){if(reduced||window.matchMedia('(max-width: 600px) and (prefers-reduced-data: reduce)').matches){video.pause();video.style.display='none';}else{document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else video.play().catch(()=>{});});}}
 const track=$('#styles-track');if(track){const distance=()=>Math.min(track.clientWidth*.8,380);$('#styles-prev').addEventListener('click',()=>track.scrollBy({left:-distance(),behavior:reduced?'instant':'smooth'}));$('#styles-next').addEventListener('click',()=>track.scrollBy({left:distance(),behavior:reduced?'instant':'smooth'}));}
 $('#year').textContent=new Date().getFullYear();
})();
