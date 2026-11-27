import { useRegrasAgenda, useVezAgenda } from "./booking/sugestoes";
import { useMemo, useState, type CSSProperties } from "react";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CalendarDays, LogIn, Scissors, User } from "lucide-react";
import { sanitizeNext } from "@/lib/auth/destination";
import { Abertura } from "@/components/Abertura";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EmptyState } from "@/components/visual";
import { WorkspaceFrame, WorkspaceHeading } from "@/components/visual/WorkspaceHeader";
import { AppointmentTicket } from "./booking/ticket";
import { SeloBarbearia } from "@/components/SeloBarbearia";
import { BrandRootVariables } from "@/features/shop/BrandRootVariables";
import { PublicBrandFontFace } from "@/features/shop/PublicBrandFontFace";
import { supabase } from "@/integrations/supabase/client";
import { useDevice, useViewportAtLeast } from "@/lib/device";
import { useI18n } from "@/lib/i18n";
import {
  formatShopDate,
  shiftDateKey,
  shopDateTime,
  weekdayForDateKey,
} from "@/lib/shop/appointments";
import { brandCornerClass, brandFontScopeClass, brandVariables } from "@/lib/shop/branding";
import {
  BookingDateChoices,
  BookingSummaryBar,
  ChangeButton,
  ServiceChoices,
  ServiceSummary,
  StaffChoices,
  StaffSummary,
  StepCard,
  TimeGrid,
} from "./booking/BookingParts";

type Contexto = {
  turno?: string;
  loja: string;
  service?: string;
  barber?: string;
  day?: string;
  time?: string;
};
type Opcao = {
  servico: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  icone_profissional?: string | null;
  profissional: string;
  pessoa: string;
  foto: string | null;
  bio: string | null;
  duracao: number;
  preco: number;
};
type Marca = {
  id: string;
  nome: string;
  tagline: string | null;
  logo_url: string | null;
  logo_background_color: string | null;
  primary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  custom_font_url: string | null;
  font_scope: string | null;
  header_font_weight: number | null;
  header_font_style: string | null;
  floating_chrome: boolean;
};
type Catalogo = {
  cantos: string;
  inicio: string;
  fim: string;
  fuso: string;
  fechados: number[] | null;
  opcoes: Opcao[];
  marca: Marca;
};

export function AgendamentoPublico(contexto: Contexto) {
  const { t } = useI18n();
  const host = window.location.hostname;
  const catalogo = useQuery({
    queryKey: ["agenda-publica", host, contexto.loja],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("consultar_agenda_publica", { p_host: host })
        .abortSignal(signal);
      if (error) throw error;
      const resultado = data as unknown as Catalogo | null;
      if (resultado && (!resultado.marca || !Array.isArray(resultado.opcoes)))
        throw new Error("Catálogo indisponível");
      return resultado;
    },
  });
  if (catalogo.isError)
    return <Abertura erro={t("shopLanding.errorTitle")} tentar={() => void catalogo.refetch()} />;
  if (catalogo.data === null) {
    const parametros = new URLSearchParams({ tab: "agendar", shop: contexto.loja });
    for (const chave of ["barber", "service", "day", "time", "turno"] as const) {
      if (contexto[chave]) parametros.set(chave, contexto[chave]);
    }
    const next = sanitizeNext("/app?" + parametros) ?? "/app?tab=agendar";
    return <Navigate to="/auth" replace search={{ shop: contexto.loja, next }} />;
  }
  if (!catalogo.data) return <Abertura />;
  return <AgendaDaLoja {...contexto} host={host} catalogo={catalogo.data} />;
}

