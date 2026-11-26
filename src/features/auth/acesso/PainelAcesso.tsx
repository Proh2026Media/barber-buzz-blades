import { SeloBarbearia } from "@/components/SeloBarbearia";
import { useI18n } from "@/lib/i18n";

export type LojaDoPainel = {
  shopId: string | null;
  nome: string;
  logoUrl: string | null;
  fotoUrl: string | null;
  /** Leiaute salvo pela loja: na "capa" a foto ocupa o painel inteiro. */
  capa: boolean;
};

/**
 * Painel ilustrado do acesso (decorativo: fora da leitura de tela e da tabulação).
 * - Sem loja: a Aurset com as cores da marca-mãe (chão, quarto de círculo, anel, foto em arco,
 *   cartão de agenda e uma frase curta).
 * - Com loja: a marca e a cor da loja, a foto que ela escolheu (ou o logo no arco) e o nome.
 */
export function PainelAcesso({ loja }: { loja: LojaDoPainel | null }) {
  const { t } = useI18n();
  const capa = Boolean(loja?.capa && loja.fotoUrl);
  return (
    <div className={`acesso-painel${capa ? " tem-capa" : ""}`} aria-hidden="true">
      {capa && loja?.fotoUrl && (
        <>
          <img className="acesso-capa-foto" src={loja.fotoUrl} alt="" />
          <span className="acesso-capa-veu" />
        </>
      )}
      <span className="acesso-forma acesso-forma-quarto" />
      <span className="acesso-forma acesso-forma-meia" />
      {/* Na Aurset a pílula traz um estado ("Aberto agora"); vazia, parecia rótulo sem texto. */}
      <span className="acesso-forma acesso-forma-pilula">
        {!loja && (
          <>
            <i />
            {t("landing.scenePill")}
          </>
        )}
      </span>
      <span className="acesso-forma acesso-forma-anel" />
      <div className="acesso-cena">
        <div className="acesso-arco">
          {loja ? (
            loja.fotoUrl ? (
              <img src={loja.fotoUrl} alt="" />
            ) : loja.logoUrl ? (
              <img className="acesso-arco-logo" src={loja.logoUrl} alt="" />
            ) : (
              // Sem foto e sem logo (e na demonstração, sem id): as iniciais do nome, para o
              // arco nunca ficar vazio.
              <SeloBarbearia
                lojaId={loja.shopId}
                nome={loja.nome}
                tamanho={96}
                className="acesso-arco-logo"
              />
            )
          ) : (
            <img
              src="/images/aurset/maos-768.webp"
              alt=""
              width={768}
              height={1024}
              decoding="async"
            />
          )}
        </div>
        {!loja && (
          <div className="acesso-agenda">
            <p className="acesso-agenda-topo">{t("acesso.painel.hoje")}</p>
            <p className="acesso-agenda-linha">
              <span className="acesso-agenda-hora">14:30</span>
              <span>{t("acesso.painel.servico")}</span>
              <span className="acesso-agenda-selo">{t("acesso.painel.status")}</span>
            </p>
            <p className="acesso-agenda-linha">
              <span className="acesso-agenda-hora">16:00</span>
              <span>{t("acesso.painel.servico2")}</span>
              <span className="acesso-agenda-selo acesso-agenda-selo-2">
                {t("acesso.painel.status2")}
              </span>
            </p>
          </div>
        )}
      </div>
      <div className="acesso-frase">
        {loja && <p className="acesso-frase-loja">{loja.nome}</p>}
        <p className="acesso-frase-titulo">
          {loja ? t("acesso.loja.titulo") : t("acesso.painel.titulo")}
        </p>
        <p className="acesso-frase-texto">
          {loja ? t("acesso.loja.texto", { name: loja.nome }) : t("acesso.painel.texto")}
        </p>
      </div>
    </div>
  );
}
