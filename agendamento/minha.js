(() => {
  'use strict';
  const URL_BASE='https://vsqvzfwlndkwmajkvtuc.supabase.co';
  const PUBLIC_KEY='sb_publishable_SwpbISATzFXp2N8T6IRPIA_V6k6Xecg';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token=new URLSearchParams(location.search).get('token');
  async function rpc(name,body){
    const r=await fetch(`${URL_BASE}/rest/v1/rpc/${name}`,{method:'POST',headers:{'apikey':PUBLIC_KEY,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
    const p=await r.json();if(!r.ok)throw Error(p?.message||'Falha ao consultar reserva.');return p;
  }
  async function init(){
    if(!token||!/^[0-9a-f-]{36}$/i.test(token)){$('#myCard').innerHTML='<p>Use o link particular recebido ao confirmar sua reserva.</p>';return;}
    try{
      const b=await rpc('alcapone_consultar',{p_token:token});
      if(!b){$('#myCard').innerHTML='<p>Reserva não encontrada.</p>';return;}
      $('#myCard').innerHTML=`<h2 style="font:36px 'Bebas Neue',sans-serif;margin:0 0 18px">RESERVA ${esc(b.code)}</h2>
        <div class="summary-row"><span>SERVIÇO</span><strong>${esc(b.service)}</strong></div>
        <div class="summary-row"><span>BARBEIRO</span><strong>${esc(b.professional)}</strong></div>
        <div class="summary-row"><span>DATA/HORA</span><strong>${esc(b.date)} · ${esc(b.time)}</strong></div>
        <div class="summary-row"><span>STATUS</span><strong>${esc(b.status).toUpperCase()}</strong></div>
        ${b.can_cancel?'<button type="button" class="action-secondary" id="cancelBtn">CANCELAR ESTA RESERVA</button>':''}`;
      $('#cancelBtn')?.addEventListener('click',async()=>{
        if(!confirm('Deseja realmente cancelar sua reserva?'))return;
        const btn=$('#cancelBtn');btn.disabled=true;btn.textContent='CANCELANDO...';
        try{
          const ok=await rpc('alcapone_cancelar',{p_token:token});
          if(!ok)throw Error('Esta reserva não pode mais ser cancelada.');
          $('#myMsg').textContent='Reserva cancelada com sucesso.';await init();
        }catch(e){$('#myMsg').textContent=e.message;btn.disabled=false;btn.textContent='CANCELAR ESTA RESERVA';}
      });
    }catch(e){ $('#myCard').innerHTML='<p>Não foi possível consultar. Tente recarregar a página.</p>';$('#myMsg').textContent=e.message;}
  }
  init();
})();
