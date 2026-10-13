#!/usr/bin/env node
/**
 * Foto de uma página do app rodando no servidor local, para conferir a tela de verdade.
 *
 *   node scripts/foto.mjs "/demo?view=owner"
 *   node scripts/foto.mjs "/demo?view=owner" --largura 1280 --escuro
 *   node scripts/foto.mjs /auth --sem-login
 *   node scripts/foto.mjs "/demo?view=owner" --passos '[{"aba":"Agenda"},{"esperar":800}]'
 *
 * Precisa do servidor local rodando: `npm run dev -- --port 8090 --host` (8090 é o padrão de
 * --base). O `npm run dev` sozinho sobe na 8080 (padrão de @lovable.dev/vite-tanstack-config);
 * nesse caso use --base http://localhost:8080.
 *
 * Simula a conta de um admin da plataforma sem barbearia (a /demo exige platform_admin) e
 * responde, com dados falsos mínimos, toda chamada ao Supabase (/auth/v1, /rest/v1,
 * /functions/v1, /storage/v1, /realtime/v1). Nenhuma requisição sai para o banco real: só o
 * servidor local e o Google Fonts passam; o resto é abortado, inclusive WebSocket (por isso o
 * Playwright precisa ser 1.48 ou mais novo). Cada caminho abre num contexto novo, com
 * armazenamento limpo; só o navegador é reaproveitado.
 *
 * Saída: uma linha JSON por foto. Código de saída 0 se a página abriu e os passos rodaram; 1 se
 * não abriu, se o servidor respondeu 400 ou mais, se o app mostrou a tela de página não
 * encontrada, se um passo falhou ou se o --avaliar deu erro. Ajuda completa: scripts/README.md.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Chave em que o cliente Supabase guarda a sessão (src/integrations/supabase/client.ts). */
const CHAVE_SESSAO = "sb-supabasebeauty-auth-token";
const PREFIXOS_SUPABASE = ["/auth/v1", "/rest/v1", "/functions/v1", "/storage/v1", "/realtime/v1"];
const HOSTS_LIBERADOS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
/** Primeira versão com context.routeWebSocket, usado para barrar o realtime do Supabase. */
const VERSAO_MINIMA_PLAYWRIGHT = "1.48.0";
/** Altura máxima da foto com --pagina-inteira quando o painel rola por dentro. */
const ALTURA_MAXIMA = 8000;

const AJUDA = `Uso: node scripts/foto.mjs <caminho> [mais caminhos...] [opções]

  <caminho>              caminho da página, ex.: "/demo?view=owner" ou "/auth"
  --base <url>           endereço do servidor local (padrão: http://localhost:8090)
  --largura <px>         padrão 390
  --altura <px>          padrão 844
  --escuro               tema escuro do aparelho (prefers-color-scheme: dark)
  --pagina-inteira       foto da página inteira, inclusive a rolagem interna dos painéis
                         (até ${ALTURA_MAXIMA} px)
  --sem-login            não simula conta (páginas públicas e /auth)
  --passos '<json>'      lista de passos, em ordem:
                           {"esperar": 1200}
                           {"aba": "Agenda"}              item da barra inferior com esse rótulo
                           {"clicar": "<seletor>"}        seletor do Playwright
                           {"papel": ["tab", "Equipe"]}   elemento com esse papel e nome acessível
                           {"digitar": ["<seletor>", "texto"]}
                           {"rolar": 600}
  --avaliar '<js>'       expressão avaliada na página; o resultado entra no relatório
  --saida <pasta>        padrão: .fotos (ignorada pelo git)
  --nome <arquivo.png>   padrão: derivado do caminho, da largura e do tema (só com um caminho)

Servidor local: npm run dev -- --port 8090 --host (8090 é o padrão de --base). O npm run dev
sozinho sobe na 8080; nesse caso use --base http://localhost:8080.

Visões da demonstração (/demo?view=…): platform, owner, equal, minority, associate, employee, customer.

Código de saída: 0 se a página abriu e os passos rodaram; 1 se não abriu, se o servidor respondeu
400 ou mais, se o app mostrou a tela de página não encontrada, se um passo falhou ou se o
--avaliar deu erro (a foto do momento é salva mesmo assim). Ajuda completa: scripts/README.md.`;

// ---------------------------------------------------------------------------------------------
// Opções
// ---------------------------------------------------------------------------------------------

function falhar(mensagem) {
  console.error(`foto: ${mensagem}`);
  process.exit(1);
}

