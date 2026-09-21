/**
 * Catálogo de ícones para serviços de barbearia e salão.
 *
 * Reúne três fontes no mesmo padrão visual (linha, traço 2, cantos arredondados):
 * - Lucide (instalado) — base geral: tesoura, navalha, brilho, bem-estar, clube.
 * - Lucide Lab (`@lucide/lab`, ISC) — ícones de nicho: poste de barbeiro, secador,
 *   navalha, bigode, toalhas, perfume, sabonete, chapéus, vestuário.
 * - Catálogos abertos portados em `service-glyphs.tsx` — espelho, pente, esmalte,
 *   batom, escova, máquina, pincel de barbear, massagem, aparador.
 *
 * O identificador gravado no banco é `lab:<nome>` ou `glyph:<nome>` para as fontes
 * complementares, e o nome puro do Lucide para a base (compatível com dados antigos).
 */

import {
  Activity,
  AudioLines,
  Award,
  Baby,
  BadgeCheck,
  Bandage,
  Bath,
  Beer,
  Bike,
  Brush,
  Building2,
  Cake,
  CalendarDays,
  Camera,
  Candy,
  Check,
  Clock,
  Coffee,
  Cookie,
  Crown,
  Cross,
  CupSoda,
  Diamond,
  Droplet,
  Droplets,
  Dumbbell,
  Eye,
  Fan,
  Fingerprint,
  Flame,
  Flower,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  GlassWater,
  Glasses,
  Hand,
  Icon,
  HandHeart,
  Handshake,
  Heart,
  HeartHandshake,
  HeartPulse,
  IceCreamCone,
  Laugh,
  Leaf,
  Lightbulb,
  Mars,
  Martini,
  Medal,
  Moon,
  Music,
  Paintbrush,
  PaintbrushVertical,
  Palette,
  PartyPopper,
  PawPrint,
  PersonStanding,
  Pill,
  Pipette,
  Radio,
  Rainbow,
  Ribbon,
  Ruler,
  Scissors,
  ScissorsLineDashed,
  Shield,
  ShieldCheck,
  Shirt,
  ShowerHead,
  Smile,
  Snowflake,
  Sparkle,
  Sparkles,
  SprayCan,
  Star,
  Stethoscope,
  Sun,
  SunMedium,
  Syringe,
  Thermometer,
  ThumbsUp,
  Timer,
  Trophy,
  Tv,
  UsersRound,
  Utensils,
  Venus,
  WandSparkles,
  Wand2,
  WashingMachine,
  Watch,
  Waves,
  Wind,
  Wine,
  Zap,
  type IconNode,
  type LucideIcon,
} from "lucide-react";
import {
  barberPole,
  bathBubble,
  bottlePerfume,
  bottleSpray,
  bottleToothbrushComb,
  candleHolder,
  chairsTableParasol,
  coatHanger,
  dress,
  fanHandheld,
  flowerLotus,
  flowerRose,
  flowerTulip,
  gemRing,
  hatBeanie,
  hatBowler,
  hatTop,
  hairdryer,
  highHeel,
  iron,
  kettle,
  mustache,
  pillow,
  razor,
  razorBlade,
  scarf,
  scissorsHairComb,
  shaveFace,
  sneaker,
  soapBar,
  sunloungerParasolSun,
  tie,
  towelFolded,
  whisk,
} from "@lucide/lab";

import { ServiceGlyph, type ServiceGlyphId } from "./service-glyphs";
import { isServiceImageSource } from "@/lib/shop/service-image";
import { cn } from "@/lib/utils";

export type ServiceIconEntry = {
  /** Valor persistido no banco. */
  id: string;
  label: string;
  /** Termos extras para a busca do seletor. */
  keywords?: string;
  lucide?: LucideIcon;
  lab?: IconNode;
  glyph?: ServiceGlyphId;
};

export type ServiceIconGroup = {
  id: string;
  label: string;
  icons: ServiceIconEntry[];
};

const lab = (id: string, label: string, node: IconNode, keywords: string): ServiceIconEntry => ({
  id: `lab:${id}`,
  label,
  keywords,
  lab: node,
});

const glyph = (id: ServiceGlyphId, label: string, keywords: string): ServiceIconEntry => ({
  id: `glyph:${id}`,
  label,
  keywords,
  glyph: id,
});

