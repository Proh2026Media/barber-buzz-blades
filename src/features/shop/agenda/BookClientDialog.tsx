import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  ContactRound,
  Loader2,
  Repeat,
  Scissors,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  ChoiceChips,
  EmptyState,
  FieldMessage,
  Notice,
  PersonAvatar,
  StatusBadge,
  announce,
} from "@/components/visual";
import { useDemo } from "@/features/demo/context";
import { demoStaffSlots } from "@/features/demo/slots";
import { checkSignupPhone, nextMaskedPhone } from "@/lib/auth/signup-phone";
import { useI18n } from "@/lib/i18n";
import {
  formatShopDate,
  shiftDateKey,
  shopDateTime,
  weekdayForDateKey,
} from "@/lib/shop/appointments";
import { cn } from "@/lib/utils";
import { InviteCard } from "../clients/InviteCard";
import {
  cleanNickname,
  demoFindClient,
  parseFoundClient,
  type FoundClient,
} from "../clients/model";
import type { BookRequest } from "./AgendaTab";
import { useDesktop } from "./board";

const DAYS_AHEAD = 21;

type Booked = {
  appointmentId: string;
  kind: "account" | "manual";
  name: string;
  nickname: string | null;
  whatsapp: string | null;
  notify: boolean | null;
  startsAt: string;
  serviceName: string;
  staffName: string;
};

type SubmitError =
  | "taken"
  | "past"
  | "closed"
  | "ownOnly"
  | "service"
  | "name"
  | "whatsapp"
  | "generic";

function errorKind(error: { code?: string; message?: string } | null): SubmitError {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  if (code === "23P01" || message.includes("não está mais livre") || message.includes("overlap")) {
    return "taken";
  }
  if (message.includes("já passou")) return "past";
  if (
    message.includes("funcionamento") ||
    message.includes("bloqueado") ||
    message.includes("aberto")
  ) {
    return "closed";
  }
  if (message.includes("própria agenda")) return "ownOnly";
  if (message.includes("não faz o serviço")) return "service";
  if (message.includes("nome")) return "name";
  if (message.includes("whatsapp")) return "whatsapp";
  if (message.includes("oferecidos")) return "taken";
  return "generic";
}

/**
 * "Agendar cliente": o barbeiro marca o horário pelo painel. Pede no mínimo o WhatsApp e o nome;
 * se o número for de um cliente com cadastro nesta barbearia, o nome do cadastro entra sozinho
 * (com aviso) e o atendimento vai para a conta dele. Sem cadastro, vira cliente do balcão, sem
 * horário recorrente, com convite para o app. Os avisos seguem as mesmas regras do app.
 */
