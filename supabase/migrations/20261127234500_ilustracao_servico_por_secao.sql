-- O valor de cada seção é uma foto ou o identificador de um ícone.
-- A ausência da chave faz a seção acompanhar o campo icon já existente.
create or replace function public.ilustracoes_de_servico_validas(config jsonb)
returns boolean language sql immutable strict set search_path = '' as $$
  select case when jsonb_typeof(config) <> 'object' then false else not exists (
    select 1 from jsonb_each(config) item
     where item.key not in ('loja','profissional','agendamento') or jsonb_typeof(item.value) <> 'string'
        or not ((item.value #>> '{}') ~ '^(https?://[^[:space:]]+|/images/servicos-modelo/[a-z0-9-]+[.]webp|[A-Za-z][A-Za-z0-9:-]*)$')
  ) end;
$$;

alter table public.services add column midia_secoes jsonb not null default '{}'
  check (public.ilustracoes_de_servico_validas(midia_secoes));
alter table public.staff_services add column midia_secoes jsonb not null default '{}'
  check (public.ilustracoes_de_servico_validas(midia_secoes) and not (midia_secoes ? 'loja'));

-- Mantém as assinaturas, concessões e regras atuais das funções, inclusive a governança dos sócios.
-- Uma definição que tenha mudado desde o ensaio faz a migração inteira parar.
create or replace function pg_temp.ajustar_trecho(alvo regprocedure, anterior text, novo text)
returns void language plpgsql as $$
declare definicao text := pg_get_functiondef(alvo);
begin
  if (length(definicao)-length(replace(definicao, anterior, ''))) <> length(anterior) then
    raise exception 'Trecho ausente ou ambíguo em %', alvo;
  end if;
  execute replace(definicao, anterior, novo);
end $$;
select pg_temp.ajustar_trecho('public.apply_shop_change(uuid,text,jsonb)',
  'active, icon, prep_minutes','active, midia_secoes, icon, prep_minutes');
select pg_temp.ajustar_trecho('public.apply_shop_change(uuid,text,jsonb)',
  $a$nullif(p_payload->>'icon', ''),$a$, $a$coalesce(p_payload->'midia_secoes','{}'::jsonb), nullif(p_payload->>'icon', ''),$a$);
select pg_temp.ajustar_trecho('public.apply_shop_change(uuid,text,jsonb)',
  $a$icon = case when p_payload ? 'icon'$a$,
  $a$midia_secoes = coalesce(p_payload->'midia_secoes', midia_secoes),
        icon = case when p_payload ? 'icon'$a$);
select pg_temp.ajustar_trecho('public.get_public_shop_landing(text,text)',
  $a$'icon', sv.icon$a$, $a$'icon', coalesce(sv.midia_secoes->>'loja',sv.icon)$a$);
select pg_temp.ajustar_trecho('public.perfil_publico_profissional(text,text)',
  $a$'icone',coalesce(nullif(ss.icon,''),s.icon)$a$,
  $a$'icone',coalesce(ss.midia_secoes->>'profissional',s.midia_secoes->>'profissional',nullif(ss.icon,''),s.icon)$a$);
select pg_temp.ajustar_trecho('public.consultar_agenda_publica(text,uuid,text,date)',
  $a$'icone', v.icon$a$,
  $a$'icone', coalesce(v.midia_secoes->>'agendamento',v.icon), 'icone_profissional', coalesce(ss.midia_secoes->>'agendamento', v.midia_secoes->>'agendamento', nullif(ss.icon,''), v.icon)$a$);
select pg_temp.ajustar_trecho('public.consultar_agenda_publica(text,uuid,text,date)',
  'cross join lateral public.staff_service_terms(f.id, v.id) t',
  'cross join lateral public.staff_service_terms(f.id, v.id) t
      left join public.staff_services ss on ss.barbershop_id=v.barbershop_id and ss.service_id=v.id and ss.staff_id=f.id and ss.active');
notify pgrst, 'reload schema';
