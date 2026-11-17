-- Executar na transação da instalação com psql -v antes=JSON_DO_BACKUP.
create temporary table bc_liberacao_antes(j jsonb) on commit drop;
insert into bc_liberacao_antes values(:'antes'::jsonb);
do $$declare j jsonb;begin
 select a.j into j from bc_liberacao_antes a;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='whatsapp_care_cycle_policy' and column_name='shop_release_mode') then raise exception 'BC_INSTALACAO_AUSENTE';end if;
 if exists(select 1 from public.whatsapp_shop_releases) or exists(select 1 from public.whatsapp_care_cycle_policy where shop_release_mode) then raise exception 'BC_INSTALACAO_AMPLIOU';end if;
 if (select to_jsonb(p)-'shop_release_mode' from public.whatsapp_care_cycle_policy p where singleton) is distinct from j->'policy'
 or (select to_jsonb(s) from public.whatsapp_send_controls s where scope='global') is distinct from j->'pause' then raise exception 'BC_POLITICA_ALTERADA';end if;
 if exists(select 1 from jsonb_array_elements(j->'functions') f left join pg_proc p on p.oid=(f->>'oid')::oid where p.oid is null or p.proowner<>(f->>'owner')::oid or coalesce(to_jsonb(p.proacl),'null'::jsonb) is distinct from f->'acl') then raise exception 'BC_IDENTIDADES_ALTERADAS';end if;
 raise notice 'BC_LIBERACAO_INSTALADA_SEM_AMPLIAR';
end $$;
