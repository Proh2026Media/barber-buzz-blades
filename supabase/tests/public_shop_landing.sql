-- Página pública da barbearia: só dados da loja, nada de cliente.
-- Rodar depois de 20261002120000_public_shop_landing.sql e 20261002170000_public_shop_landing_team_cards.sql,
-- numa transação; sempre ROLLBACK.
create temporary table land_ctx as
select gen_random_uuid() shop_id, gen_random_uuid() owner_id, gen_random_uuid() cust_id,
  gen_random_uuid() staff_a, gen_random_uuid() staff_b, gen_random_uuid() service_id,
  'land-' || substr(md5(random()::text), 1, 10) slug;
grant select on land_ctx to anon, authenticated;

select shop_id, owner_id, cust_id, staff_a, staff_b, service_id, slug from land_ctx \gset

create function pg_temp.check_land(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_land_error(statement text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement; exception when others then failed := true; end;
  perform pg_temp.check_land(failed, label);
end $$;

insert into public.barbershops(id, name, slug, timezone)
select shop_id, 'Landing test', slug, 'America/Sao_Paulo' from land_ctx;
insert into auth.users(id, email, raw_user_meta_data)
select u, u || '@example.invalid', '{"full_name":"Cliente Secreto"}'::jsonb from land_ctx c
cross join lateral unnest(array[c.owner_id, c.cust_id]) u;
insert into public.staff(id, barbershop_id, display_name, user_id, booking_slug, bio, created_at)
select staff_a, shop_id, 'Barbeiro A', owner_id, 'barbeiro-a', 'Degradê', now() - interval '2 minutes' from land_ctx union all
select staff_b, shop_id, 'Barbeiro B', null, 'barbeiro-b', null, now() - interval '1 minute' from land_ctx;
insert into public.services(id, barbershop_id, name, duration_minutes, price_cents)
select service_id, shop_id, 'Corte', 30, 5000 from land_ctx;
insert into public.shop_members(barbershop_id, user_id, staff_id, role, ownership_percent)
select shop_id, owner_id, staff_a, 'owner'::public.shop_member_role, 100 from land_ctx;
insert into public.memberships(user_id, barbershop_id, role)
select cust_id, shop_id, 'customer'::public.app_role from land_ctx;
insert into public.barbershop_settings(barbershop_id) select shop_id from land_ctx on conflict do nothing;
-- Aberto o dia todo, todos os dias, para o teste não depender do horário em que roda.
insert into public.business_hours(barbershop_id, weekday, is_open, opens_at, closes_at)
select shop_id, d, true, '00:00', '23:59' from land_ctx cross join generate_series(0, 6) d
on conflict (barbershop_id, weekday) do update set is_open = true, opens_at = '00:00', closes_at = '23:59';

-- Atendimento de cliente agora com o barbeiro A: deve ocupar o horário, sem revelar quem é.
insert into public.appointments(barbershop_id, customer_id, service_id, staff_id, starts_at, ends_at, status, booked_price_cents)
select shop_id, cust_id, service_id, staff_a,
  date_trunc('hour', now()) + interval '1 hour', date_trunc('hour', now()) + interval '90 minutes',
  'confirmed'::public.appointment_status, 5000
from land_ctx
where (now() at time zone 'America/Sao_Paulo')::time < '22:00';

set local role anon;
select pg_temp.check_land(public.get_public_shop_landing(:'slug') is not null, 'Visitante sem login lê a página pelo endereço');
select pg_temp.check_land(public.get_public_shop_landing(:'shop_id') ->> 'shop' is not null, 'Também lê pelo identificador');
select pg_temp.check_land(public.get_public_shop_landing('nao-existe-' || :'slug') is null, 'Endereço desconhecido devolve vazio');
select pg_temp.check_land(
  jsonb_array_length(public.get_public_shop_landing(:'slug') -> 'staff') = 2, 'Mostra os barbeiros ativos');
select pg_temp.check_land(
  jsonb_array_length(public.get_public_shop_landing(:'slug') -> 'hours') = 7, 'Mostra o expediente da semana');
select pg_temp.check_land(
  public.get_public_shop_landing(:'slug') ->> 'landing' is not null
  and (public.get_public_shop_landing(:'slug') -> 'landing' ->> 'enabled')::boolean,
  'Página nasce ligada com valores padrão');
select pg_temp.check_land(
  public.get_public_shop_landing(:'slug')::text !~* '(Cliente Secreto|example\.invalid|customer_id|user_id|phone|email)',
  'Nenhum dado de cliente ou de conta aparece na resposta');
select pg_temp.check_land(
  position(:'cust_id' in public.get_public_shop_landing(:'slug')::text) = 0
  and position(:'owner_id' in public.get_public_shop_landing(:'slug')::text) = 0,
  'Nenhum identificador de pessoa aparece na resposta');
select pg_temp.check_land(
  (select bool_and(
     (select count(*) from jsonb_array_elements_text(s -> 'free_today') t
      where t.value::time >= ((date_trunc('hour', now()) + interval '1 hour') at time zone 'America/Sao_Paulo')::time
        and t.value::time < ((date_trunc('hour', now()) + interval '90 minutes') at time zone 'America/Sao_Paulo')::time) = 0)
   from jsonb_array_elements(public.get_public_shop_landing(:'slug') -> 'staff') s
   where s ->> 'name' = 'Barbeiro A')
  or (now() at time zone 'America/Sao_Paulo')::time >= '22:00',
  'Horário ocupado por atendimento não aparece como livre');
select pg_temp.check_land(
  (select bool_and(t.value::time > (now() at time zone 'America/Sao_Paulo')::time - interval '1 minute')
   from jsonb_array_elements(public.get_public_shop_landing(:'slug') -> 'staff') s,
        jsonb_array_elements_text(s -> 'free_today') t) is not false,
  'Horários que já passaram não aparecem');
do $$ begin
  update public.barbershop_settings set landing = '{"headline":"x"}'::jsonb
  where barbershop_id = (select shop_id from land_ctx);
exception when others then null;
end $$;
reset role;
select pg_temp.check_land(
  (select landing from public.barbershop_settings where barbershop_id = :'shop_id') = '{}'::jsonb,
  'Visitante não altera a página');

-- Validação da configuração
select pg_temp.check_land(public.landing_config_valid('{}'::jsonb), 'Configuração vazia é válida');
select pg_temp.check_land(public.landing_config_valid(
  '{"headline":"Corte na hora","show_today":false,"instagram":"@barbearia","whatsapp":"+55 11 99999-0000"}'::jsonb),
  'Configuração completa é válida');
select pg_temp.check_land(not public.landing_config_valid('{"script":"<x>"}'::jsonb), 'Chave desconhecida é recusada');
select pg_temp.check_land(not public.landing_config_valid('{"show_today":"sim"}'::jsonb), 'Interruptor com texto é recusado');
select pg_temp.check_land(not public.landing_config_valid(jsonb_build_object('headline', repeat('a', 81))), 'Título longo demais é recusado');
select pg_temp.check_land(not public.landing_config_valid('{"instagram":"ab cd"}'::jsonb), 'Instagram inválido é recusado');
select pg_temp.check_land(not public.landing_config_valid('[]'::jsonb), 'Lista no lugar de objeto é recusada');

-- Desligar a página e esconder blocos
update public.barbershop_settings set landing = '{"show_today":false,"show_services":false}'::jsonb
where barbershop_id = :'shop_id';
set local role anon;
select pg_temp.check_land(
  (select bool_and(jsonb_array_length(s -> 'free_today') = 0)
   from jsonb_array_elements(public.get_public_shop_landing(:'slug') -> 'staff') s),
  'Sem horários do dia quando a loja esconde esse bloco');
select pg_temp.check_land(
  jsonb_array_length(public.get_public_shop_landing(:'slug') -> 'services') = 0,
  'Sem serviços quando a loja esconde esse bloco');
select pg_temp.check_land(
  (select bool_and(s ? 'bio' and s ? 'avatar_url' and s ? 'booking_slug')
   from jsonb_array_elements(public.get_public_shop_landing(:'slug') -> 'staff') s)
  and jsonb_array_length(public.get_public_shop_landing(:'slug') -> 'staff') = 2,
  'Cartão da equipe continua com foto, apresentação e endereço de agendamento sem os horários');
reset role;
update public.barbershop_settings set landing = '{"show_staff":false}'::jsonb
where barbershop_id = :'shop_id';
set local role anon;
select pg_temp.check_land(
  jsonb_array_length(public.get_public_shop_landing(:'slug') -> 'staff') = 0,
  'Equipe escondida não manda nenhum profissional, mesmo com horários de hoje ligados');
reset role;
update public.services set icon = 'https://exemplo.invalid/corte.webp' where id = :'service_id';
update public.barbershop_settings set landing = '{}'::jsonb where barbershop_id = :'shop_id';
set local role anon;
select pg_temp.check_land(
  public.get_public_shop_landing(:'slug') -> 'services' -> 0 ->> 'icon' = 'https://exemplo.invalid/corte.webp',
  'Serviço leva a foto ou o ícone escolhido');
select pg_temp.check_land(
  (select bool_and(s ->> 'name' in ('Barbeiro A', 'Barbeiro B') and s ->> 'booking_slug' like 'barbeiro-_')
   from jsonb_array_elements(public.get_public_shop_landing(:'slug') -> 'staff') s)
  and public.get_public_shop_landing(:'slug') -> 'staff' -> 0 ->> 'bio' = 'Degradê',
  'Profissional vem com nome, apresentação e endereço de agendamento');
reset role;
update public.barbershop_settings set landing = '{"enabled":false}'::jsonb where barbershop_id = :'shop_id';
set local role anon;
select pg_temp.check_land(
  jsonb_array_length(public.get_public_shop_landing(:'slug') -> 'staff') = 0
  and jsonb_array_length(public.get_public_shop_landing(:'slug') -> 'hours') = 0
  and public.get_public_shop_landing(:'slug') -> 'shop' ->> 'name' = 'Landing test',
  'Página desligada mostra só a marca e o acesso');
reset role;

update public.barbershops set status = 'suspended' where id = :'shop_id';
set local role anon;
select pg_temp.check_land(public.get_public_shop_landing(:'slug') is null, 'Loja suspensa não aparece');
reset role;

-- Dono edita a página (mudança visual)
update public.barbershops set status = 'active' where id = :'shop_id';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
update public.barbershop_settings set landing = '{"headline":"Bem-vindo"}'::jsonb where barbershop_id = :'shop_id';
select set_config('request.jwt.claim.sub', :'cust_id', true);
update public.barbershop_settings set landing = '{"headline":"Invadido"}'::jsonb where barbershop_id = :'shop_id';
reset role;
select pg_temp.check_land(
  (select landing ->> 'headline' from public.barbershop_settings where barbershop_id = :'shop_id') = 'Bem-vindo',
  'Dono edita a página e cliente não');
select pg_temp.expect_land_error(
  format('update public.barbershop_settings set landing = %L where barbershop_id = %L', '{"about":1}', :'shop_id'),
  'Banco recusa configuração inválida mesmo sem passar pela tela');
