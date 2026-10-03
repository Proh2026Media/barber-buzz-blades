-- Pendências da auditoria (03/10/2026) — mensagens do WhatsApp.
--
-- render_whatsapp_template devolvia NULL em silêncio quando o texto passava de
-- 1000 caracteres depois de trocar as variáveis (ex.: nome de serviço ou
-- observação longos), e a mensagem simplesmente não era enviada. Agora o texto
-- é cortado em 1000 caracteres com reticências no fim, sem descartar o aviso.
--
-- Parte da definição mais recente (20260925160000_whatsapp_templates_and_calendar_choice.sql);
-- só a regra do tamanho muda. Continua devolvendo NULL quando sobra {{...}} sem
-- valor ou quando o texto fica vazio — nesses casos não há o que enviar.

create or replace function public.render_whatsapp_template(
  p_body text,
  p_vars jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  max_chars constant integer := 1000;
  result text := replace(replace(coalesce(p_body, ''), E'\r\n', E'\n'), E'\r', E'\n');
  key text;
  value text;
begin
  for key, value in
    select * from jsonb_each_text(coalesce(p_vars, '{}'::jsonb))
  loop
    result := replace(result, '{{' || key || '}}', coalesce(value, ''));
  end loop;
  -- Bloqueia envio se restar {{...}} (inclui acentos, ex.: {{serviço}} não resolvido).
  if result ~ '\{\{[^}]+\}\}' then
    return null;
  end if;
  if length(trim(result)) = 0 then
    return null;
  end if;
  -- Texto longo demais: corta e termina com reticências (1 caractere), respeitando
  -- o limite total. Espaços e quebras antes do corte saem para não sobrar "  …".
  if char_length(result) > max_chars then
    result := rtrim(left(result, max_chars - 1), E' \n\t') || '…';
  end if;
  return result;
end;
$$;

-- Mesmas permissões de antes (create or replace mantém, reaplicado por segurança).
revoke all on function public.render_whatsapp_template(text, jsonb) from public, anon;
grant execute on function public.render_whatsapp_template(text, jsonb) to service_role;
