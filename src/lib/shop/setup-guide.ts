import { supabase } from "@/integrations/supabase/client";

/** O que a pessoa marcou à mão no guia "Deixe sua barbearia pronta". */
export type SetupGuideState = {
  hoursOk?: boolean;
  linkCopied?: boolean;
  /** "Trabalho sozinho": o passo Equipe e sócios fica pronto sem convidar ninguém. */
  teamOk?: boolean;
  hidden?: boolean;
  /** "Tudo pronto!" já foi mostrado uma vez nesta loja. */
  celebrated?: boolean;
};

const KEYS = ["hoursOk", "linkCopied", "teamOk", "hidden", "celebrated"] as const;

/** Só as chaves conhecidas com verdadeiro/falso (o resto é ignorado). */
export function cleanSetupGuide(value: unknown): SetupGuideState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const clean: SetupGuideState = {};
  for (const key of KEYS) {
    if (typeof source[key] === "boolean") clean[key] = source[key];
  }
  return clean;
}

/** Guia salvo no banco; `null` sem a migration 20261013230000, sem acesso ou sem rede. */
export async function fetchSetupGuide(shopId: string): Promise<SetupGuideState | null> {
  try {
    const { data, error } = await supabase.rpc("get_shop_setup_guide", { p_shop_id: shopId });
    if (error) return null;
    return cleanSetupGuide(data);
  } catch {
    return null;
  }
}

/** Grava no banco em segundo plano; o aparelho já guardou, então a falha não aparece. */
export async function saveSetupGuide(shopId: string, patch: SetupGuideState): Promise<void> {
  try {
    await supabase.rpc("save_shop_setup_guide", { p_shop_id: shopId, p_patch: patch });
  } catch {
    // Sem rede ou sem a migration: fica só neste aparelho.
  }
}
