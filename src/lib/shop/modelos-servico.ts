/** Modelos ilustrativos disponíveis a todas as lojas. A associação automática exige um nome reconhecido. */
export const modelosDeServico = [
  {
    id: "corte",
    icone: "Scissors",
    rotulo: "catalog.starter.cut",
    nomes: [
      "corte",
      "corte masculino",
      "corte de cabelo",
      "corte degradê",
      "degradê",
      "haircut",
      "corte de pelo",
    ],
  },
  {
    id: "barba",
    icone: "glyph:beard",
    rotulo: "catalog.starter.beard",
    nomes: ["barba", "aparar barba", "corte de barba", "beard trim", "arreglo de barba"],
  },
  {
    id: "cabelo-e-barba",
    icone: "lab:scissors-hair-comb",
    rotulo: "catalog.starter.combo",
    nomes: [
      "cabelo barba",
      "corte barba",
      "corte e barba",
      "cabelo e barba",
      "combo corte e barba",
      "haircut and beard",
      "corte y barba",
    ],
  },
  {
    id: "acabamento",
    icone: "glyph:trimmer",
    rotulo: "modelo.acabamento",
    nomes: ["acabamento", "pezinho", "contorno", "acabamento de nuca", "neckline trim"],
  },
  {
    id: "sobrancelha",
    icone: "Eye",
    rotulo: "catalog.starter.brows",
    nomes: ["sobrancelha", "sobrancelhas", "design de sobrancelhas", "eyebrow shaping", "cejas"],
  },
  {
    id: "depilacao-nasal",
    icone: "Sparkles",
    rotulo: "modelo.nasal",
    nomes: [
      "depilação do nariz com cera",
      "depilação nasal",
      "depilação de nariz",
      "cera no nariz",
      "nose waxing",
      "depilación nasal",
    ],
  },
  {
    id: "barboterapia",
    icone: "lab:towel-folded",
    rotulo: "modelo.barboterapia",
    nomes: ["barboterapia", "barba com toalha quente", "hot towel shave"],
  },
] as const;

type Modelo = (typeof modelosDeServico)[number];
export const fotoDoModelo = (modelo: Modelo) => `/images/servicos-modelo/${modelo.id}.webp`;
export const normalizarServico = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const modelosPorNome = new Map(
  modelosDeServico.flatMap((m) => m.nomes.map((nome) => [normalizarServico(nome), m] as const)),
);
export const modeloDoServico = (nome: string) => modelosPorNome.get(normalizarServico(nome));
/** O texto da barbearia prevalece. Nomes sem modelo exigem uma descrição própria. */
export function descricaoDoServico(
  nome: string,
  cadastrada: string | null | undefined,
  traduzir: (chave: `modelo.descricao.${Modelo["id"]}`) => string,
): string {
  const texto = cadastrada?.trim();
  if (texto) return texto;
  const modelo = modeloDoServico(nome);
  return modelo ? traduzir(`modelo.descricao.${modelo.id}`) : "";
}
const modelosPorFoto = new Map(modelosDeServico.map((m) => [fotoDoModelo(m), m]));
export const modeloDaFoto = (foto?: string | null) => (foto ? modelosPorFoto.get(foto) : undefined);

export const secoesDaIlustracao = ["loja", "profissional", "agendamento"] as const;
export type SecaoDaIlustracao = (typeof secoesDaIlustracao)[number];
export type IlustracoesDoServico = Partial<Record<SecaoDaIlustracao, string>>;

/** Cada seção substitui uma única ilustração. Uma seção ausente acompanha o padrão do serviço. */
export function lerIlustracoes(valor: unknown): IlustracoesDoServico {
  const resultado: IlustracoesDoServico = {};
  if (!valor || typeof valor !== "object") return resultado;
  for (const secao of secoesDaIlustracao) {
    const item = (valor as Record<string, unknown>)[secao];
    if (typeof item === "string" && item.trim()) resultado[secao] = item;
  }
  return resultado;
}

export function imagemDeServico(valor?: string | null): valor is string {
  return Boolean(
    valor &&
    (/^https?:\/\//i.test(valor) || valor.startsWith("data:image/") || modeloDaFoto(valor)),
  );
}

export function ilustracaoDoServico(nome: string, escolha?: string | null) {
  const modelo = modeloDoServico(nome);
  if (escolha && (imagemDeServico(escolha) || /^[a-zA-Z][a-zA-Z0-9:-]*$/.test(escolha)))
    return escolha;
  return modelo ? fotoDoModelo(modelo) : "Scissors";
}
