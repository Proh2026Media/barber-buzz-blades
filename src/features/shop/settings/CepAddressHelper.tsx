import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  PencilLine,
  Search,
  WifiOff,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { MoreDetails, StatusBadge, type Tone } from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  EMPTY_ADDRESS_PARTS,
  buildAddressText,
  cepDigits,
  findCepInText,
  isCompleteCep,
  lookupCep,
  maskCep,
  type AddressParts,
} from "@/lib/address/postal-code";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal";

type Status = "idle" | "loading" | "found" | "notFound" | "offline" | "invalid";

const STATUS_KEY: Record<Exclude<Status, "idle">, MessageKey> = {
  loading: "landingEditor.cep.loading",
  found: "landingEditor.cep.found",
  notFound: "landingEditor.cep.notFound",
  offline: "landingEditor.cep.offline",
  invalid: "landingEditor.cep.invalid",
};

/** Busca do CEP em selo: buscando, encontrado, não encontrado, sem conexão, incompleto. */
const STATUS_BADGE: Record<Exclude<Status, "idle">, { tone: Tone; icon: LucideIcon }> = {
  loading: { tone: "progress", icon: Loader2 },
  found: { tone: "success", icon: CheckCircle2 },
  notFound: { tone: "warning", icon: XCircle },
  offline: { tone: "danger", icon: WifiOff },
  invalid: { tone: "warning", icon: AlertTriangle },
};

/**
 * "Preencher pelo CEP": busca rua, bairro e cidade no ViaCEP e monta o texto do campo
 * de endereço da página. Não grava nada à parte; o campo de endereço continua livre.
 * Só substitui sozinho um endereço vazio ou o texto que este próprio bloco escreveu;
 * um endereço já digitado ou salvo só muda quando a pessoa toca em "Usar este endereço".
 */
