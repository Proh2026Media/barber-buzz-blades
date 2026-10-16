/**
 * Cliente visto pela equipe (agendar pelo painel, apelido, cliente do balcão). Regras puras, sem
 * React nem banco, para o teste do Node. Banco: migration 20261016130000_agendamento_pelo_painel.
 */

/** Resultado da busca pelo WhatsApp (`find_shop_client`). */
export type FoundClient = {
  kind: "account" | "manual" | "none";
  customerId: string | null;
  shopClientId: string | null;
  name: string | null;
  nickname: string | null;
  /** E.164 com "+" (ex.: +5511999990000). */
  whatsapp: string | null;
  /** Avisos pelo WhatsApp do cliente do balcão (o de conta segue as preferências dele). */
  notifyWhatsapp: boolean | null;
  /** Tem horário recorrente ativo nesta barbearia. */
  recurring: boolean;
  /**
   * Quem procura não vê a loja inteira e o cliente não está na própria agenda: o banco não manda
   * o apelido nem a recorrência e não deixa mudar o nome, os avisos ou apagar o apelido.
   */
  limited: boolean;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Lê a resposta do banco (jsonb) sem confiar no formato. */
export function parseFoundClient(value: unknown): FoundClient {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const kind = row.kind === "account" || row.kind === "manual" ? row.kind : "none";
  return {
    kind,
    customerId: kind === "account" ? str(row.customer_id) : null,
    shopClientId: str(row.shop_client_id),
    name: str(row.name),
    nickname: str(row.nickname),
    whatsapp: str(row.whatsapp),
    notifyWhatsapp: typeof row.notify_whatsapp === "boolean" ? row.notify_whatsapp : null,
    recurring: row.recurring === true,
    limited: row.limited === true,
  };
}

/** Apelido limpo como o banco grava: espaços juntos, até 40 letras, vazio vira null. */
export function cleanNickname(value: string | null | undefined): string | null {
  const clean = (value ?? "").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return clean || null;
}

/**
 * Como mostrar o cliente para a equipe: o apelido na frente (é como a equipe chama) e o nome
 * cadastrado menor, ao lado. Sem apelido (ou apelido igual ao nome), só o nome.
 */
export function clientDisplay(
  name: string | null | undefined,
  nickname: string | null | undefined,
): { primary: string | null; secondary: string | null } {
  const cleanName = (name ?? "").trim() || null;
  const nick = cleanNickname(nickname);
  if (!nick) return { primary: cleanName, secondary: null };
  if (cleanName && cleanName.toLocaleLowerCase("pt-BR") === nick.toLocaleLowerCase("pt-BR")) {
    return { primary: cleanName, secondary: null };
  }
  return { primary: nick, secondary: cleanName };
}

export type SeriesInfo = {
  kind: "weekday" | "interval_days" | null | undefined;
  intervalDays: number | null | undefined;
};

/**
 * Selo de recorrência na agenda: o atendimento faz parte de uma série ("Toda semana", "A cada
 * 15 dias") ou o cliente tem um horário recorrente ativo ("Cliente recorrente").
 */
export function recurringBadge(
  inSeries: boolean,
  series: SeriesInfo,
  customerRecurring: boolean | null | undefined,
):
  | { key: "agenda.recurring.weekly" }
  | { key: "agenda.recurring.everyDays"; days: number }
  | { key: "agenda.recurring.series" }
  | { key: "agenda.recurring.client" }
  | null {
  if (inSeries) {
    if (series.kind === "weekday") return { key: "agenda.recurring.weekly" };
    if (series.kind === "interval_days" && series.intervalDays && series.intervalDays > 0) {
      return series.intervalDays === 7
        ? { key: "agenda.recurring.weekly" }
        : { key: "agenda.recurring.everyDays", days: series.intervalDays };
    }
    return { key: "agenda.recurring.series" };
  }
  return customerRecurring ? { key: "agenda.recurring.client" } : null;
}

/** Link do WhatsApp com a mensagem pronta (abre o app do barbeiro no celular). */
export function whatsappLink(e164: string, text: string): string {
  const digits = e164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Link de cadastro no app da barbearia (com o WhatsApp do cliente já preenchido). */
export function signupLink(publicOrigin: string, e164: string | null): string {
  const base = `${publicOrigin.replace(/\/$/, "")}/auth?cadastro=1`;
  const digits = (e164 ?? "").replace(/\D/g, "");
  return digits ? `${base}&whatsapp=${digits}` : base;
}

export type DemoClientSource = {
  customers: { id: string; name: string; whatsapp: string | null }[];
  shopClients: {
    id: string;
    profile_id: string | null;
    full_name: string | null;
    whatsapp_e164: string | null;
    nickname: string | null;
    notify_whatsapp: boolean;
  }[];
  series: { customer_id: string; active: boolean }[];
  appointments: {
    staff_id: string;
    customer_id: string | null;
    shop_client_id?: string | null;
  }[];
};

/** Quem procura: o próprio profissional e se vê a loja inteira (como `shop_client_visible`). */
export type DemoViewer = { staffId: string | null; full: boolean };

/** A mesma busca do banco, sobre os dados da demonstração (com o mesmo "limited"). */
export function demoFindClient(
  source: DemoClientSource,
  e164: string,
  viewer: DemoViewer = { staffId: null, full: true },
): FoundClient {
  const sees = (customerId: string | null, shopClientId: string | null) =>
    viewer.full ||
    source.appointments.some(
      (row) =>
        row.staff_id === viewer.staffId &&
        ((customerId !== null && row.customer_id === customerId) ||
          (shopClientId !== null && row.shop_client_id === shopClientId)),
    );
  const customer = source.customers.find((row) => row.whatsapp === e164);
  if (customer) {
    const ficha = source.shopClients.find((row) => row.profile_id === customer.id);
    const visible = sees(customer.id, null);
    return {
      kind: "account",
      customerId: customer.id,
      shopClientId: ficha?.id ?? null,
      name: customer.name,
      nickname: visible ? (ficha?.nickname ?? null) : null,
      whatsapp: e164,
      notifyWhatsapp: null,
      recurring:
        visible && source.series.some((row) => row.customer_id === customer.id && row.active),
      limited: !visible,
    };
  }
  const manual = source.shopClients.find(
    (row) => row.profile_id === null && row.whatsapp_e164 === e164,
  );
  if (manual) {
    const visible = sees(null, manual.id);
    return {
      kind: "manual",
      customerId: null,
      shopClientId: manual.id,
      name: manual.full_name,
      nickname: visible ? manual.nickname : null,
      whatsapp: e164,
      notifyWhatsapp: manual.notify_whatsapp,
      recurring: false,
      limited: !visible,
    };
  }
  return {
    kind: "none",
    customerId: null,
    shopClientId: null,
    name: null,
    nickname: null,
    whatsapp: e164,
    notifyWhatsapp: null,
    recurring: false,
    limited: false,
  };
}
