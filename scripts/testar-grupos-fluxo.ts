/** Executado somente pelo roteiro Python, contra container descartável e transporte fictício. */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { evolutionGroupProvider } from "../supabase/functions/_shared/evolution-groups.ts";
import {
  processCareGroup,
  recoverCareGroup,
} from "../supabase/functions/_shared/whatsapp-groups.ts";
import { handleCareGroups } from "../supabase/functions/whatsapp-groups/handler.ts";
import { fakeEvolution } from "../supabase/tests/helpers/evolution-groups.ts";

if (process.env.BC_GROUP_LOCAL_FLOW !== "barba-grupos-fluxo")
  throw new Error("Use o roteiro Python local");
const docker = process.env.BC_TEST_DOCKER!;
const root = fileURLToPath(new URL("../", import.meta.url));
function sql(statement: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      docker,
      [
        "exec",
        "-i",
        "-e",
        "PGPASSWORD=localtest",
        "barba-grupos-fluxo",
        "psql",
        "-h",
        "localhost",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    const timer = setTimeout(() => child.kill(), 30000);
    child.stdout.on("data", (b) => (out += b));
    child.stderr.on("data", (b) => (err += b));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.slice(-1500)));
    });
    child.stdin.end(statement);
  });
}
const quote = (value: unknown) =>
  value === null
    ? "null"
    : typeof value === "boolean"
      ? String(value)
      : "'" +
        (typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''") +
        "'";
const db = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (!/^[a-z_]+$/.test(name) || Object.keys(args).some((k) => !/^p_[a-z_]+$/.test(k)))
      throw new Error("RPC inválida");
    try {
      const value = await sql(
        `set role service_role;select to_jsonb(public.${name}(${Object.entries(args)
          .map(([k, v]) => `${k}=>${quote(v)}`)
          .join(",")}));`,
      );
      return { data: value ? JSON.parse(value) : null };
    } catch (error) {
      return { error };
    }
  },
};
const files = [
  "20261110230000_whatsapp_saida_protegida.sql",
  "20261111120000_grupos_atendimento.sql",
  "20261111200000_grupos_integracao_evolution.sql",
];
const migrations = await Promise.all(
  files.map((f) => readFile(root + "supabase/migrations/" + f, "utf8")),
);
await sql(
  "begin;" +
    migrations.join("\n") +
    (await readFile(root + "supabase/tests/helpers/grupos-integracao-fixture.sql", "utf8")) +
    "commit;",
);
const fixture = JSON.parse(
  await sql(
    "select row_to_json(x) from (select c.customer,c.owner,c.phone,g.id group_id,n.instance_name from wa120 c join whatsapp_care_groups g on g.customer_id=c.customer join whatsapp_group_accounts a on a.id=any(g.approved_accounts) join whatsapp_channels n on n.id=a.channel_id) x;",
  ),
);
const evo = fakeEvolution(),
  provider = evolutionGroupProvider(evo.transport, true);
const current = async () =>
  JSON.parse(await sql("select row_to_json(g) from whatsapp_care_groups g;"));
const next = async () =>
  await sql(
    "select o.id from whatsapp_care_operations o join whatsapp_care_groups g on g.id=o.group_id and g.version=o.version where o.state in ('pending','blocked') and o.started_at is null order by o.created_at desc limit 1;",
  );
const edit = async (action: string, values: unknown = {}) =>
  sql(
    `select set_config('request.jwt.claim.sub',${quote(fixture.customer)},false);select care_group_customer_update(id,version,${quote(action)},${quote(values)}::jsonb) is not null from whatsapp_care_groups;`,
  );
