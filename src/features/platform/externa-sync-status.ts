export const LOJA_COM_PLANILHA = "a5c2b03b-1e30-4446-b013-8cb8a9d8c447";
export const CONTAGENS = ["linhas", "vinculadas", "pendentes", "ausentes", "excluidas"] as const;
export const HORARIOS = ["sucesso", "tentativa", "mudanca"] as const;

const estados = ["ok", "erro", "atrasado", "revisar"] as const;

export type SituacaoPlanilha = {
  estado: (typeof estados)[number];
  revisao: { linha: number; motivo: string }[];
} & Record<(typeof CONTAGENS)[number], number | null> &
  Record<(typeof HORARIOS)[number], string | null>;

/** Um retorno incompleto da API não pode aparecer no monitor como sincronização concluída. */
export function lerSituacaoPlanilha(valor: unknown): SituacaoPlanilha | null {
  if (valor === null) return null;
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new TypeError();
  const obj = valor as Record<string, unknown>;
  if (!estados.some((estado) => estado === obj.estado)) throw new TypeError();
  for (const campo of CONTAGENS) {
    const numero = obj[campo];
    if (numero === null && obj.sucesso === null) continue;
    if (typeof numero !== "number" || !Number.isSafeInteger(numero) || numero < 0)
      throw new TypeError();
  }
  for (const campo of HORARIOS) {
    const data = obj[campo];
    if (data !== null && (typeof data !== "string" || !Number.isFinite(Date.parse(data)))) {
      throw new TypeError();
    }
  }
  if (
    !Array.isArray(obj.revisao) ||
    obj.revisao.length > 20 ||
    !obj.revisao.every(
      (item) =>
        item &&
        typeof item === "object" &&
        Number.isSafeInteger(item.linha) &&
        item.linha >= 2 &&
        typeof item.motivo === "string",
    )
  )
    throw new TypeError();
  return obj as SituacaoPlanilha;
}

export function motivoDaRevisao(motivo: string) {
  switch (motivo) {
    case "telefone_invalido":
      return "externaSync.telefone";
    case "cliente_invalido":
    case "nome_invalido":
    case "nome_ambiguo":
      return "externaSync.nome";
    case "inicio_invalido":
    case "fim_invalido":
    case "criado_invalido":
    case "intervalo_invalido":
    case "hora_civil_invalida":
      return "externaSync.data";
    case "conflito_identidade":
    case "possivel_troca_de_identidade":
    case "identidade_legada_divergente":
    case "legado_ausente":
    case "vinculo_legado_inconclusivo":
    case "vinculo_duplicado":
      return "externaSync.ambigua";
    case "horario_ocupado":
      return "externaSync.ocupado";
    case "catalogo_inativo":
    case "catalogo_ausente_ou_ambiguo":
    case "profissional_ou_servico_ausente":
      return "externaSync.cadastro";
    case "telefone_com_conta":
      return "externaSync.conta";
    case "reserva_ja_existe_no_sistema":
      return "externaSync.existente";
    case "reserva_removida_no_sistema":
      return "externaSync.removida";
    case "reserva_editada_no_sistema":
    case "ficha_editada_no_sistema":
      return "externaSync.editada";
    case "regra_de_agenda_ou_cadastro":
      return "externaSync.regra";
    default:
      return "externaSync.conferirLinha";
  }
}
