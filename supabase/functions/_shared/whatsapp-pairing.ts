/** Pareamento por telefone. Recomeço é explícito e confere novamente o estado da sessão. */
export type EvolutionCall = (path: string, init?: RequestInit) => Promise<unknown>;
export type PairingResult = {
  status: "open" | "connecting" | "disconnected";
  pairing_code: string | null;
  restart_required?: boolean;
};

export function pairingPhone(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function pairingCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { pairingCode?: unknown; qrcode?: { pairingCode?: unknown } };
  const value = row.pairingCode ?? row.qrcode?.pairingCode;
  if (typeof value !== "string") return null;
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}

export function evolutionInstanceMissing(error: unknown): boolean {
  return /does not exist|not found|404/i.test(error instanceof Error ? error.message : "");
}

/** `code` é o conteúdo textual do QR; não é uma imagem em base64. */
export function evolutionQr(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { base64?: unknown; qrcode?: { base64?: unknown } };
  const raw = row.base64 ?? row.qrcode?.base64;
  if (typeof raw !== "string") return null;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(raw)) return raw;
  if (/^(iVBOR|\/9j\/|UklGR)[A-Za-z0-9+/=\s]+$/.test(raw)) {
    const type = raw.startsWith("/9j/") ? "jpeg" : raw.startsWith("UklGR") ? "webp" : "png";
    return `data:image/${type};base64,${raw}`;
  }
  return null;
}

export async function connectWithPairingCode(
  call: EvolutionCall,
  instance: string,
  phone: string,
  action: "connect" | "pairing-status" | "restart-pairing",
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<PairingResult> {
  const number = pairingPhone(phone);
  if (!number) throw new Error("PAIRING_PHONE_INVALID");
  const path = encodeURIComponent(instance);
  const readState = async (): Promise<string> => {
    try {
      const result = (await call(`/instance/connectionState/${path}`, { method: "GET" })) as {
        instance?: { instanceName?: string; state?: string };
        state?: string;
      };
      // A Evolution 2.3.7 também responde 200 com instanceName, sem state, quando ausente.
      if (result?.instance?.instanceName === instance && result.instance.state === undefined)
        return "missing";
      return result?.instance?.state ?? result?.state ?? "unknown";
    } catch (error) {
      if (evolutionInstanceMissing(error)) return "missing";
      throw new Error("PAIRING_UNAVAILABLE");
    }
  };
  let state = await readState();
  if (state === "open") return { status: "open", pairing_code: null };
  if (action === "pairing-status" && ["missing", "close", "disconnected"].includes(state)) {
    return { status: "disconnected", pairing_code: null };
  }
  if (state === "connecting" && action === "connect") {
    // "Conectando" não prova um aparelho vinculado. Oferece saída explícita, sem reset automático.
    return { status: "connecting", pairing_code: null, restart_required: true };
  }
  if (state === "connecting" && action === "restart-pairing") {
    // Esta ação vem do botão específico, após a pessoa escolher recomeçar a preparação.
    // Reconfere imediatamente antes do logout; nunca manda delete/restart de instância.
    state = await readState();
    if (state === "open") return { status: "open", pairing_code: null };
    if (state === "connecting") {
      try {
        await call(`/instance/logout/${path}`, { method: "DELETE" });
      } catch {
        // Uma falha pode ocorrer depois de encerrar a tentativa. Só o estado permite continuar.
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        state = await readState();
        if (state === "open") return { status: "open", pairing_code: null };
        if (["missing", "close", "disconnected"].includes(state)) break;
        if (attempt < 3) await pause(500);
      }
      if (!["missing", "close", "disconnected"].includes(state))
        throw new Error("PAIRING_RESTART_UNAVAILABLE");
    }
  }
  if (action !== "pairing-status" && !["missing", "close", "disconnected"].includes(state))
    throw new Error("PAIRING_UNAVAILABLE");
  if (action === "pairing-status" && state !== "connecting") {
    throw new Error("PAIRING_UNAVAILABLE");
  }
  try {
    if (state === "missing") {
      const created = await call("/instance/create", {
        method: "POST",
        body: JSON.stringify({
          instanceName: instance,
          integration: "WHATSAPP-BAILEYS",
          number,
          qrcode: true,
        }),
      });
      const code = pairingCode(created);
      if (code) return { status: "connecting", pairing_code: code };
    }
    // A Evolution pode devolver o primeiro resultado antes de terminar de gerar o código.
    for (let attempt = 0; attempt < (action !== "pairing-status" ? 3 : 1); attempt++) {
      const result = await call(`/instance/connect/${path}?number=${number}`, { method: "GET" });
      const current = result as { instance?: { state?: string }; state?: string; error?: unknown };
      if (current?.error) throw new Error("PAIRING_UNAVAILABLE");
      if ((current?.instance?.state ?? current?.state) === "open")
        return { status: "open", pairing_code: null };
      const code = pairingCode(result);
      if (code) return { status: "connecting", pairing_code: code };
      if (action !== "pairing-status" && attempt < 2) await pause(750);
    }
    return { status: "connecting", pairing_code: null };
  } catch {
    // A resposta remota pode conter informações da sessão; não a devolve nem registra.
    throw new Error("PAIRING_UNAVAILABLE");
  }
}
