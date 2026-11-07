import assert from "node:assert/strict";
import test from "node:test";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { observeSession } from "./observe-session.ts";

type Read = { data: { session: Session | null }; error: unknown };

function session(id = "conta-a", password = false): Session {
  return {
    access_token: "acesso-ficticio",
    refresh_token: "renovacao-ficticia",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id,
      app_metadata: {},
      user_metadata: { must_change_password: password },
      aud: "authenticated",
      created_at: "2026-11-07T00:00:00Z",
    },
  };
}

const result = (value: Session | null, error: unknown = null): Read => ({
  data: { session: value },
  error,
});

function deferred() {
  let resolve!: (value: Read) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Read>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function source(read: () => Promise<Read>) {
  let callback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
  let stops = 0;
  const order: string[] = [];
  return {
    auth: {
      getSession() {
        order.push("leitura");
        return read();
      },
      onAuthStateChange(fn: typeof callback) {
        order.push("assinatura");
        callback = fn;
        return { data: { subscription: { unsubscribe: () => stops++ } } };
      },
    },
    emit(event: AuthChangeEvent, value: Session | null) {
      callback?.(event, value);
    },
    order,
    stops: () => stops,
  };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("sessão: assina antes da leitura inicial e entrega a conta atual", async () => {
  const a = session();
  const s = source(async () => result(a));
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  await flush();
  assert.deepEqual(s.order, ["assinatura", "leitura"]);
  assert.deepEqual(seen, [a]);
  stop();
});

test("sessão: leitura sem conta mantém as janelas sem sessão", async () => {
  const s = source(async () => result(null));
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  await flush();
  assert.deepEqual(seen, [null]);
  stop();
});

test("sessão: erro de leitura não libera a conta que veio junto do erro", async () => {
  const s = source(async () => result(session(), new Error("falha fictícia")));
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  await flush();
  assert.deepEqual(seen, [null]);
  stop();
});

test("sessão: rejeição da leitura é tratada como indisponível", async () => {
  const s = source(async () => {
    throw new Error("falha fictícia");
  });
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  await flush();
  assert.deepEqual(seen, [null]);
  stop();
});

test("sessão: falha síncrona do leitor também é tratada", async () => {
  const s = source(() => {
    throw new Error("leitor indisponível");
  });
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  await flush();
  assert.deepEqual(seen, [null]);
  stop();
});

test("sessão: saída prevalece sobre resposta inicial atrasada", async () => {
  const d = deferred();
  const s = source(() => d.promise);
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  s.emit("SIGNED_OUT", null);
  d.resolve(result(session()));
  await flush();
  assert.deepEqual(seen, [null]);
  stop();
});

test("sessão: conta B prevalece sobre leitura antiga de A", async () => {
  const d = deferred();
  const s = source(() => d.promise);
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  const b = session("conta-b");
  s.emit("SIGNED_IN", b);
  d.resolve(result(session("conta-a")));
  await flush();
  assert.deepEqual(seen, [b]);
  stop();
});

test("sessão: atualização de senha é entregue mesmo com o mesmo objeto de sessão", async () => {
  const a = session("conta-a", true);
  const s = source(async () => result(a));
  const states: unknown[] = [];
  const stop = observeSession(s.auth, (value) => {
    states.push(value?.user.user_metadata.must_change_password);
  });
  await flush();
  a.user.user_metadata.must_change_password = false;
  s.emit("USER_UPDATED", a);
  assert.deepEqual(states, [true, false]);
  stop();
});

test("sessão: erro antigo não apaga um evento de entrada mais recente", async () => {
  const d = deferred();
  const s = source(() => d.promise);
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  const b = session("conta-b");
  s.emit("SIGNED_IN", b);
  d.reject(new Error("falha da leitura antiga"));
  await flush();
  assert.deepEqual(seen, [b]);
  stop();
});

test("sessão: desmontar descarta resposta e evento atrasados, sem desinscrever duas vezes", async () => {
  const d = deferred();
  const s = source(() => d.promise);
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  stop();
  stop();
  s.emit("SIGNED_IN", session("conta-b"));
  d.resolve(result(session("conta-a")));
  await flush();
  assert.deepEqual(seen, []);
  assert.equal(s.stops(), 1);
});

test("sessão: rejeição depois de desmontar não publica nem fica sem tratamento", async () => {
  const d = deferred();
  const s = source(() => d.promise);
  const seen: (Session | null)[] = [];
  const stop = observeSession(s.auth, (value) => seen.push(value));
  stop();
  d.reject(new Error("leitura encerrada"));
  await flush();
  assert.deepEqual(seen, []);
});
