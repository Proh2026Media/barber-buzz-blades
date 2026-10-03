/** Modelos e validação de mensagens WhatsApp (especificação do produto). */

import { t, type MessageKey } from "../i18n/index.ts";

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

/** Rótulos exibidos no editor (chaves do dicionário); o token gravado continua {{chave}}. */
export const WHATSAPP_TEMPLATE_VAR_HELP = {
  loja: {
    chipKey: "integr.var.shop.chip",
    labelKey: "integr.var.shop.label",
    example: "Barba & Cabelo",
  },
  serviço: {
    chipKey: "integr.var.service.chip",
    labelKey: "integr.var.service.label",
    example: "Corte e barba",
  },
  profissional: {
    chipKey: "integr.var.staff.chip",
    labelKey: "integr.var.staff.label",
    example: "Rafael",
  },
  quando: {
    chipKey: "integr.var.when.chip",
    labelKey: "integr.var.when.label",
    example: "26/09/2026 às 14h30",
  },
  cliente: {
    chipKey: "integr.var.client.chip",
    labelKey: "integr.var.client.label",
    example: "João",
  },
  link_reserva: {
    chipKey: "integr.var.link.chip",
    labelKey: "integr.var.link.label",
    example: "https://example.com/reserva/abc123",
  },
} as const satisfies Record<
  WhatsAppTemplateVar,
  { chipKey: MessageKey; labelKey: MessageKey; example: string }
>;

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

/**
 * Tamanho máximo plausível de cada variável já preenchida. O servidor
 * (render_whatsapp_template) mede o limite de 1000 DEPOIS da substituição e,
 * se passar, CORTA o texto em 1000 caracteres com "…" no fim (migration
 * 20261003170000): o aviso sai, mas incompleto. Por isso o editor reserva essa
 * margem, para a mensagem chegar inteira.
 */
const WHATSAPP_VAR_MAX_FILLED: Record<WhatsAppTemplateVar, number> = {
  loja: 60,
  serviço: 60,
  profissional: 40,
  quando: 30,
  cliente: 60,
  link_reserva: 120,
};

/** Estimativa do tamanho da mensagem montada com variáveis no tamanho máximo plausível. */
export function whatsappFilledLengthEstimate(body: string): number {
  const normalized = normalizeWhatsAppTemplate(body);
  let length = whatsappCodePointLength(normalized);
  for (const key of findWhatsAppPlaceholders(normalized)) {
    if (!ALLOWED_VAR_SET.has(key)) continue;
    length += WHATSAPP_VAR_MAX_FILLED[key as WhatsAppTemplateVar] - Array.from(`{{${key}}}`).length;
  }
  return length;
}

export function validateWhatsAppTemplate(body: string): string[] {
  const errors: string[] = [];
  const normalized = normalizeWhatsAppTemplate(body);

  if (!normalized.trim()) {
    errors.push(t("integr.tpl.errEmpty"));
  }

  const length = whatsappCodePointLength(normalized);
  if (length > 1000) {
    errors.push(t("integr.tpl.errTooLong", { length }));
  } else {
    const filled = whatsappFilledLengthEstimate(normalized);
    if (filled > 1000) {
      // O servidor corta o excesso (não descarta): o aviso explica que o fim some.
      errors.push(t("fix3.whatsapp.tooLongFilledCut", { length: filled }));
    }
  }

  for (const key of findWhatsAppPlaceholders(normalized)) {
    if (!ALLOWED_VAR_SET.has(key)) {
      errors.push(
        key.trim() === ""
          ? t("integr.tpl.errIncomplete")
          : t("integr.tpl.errUnknownVar", { token: `{{${key}}}` }),
      );
    }
  }

  // Markdown incompatível (fora de URLs e variáveis).
  const withoutVars = normalized.replace(PLACEHOLDER_RE, "§");
  const withoutUrls = withoutVars.replace(/https?:\/\/\S+/gi, "§");

  if (/\*\*[^*]+\*\*/.test(withoutUrls) || /__[^_]+__/.test(withoutUrls)) {
    errors.push(t("integr.tpl.errBold"));
  }
  if (/~~[^~]+~~/.test(withoutUrls)) {
    errors.push(t("integr.tpl.errStrike"));
  }
  if (/\[([^\]]+)\]\(([^)]+)\)/.test(withoutVars)) {
    errors.push(t("integr.tpl.errMdLink"));
  }
  if (/<\/?[a-z][^>]*>/i.test(withoutUrls)) {
    errors.push(t("integr.tpl.errHtml"));
  }
  if (/^#{1,6}\s/m.test(withoutUrls)) {
    errors.push(t("integr.tpl.errHeading"));
  }
  if (/```(?:json|text|md|html|js|ts)\b/i.test(withoutUrls)) {
    errors.push(t("integr.tpl.errFence"));
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
