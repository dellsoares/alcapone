/* Barbearia Al Capone — interações de apresentação; sem envio a servidor. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = $('#site-header');
  const progress = $('#reading-progress');
  const toggle = $('#menu-toggle');
  const mobileNav = $('#mobile-nav');

  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    mobileNav.classList.remove('is-open');
    mobileNav.inert = true;
    document.body.classList.remove('menu-open');
  }
  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) { closeMenu(); return; }
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fechar menu');
    mobileNav.inert = false;
    mobileNav.classList.add('is-open');
    document.body.classList.add('menu-open');
  });
  $$('a', mobileNav).forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', () => { if (innerWidth > 980) closeMenu(); }, { passive: true });

  let rafPending = false;
  const updateScrollUI = () => {
    const y = window.scrollY;
    header.classList.toggle('has-scrolled', y > 40);
    const total = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (total > 0 ? Math.min(100, y / total * 100) : 0) + '%';
    rafPending = false;
  };
  window.addEventListener('scroll', () => {
    if (!rafPending) { rafPending = true; requestAnimationFrame(updateScrollUI); }
  }, { passive: true });
  updateScrollUI();

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const revealObs = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObs.unobserve(entry.target);
      }
    }), { rootMargin: '0px 0px -55px 0px', threshold: 0.08 });
    $$('[data-reveal]').forEach(el => { el.classList.add('will-reveal'); revealObs.observe(el); });
  }
  if ('IntersectionObserver' in window) {
    const links = $$('.desktop-nav .nav-link');
    const sectionObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
        }
      });
    }, { rootMargin: '-25% 0px -60% 0px' });
    $$('main section[id]').forEach(el => sectionObs.observe(el));
  }

  const video = $('.hero-video');
  if (prefersReducedMotion || window.matchMedia('(max-width: 600px) and (prefers-reduced-data: reduce)').matches) {
    video.pause(); video.style.display = 'none';
  } else {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) video.pause(); else video.play().catch(() => {});
    });
  }

  const track = $('#styles-track');
  const slideDistance = () => Math.min(track.clientWidth * 0.8, 380);
  $('#styles-prev').addEventListener('click', () => track.scrollBy({ left: -slideDistance(), behavior: prefersReducedMotion ? 'instant' : 'smooth' }));
  $('#styles-next').addEventListener('click', () => track.scrollBy({ left: slideDistance(), behavior: prefersReducedMotion ? 'instant' : 'smooth' }));

  const form = $('#booking-form');
  const service = $('#service');
  const date = $('#booking-date');
  const result = $('#booking-result');
  const localISODate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  date.min = localISODate(new Date());
  $('#year').textContent = new Date().getFullYear();

  $$('.service-book, .plan-book').forEach(button => button.addEventListener('click', () => {
    service.value = button.dataset.service || '';
    result.hidden = true;
    $('#agendamento').scrollIntoView({ behavior: prefersReducedMotion ? 'instant' : 'smooth', block: 'start' });
    window.setTimeout(() => { try { service.focus({ preventScroll: true }); } catch { service.focus(); } }, prefersReducedMotion ? 0 : 550);
  }));

  form.addEventListener('input', () => { result.hidden = true; });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (date.value < localISODate(new Date())) { date.setCustomValidity('Escolha uma data a partir de hoje.'); date.reportValidity(); date.setCustomValidity(''); return; }
    const fd = new FormData(form);
    const d = new Date(fd.get('date') + 'T12:00:00');
    const when = Number.isNaN(d.getTime()) ? fd.get('date') : new Intl.DateTimeFormat('pt-BR').format(d);
    const summary = `SOLICITAÇÃO DE AGENDAMENTO — AL CAPONE\nNome: ${String(fd.get('name')).trim()}\nWhatsApp: ${String(fd.get('phone')).trim()}\nServiço: ${fd.get('service')}\nData desejada: ${when}\nHorário desejado: ${fd.get('time')}`;
    result.hidden = false;
    result.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = 'PRÉVIA GERADA — NÃO É UMA RESERVA';
    const pre = document.createElement('pre');
    pre.textContent = summary;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy-button'; btn.textContent = 'COPIAR SOLICITAÇÃO ↗';
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(summary); btn.textContent = 'TEXTO COPIADO ✓'; }
      catch { btn.textContent = 'SELECIONE E COPIE O TEXTO ACIMA'; }
    });
    const note = document.createElement('p');
    note.textContent = 'Nenhuma informação foi enviada. O agendamento real será integrado depois.';
    result.append(title, pre, btn, note);
    result.scrollIntoView({ behavior: prefersReducedMotion ? 'instant' : 'smooth', block: 'nearest' });
  });
})();
