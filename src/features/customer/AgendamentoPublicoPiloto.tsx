import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Abertura } from "@/components/Abertura";
import { supabase } from "@/integrations/supabase/client";
import { lojaPiloto } from "@/lib/auth/piloto-agendamento";
import { useI18n } from "@/lib/i18n";

type Opcao = {
  servico: string;
  nome: string;
  profissional: string;
  pessoa: string;
  duracao: number;
};
type Catalogo = { inicio: string; fim: string; opcoes: Opcao[] };

export function AgendamentoPublicoPiloto({
  barber,
  day,
  time,
}: {
  barber?: string;
  day?: string;
  time?: string;
}) {
  const { t } = useI18n();
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [servico, setServico] = useState("");
  const [profissional, setProfissional] = useState("");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState(time ?? "");
  const [grade, setGrade] = useState<{ chave: string; horas: string[] } | null>(null);
  const [falha, setFalha] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vigente = true;
    setFalha(false);
    void supabase.rpc("consultar_agenda_piloto", {}).then(({ data, error }) => {
      if (!vigente) return;
      const lista = data as unknown as Catalogo | null;
      if (error || !lista || !Array.isArray(lista.opcoes)) {
        setFalha(true);
        return;
      }
      const primeira =
        lista.opcoes
          .filter((o) => o.profissional === barber)
          .sort((a, b) => a.duracao - b.duracao)[0] ?? lista.opcoes[0];
      setServico(primeira?.servico ?? "");
      setProfissional(primeira?.profissional ?? "");
      setDia(day && day >= lista.inicio && day <= lista.fim ? day : lista.inicio);
      setCatalogo(lista);
    });
    return () => {
      vigente = false;
    };
  }, [barber, day, tentativa]);

  const chave = [servico, profissional, dia].join("/");
  useEffect(() => {
    if (!servico || !profissional || !dia) return;
    let vigente = true;
    void supabase
      .rpc("consultar_agenda_piloto", {
        p_servico: servico,
        p_profissional: profissional,
        p_dia: dia,
      })
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error || !Array.isArray(data)) {
          setFalha(true);
          return;
        }
        setGrade({ chave, horas: data.filter((v): v is string => typeof v === "string") });
      });
    return () => {
      vigente = false;
    };
  }, [servico, profissional, dia, chave, tentativa]);

  if (falha)
    return (
      <Abertura erro={t("shopLanding.errorTitle")} tentar={() => setTentativa((v) => v + 1)} />
    );
  if (!catalogo) return <Abertura />;
  const servicos = Array.from(new Map(catalogo.opcoes.map((o) => [o.servico, o.nome])));
  const equipe = catalogo.opcoes.filter((o) => o.servico === servico);
  const horas = grade?.chave === chave ? grade.horas : null;
  const next =
    "/app?" +
    new URLSearchParams({
      tab: "agendar",
      shop: lojaPiloto.slug,
      service: servico,
      barber: profissional,
      day: dia,
      time: hora,
    });
  return (
    <main className="public-page min-h-dvh p-4">
      <section className="public-card mx-auto grid max-w-md gap-4 rounded-[var(--panel-radius)] p-5">
        <img src="/identidade/icone?tamanho=192" width="48" height="48" alt="" />
        <h1 className="text-xl font-bold">{t("shopLanding.bookCta")}</h1>
        {servicos.length > 0 ? (
          <>
            <label className="grid gap-1">
              {t("booking.service")}
              <select
                className="min-h-12 w-full rounded-[var(--button-radius)] border border-border bg-background px-3 text-base text-foreground"
                value={servico}
                onChange={(e) => {
                  const id = e.target.value;
                  setServico(id);
                  setHora("");
                  const opcoes = catalogo.opcoes.filter((o) => o.servico === id);
                  setProfissional(
                    opcoes.find((o) => o.profissional === profissional)?.profissional ??
                      opcoes[0]?.profissional ??
                      "",
                  );
                }}
              >
                {servicos.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              {t("booking.staff")}
              <select
                className="min-h-12 w-full rounded-[var(--button-radius)] border border-border bg-background px-3 text-base text-foreground"
                value={profissional}
                onChange={(e) => {
                  setProfissional(e.target.value);
                  setHora("");
                }}
              >
                {equipe.map((o) => (
                  <option key={o.profissional} value={o.profissional}>
                    {o.pessoa}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              {t("booking.date")}
              <input
                className="min-h-12 w-full rounded-[var(--button-radius)] border border-border bg-background px-3 text-base text-foreground"
                type="date"
                min={catalogo.inicio}
                max={catalogo.fim}
                value={dia}
                onChange={(e) => {
                  setDia(e.target.value);
                  setHora("");
                }}
              />
            </label>
            <fieldset>
              <legend>{t("booking.chooseTime")}</legend>
              <div className="flex flex-wrap gap-2">
                {horas?.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={hora === h}
                    className={hora === h ? "action-button action-confirm" : "action-button"}
                    onClick={() => setHora(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
              {dia && !horas?.length && (
                <p role="status">{t(horas ? "bk.noSlots" : "app.loading")}</p>
              )}
            </fieldset>
            {horas?.includes(hora) && (
              <Link
                className="action-button action-confirm min-h-12 justify-center"
                to="/auth"
                search={{ next, shop: lojaPiloto.slug }}
              >
                {t("rapido.continuar")}
              </Link>
            )}
          </>
        ) : (
          <p>{t("bk.noSlots")}</p>
        )}
        <Link
          className="action-button min-h-11 justify-center"
          to="/auth"
          search={{ next: "/app?tab=conta", shop: lojaPiloto.slug }}
        >
          {t("auth.submit.signin")}
        </Link>
      </section>
    </main>
  );
}