function lerOpcoes(argv) {
  const op = {
    caminhos: [],
    base: "http://localhost:8090",
    largura: 390,
    altura: 844,
    escuro: false,
    paginaInteira: false,
    semLogin: false,
    passos: [],
    avaliar: null,
    saida: join(RAIZ, ".fotos"),
    nome: null,
  };
  const valor = (i, nome) => {
    if (i >= argv.length) falhar(`a opção ${nome} precisa de um valor`);
    return argv[i];
  };
  const numero = (texto, nome) => {
    const n = Number(texto);
    if (!Number.isInteger(n) || n < 100 || n > 8000) falhar(`${nome} inválida: ${texto}`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--ajuda":
      case "--help":
        console.log(AJUDA);
        process.exit(0);
        break;
      case "--base":
        op.base = valor(++i, a).replace(/\/+$/, "");
        break;
      case "--largura":
        op.largura = numero(valor(++i, a), "largura");
        break;
      case "--altura":
        op.altura = numero(valor(++i, a), "altura");
        break;
      case "--escuro":
        op.escuro = true;
        break;
      case "--pagina-inteira":
        op.paginaInteira = true;
        break;
      case "--sem-login":
        op.semLogin = true;
        break;
      case "--passos": {
        const texto = valor(++i, a);
        try {
          op.passos = JSON.parse(texto);
        } catch (e) {
          falhar(`--passos não é um JSON válido: ${e.message}`);
        }
        if (!Array.isArray(op.passos)) falhar("--passos precisa ser uma lista: '[{...}, {...}]'");
        break;
      }
      case "--avaliar":
        op.avaliar = valor(++i, a);
        break;
      case "--saida":
        op.saida = resolve(valor(++i, a));
        break;
      case "--nome":
        op.nome = valor(++i, a);
        if (!op.nome.endsWith(".png")) op.nome += ".png";
        break;
      default:
        if (a.startsWith("--")) falhar(`opção desconhecida: ${a} (veja --ajuda)`);
        op.caminhos.push(a);
    }
  }
  if (op.caminhos.length === 0) {
    console.error(AJUDA);
    process.exit(1);
  }
  if (op.nome && op.caminhos.length > 1) falhar("--nome só vale com um caminho por vez");
  try {
    new URL(op.base);
  } catch {
    falhar(`--base inválida: ${op.base}`);
  }
  return op;
}

function nomePadrao(caminho, op) {
  const url = new URL(caminho, "http://x");
  const partes = [
    ...url.pathname.split("/").filter(Boolean),
    ...[...url.searchParams.values()].filter(Boolean),
  ];
  const base =
    partes
      .join("-")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "inicio";
  return `${base}-${op.largura}-${op.escuro ? "escuro" : "claro"}.png`;
}

/** Caminho do arquivo para o relatório: relativo à pasta atual, ou absoluto se ficar fora dela. */
function caminhoParaMostrar(arquivo) {
  const rel = relative(process.cwd(), arquivo);
  return rel && !rel.startsWith("..") ? rel : arquivo;
}

// ---------------------------------------------------------------------------------------------
// Dicionário (chaves reais e texto da tela de página não encontrada)
// ---------------------------------------------------------------------------------------------

/**
 * Lê de src/lib/i18n/messages/ as chaves reais (pt-BR, a fonte) e o texto "Código para o suporte:
 * 404" de cada idioma (chave app.notFound.code, usada só em src/components/NotFoundPage.tsx).
 * Sem o dicionário, a ferramenta segue só com o padrão de chave e o texto em pt-BR.
 */
function lerDicionario() {
  const pasta = join(RAIZ, "src", "lib", "i18n", "messages");
  const chaves = [];
  const textos404 = new Set(["Código para o suporte: 404"]);
  let arquivos = [];
  try {
    arquivos = readdirSync(pasta).filter((a) => a.endsWith(".ts") && !a.startsWith("._"));
  } catch {
    /* sem dicionário */
  }
  for (const arquivo of arquivos) {
    let texto = "";
    try {
      texto = readFileSync(join(pasta, arquivo), "utf8");
    } catch {
      continue;
    }
    if (arquivo === "pt-BR.ts") {
      for (const m of texto.matchAll(/^\s*"([a-z][\w-]*(?:\.[\w-]+)+)"\s*:/gm)) chaves.push(m[1]);
    }
    const m404 = texto.match(/"app\.notFound\.code"\s*:\s*"([^"]+)"/);
    if (m404) textos404.add(m404[1]);
  }
  return { chaves, textos404: [...textos404] };
}

// ---------------------------------------------------------------------------------------------
// Playwright e navegador
// ---------------------------------------------------------------------------------------------

function versaoDe(pasta) {
  try {
    return JSON.parse(readFileSync(join(pasta, "package.json"), "utf8")).version ?? "0";
  } catch {
    return "0";
  }
}

