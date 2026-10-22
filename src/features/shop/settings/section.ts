import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const SETTINGS_SECTIONS = [
  "aparencia",
  "agendamento",
  "pontos",
  "avisos",
  "enderecos",
  "perfil",
  "equipe",
  "idioma",
  "conta",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/**
 * Marca, no histórico, a entrada criada ao abrir uma seção ou um ajuste. Fechar pela seta volta
 * uma entrada (como o Voltar do celular) em vez de trocar o endereço por cima: trocar deixava duas
 * entradas iguais e o Voltar precisava de dois toques (corrigido em 16/10/2026).
 */
const SECTION_MARK = "mbSettingsSection";
const ITEM_MARK = "mbSettingsItem";

/**
 * Volta pelo histórico pedida por aqui e ainda não concluída. Uma volta por vez: trocar de loja
 * com uma seção aberta fechava a seção (uma volta) e saía da aba (outra), e as duas juntas tiravam
 * a pessoa do painel. Enquanto ela não chega, nada de trocar o endereço por cima: o TanStack
 * intercepta pushState/replaceState e renderiza, gastando o "não restaurar a rolagem" pedido para
 * a volta (revisão de 16/10/2026).
 */
let backPending = false;
let backTimer: number | undefined;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    backPending = false;
  });
}

function goBack(steps: number, router: { resetNextScroll: boolean }) {
  if (backPending) return;
  backPending = true;
  // Reserva: se o navegador não mandar o popstate, libera depois de um tempo.
  window.clearTimeout(backTimer);
  backTimer = window.setTimeout(() => {
    backPending = false;
  }, 1500);
  // A posição da tela é a do useScrollPerScreen, não a que o roteador guardou para a entrada.
  router.resetNextScroll = false;
  window.history.go(-steps);
}

function pushedBy(mark: string): boolean {
  if (typeof window === "undefined") return false;
  const state = window.history.state as Record<string, unknown> | null;
  return Boolean(state && state[mark]);
}

/**
 * Estado da entrada nova: mantém as marcas de baixo (a seção segue marcada com um ajuste por cima)
 * e ganha chave e posição próprias do roteador, como num `push` dele. Copiar a chave da lista fazia
 * o TanStack Router tratar as duas como a mesma página e devolver a rolagem de uma na outra.
 */
function pushedState(mark: string) {
  const state = (window.history.state ?? {}) as Record<string, unknown>;
  const key = Math.random().toString(36).slice(2, 10);
  const index = typeof state.__TSR_index === "number" ? { __TSR_index: state.__TSR_index + 1 } : {};
  return { ...state, ...index, key, __TSR_key: key, [mark]: true };
}

/**
 * Fechar por cima da mesma entrada (seção aberta por link direto, ex.: a volta do Google em
 * `?secao=avisos`): chave nova do roteador, senão ele devolve à lista a rolagem da subtela.
 */
function closedState() {
  const state = (window.history.state ?? {}) as Record<string, unknown>;
  const key = Math.random().toString(36).slice(2, 10);
  return { ...state, key, __TSR_key: key };
}

/**
 * No painel quem rola é o <main> (a janela fica parada, por isso `window.scrollTo` não fazia nada).
 * Fora do painel, a própria página.
 */
function scroller(): Element | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(".arena-workspace > main") ?? document.scrollingElement;
}

/**
 * Tela aberta por cima de uma lista: abre do topo (título e seta à vista) e, ao voltar pela seta,
 * pelo Voltar do celular ou por um atalho, a lista reaparece onde estava (corrigido em 16/10/2026).
 * Na tela: `null` é a lista; `undefined`, nada dela (outra aba ou outra subtela). Devolve a função
 * que guarda a posição da lista: roda antes da troca, porque depois o navegador já cortou a rolagem.
 */
function useScrollPerScreen(open: string | null, active: boolean) {
  const shown = useRef<string | null | undefined>(active ? open : undefined);
  const listTop = useRef(0);
  useLayoutEffect(() => {
    const before = shown.current;
    const current = active ? open : undefined;
    shown.current = current;
    if (current === undefined || current === before) return;
    const box = scroller();
    if (!box) return;
    if (current !== null) box.scrollTop = 0;
    else if (before !== undefined) box.scrollTop = listTop.current;
  }, [open, active]);
  return useCallback(() => {
    if (shown.current === null) listTop.current = scroller()?.scrollTop ?? 0;
  }, []);
}

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function readSectionFromUrl(): SettingsSection | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("secao");
  return isSection(value) ? value : null;
}

