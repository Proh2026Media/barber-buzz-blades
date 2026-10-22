/**
 * Faixas de dispositivo: a única fonte para o JavaScript decidir entre celular, tablet e
 * computador (ver docs/dispositivos-2026-10-21.md, seção 2). Os números são os mesmos das
 * variantes `tablet:` (≥ 768) e `pc:` (≥ 1280) declaradas no `@theme` de src/styles.css.
 *
 * - `useDevice()` devolve a faixa atual sem piscar na hidratação: no servidor (e na primeira
 *   renderização do cliente) vale "celular", que é o uso principal.
 * - `useViewportAtLeast(1024)` cobre o "computador compacto" (tablet deitado) dentro da faixa
 *   do tablet, onde o quadro da equipe e a ficha ao lado cabem.
 * - `deviceBootstrapScript` põe `data-dispositivo` no <html> antes da hidratação, para o CSS
 *   que precisar do atributo; o módulo mantém o atributo em dia quando a largura muda.
 */
import { useSyncExternalStore } from "react";

export const DEVICE_MIN = { tablet: 768, computador: 1280 } as const;

export type Device = "celular" | "tablet" | "computador";

const DEVICE_ATTRIBUTE = "data-dispositivo";

function queryFor(px: number) {
  return `(min-width: ${px}px)`;
}

/** Faixa pela largura em px (mesma conta do script inline e do CSS). */
export function deviceForWidth(width: number): Device {
  if (width >= DEVICE_MIN.computador) return "computador";
  if (width >= DEVICE_MIN.tablet) return "tablet";
  return "celular";
}

function canMatch() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/** Assina a mudança de uma consulta de largura; devolve a função que cancela. */
function subscribeTo(px: number, onChange: () => void) {
  if (!canMatch()) return () => {};
  const media = window.matchMedia(queryFor(px));
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function subscribeDevice(onChange: () => void) {
  const stopTablet = subscribeTo(DEVICE_MIN.tablet, onChange);
  const stopPc = subscribeTo(DEVICE_MIN.computador, onChange);
  return () => {
    stopTablet();
    stopPc();
  };
}

function readDevice(): Device {
  if (!canMatch()) return "celular";
  if (window.matchMedia(queryFor(DEVICE_MIN.computador)).matches) return "computador";
  if (window.matchMedia(queryFor(DEVICE_MIN.tablet)).matches) return "tablet";
  return "celular";
}

function serverDevice(): Device {
  return "celular";
}

/** Faixa atual: "celular" (até 767), "tablet" (768–1279) ou "computador" (1280 ou mais). */
export function useDevice(): Device {
  return useSyncExternalStore(subscribeDevice, readDevice, serverDevice);
}

const atLeastReaders = new Map<number, () => boolean>();
const atLeastSubscribers = new Map<number, (onChange: () => void) => () => void>();

function serverFalse() {
  return false;
}

/**
 * Largura mínima pelo mesmo mecanismo do `useDevice` (sem piscar), para os casos fora das três
 * faixas, como 1024 (computador compacto). No servidor vale `false`.
 */
export function useViewportAtLeast(px: number): boolean {
  let read = atLeastReaders.get(px);
  if (!read) {
    read = () => canMatch() && window.matchMedia(queryFor(px)).matches;
    atLeastReaders.set(px, read);
  }
  let subscribe = atLeastSubscribers.get(px);
  if (!subscribe) {
    subscribe = (onChange) => subscribeTo(px, onChange);
    atLeastSubscribers.set(px, subscribe);
  }
  return useSyncExternalStore(subscribe, read, serverFalse);
}

/**
 * Script inline (modelo: `themeBootstrapScript` em src/lib/theme.ts) executado antes da primeira
 * pintura: grava `data-dispositivo="celular|tablet|computador"` no <html>. Precisa bater com
 * `deviceForWidth`.
 */
export const deviceBootstrapScript = `(function(){try{var w=window.innerWidth;document.documentElement.setAttribute(${JSON.stringify(DEVICE_ATTRIBUTE)},w>=${DEVICE_MIN.computador}?"computador":w>=${DEVICE_MIN.tablet}?"tablet":"celular");}catch(e){}})();`;

/** Mantém o atributo do <html> em dia quando a largura muda (um listener só por página). */
function syncDeviceAttribute() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(DEVICE_ATTRIBUTE, readDevice());
}

if (canMatch()) {
  syncDeviceAttribute();
  subscribeDevice(syncDeviceAttribute);
}
