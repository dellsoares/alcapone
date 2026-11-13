-- AL CAPONE BARBEARIA | Complemento do banco Supabase
-- Execute APÓS o arquivo AlCapone_Passo4_Banco.sql.
-- Libera somente as funções necessárias ao agendamento; dados de clientes continuam sem leitura pública.

create extension if not exists btree_gist;

-- Campos opcionais presentes no formulário.
alter table public.reservas add column if not exists cliente_email text;
alter table public.reservas add column if not exists observacoes text;

-- Evita que dois clientes reservem intervalos sobrepostos, mesmo simultaneamente.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alcapone_reservas_sem_sobreposicao'
      and conrelid = 'public.reservas'::regclass
  ) then
    alter table public.reservas add constraint alcapone_reservas_sem_sobreposicao
      exclude using gist (
        profissional_id with =,
        tstzrange(inicio, fim, '[)') with &&
      ) where (status = 'confirmado');
  end if;
end $$;

-- Expedi​ente de cada barbeiro: 0 domingo, 1 segunda, 2 terça ... 6 sábado.
insert into public.horarios_semanais(profissional_id, dia_semana, inicio, fim)
select p.id, d.dia, d.inicio, d.fim
from public.profissionais p
cross join (values
  (2, time '09:00', time '19:30'),
  (3, time '09:00', time '19:30'),
  (4, time '09:00', time '20:00'),
  (5, time '09:00', time '20:00'),
  (6, time '09:00', time '15:00')
) as d(dia,inicio,fim)
where p.nome in ('Andrei Martins','Philipe Augusto')
on conflict (profissional_id, dia_semana, inicio) do nothing;

-- Apenas catálogo público, sem divulgar telefones de clientes ou reservas.
create or replace function public.alcapone_catalogo()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.nome,
        'duration', s.duracao_minutos,
        'price_cents', round(s.preco * 100)::integer,
        'from_price', (s.nome = 'Progressiva / Botox / Selagem'),
        'active', s.ativo
      ) order by s.preco, s.nome)
      from public.servicos s where s.ativo = true
    ), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.nome,
        'photo', case when p.nome ilike '%andrei%' then 'assets/andrei.webp' else 'assets/philipe.webp' end
      ) order by p.nome)
      from public.profissionais p where p.ativo = true
    ), '[]'::jsonb),
    'today', ((now() at time zone 'America/Sao_Paulo')::date)::text,
    'max_days', 60
  );
$$;