function compararVersoes(a, b) {
  const pa = a.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Sobe de um arquivo do pacote até a pasta do package.json do playwright(-core). */
function pastaDoPacote(arquivo) {
  let pasta = dirname(arquivo);
  for (let i = 0; i < 8; i++) {
    try {
      const { name } = JSON.parse(readFileSync(join(pasta, "package.json"), "utf8"));
      if (name === "playwright-core" || name === "playwright") return pasta;
    } catch {
      /* sem package.json aqui: sobe um nível */
    }
    const acima = dirname(pasta);
    if (acima === pasta) break;
    pasta = acima;
  }
  return null;
}

/** Pastas playwright-core dentro das extensões do Cursor e do VS Code (a mais nova primeiro). */
function playwrightDasExtensoes() {
  const achadas = [];
  for (const editor of [".cursor", ".vscode"]) {
    const ext = join(homedir(), editor, "extensions");
    let itens = [];
    try {
      itens = readdirSync(ext);
    } catch {
      continue;
    }
    for (const item of itens) {
      for (const sub of ["dist/node_modules/playwright-core", "node_modules/playwright-core"]) {
        const pasta = join(ext, item, sub);
        if (existsSync(join(pasta, "package.json"))) {
          let mtime = 0;
          try {
            mtime = statSync(pasta).mtimeMs;
          } catch {
            /* sem data: fica por último no desempate */
          }
          achadas.push({ pasta, versao: versaoDe(pasta), mtime });
        }
      }
    }
  }
  achadas.sort((a, b) => compararVersoes(b.versao, a.versao) || b.mtime - a.mtime);
  return achadas.map((a) => a.pasta);
}

async function acharPlaywright() {
  const tentativas = [];
  // pasta: a do pacote, para conferir a versão antes de carregar.
  const tentar = (rotulo, acharPasta) => {
    try {
      const pasta = acharPasta();
      if (!pasta) throw new Error("pasta do pacote não encontrada");
      const versao = versaoDe(pasta);
      if (compararVersoes(versao, VERSAO_MINIMA_PLAYWRIGHT) < 0) {
        tentativas.push(
          `${rotulo}: versão ${versao}; precisa da ${VERSAO_MINIMA_PLAYWRIGHT} ou mais nova (bloqueio de WebSocket)`,
        );
        return null;
      }
      const mod = createRequire(join(pasta, "package.json"))(pasta);
      if (mod?.chromium) return { mod, origem: rotulo, versao };
      tentativas.push(`${rotulo}: pacote sem chromium`);
    } catch (e) {
      tentativas.push(`${rotulo}: ${String(e.message).split("\n")[0]}`);
    }
    return null;
  };

  if (process.env.PLAYWRIGHT_CORE) {
    const pasta = resolve(process.env.PLAYWRIGHT_CORE);
    const r = tentar(`PLAYWRIGHT_CORE=${process.env.PLAYWRIGHT_CORE}`, () => pasta);
    if (r) return r;
  }
  const reqProjeto = createRequire(join(RAIZ, "package.json"));
  for (const nome of ["playwright-core", "playwright"]) {
    const r = tentar(`${nome} (projeto)`, () => pastaDoPacote(reqProjeto.resolve(nome)));
    if (r) return r;
  }
  for (const pasta of playwrightDasExtensoes()) {
    const r = tentar(pasta, () => pasta);
    if (r) return r;
  }
  try {
    const global = execSync("npm root -g", { encoding: "utf8", timeout: 15000 }).trim();
    const pasta = join(global, "playwright-core");
    if (existsSync(pasta)) {
      const r = tentar(pasta, () => pasta);
      if (r) return r;
    }
  } catch {
    /* npm ausente: segue para a mensagem final */
  }

  console.error(`foto: não achei o Playwright (playwright-core ${VERSAO_MINIMA_PLAYWRIGHT} ou mais novo) nesta máquina.
Para resolver, escolha uma opção:
  1. Instale fora do projeto:  npm install -g playwright-core
  2. Ou aponte para uma pasta existente do pacote:
       PLAYWRIGHT_CORE="/caminho/para/node_modules/playwright-core" node scripts/foto.mjs ...
  (As extensões do Cursor costumam trazer uma cópia em
   ~/.cursor/extensions/<extensão>/dist/node_modules/playwright-core.)
${tentativas.length ? `Tentativas que falharam:\n  - ${tentativas.join("\n  - ")}` : ""}`);
  process.exit(1);
}

function acharNavegador() {
  const candidatos = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);
  return candidatos.find((c) => existsSync(c)) ?? null; // null: chromium do próprio Playwright
}

// ---------------------------------------------------------------------------------------------
// Supabase falso
// ---------------------------------------------------------------------------------------------

const ID_USUARIO = "00000000-0000-4000-8000-0000000000a1";
const AGORA = new Date().toISOString();

const USUARIO = {
  id: ID_USUARIO,
  aud: "authenticated",
  role: "authenticated",
  email: "admin.foto@exemplo.invalid",
  email_confirmed_at: AGORA,
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Admin da foto" },
  identities: [],
  created_at: AGORA,
  updated_at: AGORA,
  is_anonymous: false,
};

const PERFIL = {
  id: ID_USUARIO,
  full_name: "Admin da foto",
  avatar_url: null,
  whatsapp_e164: null,
  whatsapp_opt_in_at: null,
  created_at: AGORA,
  updated_at: AGORA,
};

const VINCULO = {
  id: "00000000-0000-4000-8000-0000000000b1",
  user_id: ID_USUARIO,
  barbershop_id: null,
  role: "platform_admin",
  created_at: AGORA,
  barbershop: null,
};

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function sessaoFalsa() {
  const agora = Math.floor(Date.now() / 1000);
  const exp = agora + 7 * 24 * 3600;
  const token = [
    base64url({ alg: "HS256", typ: "JWT" }),
    base64url({
      sub: ID_USUARIO,
      aud: "authenticated",
      role: "authenticated",
      email: USUARIO.email,
      iat: agora,
      exp,
      session_id: "00000000-0000-4000-8000-0000000000c1",
    }),
    "assinatura-falsa",
  ].join(".");
  return {
    access_token: token,
    refresh_token: "refresh-falso",
    token_type: "bearer",
    expires_in: exp - agora,
    expires_at: exp,
    user: USUARIO,
  };
}

const PNG_VAZIO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

function cabecalhosCors(req) {
  const origem = req.headers()["origin"] ?? "*";
  return {
    "access-control-allow-origin": origem,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
    "access-control-expose-headers": "content-range, x-supabase-api-version",
  };
}

