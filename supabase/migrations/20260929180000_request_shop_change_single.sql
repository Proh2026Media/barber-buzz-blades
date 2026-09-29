-- A versão de 3 argumentos só repassava para a de 5 (com padrões) e deixava a API sem saber
-- qual escolher (PGRST203): toda mudança protegida enviada pela tela falhava.
drop function if exists public.request_shop_change(uuid, text, jsonb);

grant execute on function public.request_shop_change(uuid, text, jsonb, text, integer) to authenticated;

notify pgrst, 'reload schema';