-- Horários livres por profissional, serviço e dia (intervalo de 15 minutos).
create or replace function public.alcapone_disponibilidade(
  p_profissional_id uuid, p_servico_id uuid, p_data date
)
returns table(hora text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_duracao integer;
begin
  if p_data is null
     or p_data < (now() at time zone 'America/Sao_Paulo')::date
     or p_data > (now() at time zone 'America/Sao_Paulo')::date + 60 then
    return;
  end if;
  if not exists (select 1 from public.profissionais p where p.id=p_profissional_id and p.ativo) then return; end if;
  select s.duracao_minutos into v_duracao
  from public.servicos s where s.id=p_servico_id and s.ativo;
  if v_duracao is null then return; end if;

  return query
  select to_char(g.hora_local, 'HH24:MI') as hora
  from public.horarios_semanais hs
  cross join lateral generate_series(
    p_data + hs.inicio,
    p_data + hs.fim - make_interval(mins=>v_duracao),
    interval '15 minutes'
  ) g(hora_local)
  where hs.profissional_id=p_profissional_id
    and hs.dia_semana=extract(dow from p_data)::integer
    and (g.hora_local at time zone 'America/Sao_Paulo') >= now() + interval '30 minutes'
    and not exists (
      select 1 from public.reservas r
      where r.profissional_id=p_profissional_id and r.status='confirmado'
        and tstzrange(r.inicio,r.fim,'[)') && tstzrange(
          g.hora_local at time zone 'America/Sao_Paulo',
          (g.hora_local at time zone 'America/Sao_Paulo') + make_interval(mins=>v_duracao), '[)')
    )
    and not exists (
      select 1 from public.bloqueios b
      where b.profissional_id=p_profissional_id
        and tstzrange(b.inicio,b.fim,'[)') && tstzrange(
          g.hora_local at time zone 'America/Sao_Paulo',
          (g.hora_local at time zone 'America/Sao_Paulo') + make_interval(mins=>v_duracao), '[)')
    )
  order by 1;
end;
$$;

-- Confirma a reserva somente se o horário ainda estiver livre.
create or replace function public.alcapone_agendar(
  p_profissional_id uuid, p_servico_id uuid,
  p_data date, p_hora text,
  p_nome text, p_whatsapp text,
  p_email text default null, p_observacoes text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_duracao integer;
  v_nome_servico text;
  v_nome_profissional text;
  v_inicio timestamptz;
  v_token uuid;
  v_id uuid;
begin
  if p_nome is null or char_length(trim(p_nome)) < 3 or char_length(trim(p_nome)) > 100 then
    raise exception 'Informe seu nome completo.';
  end if;
  if p_whatsapp is null or char_length(regexp_replace(p_whatsapp, '[^0-9]', '', 'g')) < 10
     or char_length(regexp_replace(p_whatsapp, '[^0-9]', '', 'g')) > 13 then
    raise exception 'Informe seu WhatsApp com DDD.';
  end if;
  if p_hora is null or p_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Horário inválido.';
  end if;
  if char_length(coalesce(p_email,'')) > 150 or char_length(coalesce(p_observacoes,'')) > 400 then
    raise exception 'Texto muito longo.';
  end if;
  -- Serializa tentativas para o mesmo profissional.
  perform pg_advisory_xact_lock(hashtext(p_profissional_id::text));
  if not exists (
    select 1 from public.alcapone_disponibilidade(p_profissional_id,p_servico_id,p_data) d
    where d.hora=p_hora
  ) then
    raise exception 'Esse horário não está mais disponível. Escolha outro.';
  end if;
  select s.duracao_minutos, s.nome into v_duracao, v_nome_servico
    from public.servicos s where s.id=p_servico_id and s.ativo;
  select p.nome into v_nome_profissional
    from public.profissionais p where p.id=p_profissional_id and p.ativo;
  v_inicio := (p_data + p_hora::time) at time zone 'America/Sao_Paulo';
  insert into public.reservas(
    profissional_id,servico_id,inicio,fim,cliente_nome,cliente_whatsapp,cliente_email,observacoes
  ) values (
    p_profissional_id,p_servico_id,v_inicio,v_inicio+make_interval(mins=>v_duracao),
    trim(p_nome), trim(p_whatsapp), nullif(trim(coalesce(p_email,'')),''), nullif(trim(coalesce(p_observacoes,'')),'')
  ) returning id,token_cliente into v_id,v_token;
  return jsonb_build_object('id',v_id,'token',v_token,
    'code',upper(left(replace(v_id::text,'-',''),8)),
    'service',v_nome_servico,'professional',v_nome_profissional);
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser reservado. Escolha outro.';
end;
$$;

-- Só quem possui o token secreto da própria reserva pode consultá-la.
create or replace function public.alcapone_consultar(p_token uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',r.id, 'service',s.nome, 'professional',p.nome,
    'date',to_char(r.inicio at time zone 'America/Sao_Paulo','DD/MM/YYYY'),
    'time',to_char(r.inicio at time zone 'America/Sao_Paulo','HH24:MI'),
    'status',r.status,'code',upper(left(replace(r.id::text,'-',''),8)),
    'can_cancel',(r.status='confirmado' and r.inicio>now())
  )
  from public.reservas r
  join public.servicos s on s.id=r.servico_id
  join public.profissionais p on p.id=r.profissional_id
  where r.token_cliente=p_token;
$$;

create or replace function public.alcapone_cancelar(p_token uuid)
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  update public.reservas r set status='cancelado'
  where r.token_cliente=p_token and r.status='confirmado' and r.inicio>now()
  returning r.id into v_id;
  return v_id is not null;
end;
$$;

-- Mantém as tabelas privadas: o navegador só consegue usar as funções acima.
revoke all on public.profissionais,public.servicos,public.horarios_semanais,
              public.reservas,public.bloqueios,public.administradores from anon,authenticated;
revoke all on function public.alcapone_catalogo() from public;
revoke all on function public.alcapone_disponibilidade(uuid,uuid,date) from public;
revoke all on function public.alcapone_agendar(uuid,uuid,date,text,text,text,text,text) from public;
revoke all on function public.alcapone_consultar(uuid) from public;
revoke all on function public.alcapone_cancelar(uuid) from public;
grant execute on function public.alcapone_catalogo() to anon,authenticated;
grant execute on function public.alcapone_disponibilidade(uuid,uuid,date) to anon,authenticated;
grant execute on function public.alcapone_agendar(uuid,uuid,date,text,text,text,text,text) to anon,authenticated;
grant execute on function public.alcapone_consultar(uuid) to anon,authenticated;
grant execute on function public.alcapone_cancelar(uuid) to anon,authenticated;

select 'Agendamento Al Capone ativado com sucesso' as resultado;
