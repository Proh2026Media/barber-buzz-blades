-- Estado agregado do leitor. As linhas nominativas da planilha nunca saem pelo painel.
create schema if not exists externa_monitor;
revoke all on schema externa_monitor from public, anon, authenticated;
create table if not exists externa_monitor.estado (
  loja uuid primary key references public.barbershops(id) on delete cascade,
  tentativa timestamptz not null default now(),
  sucesso timestamptz,
  mudanca timestamptz,
  assinatura text,
  erro text,
  totais jsonb not null default '{}'
);
create table if not exists externa_monitor.abas_complementares (
  gid text primary key,
  nome text not null,
  conteudo jsonb not null,
  presente boolean not null default true
);
revoke all on all tables in schema externa_monitor from public, anon, authenticated;
create or replace function public.platform_externa_sync_status(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_platform_admin() then raise insufficient_privilege; end if;
  return (select jsonb_build_object(
    'tentativa',e.tentativa,'sucesso',e.sucesso,'mudanca',e.mudanca,
    'estado',case when e.erro is not null then 'erro'
      when e.sucesso is null or e.sucesso < now()-interval '15 minutes' then 'atrasado'
      when coalesce((e.totais->>'pendentes')::integer,0)>0 then 'revisar' else 'ok' end,
    'linhas',e.totais->'linhas','vinculadas',e.totais->'vinculadas',
    'pendentes',e.totais->'pendentes','ausentes',e.totais->'ausentes',
    'excluidas',e.totais->'excluidas_da_agenda',
    'revisao',(select coalesce(jsonb_agg(to_jsonb(p) order by p.linha),'[]'::jsonb)
      from (select (l.registro->>'linha')::integer linha,l.motivo
        from manutencao.espelho_externa_linhas l where l.presente and l.situacao='pendente'
        order by linha limit 20) p)
  ) from externa_monitor.estado e where e.loja=p_shop_id);
end $$;
revoke all on function public.platform_externa_sync_status(uuid) from public,anon;
grant execute on function public.platform_externa_sync_status(uuid) to authenticated;
notify pgrst,'reload schema';
