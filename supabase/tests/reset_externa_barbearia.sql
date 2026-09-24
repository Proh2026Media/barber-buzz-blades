-- One-shot: após aplicar 20260923180000_booking_slug_manual_and_externa.sql
-- Como platform_admin autenticado (ou via psql com role que chame a função):
--
--   select public.admin_reset_externa_barbearia('RESET_EXTERNA');
--
-- Confirmação obrigatória: literal RESET_EXTERNA.
-- Efeito: apaga agenda, serviços e equipe da Externa; cria Ezequiel + Tiago.
-- Não configura domínio próprio — externabarbearia.com.br é só referência do site antigo.
-- Links públicos usam https://{slug}.beauty… até a loja ativar domínio próprio em Ajustes.

select public.admin_reset_externa_barbearia('RESET_EXTERNA');
