import { useState } from "react";
import { useI18n } from "@/lib/i18n";

/** A identidade é resolvida pelo domínio que serviu o documento, inclusive antes da hidratação. */
export function Abertura({ erro, tentar }: { erro?: string; tentar?: () => void }) {
  const { t } = useI18n();
  const [falhou, setFalhou] = useState(false);
  return (
    <div className="abertura-contexto">
      {erro ? (
        <>
          <p role="alert">{erro}</p>
          {tentar && (
            <button type="button" onClick={tentar}>
              {t("common.retry")}
            </button>
          )}
        </>
      ) : (
        <div role="status" className="abertura-marca">
          {falhou ? (
            <p>{t("app.loading")}</p>
          ) : (
            <>
              <img
                src="/identidade/marca"
                width="64"
                height="64"
                alt=""
                decoding="async"
                onError={() => setFalhou(true)}
              />
              <span className="sr-only">{t("app.loading")}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
