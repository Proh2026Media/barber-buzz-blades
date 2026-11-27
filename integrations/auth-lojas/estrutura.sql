-- Durante a transição, a imagem anterior pode continuar a gravar chaves do único piloto.
alter table auth.webauthn_credentials
  add column if not exists rp_id text not null default 'loja-teste-b.aurset.app',
  add column if not exists shop_id uuid not null default 'bc8595cb-72a7-4428-8a9c-97fe12c18222';
create index if not exists webauthn_credentials_cliente_loja_idx
  on auth.webauthn_credentials (user_id, shop_id, rp_id);
