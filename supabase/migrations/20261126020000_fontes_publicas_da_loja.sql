-- A URL identifica a versão publicada. Nenhuma coluna privada da configuração sai da função.
create or replace function public.get_public_shop_font_faces(p_shop_id uuid, p_font_url text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'url', face->'url', 'weight', face->'weight',
      'style', face->'style', 'file_name', face->'file_name'
    ) order by ordem)
    from jsonb_array_elements(s.custom_font_faces) with ordinality as f(face, ordem)
    where jsonb_typeof(face->'url') = 'string'
  ), '[]'::jsonb)
  from public.barbershop_settings s
  join public.barbershops b on b.id = s.barbershop_id
  where b.id = p_shop_id and b.status = 'active' and s.custom_font_url = p_font_url
$$;
revoke all on function public.get_public_shop_font_faces(uuid, text) from public;
grant execute on function public.get_public_shop_font_faces(uuid, text) to anon, authenticated;

-- Corrige também os clientes instalados que ainda carregam só o arquivo principal.
-- Só troca uma referência que aponta para itálico quando a loja pediu normal e já tem a face.
update public.barbershop_settings s
set custom_font_url = (
  select face->>'url'
  from jsonb_array_elements(s.custom_font_faces) as f(face)
  where face->>'style' = 'normal' and nullif(face->>'url', '') is not null
    and face->>'weight' ~ '^[1-9][0-9]{2}$'
  order by abs((face->>'weight')::integer - 400), (face->>'weight')::integer
  limit 1
)
where s.header_font_style = 'normal' and s.custom_font_url is not null
  and s.custom_font_faces @> jsonb_build_array(jsonb_build_object('style', 'italic', 'url', s.custom_font_url))
  and exists (
    select 1 from jsonb_array_elements(s.custom_font_faces) as f(face)
    where face->>'style' = 'normal' and nullif(face->>'url', '') is not null
      and face->>'weight' ~ '^[1-9][0-9]{2}$'
  );

notify pgrst, 'reload schema';
