import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";

type Regras = { manual: boolean; servico: string | null };
type Vez = { profissional: string; slug: string; turno: string };

export function useRegrasAgenda(loja?: string | null, barbeiro?: string | null) {
  const demo = useDemo();
  return useQuery({
    queryKey: ["regras-sugestao-agenda", loja, barbeiro ?? null],
    enabled: Boolean(loja && !demo),
    staleTime: 30000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("regras_sugestao_agenda", {
          p_loja: loja!,
          p_host: window.location.hostname,
          ...(barbeiro ? { p_barber: barbeiro } : {}),
        })
        .abortSignal(signal);
      if (error) throw error;
      return data as Regras | null;
    },
  });
}

export function useVezAgenda(
  loja: string | null | undefined,
  servico: string | undefined,
  dia: string,
  habilitada: boolean,
) {
  const demo = useDemo();
  return useQuery({
    queryKey: ["rodizio-agenda", loja, servico ?? null, dia],
    enabled: Boolean(!demo && loja && dia && habilitada),
    // O banco confere de novo ao reservar. Uma atualização em segundo plano não deve mover a seleção.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("consultar_rodizio_agenda", {
          p_loja: loja!,
          p_host: window.location.hostname,
          ...(servico ? { p_servico: servico } : {}),
          p_dia: dia,
        })
        .abortSignal(signal);
      if (error) throw error;
      return data as Vez | null;
    },
  });
}
