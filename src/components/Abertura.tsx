import { useI18n } from "@/lib/i18n";

/** Estado de entrada sem marca, anterior à resolução da sessão e da identidade da loja. */
export function Abertura({ erro, tentar }: { erro?: string; tentar?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="abertura-contexto">
      <p role={erro ? "alert" : "status"}>{erro || t("app.loading")}</p>
      {erro && tentar && <button type="button" onClick={tentar}>{t("common.retry")}</button>}
    </div>
  );
}