/** Resposta falsa para uma chamada ao Supabase. */
function respostaSupabase(req, caminho, comLogin) {
  const metodo = req.method();
  const cors = cabecalhosCors(req);
  const json = (corpo, status = 200, extra = {}) => ({
    status,
    headers: { ...cors, "content-type": "application/json", ...extra },
    body: corpo === undefined ? "" : JSON.stringify(corpo),
  });
  if (metodo === "OPTIONS") return { status: 204, headers: cors, body: "" };

  if (caminho.startsWith("/auth/v1")) {
    const rota = caminho.slice("/auth/v1".length);
    if (rota.startsWith("/user")) {
      return comLogin
        ? json(USUARIO)
        : json({ code: 401, error_code: "no_authorization", msg: "sem sessão (foto)" }, 401);
    }
    if (rota.startsWith("/token")) {
      return comLogin
        ? json(sessaoFalsa())
        : json({ error: "invalid_grant", error_description: "sem sessão (foto)" }, 400);
    }
    if (rota.startsWith("/logout")) return { status: 204, headers: cors, body: "" };
    if (rota.startsWith("/settings")) {
      return json({
        external: { email: true, google: true, phone: false },
        disable_signup: false,
        mailer_autoconfirm: false,
        phone_autoconfirm: false,
        sms_provider: "",
      });
    }
    if (rota.startsWith("/.well-known/jwks.json")) return json({ keys: [] });
    if (rota.startsWith("/authorize")) {
      return {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: "<!doctype html><meta charset=utf-8><p>Login externo bloqueado pela ferramenta de foto.</p>",
      };
    }
    return json({});
  }

  if (caminho.startsWith("/rest/v1")) {
    const recurso = caminho.slice("/rest/v1/".length);
    const objeto = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const vazio = { "content-range": "*/0" };
    if (metodo === "HEAD") return { status: 200, headers: { ...cors, ...vazio }, body: "" };
    if (recurso.startsWith("rpc/")) return json([]);
    let linhas = [];
    if (comLogin && metodo === "GET") {
      if (recurso === "profiles") linhas = [PERFIL];
      if (recurso === "memberships") linhas = [VINCULO];
    }
    if (objeto) {
      return linhas.length
        ? json(linhas[0])
        : json(
            {
              code: "PGRST116",
              details: "The result contains 0 rows",
              hint: null,
              message: "JSON object requested, multiple (or no) rows returned",
            },
            406,
          );
    }
    const intervalo = linhas.length ? `0-${linhas.length - 1}/${linhas.length}` : "*/0";
    return json(linhas, metodo === "POST" ? 201 : 200, { "content-range": intervalo });
  }

  if (caminho.startsWith("/storage/v1")) {
    if (metodo === "GET" && /\/storage\/v1\/(object|render)\//.test(caminho)) {
      return { status: 200, headers: { ...cors, "content-type": "image/png" }, body: PNG_VAZIO };
    }
    return json([]);
  }

  if (caminho.startsWith("/functions/v1")) return json({});
  return json({ error: "realtime bloqueado pela ferramenta de foto" }, 404);
}

/**
 * Contexto novo do navegador para um caminho: armazenamento limpo, sessão falsa (se houver
 * login) e a rede presa ao servidor local. Cada foto usa o seu, para uma não contaminar a outra
 * (o app lembra, por exemplo, a última área usada no aparelho).
 */
async function abrirContexto(browser, op) {
  const baseUrl = new URL(op.base);
  const comLogin = !op.semLogin;
  const celular = op.largura < 768;
  const context = await browser.newContext({
    viewport: { width: op.largura, height: op.altura },
    deviceScaleFactor: 1,
    isMobile: celular,
    hasTouch: celular,
    colorScheme: op.escuro ? "dark" : "light",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    serviceWorkers: "block",
  });
  // Sem routeWebSocket o realtime do Supabase conectaria ao servidor real: não segue.
  if (typeof context.routeWebSocket !== "function") {
    await context.close().catch(() => {});
    throw new Error(
      `este Playwright não bloqueia WebSocket; use o ${VERSAO_MINIMA_PLAYWRIGHT} ou mais novo (variável PLAYWRIGHT_CORE)`,
    );
  }
  /** Endereços de fora abortados nesta foto (vão para o relatório como "bloqueadas"). */
  const bloqueadas = new Set();

  // Sessão falsa no aparelho antes de qualquer script do app (só no endereço local).
  if (comLogin) {
    await context.addInitScript(
      ({ chave, sessao, origem }) => {
        try {
          if (location.origin === origem) localStorage.setItem(chave, JSON.stringify(sessao));
        } catch {
          /* sem armazenamento: o app verá a conta como desconectada */
        }
      },
      { chave: CHAVE_SESSAO, sessao: sessaoFalsa(), origem: baseUrl.origin },
    );
  }

  // Rede: Supabase falso; liberados só o servidor local e o Google Fonts; o resto é abortado.
  await context.route("**/*", async (route) => {
    const req = route.request();
    let url;
    try {
      url = new URL(req.url());
    } catch {
      return route.abort("blockedbyclient");
    }
    if (PREFIXOS_SUPABASE.some((p) => url.pathname.startsWith(p))) {
      return route.fulfill(respostaSupabase(req, url.pathname, comLogin));
    }
    if (url.origin === baseUrl.origin || HOSTS_LIBERADOS.has(url.hostname)) {
      return route.continue();
    }
    if (bloqueadas.size < 20) bloqueadas.add(`${url.origin}${url.pathname}`.slice(0, 120));
    return route.abort("blockedbyclient");
  });
  // WebSocket: só o do servidor local (recarga do Vite) passa; o realtime do Supabase fecha.
  await context.routeWebSocket(/.*/, (ws) => {
    let host = "";
    try {
      host = new URL(ws.url()).host;
    } catch {
      /* endereço estranho: fecha */
    }
    if (host === baseUrl.host) ws.connectToServer();
    else ws.close();
  });
  return { context, bloqueadas };
}

