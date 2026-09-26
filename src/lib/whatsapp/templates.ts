/** Modelos e validação de mensagens WhatsApp (especificação do produto). */

export type WhatsAppTemplateKey =
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.reminder";

export const WHATSAPP_TEMPLATE_VARS = [
  "loja",
  "serviço",
  "profissional",
  "quando",
  "cliente",
  "link_reserva",
] as const;

export type WhatsAppTemplateVar = (typeof WHATSAPP_TEMPLATE_VARS)[number];

export const WHATSAPP_TEMPLATE_VAR_HELP: Record<
  WhatsAppTemplateVar,
  { chip: string; label: string; example: string }
> = {
  loja: { chip: "Loja", label: "Nome da barbearia", example: "Barba & Cabelo" },
  serviço: { chip: "Serviço", label: "Serviço reservado", example: "Corte e barba" },
  profissional: { chip: "Profissional", label: "Nome do profissional", example: "Rafael" },
  quando: { chip: "Quando", label: "Data e horário", example: "26/09/2026 às 14h30" },
  cliente: { chip: "Cliente", label: "Nome do cliente", example: "João" },
  link_reserva: {
    chip: "Link",
    label: "Link para o cliente gerenciar o horário",
    example: "https://example.com/reserva/abc123",
  },
};

export const DEFAULT_WHATSAPP_BODIES: Record<WhatsAppTemplateKey, string> = {
  "booking.confirmed": `✂️ *Horário confirmado!*

Olá, {{cliente}}! Seu atendimento está agendado.

*Serviço:* {{serviço}}
*Profissional:* {{profissional}}
*Data e horário:* {{quando}}

Para consultar, remarcar ou cancelar seu agendamento, acesse:
{{link_reserva}}

Até breve!
*Equipe {{loja}}*`,
  "booking.rescheduled": `🔄 *Horário atualizado*

Olá, {{cliente}}! Seu atendimento foi remarcado.

Confira os dados atualizados:
*Serviço:* {{serviço}}
*Profissional:* {{profissional}}
*Novo horário:* {{quando}}

Para consultar ou alterar seu agendamento, acesse:
{{link_reserva}}

Nos vemos no novo horário!
*Equipe {{loja}}*`,
  "booking.cancelled": `✂️ *Horário cancelado*

Olá, {{cliente}}! Seu agendamento foi cancelado.

*Serviço:* {{serviço}}
*Profissional:* {{profissional}}
*Data e horário cancelados:* {{quando}}

Quer agendar novamente? Acesse:
{{link_reserva}}

Esperamos te ver em breve!
*Equipe {{loja}}*`,
  "booking.reminder": `⏰ *Lembrete do seu horário*

Olá, {{cliente}}! Seu atendimento está chegando.

*Serviço:* {{serviço}}
*Profissional:* {{profissional}}
*Data e horário:* {{quando}}

Para consultar, remarcar ou cancelar seu agendamento, acesse:
{{link_reserva}}

Te esperamos por aqui!
*Equipe {{loja}}*`,
};

const ALLOWED_VAR_SET = new Set<string>(WHATSAPP_TEMPLATE_VARS);

/** Normaliza finais de linha para LF. */
export function normalizeWhatsAppTemplate(body: string): string {
  return body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Contagem normativa: pontos de código Unicode. */
export function whatsappCodePointLength(body: string): number {
  return Array.from(normalizeWhatsAppTemplate(body)).length;
}

const PLACEHOLDER_RE = /\{\{([^{}]+)\}\}/g;

export function findWhatsAppPlaceholders(body: string): string[] {
  const found: string[] = [];
  const text = normalizeWhatsAppTemplate(body);
  let match: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    found.push(match[1]);
  }
  return found;
}

export function validateWhatsAppTemplate(body: string): string[] {
  const errors: string[] = [];
  const normalized = normalizeWhatsAppTemplate(body);

  if (!normalized.trim()) {
    errors.push("A mensagem não pode ficar vazia.");
  }

  const length = whatsappCodePointLength(normalized);
  if (length > 1000) {
    errors.push(`Passou do limite: ${length} de 1.000 caracteres.`);
  }

  for (const key of findWhatsAppPlaceholders(normalized)) {
    if (!ALLOWED_VAR_SET.has(key)) {
      errors.push(
        key.trim() === ""
          ? "Há chaves {{ }} incompletas."
          : `Variável desconhecida: {{${key}}}. Use só as seis permitidas.`,
      );
    }
  }

  // Markdown incompatível (fora de URLs e variáveis).
  const withoutVars = normalized.replace(PLACEHOLDER_RE, "§");
  const withoutUrls = withoutVars.replace(/https?:\/\/\S+/gi, "§");

  if (/\*\*[^*]+\*\*/.test(withoutUrls) || /__[^_]+__/.test(withoutUrls)) {
    errors.push("Para negrito use *texto*, não **texto** nem __texto__.");
  }
  if (/~~[^~]+~~/.test(withoutUrls)) {
    errors.push("Para tachado use ~texto~, não ~~texto~~.");
  }
  if (/\[([^\]]+)\]\(([^)]+)\)/.test(withoutVars)) {
    errors.push("Não use links Markdown [texto](url). Coloque a URL completa em uma linha.");
  }
  if (/<\/?[a-z][^>]*>/i.test(withoutUrls)) {
    errors.push("Não use HTML na mensagem.");
  }
  if (/^#{1,6}\s/m.test(withoutUrls)) {
    errors.push("Não use títulos com #. Prefira *negrito*.");
  }
  if (/```(?:json|text|md|html|js|ts)\b/i.test(withoutUrls)) {
    errors.push(
      "Remova cercas de documentação (```text). Três crases só para monoespaçado intencional.",
    );
  }

  return errors;
}

export const SAMPLE_WHATSAPP_VARS: Record<WhatsAppTemplateVar, string> = {
  loja: "Barba & Cabelo",
  serviço: "Corte e barba",
  profissional: "Rafael",
  quando: "26/09/2026 às 14h30",
  cliente: "João",
  link_reserva: "https://example.com/reserva/abc123",
};

/** Substituição única, sem reprocessar valores. */
export function renderWhatsAppTemplate(
  body: string,
  vars: Partial<Record<WhatsAppTemplateVar, string>>,
): string {
  const normalized = normalizeWhatsAppTemplate(body);
  return normalized.replace(PLACEHOLDER_RE, (full, key: string) => {
    if (!ALLOWED_VAR_SET.has(key)) return full;
    const value = vars[key as WhatsAppTemplateVar];
    return value ?? full;
  });
}

export function wrapWhatsAppSelection(
  text: string,
  start: number,
  end: number,
  wrapper: "*" | "_" | "~",
): { next: string; cursor: number } {
  const selected = text.slice(start, end);
  const wrapped = `${wrapper}${selected || "texto"}${wrapper}`;
  const next = text.slice(0, start) + wrapped + text.slice(end);
  return { next, cursor: start + wrapped.length };
}
