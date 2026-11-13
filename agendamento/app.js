/* Al Capone Barbearia | Agendamento estático + Supabase (projeto separado da landing) */
(() => {
  'use strict';
  const URL_BASE = 'https://vsqvzfwlndkwmajkvtuc.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_SwpbISATzFXp2N8T6IRPIA_V6k6Xecg';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brl = cents => (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const todayBR = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const addDays = (iso, days) => {const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
  const weekday = iso => new Date(iso+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'}).replace('.','').toUpperCase();
  const formattedDate = iso => new Date(iso+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',day:'2-digit',month:'long',year:'numeric'});
  async function rpc(name, body={}){
    const response=await fetch(`${URL_BASE}/rest/v1/rpc/${name}`,{
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json','apikey':PUBLIC_KEY},
      body:JSON.stringify(body), cache:'no-store'
    });
    let payload;
    try {payload=await response.json();}catch{payload=null;}
    if(!response.ok)throw Error(payload?.message || payload?.hint || `Erro de conexão (${response.status}).`);
    return payload;
  }
  let data=null,step=1,dateOffset=0,fetching=0;
  const booking={service_id:null, professional_id:null, date:null, time:null};
  const state=()=>({service:data.services.find(x=>x.id===booking.service_id),pro:data.professionals.find(x=>x.id===booking.professional_id)});
  $('#currentYear').textContent=new Date().getFullYear();
  async function init(){
    $('#serviceOptions').innerHTML='<p class="empty-note">Carregando serviços...</p>';
    try{
      data=await rpc('alcapone_catalogo');
      if(!data?.services?.length||!data?.professionals?.length)throw Error('O catálogo ainda não está configurado.');
      booking.date=data.today || todayBR();
      $('#demoBanner').hidden=true;
      renderServices();renderPros();renderDates();go(1);
    }catch(e){
      $('#demoBanner').hidden=false;
      $('#serviceOptions').innerHTML=`<p class="empty-note">Não foi possível carregar os serviços. ${esc(e.message)}</p><button type="button" class="action-secondary" id="retryInit">TENTAR NOVAMENTE ↻</button>`;
      $('#retryInit').addEventListener('click',init);
    }
  }
  function renderServices(){
    $('#serviceOptions').innerHTML=data.services.map(s=>{
      const featured=/visagis/i.test(s.name);
      return `<button type="button" class="choice ${featured?'is-visagista':''}" data-id="${esc(s.id)}" aria-pressed="false">
        <div>${featured?'<span class="choice-tag">✦ ATENDIMENTO DESTAQUE</span>':''}<strong>${esc(s.name)}</strong></div>
        <span class="choice-foot"><small>${s.duration} MIN</small><b>${s.from_price?'A partir de ':''}${brl(s.price_cents)}</b></span></button>`;
    }).join('');
    $$('.choice').forEach(btn=>btn.addEventListener('click',()=>{
      booking.service_id=btn.dataset.id; booking.time=null;
      $$('.choice').forEach(el=>{el.classList.toggle('selected',el===btn);el.setAttribute('aria-pressed',String(el===btn))});updateNext();
    }));
  }
  function renderPros(){
    $('#proOptions').innerHTML=data.professionals.map(p=>`<button type="button" class="pro-choice" data-id="${esc(p.id)}" aria-pressed="false"><img src="${esc(p.photo)}" alt="${esc(p.name)}, profissional da Al Capone"><span><small>BARBEIRO AL CAPONE</small><strong>${esc(p.name)}</strong></span></button>`).join('');
    $$('.pro-choice').forEach(btn=>btn.addEventListener('click',()=>{
      booking.professional_id=btn.dataset.id;booking.time=null;
      $$('.pro-choice').forEach(el=>{el.classList.toggle('selected',el===btn);el.setAttribute('aria-pressed',String(el===btn))});updateNext();
    }));
  }
  function go(n){
    step=n;
    $$('.wizard-panel').forEach(el=>el.classList.toggle('active',Number(el.dataset.panel)===n));
    $$('.steps li').forEach(el=>{const s=Number(el.dataset.step);el.classList.toggle('active',s===Math.min(n,4));el.classList.toggle('done',s<Math.min(n,4))});
    $('#wizardFooter').hidden=n===5;
    $('#backBtn').hidden=n<=1;
    if(n===3){renderDates();loadAvailability();}
    if(n===4)renderSummary();
    updateNext();
    if(n===5)$('#formulario').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function updateNext(){
    const btn=$('#nextBtn');btn.textContent=step===4?'CONFIRMAR RESERVA':'CONTINUAR';
    if(step!==4)btn.insertAdjacentHTML('beforeend',' <span>↗</span>');
    btn.disabled=(step===1&&!booking.service_id)||(step===2&&!booking.professional_id)||(step===3&&!booking.time);
    $('#stepHint').textContent=({1:'Escolha um serviço.',2:'Selecione o profissional.',3:'Selecione uma data e um horário.',4:'Seus dados serão usados somente para esta reserva.'})[step]||'';
  }
  $('#nextBtn').addEventListener('click',()=>{if(step===4){submit();return;}if(!$('#nextBtn').disabled)go(step+1)});
  $('#backBtn').addEventListener('click',()=>go(Math.max(1,step-1)));
  $('#newBooking').addEventListener('click',()=>{booking.service_id=null;booking.professional_id=null;booking.time=null;renderServices();renderPros();go(1)});
  function renderDates(){
    if(!data)return;
    const current=addDays(data.today,dateOffset),last=addDays(data.today,data.max_days);
    $('#monthTitle').textContent=new Date(current+'T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).toUpperCase();
    $('#datePrev').disabled=dateOffset===0;
    $('#dateNext').disabled=dateOffset+7>data.max_days;
    let html='';
    for(let i=0;i<7;i++){
      const iso=addDays(current,i),wd=new Date(iso+'T12:00:00Z').getUTCDay();
      const closed=wd===0||wd===1,out=iso>last;
      html+=`<button type="button" class="day-pill ${booking.date===iso?'selected':''}" data-date="${iso}" ${closed||out?'disabled':''} aria-pressed="${booking.date===iso}"><small>${weekday(iso)}</small><strong>${iso.slice(8)}</strong></button>`;
    }
    $('#daysStrip').innerHTML=html;
    $$('.day-pill:not(:disabled)').forEach(el=>el.addEventListener('click',()=>{booking.date=el.dataset.date;booking.time=null;renderDates();loadAvailability();updateNext()}));
  }
  $('#dateNext').addEventListener('click',()=>{dateOffset=Math.min(dateOffset+7,56);booking.date=null;booking.time=null;renderDates();$('#slotArea').innerHTML='<p class="empty-note">Selecione uma data para consultar os horários.</p>';updateNext()});
  $('#datePrev').addEventListener('click',()=>{dateOffset=Math.max(0,dateOffset-7);booking.date=null;booking.time=null;renderDates();$('#slotArea').innerHTML='<p class="empty-note">Selecione uma data para consultar os horários.</p>';updateNext()});
  async function loadAvailability(){
    const seq=++fetching;if(!booking.date)return;
    $('#slotArea').innerHTML='<p class="empty-note">Consultando horários...</p>';
    $('#availabilityMeta').textContent=formattedDate(booking.date);
    try{
      const result=await rpc('alcapone_disponibilidade',{p_profissional_id:booking.professional_id,p_servico_id:booking.service_id,p_data:booking.date});
      const slots=(result||[]).map(item=>item.hora);
      if(seq!==fetching)return;
      if(!slots.length){$('#slotArea').innerHTML='<p class="empty-note">Sem horários disponíveis. Experimente outra data.</p>';booking.time=null;updateNext();return;}
      let html='';
      for(const [title,items] of [['MANHÃ',slots.filter(s=>s<'12:00')],['TARDE',slots.filter(s=>s>='12:00')]]){
        if(!items.length)continue;
        html+=`<div class="period-label">${title}</div><div class="time-buttons">${items.map(s=>`<button type="button" class="time-slot ${booking.time===s?'selected':''}" data-time="${esc(s)}" aria-pressed="${booking.time===s}">${esc(s)}</button>`).join('')}</div>`;
      }
      $('#slotArea').innerHTML=html;
      $$('.time-slot').forEach(el=>el.addEventListener('click',()=>{booking.time=el.dataset.time;$$('.time-slot').forEach(e=>{e.classList.toggle('selected',e===el);e.setAttribute('aria-pressed',String(e===el))});updateNext()}));
    }catch(e){if(seq===fetching)$('#slotArea').innerHTML=`<p class="empty-note">${esc(e.message)}. Tente outra data ou recarregue a página.</p>`;}
  }
  function renderSummary(){
    const {service,pro}=state();
    $('#summary').innerHTML=`<div class="summary-row"><span>SERVIÇO</span><strong>${esc(service.name)}</strong></div><div class="summary-row"><span>PROFISSIONAL</span><strong>${esc(pro.name)}</strong></div><div class="summary-row"><span>DATA E HORA</span><strong>${esc(formattedDate(booking.date))} · ${esc(booking.time)}</strong></div><div class="summary-row"><span>DURAÇÃO</span><strong>${service.duration} minutos</strong></div><div class="summary-row summary-total"><span>VALOR ${service.from_price?'INICIAL':'DO SERVIÇO'}</span><strong>${brl(service.price_cents)}</strong></div>`;
    $('#formError').hidden=true;
  }
  async function submit(){
    const err=$('#formError');
    const fullName=$('#clientName').value.trim(),phone=$('#clientPhone').value.trim(),email=$('#clientEmail').value.trim();
    if(fullName.length<3||phone.replace(/\D/g,'').length<10||!$('#consent').checked){
      err.textContent='Preencha nome e WhatsApp com DDD e aceite o uso dos dados.';err.hidden=false;return;
    }
    const next=$('#nextBtn');next.disabled=true;next.textContent='CONFIRMANDO...';err.hidden=true;
    try{
      const payload=await rpc('alcapone_agendar',{
        p_profissional_id:booking.professional_id,p_servico_id:booking.service_id,
        p_data:booking.date,p_hora:booking.time,p_nome:fullName,p_whatsapp:phone,
        p_email:email||null,p_observacoes:$('#clientNotes').value.trim()||null
      });
      $('#confirmationInfo').innerHTML=`<div class="summary-row"><span>CÓDIGO</span><strong>${esc(payload.code)}</strong></div><div class="summary-row"><span>SERVIÇO</span><strong>${esc(payload.service)}</strong></div><div class="summary-row"><span>PROFISSIONAL</span><strong>${esc(payload.professional)}</strong></div><div class="summary-row"><span>DATA/HORA</span><strong>${esc(formattedDate(booking.date))} · ${esc(booking.time)}</strong></div>`;
      $('#manageLink').href='minha.html?token='+encodeURIComponent(payload.token);
      go(5);
    }catch(e){err.textContent=e.message;err.hidden=false;updateNext();}
  }
  init();
})();