// ---------------------------------------------------------------------------------------------
// Coleta na página
// ---------------------------------------------------------------------------------------------

/**
 * Roda no navegador: largura, conteúdo fora da tela, janelas abertas, textos com cara de chave de
 * dicionário e se a tela é a de página não encontrada.
 */
function coletarNaPagina({ chaves, textos404 }) {
  const larguraTela = window.innerWidth;
  const visivel = (el) => {
    if (!el || !(el instanceof Element)) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const curto = (t, n = 80) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const descrever = (el) => {
    const classes = (el.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean);
    return [el.tagName, ...classes.slice(0, 2)].join(".").slice(0, 70);
  };

  // --- Janelas abertas ---
  const janelas = [];
  for (const el of document.querySelectorAll(
    '[role="dialog"], [role="alertdialog"], dialog[open]',
  )) {
    if (!visivel(el)) continue;
    let nome = el.getAttribute("aria-label");
    const rotulo = el.getAttribute("aria-labelledby");
    if (!nome && rotulo) {
      nome = rotulo
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
    }
    if (!nome) nome = el.querySelector("h1, h2, h3, h4")?.textContent;
    // Sem título: a primeira linha do texto da janela.
    if (!nome) nome = (el.innerText ?? "").split("\n").find((linha) => linha.trim());
    janelas.push(curto(nome) || "(sem título)");
  }

  // --- Conteúdo fora da tela ---
  // Nos painéis o <main> rola por dentro e tem overflow-x hidden: o que passa da largura fica
  // cortado sem rolagem do documento. Por isso vale a caixa de cada elemento e de cada texto.
  const passaDaTela = (r) => r.left < -1 || r.right > larguraTela + 1;
  const decorativo = (el) =>
    Boolean(el.closest('[aria-hidden="true"], [role="presentation"], [role="none"]'));
  // Um ancestral que corta na horizontal e cabe inteiro na tela (cartão, texto com reticências,
  // carrossel) esconde o excesso antes da borda: é desenho, não estouro. Ancestrais da largura
  // toda da tela (<main>, corpo do painel) contam como a própria borda.
  const cortadoAntesDaBorda = (inicio, contarInicio) => {
    let atual = inicio;
    let candidato = contarInicio ? inicio : null;
    for (let passo = 0; passo < 200; passo++) {
      if (!candidato) {
        const posicao = getComputedStyle(atual).position;
        if (posicao === "fixed") return false;
        candidato = posicao === "absolute" ? atual.offsetParent : atual.parentElement;
      }
      if (!candidato || candidato === document.body || candidato === document.documentElement) {
        return false;
      }
      if (getComputedStyle(candidato).overflowX !== "visible") {
        const r = candidato.getBoundingClientRect();
        const larguraToda = r.left <= 1 && r.right >= larguraTela - 1;
        if (!larguraToda && r.left >= -1 && r.right <= larguraTela + 1) return true;
      }
      atual = candidato;
      candidato = null;
    }
    return false;
  };
  const fora = [];
  const marcados = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || !passaDaTela(r)) continue;
    if (!visivel(el) || decorativo(el) || cortadoAntesDaBorda(el, false)) continue;
    marcados.add(el);
    fora.push({ no: el, r });
  }

  // --- Textos: chaves cruas, tela de página não encontrada e texto fora da tela ---
  const conhecidas = new Set(chaves);
  // Domínios e arquivos não contam como chave (ex.: barbaecabelo.com.br, logo.png).
  const finaisIgnorados = new Set(
    (
      "com br net org io app dev digital pt es uk us info biz me co ai site online store shop " +
      "png jpg jpeg webp svg gif ico pdf mp4 js mjs ts tsx css html json md txt"
    ).split(" "),
  );
  // Segmentos com hífen valem (ex.: fix.cliente-app.rescheduleUnavailable). O final impede casar
  // só o começo de um endereço (myaccount.google.com/permissions) ou de um e-mail.
  const padrao = /(^|[^\w@./-])([a-z][\w-]*(?:\.[A-Za-z0-9][\w-]*)+)(?!\.?[\w@/-])/g;
  const encontradas = new Set();
  const examinar = (texto) => {
    if (!texto || !texto.includes(".")) return;
    for (const m of texto.matchAll(padrao)) {
      const token = m[2];
      if (conhecidas.has(token)) {
        encontradas.add(token); // chave real do dicionário na tela: faltou traduzir
        continue;
      }
      const partes = token.split(".");
      if (partes[0] === "www") continue; // endereço
      if (finaisIgnorados.has(partes[partes.length - 1].toLowerCase())) continue; // domínio, arquivo
      if (partes.slice(1).every((p) => /^\d+$/.test(p))) continue; // versão (v1.2.3)
      if (partes.every((p) => p.length === 1)) continue; // abreviação (e.g, i.e)
      encontradas.add(token);
    }
  };
  let naoEncontrada = false;
  const faixa = document.createRange();
  const caminhante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let no = caminhante.nextNode(); no; no = caminhante.nextNode()) {
    const pai = no.parentElement;
    if (!pai || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(pai.tagName)) continue;
    const texto = no.textContent ?? "";
    if (!texto.trim() || !visivel(pai)) continue;
    examinar(texto);
    if (textos404.includes(texto.trim())) naoEncontrada = true;
    faixa.selectNodeContents(no);
    const r = faixa.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || !passaDaTela(r)) continue;
    if (decorativo(pai) || cortadoAntesDaBorda(pai, true)) continue;
    fora.push({ no, r, texto: true });
  }
  for (const el of document.querySelectorAll("[placeholder], [aria-label], [title], [alt]")) {
    if (!visivel(el)) continue;
    for (const atributo of ["placeholder", "aria-label", "title", "alt"]) {
      examinar(el.getAttribute(atributo));
    }
  }

  // Só o elemento mais de fora de cada grupo (os filhos dele vão junto).
  const dentroDeMarcado = (no) => {
    for (let p = no.parentElement; p; p = p.parentElement) if (marcados.has(p)) return true;
    return false;
  };
  const foraDaTela = fora
    .filter((item) => !dentroDeMarcado(item.no))
    .slice(0, 10)
    .map(({ no, r, texto }) => {
      const nome = texto ? `texto "${curto(no.textContent, 40)}"` : descrever(no);
      return `${nome}: de ${Math.round(r.left)} a ${Math.round(r.right)} px`;
    });
  let esquerda = 0;
  let direita = larguraTela;
  for (const { r } of fora) {
    esquerda = Math.min(esquerda, r.left);
    direita = Math.max(direita, r.right);
  }
  const larguraConteudo = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0,
    Math.round(direita - esquerda),
  );
  return {
    larguraTela,
    larguraConteudo,
    rolagemLateral: larguraConteudo > larguraTela || foraDaTela.length > 0,
    foraDaTela,
    janelasAbertas: janelas,
    chavesCruas: [...encontradas].slice(0, 50),
    naoEncontrada,
    endereco: location.pathname + location.search,
  };
}

