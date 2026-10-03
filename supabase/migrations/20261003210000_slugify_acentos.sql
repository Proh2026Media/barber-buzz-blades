-- slugify_pt: as listas do translate() tinham tamanhos diferentes (96 × 100) e várias letras
-- saíam trocadas pela posição (í→e, ó→i, ú→o, ç→y, ñ→y): "Vinícius" virava "vinecius",
-- "Ação" virava "ayao". Listas realinhadas (96 × 96). Endereços já criados não mudam;
-- só nomes novos ou renomeados passam a gerar o endereço certo.
create or replace function public.slugify_pt(p_input text)
returns text
language plpgsql
immutable
as $$
declare
  raw text;
  result text;
begin
  raw := lower(coalesce(nullif(trim(p_input), ''), 'item'));
  raw := translate(
    raw,
    'áàâãäåāăąéèêëēĕėęěíìîïĩīĭįıóòôõöōŏőúùûüũūŭůűýÿçñÁÀÂÃÄÅĀĂĄÉÈÊËĒĔĖĘĚÍÌÎÏĨĪĬĮİÓÒÔÕÖŌŎŐÚÙÛÜŨŪŬŮŰÝŸÇÑ',
    'aaaaaaaaaeeeeeeeeeiiiiiiiiioooooooouuuuuuuuuyycnaaaaaaaaaeeeeeeeeeiiiiiiiiioooooooouuuuuuuuuyycn'
  );
  result := regexp_replace(raw, '[^a-z0-9]+', '-', 'g');
  result := regexp_replace(result, '^-+|-+$', '', 'g');
  if result = '' then result := 'item'; end if;
  return left(result, 60);
end;
$$;

grant execute on function public.slugify_pt(text) to authenticated;
