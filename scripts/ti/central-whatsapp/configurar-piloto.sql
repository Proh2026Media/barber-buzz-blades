-- psql -v shop=UUID_DA_LOJA -v customer=UUID_DO_CLIENTE -f configurar-piloto.sql
-- Configura o escopo, MAS NÃO LIGA o piloto ou envia mensagem.
begin;
select pg_advisory_xact_lock(hashtextextended('whatsapp-egress',120));
create temporary table bc_piloto_alvo on commit drop as select :'shop'::uuid shop,:'customer'::uuid customer;
do $$begin
 if not exists(select 1 from bc_piloto_alvo a join public.memberships m on m.barbershop_id=a.shop and m.user_id=a.customer and m.role='customer' where public.whatsapp_complete_shop(a.shop)) then raise exception 'BC_PILOTO_EXIGE_CLIENTE_DA_LOJA_COMPLETA';end if;
 if exists(select 1 from public.whatsapp_care_cycle_policy where enabled) then raise exception 'BC_PAUSAR_POLITICA_ANTES_DO_ESCOPO';end if;
end $$;
update public.whatsapp_care_cycle_policy set enabled=false,pilot_shop_id=a.shop,pilot_customer_id=a.customer,version=version+1,changed_at=now() from bc_piloto_alvo a;
commit;
