import { useId, useState } from "react";
import { Banknote, Calculator, RotateCcw, ShieldCheck, Wallet } from "lucide-react";
import { ChoiceChips, Notice, StatTile } from "@/components/visual";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  quoteCancellationRefund,
  requestComplementaryRefund,
  type RefundProcess,
} from "./refund-policy";

/** Somente demonstração: valores locais, sem banco, cobrança ou ordem de devolução. */
export function RefundPolicySimulator() {
  const { t, intlLocale } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("100,00");
  const [received, setReceived] = useState("100,00");
  const [lead, setLead] = useState(120);
  const [reason, setReason] = useState<"forgot" | "other" | "unspecified">("forgot");
  const [actor, setActor] = useState<"customer" | "shop">("customer");
  const [accepted, setAccepted] = useState("yes");
  const [requested, setRequested] = useState<RefundProcess | null>(null);
  const resetRequest = () => setRequested(null);
  const cents = (value: string) => {
    if (!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
    const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  };
  const priceCents = cents(price);
  const receivedCents = cents(received);
  let quote: ReturnType<typeof quoteCancellationRefund> | null = null;
  if (priceCents !== null && receivedCents !== null && priceCents > 0) {
    quote = quoteCancellationRefund({
      agreedPriceCents: priceCents,
      receivedCents,
      refundedCents: 0,
      reservedCents: 0,
      currency: "BRL",
      startsAtMs: 1800000000000,
      cancelledAtMs: 1800000000000 - lead * 60000,
      policyAccepted: accepted === "yes",
      actor,
      reason,
    });
  }
  const money = (value: number) =>
    new Intl.NumberFormat(intlLocale, { style: "currency", currency: "BRL" }).format(value / 100);
  const inputClass =
    "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="action-button action-neutral w-full"
      >
        <Calculator className="size-4" aria-hidden />
        {t("p49.open")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="bg-card">
          <DialogHeader className="pr-10">
            <DialogTitle>{t("p49.title")}</DialogTitle>
            <DialogDescription>{t("p49.simulation")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="grid min-w-0 gap-4 tablet:grid-cols-2">
              <label htmlFor={`${id}-price`} className="min-w-0 space-y-1 text-sm font-semibold">
                <span>{t("p49.price")}</span>
                <input
                  id={`${id}-price`}
                  inputMode="decimal"
                  value={price}
                  maxLength={10}
                  aria-invalid={priceCents === null || priceCents <= 0 || undefined}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    resetRequest();
                  }}
                  className={inputClass}
                />
              </label>
              <label htmlFor={`${id}-received`} className="min-w-0 space-y-1 text-sm font-semibold">
                <span>{t("p49.receivedInput")}</span>
                <input
                  id={`${id}-received`}
                  inputMode="decimal"
                  value={received}
                  maxLength={10}
                  aria-invalid={receivedCents === null || undefined}
                  onChange={(event) => {
                    setReceived(event.target.value);
                    resetRequest();
                  }}
                  className={inputClass}
                />
              </label>
            </div>
            <ChoiceChips
              label={t("p49.when")}
              value={lead}
              onChange={(value) => {
                setLead(value);
                resetRequest();
              }}
              options={[
                { value: 240, label: t("p49.fourHours") },
                { value: 180, label: t("p49.threeHours") },
                { value: 120, label: t("p49.twoHours") },
                { value: -1, label: t("p49.started") },
              ]}
            />
            <ChoiceChips
              label={t("p49.reason")}
              value={reason}
              onChange={(value) => {
                setReason(value);
                resetRequest();
              }}
              options={[
                { value: "forgot", label: t("p49.forgot") },
                { value: "other", label: t("p49.other") },
                { value: "unspecified", label: t("p49.unspecified") },
              ]}
            />
            <div className="grid min-w-0 gap-4 tablet:grid-cols-2">
              <ChoiceChips
                label={t("p49.actor")}
                value={actor}
                onChange={(value) => {
                  setActor(value);
                  resetRequest();
                }}
                options={[
                  { value: "customer", label: t("p49.customer") },
                  { value: "shop", label: t("p49.shop") },
                ]}
              />
              <ChoiceChips
                label={t("p49.accepted")}
                value={accepted}
                onChange={(value) => {
                  setAccepted(value);
                  resetRequest();
                }}
                options={[
                  { value: "yes", label: t("p49.yes") },
                  { value: "no", label: t("p49.no") },
                ]}
              />
            </div>
            {quote ? (
              <div className="space-y-3" aria-live="polite" aria-atomic="true">
                <div className="grid gap-3 tablet:grid-cols-3">
                  <StatTile icon={Wallet} label={t("p49.received")} value={money(receivedCents!)} />
                  <StatTile
                    icon={ShieldCheck}
                    label={t("p49.retention")}
                    value={money(quote.retentionCents)}
                  />
                  <StatTile
                    icon={RotateCcw}
                    label={t("p49.refund")}
                    value={money(quote.refundTargetCents)}
                  />
                </div>
                <Notice
                  tone="info"
                  title={t(quote.retentionCents > 0 ? "p49.withRetention" : "p49.withoutRetention")}
                />
                {quote.retentionCents > 0 &&
                  (requested ? (
                    <Notice tone="info" title={t("p49.requested")}>
                      {t("p49.requestedHint")}
                    </Notice>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setRequested(
                          requestComplementaryRefund(
                            quote,
                            {
                              currency: "BRL",
                              receivedCents: receivedCents!,
                              refundedCents: 0,
                              reservedCents: quote.refundTargetCents,
                            },
                            `sim-${id}`,
                          ),
                        )
                      }
                      className="action-button action-neutral w-full"
                    >
                      <Banknote className="size-4" aria-hidden />
                      {t("p49.requestFull")}
                    </button>
                  ))}
              </div>
            ) : (
              <Notice tone="warning" title={t("p49.invalid")} />
            )}
          </DialogBody>
          <DialogActions>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="action-button action-neutral"
            >
              {t("common.close")}
            </button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}