export function BookClientDialog({
  open,
  onOpenChange,
  shopId,
  shopName,
  publicOrigin,
  timeZone,
  today,
  staff,
  services,
  businessHours,
  ownStaffId,
  canBookForOthers,
  horizonDays,
  request,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string;
  shopName: string;
  publicOrigin: string | null;
  timeZone: string;
  today: string;
  staff: Tables<"staff">[];
  services: Tables<"services">[];
  businessHours: Tables<"business_hours">[];
  ownStaffId: string | null;
  /** Quem vê a loja inteira marca na agenda de qualquer profissional; os demais, só na própria. */
  canBookForOthers: boolean;
  /** Prazo da agenda (dias abertos para o cliente). Vale também para quem não vê a loja inteira. */
  horizonDays: number;
  request: BookRequest | null;
  onBooked: (result: { appointmentId: string; day: string }) => void;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  // No computador, profissionais e dias quebram em linhas (rolar de lado com o mouse é difícil e
  // a fila cortava nomes sem aviso); no celular continua a fila com rolagem lateral.
  const desktop = useDesktop();
  // O relógio da demonstração avança a cada 10 s (novo objeto): a busca usa a versão mais recente
  // sem rodar de novo a cada tique (senão apagaria o nome que o barbeiro corrigiu).
  const demoRef = useRef(demo);
  demoRef.current = demo;
  const formId = useId();
  const phoneRef = useRef<HTMLInputElement>(null);

  const activeStaff = useMemo(() => staff.filter((member) => member.active), [staff]);
  const activeServices = useMemo(() => services.filter((service) => service.active), [services]);
  const closedWeekdays = useMemo(
    () => new Set(businessHours.filter((row) => !row.is_open).map((row) => row.weekday)),
    [businessHours],
  );

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [typedName, setTypedName] = useState("");
  const [nickname, setNickname] = useState("");
  const [notify, setNotify] = useState(true);
  const [found, setFound] = useState<FoundClient | null>(null);
  const [lookup, setLookup] = useState<"idle" | "searching" | "error">("idle");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [day, setDay] = useState(today);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsState, setSlotsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [slot, setSlot] = useState<string | null>(null);
  const [wantedStart, setWantedStart] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  // Recarrega a lista de horários (ex.: o escolhido foi tomado por outra pessoa).
  const [slotsVersion, setSlotsVersion] = useState(0);
  // O nome que o barbeiro digitou (volta para o campo se o número mudar depois de achar a conta).
  const typedNameRef = useRef("");
  // Apelido preenchido pela busca: sai do campo se o número mudar (não vai para outro cliente).
  const autoNickRef = useRef<string | null>(null);
  // Avisos escolhidos à mão pelo barbeiro (null = não mexeu): corrigir o número não os religa, e a
  // escolha volta depois de passar por um cliente de outro profissional (que trava o interruptor).
  const notifyByHandRef = useRef<boolean | null>(null);
  // Quem não vê a loja inteira fica no prazo da agenda (o banco exige isso dele na hora de gravar).
  const lastDay = shiftDateKey(today, Math.max(1, horizonDays) - 1);
  const dayAllowed = (key: string) => key >= today && (canBookForOthers || key <= lastDay);

  // Abre limpo, já com o dia, o horário e o profissional pedidos (atalho "Agendar aqui").
  useEffect(() => {
    if (!open) return;
    setPhone("");
    setName("");
    setTypedName("");
    typedNameRef.current = "";
    setNickname("");
    autoNickRef.current = null;
    notifyByHandRef.current = null;
    setNotify(true);
    setFound(null);
    setLookup("idle");
    setSubmitError(null);
    setShowErrors(false);
    setBooked(null);
    setSlot(null);
    const requestedStaff =
      request?.staffId && activeStaff.some((member) => member.id === request.staffId)
        ? request.staffId
        : null;
    setStaffId(
      canBookForOthers ? (requestedStaff ?? ownStaffId ?? activeStaff[0]?.id ?? null) : ownStaffId,
    );
    setDay(request?.day && dayAllowed(request.day) ? request.day : today);
    setWantedStart(request?.startsAt ?? null);
    setServiceId((current) =>
      current && activeServices.some((service) => service.id === current)
        ? current
        : (activeServices[0]?.id ?? null),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request]);

  const phoneCheck = checkSignupPhone(phone);
  const e164 = phoneCheck.ok ? phoneCheck.e164 : null;

  // Busca o cliente assim que o número fica completo. O que veio do número anterior (conta, nome,
  // apelido, avisos) deixa de valer na hora: nada de marcar para o cliente errado.
  useEffect(() => {
    if (!open) return;
    setFound(null);
    setName(typedNameRef.current);
    const autoNick = autoNickRef.current;
    autoNickRef.current = null;
    if (autoNick !== null) setNickname((current) => (current === autoNick ? "" : current));
    setNotify(notifyByHandRef.current ?? true);
    if (!e164) {
      setLookup("idle");
      return;
    }
    let cancelled = false;
    setLookup("searching");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          let result: FoundClient;
          const currentDemo = demoRef.current;
          if (currentDemo) {
            result = demoFindClient(currentDemo, e164, {
              staffId: ownStaffId,
              full: canBookForOthers,
            });
          } else {
            const { data, error } = await supabase.rpc("find_shop_client", {
              p_shop_id: shopId,
              p_whatsapp: e164,
            });
            if (error) throw error;
            result = parseFoundClient(data);
          }
          if (cancelled) return;
          setFound(result);
          setLookup("idle");
          // O apelido guardado entra no campo; sem apelido guardado, fica o que foi digitado.
          if (result.nickname) {
            setNickname(result.nickname);
            autoNickRef.current = result.nickname;
          }
          if (result.kind === "account") {
            setName(result.name ?? "");
            announce(
              result.name
                ? t("bk.found.accountAnnounce", { name: result.name })
                : t("bk.found.account"),
            );
          } else if (result.kind === "manual") {
            setName(result.name ?? typedNameRef.current);
            if (notifyByHandRef.current === null || result.limited) {
              setNotify(result.notifyWhatsapp ?? true);
            }
          } else {
            setName(typedNameRef.current);
          }
        } catch {
          if (!cancelled) {
            setFound(null);
            setLookup("error");
          }
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, e164, !!demo, shopId]);

  const service = activeServices.find((row) => row.id === serviceId) ?? null;
  const member = activeStaff.find((row) => row.id === staffId) ?? null;

  // Horários livres do profissional no dia: a grade do app, sem a antecedência mínima do cliente
  // (o barbeiro encaixa quem acabou de chegar).
  useEffect(() => {
    if (!open || !service || !staffId || booked) return;
    let cancelled = false;
    // Na demonstração a conta é na hora: sem "Buscando…" piscando a cada tique do relógio.
    if (!demo) setSlotsState("loading");
    void (async () => {
      try {
        let list: string[];
        if (demo) {
          list = dayAllowed(day)
            ? demoStaffSlots(demo, staffId, day, service.duration_minutes, service.id, timeZone, {
                team: true,
              }).map((date) => date.toISOString())
            : [];
        } else {
          const { data, error } = await supabase.rpc("get_team_slots", {
            p_shop_id: shopId,
            p_staff_id: staffId,
            p_service_id: service.id,
            p_date: day,
          });
          if (error) throw error;
          list = (data ?? []).map((row) => new Date(row.starts_at).toISOString());
        }
        if (cancelled) return;
        const unique = [...new Set(list)].sort();
        setSlots(unique);
        setSlotsState("ready");
        setSlot((current) => {
          if (current && unique.includes(current)) return current;
          if (wantedStart) {
            const wanted = Date.parse(wantedStart);
            return unique.find((iso) => Date.parse(iso) >= wanted) ?? null;
          }
          return null;
        });
      } catch {
        if (!cancelled) {
          setSlots([]);
          setSlotsState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    service?.id,
    staffId,
    day,
    demo?.appointments,
    demo?.availabilityBlocks,
    demo?.waits,
    booked,
    slotsVersion,
  ]);

  const dayOptions = useMemo(() => {
    const keys: string[] = [];
    const lastOffset = canBookForOthers ? DAYS_AHEAD + 7 : Math.max(1, horizonDays);
    for (let offset = 0; keys.length < DAYS_AHEAD && offset < lastOffset; offset++) {
      const key = shiftDateKey(today, offset);
      if (closedWeekdays.has(weekdayForDateKey(key))) continue;
      keys.push(key);
    }
    return keys.map((key) => {
      const date = shopDateTime(key, "12:00", timeZone);
      const label =
        key === today
          ? t("bk.today")
          : key === shiftDateKey(today, 1)
            ? t("bk.tomorrow")
            : formatShopDate(date, timeZone, { weekday: "short", day: "2-digit" }, intlLocale);
      return {
        value: key,
        label,
        note: formatShopDate(date, timeZone, { day: "2-digit", month: "2-digit" }, intlLocale),
      };
    });
  }, [canBookForOthers, closedWeekdays, horizonDays, intlLocale, t, timeZone, today]);

  const timeLabel = (iso: string) =>
    formatShopDate(new Date(iso), timeZone, { hour: "2-digit", minute: "2-digit" }, intlLocale);
  const whenLabel = (iso: string) =>
    formatShopDate(
      new Date(iso),
      timeZone,
      { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" },
      intlLocale,
    );
  const money = (cents: number) =>
    (cents / 100).toLocaleString(intlLocale, {
      style: "currency",
      currency: "BRL",
      currencyDisplay: "narrowSymbol",
    });

  const accountLocked = found?.kind === "account";
  // Cliente do balcão de outro profissional (quem marca não vê a loja inteira): o nome e os avisos
  // ficam como a barbearia guardou.
  const manualLocked = found?.kind === "manual" && found.limited;
  const isManual = !accountLocked;
  const nameValue = name.replace(/\s+/g, " ").trim();
  // Conta sem nome no cadastro não trava: o banco usa a conta.
  const nameMissing = !nameValue && !accountLocked;
  const phoneMissing = !e164;
  const typedDiffers =
    accountLocked &&
    !!found?.name &&
    !!typedName.trim() &&
    typedName.trim().toLocaleLowerCase("pt-BR") !== (found?.name ?? "").toLocaleLowerCase("pt-BR");
  const ready =
    !nameMissing && !phoneMissing && !!service && !!staffId && !!slot && lookup !== "searching";

  async function submit() {
    setShowErrors(true);
    setSubmitError(null);
    // Ainda buscando o número: espera o resultado (senão marcaria para o cliente anterior).
    if (lookup === "searching") return;
    if (!ready || !service || !staffId || !slot || !e164) {
      if (phoneMissing) phoneRef.current?.focus();
      return;
    }
    setSubmitting(true);
    const startsAt = slot;
    const endsAt = new Date(Date.parse(slot) + service.duration_minutes * 60_000).toISOString();
    const nick = cleanNickname(nickname);
    try {
      let result: Booked;
      if (demo) {
        // A mesma conferência do banco: dia dentro do prazo e horário ainda livre?
        if (!dayAllowed(day)) throw { message: "Esse dia ainda não está aberto para agendamento." };
        const still = demoStaffSlots(
          demo,
          staffId,
          day,
          service.duration_minutes,
          service.id,
          timeZone,
          { team: true },
        ).some((date) => date.toISOString() === startsAt);
        if (!still) throw { code: "23P01" };
        const appointmentId = crypto.randomUUID();
        const stamp = demo.now.toISOString();
        const account = found?.kind === "account" ? found : null;
        const manualId = account ? null : (found?.shopClientId ?? `demo-client-${appointmentId}`);
        const existing = demo.shopClients.find((row) =>
          account ? row.profile_id === account.customerId : row.id === manualId,
        );
        // Cliente de outro profissional (limited): nome e avisos ficam; o apelido só entra se ele
        // ainda não tinha — a mesma regra de book_for_client. O cartão de sucesso mostra o que ficou.
        const keep = found?.limited ? existing : undefined;
        const savedNick = found?.limited ? (existing?.nickname ?? nick) : nick;
        const savedName = keep ? keep.full_name : nameValue;
        const savedNotify = keep ? keep.notify_whatsapp : notify;
        demo.dispatch({
          type: "client.book",
          appointment: {
            id: appointmentId,
            barbershop_id: demo.shop.id,
            customer_id: account?.customerId ?? null,
            shop_client_id: manualId,
            booked_by: "demo-admin",
            service_id: service.id,
            staff_id: staffId,
            starts_at: startsAt,
            ends_at: endsAt,
            status: "confirmed",
            booked_price_cents: service.price_cents,
            public_token: `demo-token-${appointmentId}`,
            series_id: null,
            created_at: stamp,
            updated_at: stamp,
          },
          client: account
            ? {
                id: existing?.id ?? `demo-client-${account.customerId}`,
                profile_id: account.customerId,
                full_name: null,
                whatsapp_e164: null,
                nickname: savedNick,
                notify_whatsapp: true,
              }
            : {
                id: manualId!,
                profile_id: null,
                full_name: savedName,
                whatsapp_e164: e164,
                nickname: savedNick,
                notify_whatsapp: savedNotify,
              },
        });
        result = {
          appointmentId,
          kind: account ? "account" : "manual",
          name: account?.name ?? (savedName || t("shop.customerFallback")),
          nickname: savedNick,
          whatsapp: e164,
          notify: account ? null : savedNotify,
          startsAt,
          serviceName: service.name,
          staffName: member?.display_name ?? "",
        };
      } else {
        const account = found?.kind === "account" ? found : null;
        const manual = found?.kind === "manual" ? found : null;
        const { data, error } = await supabase.rpc("book_for_client", {
          p_shop_id: shopId,
          p_staff_id: staffId,
          p_service_id: service.id,
          p_starts_at: startsAt,
          p_customer_id: account?.customerId ?? null,
          p_shop_client_id: manual?.shopClientId ?? null,
          p_name: account ? null : nameValue,
          p_whatsapp: account || manual ? null : e164,
          // Campo vazio só apaga o apelido quando a busca mostrou quem é o cliente e o apelido
          // dele; se a busca falhou ou o cliente é de outro profissional, fica como está.
          p_nickname: nick ?? (found && found.kind !== "none" && !found.limited ? "" : null),
          p_notify: account ? null : notify,
        });
        if (error) throw error;
        const row = (data ?? {}) as Record<string, unknown>;
        const kind = row.kind === "account" ? "account" : "manual";
        result = {
          appointmentId: String(row.appointment_id ?? ""),
          kind,
          name:
            typeof row.name === "string" && row.name
              ? row.name
              : nameValue || t("shop.customerFallback"),
          nickname: typeof row.nickname === "string" ? row.nickname : nick,
          whatsapp: e164,
          notify: kind === "manual" ? notify : null,
          startsAt,
          serviceName: service.name,
          staffName: member?.display_name ?? "",
        };
      }
      setBooked(result);
      announce(t("bk.done.title"));
      onBooked({ appointmentId: result.appointmentId, day });
    } catch (error) {
      const kind = errorKind(error as { code?: string; message?: string });
      setSubmitError(kind);
      // Horário tomado: recarrega a lista para mostrar só os livres.
      if (kind === "taken") {
        setSlot(null);
        setWantedStart(null);
        setSlotsVersion((value) => value + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function bookAnother() {
    setBooked(null);
    setPhone("");
    setName("");
    setTypedName("");
    typedNameRef.current = "";
    setNickname("");
    autoNickRef.current = null;
    notifyByHandRef.current = null;
    setNotify(true);
    setFound(null);
    setSlot(null);
    setWantedStart(null);
    setShowErrors(false);
    setSubmitError(null);
    window.setTimeout(() => phoneRef.current?.focus(), 50);
  }

  const errorText: Record<SubmitError, string> = {
    taken: t("bk.error.taken"),
    past: t("bk.error.past"),
    closed: t("bk.error.closed"),
    ownOnly: t("bk.error.ownOnly"),
    service: t("bk.error.service"),
    name: t("bk.nameRequired"),
    whatsapp: t("bk.whatsappInvalid"),
    generic: t("bk.error.generic"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          phoneRef.current?.focus();
        }}
        className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl border-border bg-card p-0"
      >
        <div className="flex min-h-14 items-center gap-2.5 border-b border-border px-4 py-3 pr-14">
          <CalendarPlus className="size-5 shrink-0 text-gold" aria-hidden />
          <DialogTitle className="min-w-0 break-words text-base font-bold">
            {booked ? t("bk.done.title") : t("bk.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("bk.description")}</DialogDescription>
        </div>

        {booked ? (
          <div className="dialog-scroll-area flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <div className="tone-success flex items-start gap-3 rounded-2xl border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] p-4">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-[color:var(--tone-ink)]"
                aria-hidden
              />
              <div className="min-w-0 space-y-1">
                <p className="font-bold">
                  {booked.nickname ? `${booked.nickname} · ${booked.name}` : booked.name}
                </p>
                <p className="text-sm">
                  {booked.serviceName} · {whenLabel(booked.startsAt)}
                </p>
                {booked.staffName && (
                  <p className="text-sm text-muted-foreground">
                    {t("team.profile.with", { name: booked.staffName })}
                  </p>
                )}
              </div>
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <BellRing className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
              {booked.kind === "account"
                ? t("bk.notifyAccount")
                : booked.notify
                  ? t("bk.done.whatsapp")
                  : t("bk.done.whatsappOff")}
            </p>
            {booked.kind === "manual" && (
              <>
                <Notice tone="info" icon={Repeat} title={t("bk.noRecurring.title")} role="none">
                  {t("bk.noRecurring.body")}
                </Notice>
                <InviteCard
                  whatsappE164={booked.whatsapp}
                  clientName={booked.name}
                  shopName={shopName}
                  publicOrigin={publicOrigin}
                />
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={bookAnother}
                className="action-button action-confirm min-h-11 flex-1"
              >
                <CalendarPlus aria-hidden />
                {t("bk.another")}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        ) : (
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="dialog-scroll-area flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
              {/* 1. Cliente */}
              <fieldset className="space-y-3">
                <legend className="mb-1 flex items-center gap-2 text-sm font-bold">
                  <UserRound className="size-4 text-gold" aria-hidden />
                  {t("bk.client")}
                </legend>
                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-phone`} className="block text-sm font-semibold">
                    {t("bk.whatsapp")}
                  </label>
                  <div className="relative">
                    <input
                      ref={phoneRef}
                      id={`${formId}-phone`}
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      value={phone}
                      onChange={(event) => setPhone(nextMaskedPhone(phone, event.target.value))}
                      placeholder="(11) 99999-0000"
                      aria-invalid={showErrors && phoneMissing ? true : undefined}
                      aria-describedby={`${formId}-phone-hint`}
                      className="min-h-12 w-full rounded-xl border border-border bg-background px-3 pe-10 text-base tabular-nums"
                    />
                    {lookup === "searching" && (
                      <Loader2
                        className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground motion-safe:animate-spin"
                        aria-hidden
                      />
                    )}
                    {lookup !== "searching" && e164 && (
                      <Search
                        className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </div>
                  {showErrors && phoneMissing ? (
                    <FieldMessage tone="error" id={`${formId}-phone-hint`}>
                      {t("bk.whatsappInvalid")}
                    </FieldMessage>
                  ) : (
                    <FieldMessage id={`${formId}-phone-hint`}>{t("bk.whatsappHint")}</FieldMessage>
                  )}
                </div>

                {lookup === "searching" && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t("bk.searching")}
                  </p>
                )}
                {lookup === "error" && <Notice tone="warning" title={t("bk.lookupError")} />}
                {found?.kind === "account" && (
                  <Notice
                    tone="success"
                    title={t("bk.found.account")}
                    action={
                      typedDiffers && !cleanNickname(nickname)
                        ? {
                            label: t("bk.found.useTyped", { name: typedName.trim() }),
                            onClick: () => setNickname(typedName.trim().slice(0, 40)),
                          }
                        : undefined
                    }
                  >
                    {typedDiffers
                      ? t("bk.found.nameChanged", {
                          name: found.name ?? "",
                          typed: typedName.trim(),
                        })
                      : found.name
                        ? t("bk.found.accountName", { name: found.name })
                        : t("bk.found.accountNoName")}
                  </Notice>
                )}
                {found?.kind === "manual" && (
                  <Notice tone="info" icon={ContactRound} title={t("bk.found.manual")}>
                    {manualLocked ? t("bk.found.manualHintKept") : t("bk.found.manualHint")}
                  </Notice>
                )}

                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-name`} className="block text-sm font-semibold">
                    {t("bk.name")}
                  </label>
                  <input
                    id={`${formId}-name`}
                    value={name}
                    readOnly={accountLocked || manualLocked}
                    autoComplete="off"
                    autoCapitalize="words"
                    maxLength={120}
                    onChange={(event) => {
                      setName(event.target.value);
                      setTypedName(event.target.value);
                      typedNameRef.current = event.target.value;
                    }}
                    placeholder={t("bk.namePlaceholder")}
                    aria-invalid={showErrors && nameMissing ? true : undefined}
                    aria-describedby={`${formId}-name-hint`}
                    className={cn(
                      "min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base",
                      (accountLocked || manualLocked) && "bg-muted/50 text-foreground",
                    )}
                  />
                  {showErrors && nameMissing ? (
                    <FieldMessage tone="error" id={`${formId}-name-hint`}>
                      {t("bk.nameRequired")}
                    </FieldMessage>
                  ) : accountLocked ? (
                    <FieldMessage id={`${formId}-name-hint`}>{t("bk.nameLocked")}</FieldMessage>
                  ) : manualLocked ? (
                    <FieldMessage id={`${formId}-name-hint`}>{t("bk.nameKept")}</FieldMessage>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={`${formId}-nick`}
                    className="flex items-center gap-1.5 text-sm font-semibold"
                  >
                    {t("bk.nickname")}
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("bk.optional")}
                    </span>
                  </label>
                  <input
                    id={`${formId}-nick`}
                    value={nickname}
                    maxLength={40}
                    autoComplete="off"
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder={t("bk.nicknamePlaceholder")}
                    aria-describedby={`${formId}-nick-hint`}
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base"
                  />
                  <FieldMessage id={`${formId}-nick-hint`}>{t("bk.nicknameHint")}</FieldMessage>
                </div>
              </fieldset>

              {/* 2. Serviço */}
              {activeServices.length > 0 ? (
                <ChoiceChips
                  label={t("bk.service")}
                  icon={Scissors}
                  value={serviceId}
                  onChange={(value) => {
                    setServiceId(value);
                    setSlot(null);
                  }}
                  options={activeServices.map((row) => ({
                    value: row.id,
                    label: row.name,
                    note: `${row.duration_minutes} min · ${money(row.price_cents)}`,
                  }))}
                />
              ) : (
                <EmptyState tone="scissors" variant="plain" title={t("bk.noServices")} />
              )}

              {/* 3. Profissional (quem vê a loja inteira) */}
              {canBookForOthers && activeStaff.length > 1 && (
                <ChoiceChips
                  label={t("bk.staff")}
                  icon={Users}
                  scroll={!desktop}
                  value={staffId}
                  onChange={(value) => {
                    setStaffId(value);
                    setSlot(null);
                  }}
                  options={activeStaff.map((row) => ({
                    value: row.id,
                    label: row.display_name,
                    media: (
                      <PersonAvatar
                        name={row.display_name}
                        src={row.avatar_url}
                        seed={row.id}
                        size="xs"
                      />
                    ),
                  }))}
                />
              )}

              {/* 4. Dia e horário */}
              <ChoiceChips
                label={t("bk.day")}
                icon={CalendarPlus}
                scroll={!desktop}
                value={day}
                onChange={(value) => {
                  setDay(value);
                  setSlot(null);
                  setWantedStart(null);
                }}
                options={dayOptions}
              />
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="size-4 text-gold" aria-hidden />
                  {t("bk.time")}
                </p>
                {slotsState === "loading" ? (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                    {t("bk.loadingSlots")}
                  </p>
                ) : slotsState === "error" ? (
                  <Notice tone="danger" title={t("bk.slotsError")} />
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("bk.noSlots")}</p>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label={t("bk.time")}
                    className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2"
                  >
                    {slots.map((iso) => {
                      const on = slot === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setSlot(iso)}
                          className={cn(
                            "min-h-11 rounded-xl border text-sm font-bold tabular-nums transition",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:border-primary/40",
                          )}
                        >
                          {timeLabel(iso)}
                        </button>
                      );
                    })}
                  </div>
                )}
                {showErrors && !slot && slotsState === "ready" && slots.length > 0 && (
                  <FieldMessage tone="error">{t("bk.chooseTime")}</FieldMessage>
                )}
              </div>

              {/* 5. Avisos */}
              {isManual ? (
                <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
                  <BellRing className="size-4 shrink-0 text-gold" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t("bk.notify")}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("bk.notifyHint")}
                    </span>
                  </span>
                  <Switch
                    checked={notify}
                    onCheckedChange={(value) => {
                      notifyByHandRef.current = value;
                      setNotify(value);
                    }}
                    disabled={manualLocked}
                    aria-label={t("bk.notify")}
                  />
                </label>
              ) : (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <BellRing className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  {t("bk.notifyAccount")}
                </p>
              )}

              {isManual && e164 && found?.kind !== "account" && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Repeat className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  {t("bk.noRecurring.short")}
                </p>
              )}
              {found?.kind === "account" && found.recurring && (
                <StatusBadge tone="highlight" icon={Repeat} label={t("agenda.recurring.client")} />
              )}

              {submitError && <Notice tone="danger" title={errorText[submitError]} />}
            </div>

            <div className="border-t border-border bg-card p-3 sm:px-5">
              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting ? true : undefined}
                className="action-button action-confirm min-h-12 w-full"
              >
                {submitting ? (
                  <Loader2 className="motion-safe:animate-spin" aria-hidden />
                ) : (
                  <CalendarPlus aria-hidden />
                )}
                {submitting
                  ? t("bk.saving")
                  : slot
                    ? t("bk.submit", { when: whenLabel(slot) })
                    : t("bk.submitShort")}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