function writeSectionToUrl(section: SettingsSection | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  if (section) url.searchParams.set("secao", section);
  else url.searchParams.delete("secao");
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    return;
  }
  if (mode === "push") {
    window.history.pushState(pushedState(SECTION_MARK), "", next);
  } else {
    window.history.replaceState(section ? window.history.state : closedState(), "", next);
  }
}

/** Subtela aberta em Ajustes, guardada em `?secao=` para o botão Voltar do celular funcionar. */
export function useSettingsSection(active: boolean) {
  const router = useRouter();
  const [section, setSectionState] = useState<SettingsSection | null>(() => readSectionFromUrl());
  const rememberList = useScrollPerScreen(section, active);

  useEffect(() => {
    if (!active) {
      // Ao sair da aba Ajustes, volta ao menu: estado e URL ficam em sincronia e, ao retornar, o
      // Voltar do celular continua levando à lista de ajustes. Seção aberta por um toque: volta as
      // entradas que ela criou (trocar por cima deixava entradas que o Voltar percorria sem mudar
      // nada), sem a rolagem que o roteador guardou para a lista vazar para a aba nova.
      setSectionState(null);
      if (pushedBy(SECTION_MARK) && readSectionFromUrl()) {
        goBack(pushedBy(ITEM_MARK) && readItemFromUrl() ? 2 : 1, router);
      } else if (!backPending) {
        writeSectionToUrl(null, "replace");
      }
      return;
    }
    const onPop = () => setSectionState(readSectionFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [active, router]);

  const setSection = useCallback(
    (next: SettingsSection | null) => {
      rememberList();
      setSectionState(next);
      if (next === null && pushedBy(SECTION_MARK) && readSectionFromUrl()) {
        // Com um ajuste aberto por cima (entrada própria), volta as duas entradas.
        goBack(pushedBy(ITEM_MARK) && readItemFromUrl() ? 2 : 1, router);
      } else if (!backPending) {
        writeSectionToUrl(next, next ? "push" : "replace");
      }
    },
    [rememberList, router],
  );

  return [section, setSection] as const;
}

export function readItemFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("item");
  return value && /^[a-z0-9-]{1,40}$/.test(value) ? value : null;
}

/**
 * Quem escuta o `?item=` mudar por fora do próprio `useSettingsItem` (o trilho do Agendamento no
 * computador, montado pelo SettingsHub, troca o ajuste aberto sem ter o `setItem` do ShopShell).
 */
const itemListeners = new Set<() => void>();

/**
 * Abre (ou troca) o ajuste aberto dentro de uma subtela a partir de fora do hook: grava `?item=`
 * e avisa cada `useSettingsItem` ativo para reler o endereço. `replace` não cria entrada no
 * histórico (trocar de ajuste no trilho lado a lado não deve acumular Voltar).
 */
export function openSettingsItem(item: string | null, mode: "push" | "replace" = "replace") {
  if (typeof window === "undefined" || backPending) return;
  writeItemToUrl(item, mode);
  itemListeners.forEach((listener) => listener());
}

function writeItemToUrl(item: string | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  if (item) url.searchParams.set("item", item);
  else url.searchParams.delete("item");
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    return;
  }
  if (mode === "push") {
    window.history.pushState(pushedState(ITEM_MARK), "", next);
  } else {
    window.history.replaceState(item ? window.history.state : closedState(), "", next);
  }
}

/**
 * Um ajuste aberto dentro de uma subtela (ex.: Agendamento → "Fila de espera"), guardado em
 * `?item=`: a subtela mostra a lista de ajustes e cada um abre sozinho, sem uma página longa com
 * todos os cartões abertos. O Voltar do celular fecha o ajuste e volta à lista.
 */
export function useSettingsItem(section: SettingsSection | null, owner: SettingsSection) {
  const router = useRouter();
  const active = section === owner;
  const [item, setItemState] = useState<string | null>(() => (active ? readItemFromUrl() : null));
  const rememberList = useScrollPerScreen(item, active);

  useEffect(() => {
    if (!active) {
      setItemState(null);
      // Com uma volta a caminho (a seção fechou), o endereço muda sozinho.
      if (!backPending && readItemFromUrl()) writeItemToUrl(null, "replace");
      return;
    }
    setItemState(readItemFromUrl());
    const onPop = () => setItemState(readItemFromUrl());
    window.addEventListener("popstate", onPop);
    itemListeners.add(onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      itemListeners.delete(onPop);
    };
  }, [active]);

  const setItem = useCallback(
    (next: string | null) => {
      rememberList();
      setItemState(next);
      if (next === null && pushedBy(ITEM_MARK) && readItemFromUrl()) {
        goBack(1, router);
      } else if (!backPending) {
        writeItemToUrl(next, next ? "push" : "replace");
      }
    },
    [rememberList, router],
  );

  return [item, setItem] as const;
}
