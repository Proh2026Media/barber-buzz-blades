import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  armDemoGuard,
  DemoNetworkBlockedError,
  demoBlocksRequest,
  disarmDemoGuard,
  guardedFetch,
  requestUrl,
} from "./demo-guard.ts";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const REST = "https://banco.exemplo.co/rest/v1/services?barbershop_id=eq.x";
const RPC = "https://banco.exemplo.co/rest/v1/rpc/get_team_schedule";
const STORAGE = "https://banco.exemplo.co/storage/v1/object/fotos/a.png";
const FUNCTIONS = "https://banco.exemplo.co/functions/v1/invite-shop-admin";
const AUTH = "https://banco.exemplo.co/auth/v1/token?grant_type=refresh_token";

test("demonstração aberta: nenhuma chamada ao banco sai do aparelho", () => {
  armDemoGuard();
  try {
    for (const url of [REST, RPC, STORAGE, FUNCTIONS]) {
      assert.equal(demoBlocksRequest(url, "/demo"), true, url);
    }
    // Só a sessão continua viva (renovar o acesso não lê nem grava dados da loja).
    assert.equal(demoBlocksRequest(AUTH, "/demo"), false);
    // Ao sair para a plataforma, a checagem de acesso da página seguinte lê a sessão.
    assert.equal(demoBlocksRequest(REST, "/platform"), false);
  } finally {
    disarmDemoGuard();
  }
  assert.equal(demoBlocksRequest(REST, "/demo"), false);
});

test("guardedFetch barra as funções na demonstração sem tocar a rede", async () => {
  const original = globalThis.fetch;
  const originalError = console.error;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("ok");
  }) as typeof fetch;
  console.error = () => {};
  const page = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { location: { pathname: "/demo" } };
  armDemoGuard();
  try {
    await assert.rejects(guardedFetch(FUNCTIONS), DemoNetworkBlockedError);
    assert.equal(calls, 0);
    disarmDemoGuard();
    await guardedFetch(FUNCTIONS);
    assert.equal(calls, 1);
  } finally {
    disarmDemoGuard();
    globalThis.fetch = original;
    console.error = originalError;
    (globalThis as { window?: unknown }).window = page;
  }
});

test("o erro da trava diz o que foi barrado", () => {
  const error = new DemoNetworkBlockedError(RPC);
  assert.match(error.message, /demonstração/);
  assert.match(error.message, /get_team_schedule/);
  assert.equal(requestUrl(new URL(REST)), REST);
  assert.equal(requestUrl(REST), REST);
});

test("o cliente do banco passa toda chamada pela trava da demonstração", () => {
  const client = readFileSync(join(SRC, "integrations/supabase/client.ts"), "utf8");
  assert.match(client, /demoBlocksRequest\(/);
  assert.match(client, /blockedDemoResponse\(/);
  const workspace = readFileSync(join(SRC, "features/demo/DemoWorkspace.tsx"), "utf8");
  assert.match(workspace, /useDemoNetworkGuard\(\)/);
});

/**
 * Componentes que leem o banco e nunca aparecem dentro da demonstração (a tela que os mostra
 * já os esconde quando `demo` está ligado, ou ficam em páginas fora do /demo).
 */
const OUTSIDE_DEMO = new Map<string, string>([
  ["features/auth/ChangePasswordCard.tsx", "Ajustes → Conta só fora da demonstração"],
  ["features/customer/AskShopLink.tsx", "rota /app: só sem barbearia (a demonstração tem loja)"],
  ["features/customer/NamePrompt.tsx", "rota /app"],
  ["features/customer/ReservationAccessGate.tsx", "rota /app"],
  ["features/loyalty/LoyaltyAdminPage.tsx", "rota /shop/pontos"],
  ["features/marketing/ShopLanding.tsx", "página pública"],
  ["features/platform/AccountManagersPanel.tsx", "plataforma: escondido em demoMode"],
  ["features/platform/PlatformWhatsAppCard.tsx", "plataforma: escondido em demoMode"],
  ["features/shop/ShopTeamAccessCard.tsx", "aba Equipe: só fora da demonstração"],
  ["features/shop/settings/ShopDomainCard.tsx", "Ajustes → Endereços: só fora da demonstração"],
  ["features/shop/settings/SlugRedirectsCard.tsx", "Ajustes → Endereços: só fora da demonstração"],
  ["features/shop/settings/decision-queue.ts", "contagem de decisões: só fora da demonstração"],
  ["features/shop/team.tsx", "loadTeamMembers: quem chama já confere a demonstração"],
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith("._") || name.startsWith(".")) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

/**
 * Componentes que não chamam useDemo() mas recebem da tela um sinal de demonstração e o usam
 * numa condição antes de ir ao banco. A expressão confere essa condição no código (sem
 * comentários), para um "demonstração" solto num comentário não bastar.
 */
const DEMO_BY_PROP = new Map<string, RegExp>([
  ["features/customer/NamePrompt.tsx", /if \(disabled\) return/],
  ["features/customer/WhatsappConfirmBanner.tsx", /if \(disabled\) return/],
  ["features/customer/WhatsappProfileCard.tsx", /if \(demo\)/],
  ["features/customer/booking/useClosedWeekdays.ts", /if \(demoHours\)/],
  ["features/demo/DemoWorkspace.tsx", /useDemoNetworkGuard\(\);/],
  ["features/legal/TermsUpdateGate.tsx", /if \(disabled\) return/],
  ["features/platform/InviteMemberDialog.tsx", /if \(demoMode\)/],
  ["features/platform/PlatformShell.tsx", /if \(demoMode\) return null/],
  ["features/shop/ShopPermissionsMatrix.tsx", /if \(demo\)/],
  ["features/shop/catalog/useCatalogExtras.ts", /if \(!active \|\| !shopId \|\| demo\)/],
  ["features/shop/hours/usePendingHours.ts", /if \(!enabled \|\| !shopId\) return/],
  ["features/shop/settings/useSettingsSignals.ts", /if \(!active \|\| demo \|\| !shopId\) return/],
]);

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("todo componente que lê o banco sabe da demonstração (ou nunca aparece nela)", () => {
  const readers = walk(join(SRC, "features"))
    .filter((file) => readFileSync(file, "utf8").includes("@/integrations/supabase/client"))
    .map((file) => relative(SRC, file).split("\\").join("/"));
  const offenders = readers
    .filter((file) => !OUTSIDE_DEMO.has(file))
    .filter((file) => {
      const code = withoutComments(readFileSync(join(SRC, file), "utf8"));
      if (/\buseDemo\(\)/.test(code)) return false;
      const signal = DEMO_BY_PROP.get(file);
      return !signal || !signal.test(code);
    });
  assert.deepEqual(
    offenders,
    [],
    "Estes componentes chamam o banco sem checar a demonstração. Use useDemo() e dados fictícios.",
  );
  // As listas não podem guardar arquivos que já não leem o banco.
  const stale = [...OUTSIDE_DEMO.keys(), ...DEMO_BY_PROP.keys()].filter(
    (file) => !readers.includes(file),
  );
  assert.deepEqual(stale, [], "Tire das listas os arquivos que não leem mais o banco.");
});

test("toda chamada direta às funções do banco passa pela trava (guardedFetch)", () => {
  const offenders = walk(SRC)
    .filter((file) => /\bfetch\(\s*`\$\{[^}]+\}\/functions\/v1\//.test(readFileSync(file, "utf8")))
    .map((file) => relative(SRC, file).split("\\").join("/"));
  assert.deepEqual(offenders, [], "Use guardedFetch de @/lib/demo-guard nestas chamadas.");
});