export const SERVICE_ICON_GROUPS: ServiceIconGroup[] = [
  {
    id: "cabelo",
    label: "Cabelo",
    icons: [
      { id: "Scissors", label: "Tesoura", keywords: "corte tesoura barbeiro", lucide: Scissors },
      {
        id: "ScissorsLineDashed",
        label: "Corte",
        keywords: "corte tesoura ponta",
        lucide: ScissorsLineDashed,
      },
      lab("scissors-hair-comb", "Tesoura e pente", scissorsHairComb, "corte pente tesoura"),
      lab("hairdryer", "Secador", hairdryer, "secador escova secar"),
      glyph("hair", "Cabelo", "cabelo corte penteado"),
      glyph("hairLong", "Cabelo longo", "cabelo longo comprido"),
      glyph("hairBrush", "Escova", "escova pentear cabelo"),
      glyph("comb", "Pente", "pente pentear desembaracar"),
      glyph("clippers", "Máquina", "maquina cortar degradê"),
      glyph("trimmer", "Aparador", "aparador maquina acabamento"),
      glyph("hairClip", "Presa de cabelo", "presa grampo cabelo"),
      { id: "Wind", label: "Vento", keywords: "vento sopro secagem", lucide: Wind },
      { id: "Fan", label: "Ventilador", keywords: "ventilador ar", lucide: Fan },
      { id: "Flame", label: "Chapinha", keywords: "chapinha fogo calor", lucide: Flame },
      lab("iron", "Ferro", iron, "chapinha ferro alisar"),
      { id: "Droplets", label: "Hidratação", keywords: "hidratacao gotas", lucide: Droplets },
      { id: "Sparkles", label: "Brilho", keywords: "brilho luz", lucide: Sparkles },
    ],
  },
  {
    id: "barba",
    label: "Barba e bigode",
    icons: [
      lab("razor", "Navalha", razor, "navalha barba gilete"),
      glyph("straightRazor", "Navalha reta", "navalha reta barbear classico"),
      lab("razor-blade", "Lâmina", razorBlade, "lamina gilete aparelho"),
      lab("shave-face", "Barbear", shaveFace, "barbear rosto lamina"),
      lab("mustache", "Bigode", mustache, "bigode pelo"),
      glyph("beard", "Barba", "barba pelos"),
      glyph("shavingBrush", "Pincel de barbear", "pincel barbear espuma"),
      lab("barber-pole", "Poste de barbeiro", barberPole, "poste barbeiro barbearia"),
      { id: "SprayCan", label: "Espuma", keywords: "espuma spray gel", lucide: SprayCan },
      { id: "Droplet", label: "Loção", keywords: "locao oleo gota", lucide: Droplet },
      { id: "Brush", label: "Pincel", keywords: "pincel", lucide: Brush },
    ],
  },
  {
    id: "estetica",
    label: "Estética e rosto",
    icons: [
      { id: "Sparkles", label: "Brilho", keywords: "brilho glow", lucide: Sparkles },
      { id: "Sparkle", label: "Cintilar", keywords: "cintilar brilho", lucide: Sparkle },
      glyph("mirror", "Espelho", "espelho reflexo"),
      { id: "Flower", label: "Flor", keywords: "flor natural", lucide: Flower },
      { id: "Flower2", label: "Flor aberta", keywords: "flor natural", lucide: Flower2 },
      lab("flower-lotus", "Lótus", flowerLotus, "lotus spa flor"),
      lab("flower-rose", "Rosa", flowerRose, "rosa flor"),
      lab("flower-tulip", "Tulipa", flowerTulip, "tulipa flor"),
      { id: "Sun", label: "Sol", keywords: "sol bronze luz", lucide: Sun },
      { id: "SunMedium", label: "Bronze", keywords: "bronze sol", lucide: SunMedium },
      { id: "Moon", label: "Lua", keywords: "lua noite", lucide: Moon },
      { id: "Wand2", label: "Mágica", keywords: "magica transformacao", lucide: Wand2 },
      {
        id: "WandSparkles",
        label: "Transformação",
        keywords: "transformacao magica",
        lucide: WandSparkles,
      },
      { id: "Snowflake", label: "Peeling", keywords: "peeling gelado limpeza", lucide: Snowflake },
      {
        id: "Thermometer",
        label: "Temperatura",
        keywords: "temperatura calor",
        lucide: Thermometer,
      },
      { id: "Eye", label: "Sobrancelha", keywords: "sobrancelha olhar", lucide: Eye },
      { id: "Pipette", label: "Pigmento", keywords: "pigmento cor", lucide: Pipette },
      { id: "Palette", label: "Cores", keywords: "cores paleta", lucide: Palette },
      { id: "Paintbrush", label: "Pincel de cor", keywords: "pincel cor", lucide: Paintbrush },
      { id: "Smile", label: "Sorriso", keywords: "sorriso rosto", lucide: Smile },
      { id: "Laugh", label: "Bem-estar", keywords: "riso rosto", lucide: Laugh },
    ],
  },
  {
    id: "unhas",
    label: "Unhas e maquiagem",
    icons: [
      glyph("nailPolish", "Esmalte", "esmalte unha pintura"),
      glyph("lipstick", "Batom", "batom boca maquiagem"),
      { id: "Hand", label: "Mão", keywords: "mao manicure", lucide: Hand },
      { id: "HandHeart", label: "Cuidado", keywords: "cuidado carinho", lucide: HandHeart },
      { id: "Brush", label: "Pincel", keywords: "pincel maquiagem", lucide: Brush },
      {
        id: "PaintbrushVertical",
        label: "Pincel fino",
        keywords: "pincel detalhe",
        lucide: PaintbrushVertical,
      },
      { id: "Palette", label: "Paleta", keywords: "paleta cores", lucide: Palette },
      { id: "Pipette", label: "Pigmento", keywords: "pigmento cor", lucide: Pipette },
      { id: "Gem", label: "Joia", keywords: "joia brilho", lucide: Gem },
      { id: "Diamond", label: "Diamante", keywords: "diamante luxo", lucide: Diamond },
      lab("gem-ring", "Anel", gemRing, "anel joia alianca"),
      { id: "Star", label: "Estrela", keywords: "estrela", lucide: Star },
    ],
  },
  {
    id: "bemestar",
    label: "Bem-estar e spa",
    icons: [
      { id: "Waves", label: "Massagem", keywords: "massagem relaxar ondas", lucide: Waves },
      glyph("massage", "Massoterapia", "massagem terapia corpo"),
      { id: "Bath", label: "Banho", keywords: "banho imersao", lucide: Bath },
      { id: "ShowerHead", label: "Chuveiro", keywords: "chuveiro ducha banho", lucide: ShowerHead },
      lab("bath-bubble", "Espuma de banho", bathBubble, "espuma banho bolha"),
      lab("soap-bar", "Sabonete", soapBar, "sabonete limpeza"),
      lab("towel-folded", "Toalha", towelFolded, "toalha banho"),
      lab("pillow", "Almofada", pillow, "almofada descanso"),
      lab("candle-holder", "Vela", candleHolder, "vela aroma relaxar"),
      lab("bottle-perfume", "Perfume", bottlePerfume, "perfume aroma fragrancia"),
      lab("bottle-spray", "Spray", bottleSpray, "spray fixador"),
      lab("bottle-toothbrush-comb", "Higiene", bottleToothbrushComb, "higiene escova"),
      glyph("perfume", "Essência", "essencia fragrancia"),
      { id: "Leaf", label: "Natural", keywords: "natural organico folha", lucide: Leaf },
      { id: "HeartPulse", label: "Pulso", keywords: "pulso saude", lucide: HeartPulse },
      { id: "Activity", label: "Atividade", keywords: "atividade saude", lucide: Activity },
      { id: "Stethoscope", label: "Clínico", keywords: "clinico saude", lucide: Stethoscope },
      { id: "Syringe", label: "Procedimento", keywords: "procedimento injecao", lucide: Syringe },
      { id: "Bandage", label: "Curativo", keywords: "curativo cuidado", lucide: Bandage },
      { id: "Pill", label: "Suplemento", keywords: "suplemento remedio", lucide: Pill },
      { id: "Cross", label: "Saúde", keywords: "saude cruz", lucide: Cross },
    ],
  },
  {
    id: "corpo",
    label: "Corpo e vestuário",
    icons: [
      { id: "Shirt", label: "Camisa", keywords: "camisa roupa", lucide: Shirt },
      lab("coat-hanger", "Cabide", coatHanger, "cabide roupa"),
      lab("dress", "Vestido", dress, "vestido roupa"),
      lab("scarf", "Lenço", scarf, "lenco cachecol"),
      lab("tie", "Gravata", tie, "gravata social"),
      lab("hat-top", "Cartola", hatTop, "cartola chapeu"),
      lab("hat-bowler", "Chapéu", hatBowler, "chapeu"),
      lab("hat-beanie", "Touca", hatBeanie, "touca gorro"),
      lab("high-heel", "Salto", highHeel, "salto sapato"),
      lab("sneaker", "Tênis", sneaker, "tenis sapato"),
      { id: "Glasses", label: "Óculos", keywords: "oculos", lucide: Glasses },
      { id: "Watch", label: "Relógio", keywords: "relogio acessorio", lucide: Watch },
      { id: "Footprints", label: "Passos", keywords: "passos caminhada", lucide: Footprints },
      {
        id: "PersonStanding",
        label: "Cliente",
        keywords: "cliente pessoa",
        lucide: PersonStanding,
      },
      { id: "Dumbbell", label: "Treino", keywords: "treino academia", lucide: Dumbbell },
      {
        id: "Fingerprint",
        label: "Identidade",
        keywords: "identidade digital",
        lucide: Fingerprint,
      },
      { id: "Venus", label: "Feminino", keywords: "feminino mulher", lucide: Venus },
      { id: "Mars", label: "Masculino", keywords: "masculino homem", lucide: Mars },
      { id: "Baby", label: "Infantil", keywords: "infantil crianca", lucide: Baby },
    ],
  },
  {
    id: "clube",
    label: "Clube e lounge",
    icons: [
      { id: "Coffee", label: "Café", keywords: "cafe bebida", lucide: Coffee },
      { id: "Wine", label: "Vinho", keywords: "vinho bebida", lucide: Wine },
      { id: "Beer", label: "Cerveja", keywords: "cerveja bebida", lucide: Beer },
      { id: "Martini", label: "Drink", keywords: "drink coquetel", lucide: Martini },
      { id: "GlassWater", label: "Água", keywords: "agua bebida", lucide: GlassWater },
      { id: "CupSoda", label: "Refrigerante", keywords: "refrigerante bebida", lucide: CupSoda },
      { id: "Utensils", label: "Comida", keywords: "comida refeicao", lucide: Utensils },
      lab("kettle", "Chaleira", kettle, "chaleira cha"),
      lab("whisk", "Batedor", whisk, "batedor drink"),
      lab("chairs-table-parasol", "Mesas", chairsTableParasol, "mesa area externa"),
      lab("sunlounger-parasol-sun", "Espreguiçadeira", sunloungerParasolSun, "piscina sol"),
      lab("fan-handheld", "Leque", fanHandheld, "leque vento"),
      { id: "Music", label: "Música", keywords: "musica som", lucide: Music },
      { id: "AudioLines", label: "Áudio", keywords: "audio som", lucide: AudioLines },
      { id: "Radio", label: "Rádio", keywords: "radio som", lucide: Radio },
      { id: "Tv", label: "TV", keywords: "tv tela assistir", lucide: Tv },
      { id: "Gamepad2", label: "Jogos", keywords: "jogos videogame", lucide: Gamepad2 },
      { id: "Bike", label: "Bicicleta", keywords: "bicicleta bike", lucide: Bike },
      { id: "Trophy", label: "Troféu", keywords: "trofeu campeonato", lucide: Trophy },
      { id: "Medal", label: "Medalha", keywords: "medalha premio", lucide: Medal },
      { id: "Award", label: "Prêmio", keywords: "premio award", lucide: Award },
      { id: "PartyPopper", label: "Festa", keywords: "festa evento", lucide: PartyPopper },
      { id: "Gift", label: "Presente", keywords: "presente brinde", lucide: Gift },
      { id: "Cake", label: "Bolo", keywords: "bolo aniversario", lucide: Cake },
      { id: "Candy", label: "Doce", keywords: "doce bala", lucide: Candy },
      { id: "IceCreamCone", label: "Sorvete", keywords: "sorvete gelado", lucide: IceCreamCone },
      { id: "Cookie", label: "Biscoito", keywords: "biscoito lanche", lucide: Cookie },
      { id: "PawPrint", label: "Pet", keywords: "pet animal", lucide: PawPrint },
      { id: "Camera", label: "Foto", keywords: "foto camera", lucide: Camera },
    ],
  },
  {
    id: "status",
    label: "Níveis e status",
    icons: [
      { id: "Crown", label: "Coroa", keywords: "coroa rei nivel", lucide: Crown },
      { id: "Star", label: "Estrela", keywords: "estrela nivel", lucide: Star },
      { id: "Gem", label: "Diamante", keywords: "diamante premium", lucide: Gem },
      { id: "Shield", label: "Escudo", keywords: "escudo protecao", lucide: Shield },
      {
        id: "ShieldCheck",
        label: "Verificado",
        keywords: "verificado aprovado",
        lucide: ShieldCheck,
      },
      { id: "BadgeCheck", label: "Selo", keywords: "selo certificado", lucide: BadgeCheck },
      { id: "Ribbon", label: "Faixa", keywords: "faixa conquista", lucide: Ribbon },
      { id: "Zap", label: "Rápido", keywords: "rapido relampago", lucide: Zap },
      { id: "Heart", label: "Coração", keywords: "coracao amor", lucide: Heart },
      { id: "Handshake", label: "Parceria", keywords: "parceria acordo", lucide: Handshake },
      {
        id: "HeartHandshake",
        label: "Fidelidade",
        keywords: "fidelidade parceria",
        lucide: HeartHandshake,
      },
      { id: "ThumbsUp", label: "Aprovado", keywords: "aprovado positivo", lucide: ThumbsUp },
      { id: "Check", label: "Check", keywords: "check confirmado", lucide: Check },
      { id: "Rainbow", label: "Arco-íris", keywords: "arco iris cores", lucide: Rainbow },
      { id: "Sparkles", label: "Brilho", keywords: "brilho novo", lucide: Sparkles },
      { id: "Flame", label: "Popular", keywords: "popular fogo", lucide: Flame },
    ],
  },
  {
    id: "basico",
    label: "Básicos",
    icons: [
      { id: "Timer", label: "Tempo", keywords: "tempo duracao", lucide: Timer },
      { id: "Clock", label: "Horário", keywords: "horario relogio", lucide: Clock },
      { id: "CalendarDays", label: "Agenda", keywords: "agenda data", lucide: CalendarDays },
      { id: "Ruler", label: "Medida", keywords: "medida regua", lucide: Ruler },
      { id: "Scissors", label: "Tesoura", keywords: "tesoura corte", lucide: Scissors },
      { id: "UsersRound", label: "Equipe", keywords: "equipe time", lucide: UsersRound },
      { id: "Building2", label: "Barbearia", keywords: "barbearia loja salao", lucide: Building2 },
      { id: "Lightbulb", label: "Ideia", keywords: "ideia dica", lucide: Lightbulb },
      {
        id: "WashingMachine",
        label: "Lavagem",
        keywords: "lavagem maquina",
        lucide: WashingMachine,
      },
      { id: "Sparkles", label: "Brilho", keywords: "brilho limpeza", lucide: Sparkles },
      { id: "Droplet", label: "Gota", keywords: "gota liquido", lucide: Droplet },
      { id: "Coffee", label: "Café", keywords: "cafe pausa", lucide: Coffee },
    ],
  },
];

