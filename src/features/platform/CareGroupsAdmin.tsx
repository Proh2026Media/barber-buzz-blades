import { useEffect, useRef, useState } from "react";
import { UsersRound, ShieldCheck, Pause, RefreshCw } from "lucide-react";
import { Notice, SectionHeader } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { useDemo } from "@/features/demo/context";
import { careStates } from "@/features/whatsapp/CareGroupPanel";

type Payload = {
  enabled: boolean;
  accounts: { id: string; shop_name: string; number: string; enabled: boolean }[];
  groups: {
    id: string;
    shop_id: string;
    shop_name: string;
    customer_name: string;
    state: string;
    version: number;
  }[];
};
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";
export function CareGroupsAdmin({
  shops,
  numbers,
}: {
  shops: { id: string; name: string }[];
  numbers: { id: string; display_phone?: string | null; label?: string | null }[];
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const [data, setData] = useState<Payload | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [shop, setShop] = useState(""),
    [number, setNumber] = useState(""),
    [owned, setOwned] = useState(false),
    [selected, setSelected] = useState("");
  const live = useRef(true),
    pending = useRef(false);
  async function action(name: string, values: Json = {}) {
    if (demo || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      const r = await supabase.rpc("care_group_admin", { p_action: name, p_values: values });
      if (r.error || (r.data as { denied?: boolean })?.denied) throw new Error("GROUP_DENIED");
      if (live.current) setData(r.data as unknown as Payload);
    } catch {
      if (live.current) setError(true);
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void action("read");
    return () => {
      live.current = false;
    };
  }, [demo]);
  const group = data?.groups.find((g) => g.id === selected);
  return (
    <section className="min-w-0 space-y-4" aria-busy={busy}>
      <div className="app-action-card space-y-3 p-4 tablet:p-5">
        <SectionHeader icon={UsersRound} title={t("care.adminTitle")} />
        <Notice tone="warning" title={t("care.providerBlocked")}>
          {t("care.providerHint")}
        </Notice>
        {error && <Notice tone="danger" title={t("care.error")} />}
        <div className="flex flex-wrap gap-2">
          <button
            className="action-button"
            disabled={busy || !data}
            onClick={() => void action("enrollment", { enabled: !data?.enabled })}
          >
            {t(data?.enabled ? "care.disableEnrollment" : "care.enableEnrollment")}
          </button>
          <button className="action-button" disabled={busy} onClick={() => void action("read")}>
            <RefreshCw aria-hidden />
            {t("waCentral.refresh")}
          </button>
        </div>
      </div>
      <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div className="app-action-card min-w-0 space-y-4 p-4 tablet:p-5">
          <SectionHeader icon={ShieldCheck} title={t("care.accounts")} />
          <label className="block space-y-1 text-sm">
            <span>{t("care.shop")}</span>
            <select className={field} value={shop} onChange={(e) => setShop(e.target.value)}>
              <option value="">{t("care.choose")}</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>{t("care.number")}</span>
            <select
              className={field}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setOwned(false);
              }}
            >
              <option value="">{t("care.choose")}</option>
              {numbers
                .filter((n) => n.display_phone)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.display_phone} · {n.display_phone}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex min-h-11 gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              checked={owned}
              onChange={(e) => setOwned(e.target.checked)}
            />
            {t("care.owned")}
          </label>
          <button
            className="action-button action-confirm w-full"
            disabled={busy || !shop || !number || !owned}
            onClick={() =>
              void action("authorize_account", {
                shop_id: shop,
                channel_id: number,
                platform_owned: owned,
              })
            }
          >
            {t("care.authorizeNumber")}
          </button>
          <div className="space-y-2">
            {data?.accounts.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 p-3 text-sm"
              >
                <span>
                  {a.shop_name}
                  <strong className="block">{a.number}</strong>
                </span>
                {a.enabled ? (
                  <button
                    className="action-button"
                    disabled={busy}
                    onClick={() => void action("revoke_account", { account_id: a.id })}
                  >
                    {t("care.revoke")}
                  </button>
                ) : (
                  <span>{t("care.revoked")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="app-action-card min-w-0 space-y-4 p-4 tablet:p-5">
          <SectionHeader icon={UsersRound} title={t("care.requests")} />
          {data?.groups.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("care.empty")}</p>
          )}
          <div className="space-y-2">
            {data?.groups.map((g) => (
              <button
                key={g.id}
                className={`flex min-h-16 w-full flex-col items-start rounded-xl border p-3 text-left ${selected === g.id ? "border-gold bg-muted" : "border-border"}`}
                onClick={() => {
                  setSelected(g.id);
                }}
              >
                <strong className="break-words">{g.customer_name}</strong>
                <span className="text-sm">
                  {g.shop_name} · {t(careStates[g.state] ?? "care.unavailable")}
                </span>
              </button>
            ))}
          </div>
          {group && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex flex-wrap gap-2">
                <button
                  className="action-button"
                  disabled={busy}
                  onClick={() =>
                    void action("pause", { group_id: group.id, version: group.version })
                  }
                >
                  <Pause aria-hidden />
                  {t("care.pause")}
                </button>
                <button
                  className="action-button"
                  disabled={busy}
                  onClick={() =>
                    void action("review", { group_id: group.id, version: group.version })
                  }
                >
                  {t("care.review")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t("care.noCommercialAdmins")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
