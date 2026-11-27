import { useI18n } from "@/lib/i18n";
import { descricaoDoServico } from "@/lib/shop/modelos-servico";

export function DescricaoServico({ nome, descricao }: { nome: string; descricao?: string | null }) {
  const { t } = useI18n();
  const texto = descricaoDoServico(nome, descricao, t);
  return texto ? (
    <span className="descricao-servico block whitespace-pre-line text-start text-sm font-normal leading-snug text-muted-foreground [overflow-wrap:anywhere]">
      {texto}
    </span>
  ) : null;
}
