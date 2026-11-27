/** Modelos ilustrativos disponíveis a todas as lojas. A associação automática exige um nome reconhecido. */
export const modelosDeServico = [
  {
    id: "corte",
    emoji: "✂️",
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
    emoji: "🧔",
    rotulo: "catalog.starter.beard",
    nomes: ["barba", "aparar barba", "corte de barba", "beard trim", "arreglo de barba"],
  },
  {
    id: "cabelo-e-barba",
    emoji: "💈",
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
    emoji: "🪒",
    rotulo: "modelo.acabamento",
    nomes: ["acabamento", "pezinho", "contorno", "acabamento de nuca", "neckline trim"],
  },
  {
    id: "sobrancelha",
    emoji: "👁️",
    rotulo: "catalog.starter.brows",
    nomes: ["sobrancelha", "sobrancelhas", "design de sobrancelhas", "eyebrow shaping", "cejas"],
  },
  {
    id: "depilacao-nasal",
    emoji: "👃",
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
    emoji: "🧖",
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
const modelosPorFoto = new Map(modelosDeServico.map((m) => [fotoDoModelo(m), m]));
export const modeloDaFoto = (foto?: string | null) => (foto ? modelosPorFoto.get(foto) : undefined);

export function ehEmojiDeServico(icone?: string | null) {
  return Boolean(
    icone &&
    /^\p{Extended_Pictographic}[\uFE0E\uFE0F\p{Emoji_Modifier}]*(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F\p{Emoji_Modifier}]*)*$/u.test(
      icone,
    ),
  );
}