function AgendaDaLoja({
  loja,
  host,
  service,
  turno,
  barber,
  day,
  time,
  catalogo,
}: Contexto & { host: string; catalogo: Catalogo }) {
  const { t, intlLocale } = useI18n();
  const navigate = useNavigate();
  const expandida = useDevice() !== "celular";
  const resumoLateral = useViewportAtLeast(1024);
  const { marca, fuso } = catalogo;
  const direto = turno ? undefined : barber;
  const opcoes = useMemo(
    () => (direto ? catalogo.opcoes.filter((o) => o.profissional === direto) : catalogo.opcoes),
    [catalogo.opcoes, direto],
  );
  const [idServico, escolherServico] = useState(service);
  const [escolhido, escolherProfissional] = useState<{ slug: string; turno?: string } | null>(
    barber && catalogo.opcoes.some((o) => o.profissional === barber)
      ? { slug: barber, turno }
      : null,
  );
  const diaInicial = day && day >= catalogo.inicio && day <= catalogo.fim ? day : catalogo.inicio;
  const [dia, definirDia] = useState(diaInicial);
  const [hora, definirHora] = useState(diaInicial === day ? time : undefined);
  const [servicoAberto, abrirServico] = useState(!time);
  const [equipeAberta, abrirEquipe] = useState(!time);
  const regras = useRegrasAgenda(marca.id, escolhido?.slug);
  const permite = regras.data?.manual === false;
  const vez = useVezAgenda(marca.id, idServico, dia, permite && !direto && !escolhido);
  const indicacao = permite && !escolhido && !direto ? vez.data : null;
  const profissional =
    escolhido && (!escolhido.turno || permite) ? escolhido.slug : indicacao?.slug;
  const turnoAtual = permite ? (escolhido?.turno ?? indicacao?.turno) : undefined;
  const equipe = Array.from(new Map(opcoes.map((o) => [o.profissional, o])).values());
  const membros = equipe.map((o, index) => ({
    index,
    member: { id: o.profissional, display_name: o.pessoa, avatar_url: o.foto, bio: o.bio },
  }));
  const opcoesServico = profissional
    ? opcoes.filter((o) => o.profissional === profissional)
    : opcoes;
  const servicos = Array.from(
    new Map(
      opcoesServico.map((o) => [
        o.servico,
        {
          id: o.servico,
          name: o.nome,
          description: o.descricao,
          icon: profissional ? (o.icone_profissional ?? o.icone) : o.icone,
        },
      ]),
    ).values(),
  );
  // Um horário anunciado no perfil representa a duração mínima publicada daquele profissional.
  const servicoDoHorario =
    direto && time ? [...opcoesServico].sort((a, b) => a.duracao - b.duracao)[0]?.servico : null;
  const servico = servicos.find(
    (s) => s.id === (idServico ?? servicoDoHorario ?? regras.data?.servico),
  );
  const escolha = opcoesServico.find(
    (o) => o.servico === servico?.id && o.profissional === profissional,
  );
  const tocouServico = Boolean(idServico || servicoDoHorario);
  const tocouEquipe = Boolean(escolhido);
  const datas = useMemo(() => {
    const dias: string[] = [];
    for (let d = catalogo.inicio; d <= catalogo.fim; d = shiftDateKey(d, 1)) dias.push(d);
    return dias;
  }, [catalogo.inicio, catalogo.fim]);
  const fechados = useMemo(
    () => catalogo.fechados && new Set(catalogo.fechados),
    [catalogo.fechados],
  );
  const grade = useQuery({
    queryKey: ["horarios-publicos", host, servico?.id, profissional, dia],
    enabled: Boolean(servico && profissional && dia),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("consultar_agenda_publica", {
          p_host: host,
          p_servico: servico!.id,
          p_profissional: profissional!,
          p_dia: dia,
        })
        .abortSignal(signal);
      if (error || !Array.isArray(data)) throw error ?? new Error("Horários indisponíveis");
      return data.filter((v): v is string => typeof v === "string");
    },
  });
  const horarios = useMemo(
    () => (grade.data ?? []).map((h) => shopDateTime(dia, h, fuso)),
    [grade.data, dia, fuso],
  );
  const posicao = grade.isError ? -1 : (grade.data?.indexOf(hora ?? "") ?? -1);
  const horario = horarios[posicao];
  const equipeDefinida = Boolean(profissional && (tocouEquipe || horario));
  const servicoDefinido = Boolean(servico && (tocouServico || horario));
  const destino = new URLSearchParams({ tab: "agendar", shop: loja });
  if (servico) destino.set("service", servico.id);
  if (profissional) {
    if (turnoAtual) destino.set("turno", turnoAtual);
    destino.set("barber", profissional);
    destino.set("day", dia);
    if (horario && hora) destino.set("time", hora);
  }
  const acesso = { shop: loja, next: "/app?" + destino };
  const estilo = brandVariables(
    marca.primary_color,
    marca.accent_color,
    marca.font_family,
    marca.custom_font_url,
    marca.header_font_weight,
    marca.header_font_style,
    catalogo.cantos,
  );
  const dinheiro = (valor: number) =>
    (valor / 100).toLocaleString(intlLocale, {
      style: "currency",
      currency: "BRL",
      currencyDisplay: "narrowSymbol",
    });
  function termos(id: string) {
    const opcao =
      opcoes.find((o) => o.servico === id && o.profissional === profissional) ??
      opcoes.find((o) => o.servico === id)!;
    return { price_cents: opcao.preco, duration_minutes: opcao.duracao };
  }
  const indiceMembro = equipe.findIndex((o) => o.profissional === profissional);
  const quando = horario
    ? formatShopDate(
        horario,
        fuso,
        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
        intlLocale,
      )
    : t("booking.chooseTime");
  return (
    <WorkspaceFrame
      className={`arena-workspace customer-workspace agenda-visitante bg-background text-foreground font-sans selection:bg-primary/20 ${brandFontScopeClass(marca.font_scope)} ${brandCornerClass(catalogo.cantos)} ${marca.floating_chrome ? "brand-chrome-floating" : ""}`}
      style={estilo as CSSProperties}
    >
      <BrandRootVariables vars={estilo} />
      <PublicBrandFontFace shopId={marca.id} url={marca.custom_font_url} />
      <header className="workspace-header-grid brand-header sticky top-0 z-30 bg-card border-b border-border/50 p-4 flex items-center justify-between gap-2">
        <a href="/" className="flex min-w-0 flex-1 items-center pl-[4.5rem]">
          <span
            className="brand-header-logo-wrap quadro-logo-loja"
            style={
              marca.logo_background_color
                ? { backgroundColor: marca.logo_background_color }
                : undefined
            }
          >
            {marca.logo_url ? (
              <img src={marca.logo_url} alt="" />
            ) : (
              <SeloBarbearia lojaId={marca.id} tema={marca} nome={marca.nome} tamanho={44} />
            )}
          </span>
          <div className="@container flex min-w-0 flex-1 flex-col justify-center">
            <h1 className="brand-header-title line-clamp-2 text-sm font-bold tracking-tight leading-tight">
              {marca.nome}
            </h1>
            {marca.tagline && (
              <p className="mt-1 hidden truncate text-[11px] font-medium text-primary @min-[5.5rem]:block">
                {marca.tagline}
              </p>
            )}
          </div>
        </a>
        <div className="workspace-header-actions flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle className="max-[359px]:hidden" />
          <Link className="action-button" to="/auth" search={acesso}>
            <LogIn className="size-4" aria-hidden />
            {t("auth.submit.signin")}
          </Link>
        </div>
      </header>
      <main className="p-4 max-w-xl mx-auto customer-main-wide">
        <div className="mb-panel space-y-5">
          <div className="workspace-section-title app-section-title">
            <WorkspaceHeading>
              <Calendar />
              <h2>{t("booking.title")}</h2>
            </WorkspaceHeading>
          </div>
          {!opcoes.length ? (
            <EmptyState variant="plain" title={t("booking.noServices")} />
          ) : (
            <div className="customer-booking-layout grid grid-cols-[minmax(0,1fr)] items-start gap-4 tablet:gap-6 pc:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="booking-workspace-content min-w-0 space-y-4">
                <div className="customer-booking-choices space-y-4 tablet:grid tablet:grid-cols-2 tablet:items-start tablet:gap-4 tablet:space-y-0">
                  <StepCard
                    id="booking-step-staff"
                    index={1}
                    title={t("booking.staff")}
                    state={equipeDefinida ? "done" : "current"}
                    aside={
                      profissional && !direto && !expandida && !equipeAberta ? (
                        <ChangeButton
                          label={t("booking.changeStaff")}
                          onClick={() => abrirEquipe(true)}
                        />
                      ) : null
                    }
                  >
                    {indiceMembro >= 0 && (direto || (!expandida && !equipeAberta)) ? (
                      <StaffSummary
                        member={membros[indiceMembro].member}
                        locked={Boolean(direto)}
                      />
                    ) : (
                      <StaffChoices
                        choices={membros}
                        selectedIndex={indiceMembro}
                        view={expandida ? "list" : "grid"}
                        anyOption={false}
                        anyActive={false}
                        favoriteId={null}
                        suggested={Boolean(turnoAtual)}
                        onPick={(i) => {
                          if (equipe[i].profissional !== profissional) definirHora(undefined);
                          const slug = equipe[i].profissional;
                          escolherProfissional({
                            slug,
                            turno: slug === profissional ? turnoAtual : undefined,
                          });
                          if (
                            idServico &&
                            !opcoes.some((o) => o.profissional === slug && o.servico === idServico)
                          )
                            escolherServico(undefined);
                          abrirServico(true);
                          abrirEquipe(false);
                        }}
                      />
                    )}
                  </StepCard>
                  <StepCard
                    id="booking-step-service"
                    index={2}
                    title={t("booking.service")}
                    state={servicoDefinido ? "done" : equipeDefinida ? "current" : "upcoming"}
                    aside={
                      servico && !expandida && !servicoAberto ? (
                        <ChangeButton
                          label={t("booking.change")}
                          onClick={() => abrirServico(true)}
                        />
                      ) : null
                    }
                  >
                    {servico && !expandida && !servicoAberto ? (
                      <ServiceSummary
                        service={servico}
                        terms={termos(servico.id)}
                        formatMoney={dinheiro}
                      />
                    ) : (
                      <ServiceChoices
                        services={servicos}
                        selectedIndex={servico ? servicos.indexOf(servico) : -1}
                        view="list"
                        termsFor={(s) => termos(s.id)}
                        formatMoney={dinheiro}
                        suggested={Boolean(
                          !tocouServico && servico && regras.data?.servico === servico.id,
                        )}
                        onPick={(i) => {
                          const id = servicos[i].id;
                          if (id !== servico?.id) definirHora(undefined);
                          escolherServico(id);
                          abrirServico(false);
                        }}
                      />
                    )}
                  </StepCard>
                </div>
                <StepCard
                  id="booking-step-when"
                  index={3}
                  title={t("booking.step.when")}
                  state={
                    horario ? "done" : equipeDefinida && servicoDefinido ? "current" : "upcoming"
                  }
                >
                  <BookingDateChoices
                    expandedBooking={expandida}
                    bookingDayKeys={datas}
                    selectedDay={dia}
                    shopTimeZone={fuso}
                    closedWeekdays={fechados}
                    pickDay={(d) => {
                      if (d !== dia) definirHora(undefined);
                      definirDia(d);
                    }}
                  >
                    <TimeGrid
                      state={
                        !servico || !profissional
                          ? "needChoice"
                          : grade.isError
                            ? "error"
                            : grade.isPending
                              ? "loading"
                              : horarios.length
                                ? "ready"
                                : "empty"
                      }
                      onRetry={() => void grade.refetch()}
                      slots={horarios}
                      selectedIso={horario?.toISOString() ?? null}
                      onSelect={(iso) => {
                        if (profissional)
                          escolherProfissional({ slug: profissional, turno: turnoAtual });
                        if (servico) escolherServico(servico.id);
                        definirHora(
                          grade.data?.[horarios.findIndex((h) => h.toISOString() === iso)],
                        );
                        abrirServico(false);
                        abrirEquipe(false);
                      }}
                      timeZone={fuso}
                      mayOpen={[]}
                      empty={{ closed: fechados?.has(weekdayForDateKey(dia)) ?? false }}
                    />
                  </BookingDateChoices>
                </StepCard>
                {!resumoLateral && (
                  <StepCard
                    id="booking-step-review"
                    index={4}
                    title={t("booking.step.review")}
                    state={horario ? "current" : "upcoming"}
                  >
                    {horario && escolha && servico ? (
                      <div className="space-y-2 rounded-2xl border border-border bg-background/60 p-3">
                        <AppointmentTicket
                          variant="mini"
                          data={{
                            startsAt: horario.toISOString(),
                            serviceName: servico.name,
                            serviceIcon: servico.icon,
                            staffName: escolha.pessoa,
                            staffId: profissional,
                            staffPhoto: escolha.foto,
                          }}
                          now={new Date()}
                          timeZone={fuso}
                        />
                        <p className="flex items-center justify-between border-t border-border pt-2 text-sm">
                          <span>{t("booking.total")}</span>
                          <strong>{dinheiro(escolha.preco)}</strong>
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("booking.chooseTime")}</p>
                    )}
                  </StepCard>
                )}
              </div>
              <BookingSummaryBar
                pills={[
                  {
                    key: "servico",
                    icon: Scissors,
                    label: servico?.name ?? t("booking.service"),
                    pending: !servico,
                  },
                  {
                    key: "equipe",
                    icon: User,
                    label: membros[indiceMembro]?.member.display_name ?? t("booking.staff"),
                    pending: !profissional,
                  },
                  {
                    key: "quando",
                    icon: CalendarDays,
                    label: quando,
                    pending: !horario,
                    lead: true,
                  },
                ]}
                step={{
                  index: 4,
                  state: horario ? "current" : "upcoming",
                  title: t("booking.step.review"),
                }}
                price={escolha ? dinheiro(escolha.preco) : null}
                buttonLabel={t("rapido.entrarConfirmar")}
                buttonIcon={LogIn}
                ready={Boolean(horario && escolha)}
                busy={false}
                onConfirm={() => {
                  if (horario) void navigate({ to: "/auth", search: acesso });
                }}
              />
            </div>
          )}
        </div>
      </main>
    </WorkspaceFrame>
  );
}