/**
 * Roda no navegador: quanto do maior painel com rolagem vertical interna está escondido. Na
 * primeira medida escolhe o painel (o de maior área); nas seguintes mede o mesmo.
 */
function medirRolagemInterna(escolher) {
  if (!escolher) {
    const el = window.__fotoPainel;
    return el && el.isConnected ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
  }
  let melhor = null;
  let maiorArea = 0;
  for (const el of document.body.querySelectorAll("*")) {
    const escondido = el.scrollHeight - el.clientHeight;
    if (escondido <= 1) continue;
    const st = getComputedStyle(el);
    if ((st.overflowY !== "auto" && st.overflowY !== "scroll") || st.visibility === "hidden") {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.width * r.height > maiorArea) {
      maiorArea = r.width * r.height;
      melhor = el;
    }
  }
  window.__fotoPainel = melhor;
  return melhor ? melhor.scrollHeight - melhor.clientHeight : 0;
}

/**
 * Para --pagina-inteira: o app rola dentro do <main> dos painéis (o documento não rola), então a
 * foto de página inteira do Playwright sairia do tamanho da tela. Aumenta a janela até o painel
 * mostrar tudo (no máximo ALTURA_MAXIMA). Devolve um aviso, se houver.
 */
async function aumentarParaPaginaInteira(page, op) {
  let altura = op.altura;
  let escondido = await page.evaluate(medirRolagemInterna, true);
  for (let rodada = 0; rodada < 3 && escondido > 1 && altura < ALTURA_MAXIMA; rodada++) {
    const anterior = altura;
    altura = Math.min(ALTURA_MAXIMA, altura + escondido);
    await page.setViewportSize({ width: op.largura, height: altura });
    await page.waitForTimeout(300);
    const resto = await page.evaluate(medirRolagemInterna, false);
    if (resto >= escondido) {
      // O painel não cresce com a janela (altura fixa): volta ao tamanho anterior.
      altura = anterior;
      await page.setViewportSize({ width: op.largura, height: altura });
      await page.waitForTimeout(300);
      return "o painel que rola por dentro tem altura fixa; a foto mostra só a parte visível dele";
    }
    escondido = resto;
  }
  if (escondido > 1 && altura >= ALTURA_MAXIMA) {
    return `a página inteira passa de ${ALTURA_MAXIMA} px; a foto foi cortada nessa altura`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Passos
// ---------------------------------------------------------------------------------------------

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function aguardarCalma(page, tempo = 500) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(tempo);
}

/** Espera até `ms` por pelo menos um elemento; devolve quantos achou. */
async function contarComEspera(page, alvo, ms = 3000) {
  const fim = Date.now() + ms;
  for (;;) {
    const n = await alvo.count();
    if (n > 0 || Date.now() >= fim) return n;
    await page.waitForTimeout(150);
  }
}

/** Toca no primeiro elemento; se ele existe mas não aceita o toque, explica. */
async function tocar(alvo, descricao) {
  try {
    await alvo.first().click({ timeout: 8000 });
  } catch (e) {
    const linha = String(e.message).split("\n")[0];
    if (/Timeout \d+ms exceeded/.test(linha)) {
      throw new Error(
        `${descricao} existe, mas não deu para tocar em 8 s (escondido, coberto por outro elemento ou desativado)`,
      );
    }
    throw e;
  }
}

/** Nomes acessíveis (aproximados) dos elementos com esse papel, para a mensagem de erro. */
async function nomesComPapel(page, papel) {
  try {
    const nomes = await page
      .getByRole(papel)
      .evaluateAll((els) =>
        els
          .map((el) =>
            (el.getAttribute("aria-label") || el.innerText || el.textContent || "")
              .replace(/\s+/g, " ")
              .trim(),
          )
          .filter(Boolean),
      );
    return [...new Set(nomes)].slice(0, 15);
  } catch {
    return [];
  }
}

async function executarPasso(page, passo) {
  if (!passo || typeof passo !== "object" || Array.isArray(passo)) {
    throw new Error(`passo inválido: ${JSON.stringify(passo)}`);
  }
  const [tipo] = Object.keys(passo);
  const valor = passo[tipo];
  switch (tipo) {
    case "esperar":
      await page.waitForTimeout(Number(valor) || 0);
      return;
    case "aba": {
      const botoes = page.locator("nav.app-mobile-nav button");
      await contarComEspera(page, botoes);
      const exato = botoes.filter({
        has: page.locator("span", { hasText: new RegExp(`^\\s*${escaparRegex(valor)}\\s*$`) }),
      });
      const alvo = (await exato.count()) > 0 ? exato : botoes.filter({ hasText: valor });
      if ((await alvo.count()) === 0) {
        const rotulos = await botoes.allInnerTexts().catch(() => []);
        throw new Error(
          `aba "${valor}" não está na barra inferior (rótulos: ${rotulos.map((r) => r.trim()).join(", ") || "nenhum"})`,
        );
      }
      await tocar(alvo, `a aba "${valor}"`);
      await aguardarCalma(page, 600);
      return;
    }
    case "clicar": {
      const seletor = String(valor);
      const alvo = page.locator(seletor);
      if ((await contarComEspera(page, alvo)) === 0) {
        throw new Error(`nenhum elemento para o seletor ${seletor} (esperei 3 s)`);
      }
      await tocar(alvo, `o elemento do seletor ${seletor}`);
      await aguardarCalma(page, 400);
      return;
    }
    case "papel": {
      if (!Array.isArray(valor) || valor.length < 1) {
        throw new Error('papel espera ["papel", "nome"], ex.: ["tab", "Equipe"]');
      }
      const [papel, nome] = valor;
      const alvo = page.getByRole(papel, nome === undefined ? {} : { name: String(nome) });
      const descricao = `papel "${papel}"${nome === undefined ? "" : ` e nome "${nome}"`}`;
      if ((await contarComEspera(page, alvo)) === 0) {
        const nomes = await nomesComPapel(page, papel);
        throw new Error(
          `nenhum elemento com ${descricao} (esperei 3 s; com o papel "${papel}" na tela: ${nomes.join(", ") || "nenhum"})`,
        );
      }
      await tocar(alvo, `o elemento com ${descricao}`);
      await aguardarCalma(page, 400);
      return;
    }
    case "digitar": {
      if (!Array.isArray(valor) || valor.length !== 2) {
        throw new Error('digitar espera ["<seletor>", "texto"]');
      }
      const seletor = String(valor[0]);
      const alvo = page.locator(seletor);
      if ((await contarComEspera(page, alvo)) === 0) {
        throw new Error(`nenhum campo para o seletor ${seletor} (esperei 3 s)`);
      }
      await alvo.first().fill(String(valor[1]), { timeout: 8000 });
      await page.waitForTimeout(300);
      return;
    }
    case "rolar": {
      const vp = page.viewportSize();
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.wheel(0, Number(valor) || 0);
      await page.waitForTimeout(500);
      return;
    }
    default:
      throw new Error(
        `passo desconhecido: "${tipo}" (use esperar, aba, clicar, papel, digitar ou rolar)`,
      );
  }
}

// ---------------------------------------------------------------------------------------------
// Foto
// ---------------------------------------------------------------------------------------------

/** Traduz as falhas de rede mais comuns ao abrir a página. */
function explicarFalhaAoAbrir(mensagem, op) {
  const base = new URL(op.base);
  const porta = base.port || (base.protocol === "https:" ? "443" : "80");
  if (mensagem.includes("ERR_CONNECTION_REFUSED")) {
    return `nada respondendo em ${op.base}; o servidor local está rodando? Para subir nessa porta: npm run dev -- --port ${porta} --host`;
  }
  if (mensagem.includes("ERR_UNSAFE_PORT")) {
    return `o navegador não abre a porta ${porta} por segurança; use outra porta no servidor e no --base`;
  }
  if (mensagem.includes("ERR_NAME_NOT_RESOLVED")) {
    return `o endereço ${base.hostname} não existe; confira o --base`;
  }
  if (/Timeout \d+ms exceeded/.test(mensagem)) {
    return "o servidor não respondeu a tempo; confira se ele está rodando e não travou";
  }
  return `confira o endereço (--base ${op.base}) e se o servidor local está rodando`;
}

async function fotografar({ context, bloqueadas }, caminho, op, dicionario) {
  const page = await context.newPage();
  const errosConsole = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const texto = msg.text();
    // Recursos que a própria ferramenta bloqueou não são erro da página.
    if (/ERR_BLOCKED_BY_CLIENT|ERR_FAILED/.test(texto)) return;
    errosConsole.push(texto.slice(0, 300));
  });
  page.on("pageerror", (e) => errosConsole.push(`(exceção) ${String(e.message).slice(0, 300)}`));

  const arquivo = join(op.saida, op.nome ?? nomePadrao(caminho, op));
  const relatorio = {
    foto: caminhoParaMostrar(arquivo),
    larguraTela: op.largura,
    larguraConteudo: null,
    rolagemLateral: null,
    janelasAbertas: [],
    chavesCruas: [],
    errosConsole,
    avaliacao: null,
  };
  const avisar = (texto) => {
    relatorio.aviso = relatorio.aviso ? `${relatorio.aviso}; ${texto}` : texto;
  };
  let ok = true;
  let abriu = false;

  try {
    const destino = new URL(caminho.startsWith("/") ? caminho : `/${caminho}`, op.base).href;
    let resposta;
    try {
      resposta = await page.goto(destino, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (e) {
      const linha = String(e.message).split("\n")[0];
      throw new Error(`${linha} — ${explicarFalhaAoAbrir(linha, op)}`);
    }
    if (!resposta) throw new Error("sem resposta do servidor");
    if (resposta.status() >= 400) {
      relatorio.erro = `o servidor respondeu ${resposta.status()} para ${caminho}`;
      ok = false;
    }
    abriu = true;
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(900);

    for (let i = 0; i < op.passos.length; i++) {
      try {
        await executarPasso(page, op.passos[i]);
      } catch (e) {
        relatorio.erro ??= `passo ${i + 1} ${JSON.stringify(op.passos[i])} falhou: ${String(e.message).split("\n")[0]}`;
        ok = false;
        break;
      }
    }
    if (op.passos.length) await page.waitForTimeout(300);

    if (op.avaliar) {
      try {
        relatorio.avaliacao = (await page.evaluate(op.avaliar)) ?? null;
      } catch (e) {
        const linha = String(e.message).split("\n")[0];
        relatorio.avaliacao = { erro: linha };
        relatorio.erro ??= `--avaliar falhou: ${linha}`;
        ok = false;
      }
    }
  } catch (e) {
    const linha = String(e.message).split("\n")[0];
    relatorio.erro ??= abriu
      ? `a página parou de responder (${caminho}): ${linha}`
      : `a página não abriu (${caminho}): ${linha}`;
    ok = false;
  }

  if (abriu) {
    try {
      const dados = await page.evaluate(coletarNaPagina, dicionario);
      relatorio.larguraTela = dados.larguraTela;
      relatorio.larguraConteudo = dados.larguraConteudo;
      relatorio.rolagemLateral = dados.rolagemLateral;
      if (dados.foraDaTela.length) relatorio.foraDaTela = dados.foraDaTela;
      relatorio.janelasAbertas = dados.janelasAbertas;
      relatorio.chavesCruas = dados.chavesCruas;
      relatorio.endereco = dados.endereco;
      if (!op.semLogin && dados.endereco.startsWith("/auth") && !caminho.startsWith("/auth")) {
        avisar("a página mandou para /auth: o login simulado não foi aceito");
      }
      if (dados.naoEncontrada) {
        relatorio.erro ??= `o app mostrou a tela de página não encontrada para ${caminho} (caminho errado ou página que depende de dados reais)`;
        ok = false;
      }
      mkdirSync(op.saida, { recursive: true });
      try {
        if (op.paginaInteira) {
          const aviso = await aumentarParaPaginaInteira(page, op);
          if (aviso) avisar(aviso);
        }
        await page.screenshot({
          path: arquivo,
          fullPage: op.paginaInteira,
          animations: "disabled",
          caret: "hide",
        });
      } finally {
        if (op.paginaInteira) {
          await page.setViewportSize({ width: op.largura, height: op.altura }).catch(() => {});
        }
      }
    } catch (e) {
      relatorio.erro ??= `não consegui tirar a foto: ${String(e.message).split("\n")[0]}`;
      relatorio.foto = null;
      ok = false;
    }
  } else {
    relatorio.foto = null;
  }
  await page.close().catch(() => {});
  if (bloqueadas.size) relatorio.bloqueadas = [...bloqueadas];
  return { relatorio, ok };
}

async function main() {
  const op = lerOpcoes(process.argv.slice(2));
  const { mod: playwright } = await acharPlaywright();
  const executavel = acharNavegador();
  const dicionario = lerDicionario();

  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      ...(executavel ? { executablePath: executavel } : {}),
    });
  } catch (e) {
    falhar(
      `não consegui abrir o navegador (${executavel ?? "chromium do Playwright"}): ${String(e.message).split("\n")[0]}\n` +
        'Instale o Google Chrome ou indique outro com CHROME_PATH="/caminho/do/navegador".',
    );
  }

  // O navegador é reaproveitado (é o que demora para abrir); o contexto é novo a cada caminho.
  let tudoOk = true;
  for (const caminho of op.caminhos) {
    let contexto;
    try {
      contexto = await abrirContexto(browser, op);
    } catch (e) {
      await browser.close().catch(() => {});
      falhar(String(e.message).split("\n")[0]);
    }
    const { relatorio, ok } = await fotografar(contexto, caminho, op, dicionario);
    await contexto.context.close().catch(() => {});
    console.log(JSON.stringify(relatorio));
    if (!ok) {
      tudoOk = false;
      console.error(`foto: ${relatorio.erro ?? `a foto de ${caminho} falhou`}`);
    }
  }
  await browser.close().catch(() => {});
  process.exit(tudoOk ? 0 : 1);
}

main().catch((e) => {
  console.error(`foto: erro inesperado: ${e?.stack ?? e}`);
  process.exit(1);
});
