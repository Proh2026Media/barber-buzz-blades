-- A Externa Barbearia foi remontada uma vez (Ezequiel + Tiago) em 02/10/2026.
-- A função de uso único apagava agenda, serviços e equipe; não deve continuar disponível.
drop function if exists public.admin_reset_externa_barbearia(text);
