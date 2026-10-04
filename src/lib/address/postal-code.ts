/**
 * Ajudante de endereço pelo CEP (Brasil). Regras puras, sem React nem i18n, para testar
 * com `node --test`. O CEP não vira campo no banco: serve só para montar o texto livre
 * de `barbershop_settings.landing.address` (até 160 caracteres).
 *
 * Fonte: ViaCEP (https://viacep.com.br), serviço público com CORS liberado. Só o CEP
 * digitado é enviado. Portugal (GeoAPI.pt) ficou de fora: sem chave, o serviço aceita
 * só 5 consultas por dia por endereço de internet, o que falharia em redes móveis
 * compartilhadas.
 */

export const CEP_LENGTH = 8;
export const CEP_LOOKUP_TIMEOUT_MS = 6000;
export const VIACEP_URL = "https://viacep.com.br/ws/{cep}/json/";

/** Partes do endereço; todas editáveis pela pessoa depois da busca. */
export type AddressParts = {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  /** CEP com máscara (00000-000) ou vazio. */
  cep: string;
};

export const EMPTY_ADDRESS_PARTS: AddressParts = {
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  cep: "",
};

/** Só os números, no máximo 8 (o que passar disso é ignorado). */
export function cepDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, CEP_LENGTH);
}

/** Máscara enquanto digita: "01001000" → "01001-000"; "0100" → "0100". */
export function maskCep(value: string): string {
  const digits = cepDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function isCompleteCep(value: string): boolean {
  return cepDigits(value).length === CEP_LENGTH;
}

/**
 * CEP já escrito num endereço salvo, com máscara, para pré-preencher o campo.
 * Aceita "CEP 01001-000", "CEP: 01001000", "01001-000" e "01.001-000". Oito números
 * soltos sem a palavra CEP não contam (podem ser telefone ou outro número).
 */
export function findCepInText(text: string): string | null {
  const labelled = /\bCEP\s*:?\s*(\d{2})\.?(\d{3})-?(\d{3})(?!\d)/i.exec(text);
  const loose = labelled ?? /(?<![\d.-])(\d{2})\.?(\d{3})-(\d{3})(?![\d-])/.exec(text);
  if (!loose) return null;
  return maskCep(`${loose[1]}${loose[2]}${loose[3]}`);
}

/** Resposta do ViaCEP → partes do endereço; null quando o CEP não existe ou veio estranho. */
export function parseViaCep(data: unknown): Omit<AddressParts, "number" | "complement"> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (row.erro === true || row.erro === "true") return null;
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const cep = maskCep(text(row.cep));
  const city = text(row.localidade);
  const state = text(row.uf).toUpperCase();
  if (!isCompleteCep(cep) || !city || !/^[A-Z]{2}$/.test(state)) return null;
  return { street: text(row.logradouro), district: text(row.bairro), city, state, cep };
}

export type CepLookupResult =
  | { ok: true; address: Omit<AddressParts, "number" | "complement"> }
  | { ok: false; reason: "invalid" | "notFound" | "offline" | "aborted" };

type LookupOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Quem chama cancela a busca anterior quando a pessoa muda o CEP. */
  signal?: AbortSignal;
};

/**
 * Busca o CEP no ViaCEP com tempo limite. Nunca lança erro:
 * - `invalid`: não tem 8 números (ou é 00000-000);
 * - `notFound`: o ViaCEP respondeu que o CEP não existe;
 * - `offline`: sem conexão, demorou demais ou o serviço falhou;
 * - `aborted`: quem chamou cancelou (a tela ignora).
 */
export async function lookupCep(
  value: string,
  options: LookupOptions = {},
): Promise<CepLookupResult> {
  const digits = cepDigits(value);
  if (digits.length !== CEP_LENGTH || /^0+$/.test(digits)) return { ok: false, reason: "invalid" };
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? CEP_LOOKUP_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetchImpl(VIACEP_URL.replace("{cep}", digits), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Só o CEP vai na consulta: sem cookies nem o endereço da página de origem.
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    // O ViaCEP responde 400 para formato inválido e 200 com {"erro": true} para CEP inexistente.
    if (response.status === 400) return { ok: false, reason: "notFound" };
    if (!response.ok) return { ok: false, reason: "offline" };
    const address = parseViaCep(await response.json());
    return address ? { ok: true, address } : { ok: false, reason: "notFound" };
  } catch {
    if (options.signal?.aborted && !timedOut) return { ok: false, reason: "aborted" };
    return { ok: false, reason: "offline" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compose(parts: AddressParts, withComplement: boolean, withDistrict: boolean): string {
  const first = [clean(parts.street), clean(parts.number)].filter(Boolean).join(", ");
  const head = [
    first,
    withComplement ? clean(parts.complement) : "",
    withDistrict ? clean(parts.district) : "",
  ]
    .filter(Boolean)
    .join(" - ");
  const place = [clean(parts.city), clean(parts.state)].filter(Boolean).join(" - ");
  const cep = isCompleteCep(parts.cep) ? `CEP ${maskCep(parts.cep)}` : "";
  return [head, place, cep].filter(Boolean).join(", ");
}

/**
 * Texto final do endereço: "Rua X, 123 - Sala 2 - Bairro, Cidade - UF, CEP 00000-000",
 * sem partes vazias. Se passar do limite, tira primeiro o complemento, depois o bairro
 * e, por último, corta o fim do texto.
 */
export function buildAddressText(parts: AddressParts, max = 160): string {
  const attempts = [
    compose(parts, true, true),
    compose(parts, false, true),
    compose(parts, false, false),
  ];
  const fit = attempts.find((text) => text.length <= max);
  return fit ?? attempts[2].slice(0, max).trim();
}