let checks = 0;
function check(ok: unknown, label: string) {
  assert.ok(ok, label);
  checks++;
  console.log("PASS:", label);
}
const secret = "segredo-ficticio-para-webhook-local-123456789";
async function event(kind: string, data: unknown, id: string) {
  const response = await handleCareGroups(
    new Request("https://example.invalid", {
      method: "POST",
      headers: { "x-bc-group-secret": secret },
      body: JSON.stringify({ event: kind, instance: fixture.instance_name, event_id: id, data }),
    }),
    db,
    provider,
    { service: secret, webhook: secret },
  );
  assert.equal(response.status, 200);
}
const first = await next();
const results = await Promise.all([
  processCareGroup(db, provider, first),
  processCareGroup(db, provider, first),
]);
check(
  results.includes("observed") && results.includes("blocked") && evo.state.creates === 1,
  "Banco e processador disputam uma criação única",
);
check(
  (await current()).state === "waiting_customer",
  "Configuração real do banco aguarda entrada do Cliente",
);
check(
  (
    await sql(
      `select set_config('request.jwt.claim.sub',${quote(fixture.customer)},false);select care_group_invite(id) from whatsapp_care_groups;`,
    )
  ).includes("https://chat.whatsapp.com/"),
  "Convite fica disponível somente pela RPC do Cliente",
);
evo.state.requests = [fixture.phone.slice(1) + "@s.whatsapp.net"];
await event(
  "group.join-request",
  { id: evo.groupId, participant: evo.state.requests[0] },
  "11111111-1111-4111-8111-111111111111",
);
check(
  (await processCareGroup(db, provider, await next())) === "observed" &&
    (await current()).state === "active",
  "Pedido autorizado ativa o vínculo após consulta",
);
check(
  evo.state.group.participants.some((p) => p.id === "5511777777777@s.whatsapp.net") &&
    evo.state.group.participants.filter((p) => p.admin).length === 1,
  "Equipe aprovada é comum e Plataforma mantém administração",
);
evo.state.requests = ["5511666666666@s.whatsapp.net"];
await event(
  "group.join-request",
  { id: evo.groupId, participant: evo.state.requests[0] },
  "22222222-2222-4222-8222-222222222222",
);
await processCareGroup(db, provider, await next());
check(
  !evo.state.group.participants.some((p) => p.id === "5511666666666@s.whatsapp.net"),
  "Convite vazado não admite terceiro",
);
await sql(
  `begin;update shop_members set active=false where user_id=${quote(fixture.owner)};with replacement as (insert into staff(barbershop_id,display_name,user_id,booking_slug) select shop,'Novo dono fictício',other_customer,'outro' from wa120 returning id,barbershop_id,user_id) insert into shop_members(barbershop_id,user_id,staff_id,role,ownership_percent) select barbershop_id,user_id,id,'owner',100 from replacement;commit;`,
);
check(
  (await processCareGroup(db, provider, await next())) === "observed" &&
    !evo.state.group.participants.some((p) => p.id === "5511777777777@s.whatsapp.net"),
  "Saída da equipe remove a identidade aprovada no fluxo completo",
);
evo.state.group.participants = evo.state.group.participants.filter(
  (p) => p.id !== fixture.phone.slice(1) + "@s.whatsapp.net",
);
await event(
  "group-participants.update",
  { id: evo.groupId, action: "remove", participants: [fixture.phone.slice(1) + "@s.whatsapp.net"] },
  "33333333-3333-4333-8333-333333333333",
);
check(
  (await current()).state === "customer_left" && (await current()).entry_pending === false,
  "Saída comprovada suspende imediatamente e exige nova adesão",
);
evo.state.requests = [fixture.phone.slice(1) + "@s.whatsapp.net"];
const before = evo.state.calls.length;
await event(
  "group.join-request",
  { id: evo.groupId, participant: evo.state.requests[0] },
  "44444444-4444-4444-8444-444444444444",
);
const pending = await next();
if (pending) await processCareGroup(db, provider, pending);
check(evo.state.calls.length === before, "Pedido posterior isolado não reativa o Cliente que saiu");
const accounts = (await current()).approved_accounts;
await edit("rejoin", { accept: true, accounts });
evo.state.requests = [];
check(
  (await processCareGroup(db, provider, await next())) === "observed" &&
    (await current()).state === "waiting_customer",
  "Nova adesão pode aguardar retorno sem perder o histórico",
);
check(
  (await current()).use_group === true && (await current()).notifications === false,
  "Retorno não libera fallback individual nem restaura avisos",
);
// Revogação entre leitura externa e próxima etapa deve invalidar a posse anterior.
await sql(
  "select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);select care_group_admin('review',jsonb_build_object('group_id',id,'version',version)) is not null from whatsapp_care_groups;",
);
let interrupted = false;
evo.state.before = async (route) => {
  if (route === "bcInspect" && !interrupted) {
    interrupted = true;
    await edit("close");
  }
};
check(
  (await processCareGroup(db, provider, await next())) === "paused" &&
    (await current()).state === "closed",
  "Encerramento durante consulta invalida a operação antiga",
);
evo.state.before = async () => {};
check(
  (await processCareGroup(db, provider, await next())) === "closed" &&
    (await current()).reason === "closed_confirmed",
  "Operação própria conclui limpeza do encerramento",
);
// Outra fixture simula perda de resposta sem tocar em dados externos.
await sql(
  "update whatsapp_care_operations set state='unknown',lease_until=now()-interval '1 second' where provider_creation_started;update whatsapp_care_groups set group_jid=null;",
);
check(
  (await recoverCareGroup(db, provider, first)) === "recovered" && evo.state.creates === 1,
  "Recuperação consulta diário e não repete a criação",
);
check(
  (await current()).state === "closed" && !(await current()).controls_verified,
  "Recuperação conserva revogação e não ativa o vínculo",
);
const rollback = (
  await readFile(root + "supabase/rollback/20261111120000_grupos_atendimento.sql", "utf8")
).replace(/^begin;|^commit;/gm, "");
const reversed = JSON.parse(
  await sql(
    "begin;" +
      rollback +
      `
  select jsonb_build_object('disabled',not (select enrollment_enabled from whatsapp_group_settings),
    'preserved',group_jid is not null and use_group and not controls_verified,
    'invites',(select count(*) from whatsapp_care_invites)=0) from whatsapp_care_groups;rollback;`,
  ),
);
check(
  reversed.disabled && reversed.invites,
  "Reversão existente desliga adesões e invalida convites na nº 107",
);
check(reversed.preserved, "Reversão conserva grupo e histórico sem liberar fallback individual");
console.log(`TOTAL: ${checks} PASS; PostgreSQL real e Evolution inteiramente fictícia`);