/** Lista plana, mantida para compatibilidade com buscas e testes existentes. */
export const SERVICE_ICONS: ServiceIconEntry[] = SERVICE_ICON_GROUPS.flatMap(
  (group) => group.icons,
);

const ICON_BY_ID = new Map(SERVICE_ICONS.map((entry) => [entry.id, entry]));

/** Filtra o catálogo por texto livre (rótulo, identificador e termos extras). */
export function searchServiceIcons(query: string): ServiceIconEntry[] {
  const term = query.trim().toLowerCase();
  if (!term) return SERVICE_ICONS;
  return SERVICE_ICONS.filter((entry) =>
    `${entry.label} ${entry.id} ${entry.keywords ?? ""}`.toLowerCase().includes(term),
  );
}

export function serviceIconLabel(id: string | null | undefined) {
  if (!id) return "Tesoura";
  if (isServiceImageSource(id)) return "Imagem personalizada";
  return ICON_BY_ID.get(id)?.label ?? "Tesoura";
}

export function ServiceIcon({
  icon,
  className,
  imageClassName,
}: {
  icon?: string | null;
  className?: string;
  /** Fotos têm presença maior que pictogramas, sem herdar padding do ícone. */
  imageClassName?: string;
}) {
  const entry = icon ? ICON_BY_ID.get(icon) : undefined;

  if (!icon) return <Scissors className={className} />;

  if (isServiceImageSource(icon)) {
    return (
      <img src={icon} alt="" className={cn(imageClassName ?? className, "object-cover !p-0")} />
    );
  }

  if (entry?.glyph) return <ServiceGlyph glyph={entry.glyph} className={className} />;

  if (entry?.lab) {
    return <Icon iconNode={entry.lab} className={className} />;
  }

  if (entry?.lucide) {
    const LucideIcon = entry.lucide;
    return <LucideIcon className={className} />;
  }

  return <Scissors className={className} />;
}
