-- Opção visual para afastar cabeçalho e rodapé das bordas da janela.
-- O padrão `false` preserva exatamente o layout existente das barbearias.
alter table public.barbershop_settings
  add column if not exists floating_chrome boolean not null default false;

grant update (floating_chrome)
  on public.barbershop_settings to authenticated;

-- A opção faz parte da identidade visual e pode ser alterada pelos mesmos
-- papéis autorizados a personalizar logo, cores, fontes e cantos.
create or replace function public.settings_change_is_visual(
  old_row public.barbershop_settings,
  new_row public.barbershop_settings
) returns boolean language sql immutable set search_path=public as $$
  select old_row.barbershop_id = new_row.barbershop_id
    and (to_jsonb(old_row) - array[
      'display_name','logo_url','logo_background_color','font_family','custom_font_url',
      'custom_font_name','custom_font_faces','font_scope','header_font_weight',
      'header_font_style','corner_style','floating_chrome','primary_color','accent_color',
      'tagline','updated_at'
    ]) = (to_jsonb(new_row) - array[
      'display_name','logo_url','logo_background_color','font_family','custom_font_url',
      'custom_font_name','custom_font_faces','font_scope','header_font_weight',
      'header_font_style','corner_style','floating_chrome','primary_color','accent_color',
      'tagline','updated_at'
    ])
$$;
