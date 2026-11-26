import { Palette } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { PALETA_EVENT, readPaleta, writePaleta, type Paleta } from "@/lib/paleta";

type PaletaToggleProps = {
  className?: string;
  buttonClassName?: string;
};

/**
 * Alterna a paleta da plataforma entre as cores da marca e os neutros (opção de uso, no claro
 * e no escuro). Fica só nas telas da própria Aurset; nas telas de um estabelecimento vale o
 * tema da loja.
 */
export function PaletaToggle({
  className,
  buttonClassName = "app-icon-button",
}: PaletaToggleProps) {
  const { t } = useI18n();
  const [paleta, setPaleta] = useState<Paleta>("marca");
  useEffect(() => {
    const sync = () => setPaleta(readPaleta());
    sync();
    window.addEventListener(PALETA_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PALETA_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const neutra = paleta === "neutra";
  const label = neutra ? t("paleta.useBrand") : t("paleta.useNeutral");
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => writePaleta(neutra ? "marca" : "neutra")}
        aria-label={label}
        aria-pressed={neutra}
        title={label}
        className={buttonClassName}
      >
        <Palette size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