export function CepAddressHelper({
  address,
  maxLength,
  onAddressChange,
  onWritten,
}: {
  address: string;
  maxLength: number;
  onAddressChange: (value: string) => void;
  /** Avisa o texto que este bloco escreveu (o editor recolhe o campo enquanto ele não muda). */
  onWritten?: (text: string) => void;
}) {
  const { t } = useI18n();
  const [cep, setCep] = useState(() => findCepInText(address) ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [parts, setParts] = useState<AddressParts | null>(null);
  const [lastWritten, setLastWritten] = useState<string | null>(null);
  // Sobe a cada CEP encontrado; o efeito abaixo leva o foco para "Número" depois
  // que os campos já estão na tela (na primeira busca eles ainda não existem).
  const [focusNumberTick, setFocusNumberTick] = useState(0);
  const statusId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const lastLookupRef = useRef<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef(address);
  addressRef.current = address;
  const lastWrittenRef = useRef(lastWritten);
  lastWrittenRef.current = lastWritten;
  // Partes atuais para quem termina depois de um await (número digitado durante a busca).
  const partsRef = useRef(parts);
  partsRef.current = parts;

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (focusNumberTick > 0) numberRef.current?.focus();
  }, [focusNumberTick]);

  const composed = parts ? buildAddressText(parts, maxLength) : "";
  const needsConfirm = Boolean(parts && composed && address !== composed);

  function write(next: AddressParts) {
    const text = buildAddressText(next, maxLength);
    const current = addressRef.current;
    // Não apaga o que a pessoa escreveu: só sincroniza sozinho se estava vazio
    // ou se o texto atual foi escrito por este bloco.
    if (text && (!current.trim() || current === lastWrittenRef.current)) {
      onAddressChange(text);
      setLastWritten(text);
      onWritten?.(text);
    }
  }

  async function search(value: string) {
    abortRef.current?.abort();
    const digits = cepDigits(value);
    if (!isCompleteCep(digits)) {
      setStatus("invalid");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    lastLookupRef.current = digits;
    setStatus("loading");
    const result = await lookupCep(digits, { signal: controller.signal });
    if (controller.signal.aborted) return;
    if (!result.ok) {
      if (result.reason === "aborted") return;
      setStatus(result.reason);
      return;
    }
    const previous = partsRef.current;
    const next: AddressParts = {
      ...EMPTY_ADDRESS_PARTS,
      ...result.address,
      // Número e complemento já digitados continuam ao trocar o CEP.
      number: previous?.number ?? "",
      complement: previous?.complement ?? "",
    };
    partsRef.current = next;
    setParts(next);
    setStatus("found");
    write(next);
    setFocusNumberTick((tick) => tick + 1);
  }

  function changeCep(value: string) {
    const masked = maskCep(value);
    setCep(masked);
    const digits = cepDigits(masked);
    if (digits.length === 8) {
      if (digits !== lastLookupRef.current) void search(digits);
      return;
    }
    abortRef.current?.abort();
    lastLookupRef.current = null;
    setStatus("idle");
  }

  function changePart<K extends keyof AddressParts>(key: K, value: AddressParts[K]) {
    const current = partsRef.current;
    if (!current) return;
    const next = { ...current, [key]: value };
    partsRef.current = next;
    setParts(next);
    write(next);
  }

  function apply() {
    if (!composed) return;
    onAddressChange(composed);
    setLastWritten(composed);
    onWritten?.(composed);
  }

  const partField = (
    key: Exclude<keyof AddressParts, "cep">,
    label: MessageKey,
    extra: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="block space-y-1 text-sm font-semibold">
      {t(label)}
      <input
        value={parts?.[key] ?? ""}
        onChange={(e) =>
          changePart(key, key === "state" ? e.target.value.toUpperCase() : e.target.value)
        }
        className={fieldClass}
        {...extra}
      />
    </label>
  );

  const statusMeta = status === "idle" ? null : STATUS_BADGE[status];
  const summary = parts
    ? [parts.street, parts.district, [parts.city, parts.state].filter(Boolean).join("/")]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-3">
      <p className="flex items-center gap-2 text-sm font-bold">
        <MapPin className="size-4 shrink-0 text-gold" aria-hidden />
        {t("landingEditor.cep.title")}
      </p>

      <div className="flex items-end gap-2">
        <label className="block min-w-0 flex-1 space-y-1 text-sm font-semibold">
          {t("landingEditor.cep.label")}
          <input
            value={cep}
            inputMode="numeric"
            autoComplete="postal-code"
            // Sem maxLength: o navegador cortaria o texto colado (" 01310 100 ") antes
            // da máscara; maskCep já limita a 8 números.
            placeholder={t("landingEditor.cep.placeholder")}
            aria-describedby={statusId}
            onChange={(e) => changeCep(e.target.value)}
            onKeyDown={(e) => {
              // Enter no CEP busca em vez de enviar o formulário da página.
              if (e.key === "Enter") {
                e.preventDefault();
                void search(cep);
              }
            }}
            className={`${fieldClass} tabular-nums`}
          />
        </label>
        <button
          type="button"
          onClick={() => void search(cep)}
          disabled={status === "loading"}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold disabled:opacity-60"
        >
          {status === "loading" ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
          {t("landingEditor.cep.search")}
        </button>
      </div>

      <div id={statusId} role="status" aria-live="polite" className="empty:hidden">
        {statusMeta && status !== "found" && (
          <StatusBadge
            tone={statusMeta.tone}
            icon={statusMeta.icon}
            label={t(STATUS_KEY[status as Exclude<Status, "idle">])}
          />
        )}
        {status === "found" && <span className="sr-only">{t(STATUS_KEY.found)}</span>}
      </div>

      {parts && (
        <div className="space-y-3">
          {/* Endereço encontrado: cartão verde com o resultado; só número e complemento à vista. */}
          <div className="tone-success flex items-start gap-2.5 rounded-xl border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] p-3">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-[color:var(--tone-ink)]"
              aria-hidden
            />
            <p className="min-w-0 break-words text-sm font-semibold text-foreground">{summary}</p>
          </div>
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
            <label className="block space-y-1 text-sm font-semibold">
              {t("landingEditor.cep.number")}
              <input
                ref={numberRef}
                value={parts.number}
                maxLength={12}
                placeholder={t("landingEditor.cep.numberPlaceholder")}
                onChange={(e) => changePart("number", e.target.value)}
                className={fieldClass}
              />
            </label>
            {partField("complement", "landingEditor.cep.complement", {
              maxLength: 60,
              placeholder: t("landingEditor.cep.complementPlaceholder"),
              autoComplete: "address-line2",
            })}
          </div>
          <MoreDetails summary={t("landingEditor.cep.editParts")} icon={PencilLine}>
            <div className="space-y-3">
              {partField("street", "landingEditor.cep.street", { autoComplete: "address-line1" })}
              {partField("district", "landingEditor.cep.district")}
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                {partField("city", "landingEditor.cep.city", { autoComplete: "address-level2" })}
                {partField("state", "landingEditor.cep.stateName", {
                  maxLength: 2,
                  autoCapitalize: "characters",
                  autoComplete: "address-level1",
                })}
              </div>
            </div>
          </MoreDetails>

          {needsConfirm && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="text-sm text-muted-foreground">{t("landingEditor.cep.preview")}</p>
              <p className="break-words text-sm font-semibold">{composed}</p>
              <button type="button" onClick={apply} className="action-button action-confirm w-full">
                <Check aria-hidden />
                {t("landingEditor.cep.apply")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
