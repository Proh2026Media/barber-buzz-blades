/** Banco B&C real descartável + socket Evolution fictício. Nenhum .env, VPS ou WhatsApp. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { handleCareAccess } from "../supabase/functions/whatsapp-group-access/handler.ts";
import { sendGroupLogin } from "../supabase/functions/_shared/whatsapp-group-login.ts";
import { sendGroupNotice } from "../supabase/functions/_shared/whatsapp-group-notice.ts";
import { processCareCycle } from "../supabase/functions/_shared/care-cycles.ts";
const checkout = resolve(process.argv[2] ?? "");
if (
  !checkout.startsWith("/private/tmp/bc-evolution-") &&
  !checkout.startsWith("/tmp/bc-evolution-")
)
  throw Error("Informe a cópia exclusiva da Evolution em /tmp");
if (
  process.env.DOCKER_HOST ||
  !execFileSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], {
    encoding: "utf8",
  })
    .trim()
    .startsWith("unix://")
)
  throw Error("Somente Docker Unix local");
const { fixture, a, b, u, id } = await import(
  pathToFileURL(checkout + "/test/bc-cycle-fixture.ts").href
);
const { executeGroupCommand } = await import(
  pathToFileURL(checkout + "/src/api/integrations/channel/whatsapp/bc-groups/core.ts").href
);
process.env.BC_GROUPS_EXTENSION_ENABLED = "true";
process.env.BC_GROUPS_INSTANCES = "fixture";
const admin = "11111111-1111-4111-8111-111111111111";
let actor = admin;
function sql(query: string, role = "authenticated") {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "barba-central-d1-local",
      "psql",
      "-XqAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    {
      input:
        `set statement_timeout='10s';set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='${role}';` +
        query,
      encoding: "utf8",
      timeout: 15000,
    },
  ).trim();
}
const quote = (v: unknown) =>
  v == null
    ? "null"
    : "'" + String(typeof v === "object" ? JSON.stringify(v) : v).replaceAll("'", "''") + "'";
const types: Record<string, Record<string, string>> = {
  claim_care_cycle: { p_cycle: "uuid" },
  authorize_care_cycle: { p_cycle: "uuid", p_token: "uuid", p_closing: "boolean", p_step: "uuid" },
  seal_care_cycle_creation: {
    p_cycle: "uuid",
    p_token: "uuid",
    p_instance_id: "text",
    p_body: "jsonb",
    p_hash: "text",
  },
  start_care_cycle_step: {
    p_cycle: "uuid",
    p_token: "uuid",
    p_phase: "text",
    p_revision: "text",
    p_instance: "text",
    p_hash: "text",
  },
  finish_care_cycle_step: {
    p_cycle: "uuid",
    p_token: "uuid",
    p_step: "uuid",
    p_accepted: "boolean",
    p_provider_id: "text",
  },
  record_care_cycle_creation: {
    p_cycle: "uuid",
    p_token: "uuid",
    p_jid: "text",
    p_created_at: "timestamptz",
    p_expires_at: "timestamptz",
  },
  record_care_cycle_observation: {
    p_cycle: "uuid",
    p_token: "uuid",
    p_cycle_proof: "jsonb",
    p_snapshot: "jsonb",
    p_invite: "text",
  },
  release_care_cycle: { p_cycle: "uuid", p_token: "uuid", p_reason: "text", p_closed: "boolean" },
};
Object.assign(types, {
  care_access_start: {
    p_shop: "uuid",
    p_phone: "text",
    p_accounts: "uuid[]",
    p_accept: "boolean",
    p_group: "uuid",
    p_version: "bigint",
  },
  claim_care_access: { p_user: "uuid", p_shop: "uuid" },
  record_care_access_connections: {
    p_id: "uuid",
    p_user: "uuid",
    p_token: "uuid",
    p_observations: "jsonb",
  },
  resume_care_access: { p_id: "uuid", p_token: "uuid" },
  finish_care_access: { p_id: "uuid", p_user: "uuid", p_token: "uuid", p_failed: "boolean" },
  care_group_read: { p_shop: "uuid" },
  record_legacy_care_cycle_proof: { p_cycle: "uuid", p_token: "uuid", p_proof: "jsonb" },
  whatsapp_group_login_context: { p_challenge_id: "uuid", p_code_hash: "text" },
  authorize_whatsapp_group_login: {
    p_challenge_id: "uuid",
    p_code_hash: "text",
    p_expected: "jsonb",
  },
  finish_whatsapp_send: { p_attempt_id: "uuid", p_provider_id: "text" },
  whatsapp_group_notice_context: { p_outbox_id: "uuid", p_lease_token: "uuid" },
  authorize_whatsapp_group_notice: {
    p_outbox_id: "uuid",
    p_lease_token: "uuid",
    p_expected: "jsonb",
  },
  defer_whatsapp_send: { p_id: "uuid", p_lease_token: "uuid" },
  record_care_cycle_cleanup: {
    p_cycle: "uuid",
    p_token: "uuid",
    p_number: "uuid",
    p_state: "text",
  },
});
const db = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    assert.ok(types[name], name);
    for (const k of Object.keys(args)) assert.ok(types[name][k], k);
    const query = `select to_jsonb(public.${name}(${Object.entries(args)
      .map(
        ([k, v]) =>
          `${k}=>${quote(types[name][k] === "uuid[]" ? "{" + (v as string[]).join(",") + "}" : v)}::${types[name][k]}`,
      )
      .join(",")}));`;
    try {
      const text = sql(query, "service_role");
      return { data: text ? JSON.parse(text) : null };
    } catch (e) {
      throw new Error("Falha na RPC local " + name, { cause: e });
    }
  },
};
assert.equal(
  sql("select count(*) from public.whatsapp_care_cycles;"),
  "0",
  "Recrie a bancada D4 antes de cada ensaio integrado",
);
const person = randomUUID(),
  numberA = randomUUID(),
  numberB = randomUUID(),
  plan = randomUUID();
let f = await fixture();
f.raw.creation = Math.floor(Date.now() / 1000);
const sentTo: string[] = [];
const originalSend = f.d.socket.sendMessage;
f.d.socket.sendMessage = async (jid: string, ...args: any[]) => {
  sentTo.push(jid);
  return originalSend(jid, ...args);
};
let cycle: string, shop: string;
const map: Record<string, string> = {
  bcCapabilities: "capabilities",
  bcCreate: "create",
  bcAdoptClosing: "adoptClosing",
  bcCreationStatus: "creationStatus",
  bcRecoverCycle: "recoverCycle",
  bcCycle: "cycleStatus",
  bcOperation: "operationStatus",
  bcInspect: "inspect",
  bcPrepare: "prepare",
  bcWelcome: "welcome",
  bcDescription: "description",
  bcBrand: "brand",
  bcSubject: "subject",
  bcPinNotice: "pinNotice",
  joinRequests: "requests",
  bcInvite: "invite",
  bcClose: "close",
  bcSendCode: "sendCode",
  bcSendNotice: "sendNotice",
};
let createCalls = 0;
let principalOffline = false;
f.d.ready = () => !principalOffline || f.d.instanceId !== "criador";
const transport = async (path: string, init: RequestInit = {}) => {
  const url = new URL(path, "https://example.invalid");
  const parts = url.pathname.split("/");
  const endpoint = parts[2],
    instance = decodeURIComponent(parts[3]);
  assert.ok(map[endpoint], endpoint);
  assert.ok([`bc-${numberA}`, `bc-${numberB}`].includes(instance));
  f.as(instance === `bc-${numberA}` ? a : b);
  const command = endpoint === "joinRequests" && init.method === "POST" ? "decide" : map[endpoint];
  if (command === "create") createCalls++;
  return executeGroupCommand(
    f.d,
    command,
    init.body ? JSON.parse(String(init.body)) : Object.fromEntries(url.searchParams),
  );
};
const asset = async (shopId: string, url: string) => {
  assert.equal(shopId, shop);
  assert.match(url, /\/barbershop-logos\//);
  return { base64: f.preparation.logoBase64, sha256: f.preparation.logoHash };
};
try {
  sql(
    "update public.whatsapp_send_controls set paused=false where scope='global';update public.whatsapp_care_cycle_policy set enabled=true,assisted_access_enabled=true;update public.whatsapp_group_settings set enrollment_enabled=true,login_enabled=true;",
  );
  shop = JSON.parse(
    sql(
      "select public.register_my_barbershop(gen_random_uuid(),'Ensaio de Ciclo','America/Sao_Paulo','single',true,'teste','teste','teste');",
    ),
  ).shop_id;
  sql(
    `select public.platform_create_whatsapp_channel('${numberA}','Ensaio A');select public.platform_create_whatsapp_channel('${numberB}','Ensaio B');update public.whatsapp_channels set display_phone=case id when '${numberA}' then '+${a.split("@")[0]}' else '+${b.split("@")[0]}' end,status='open' where id in('${numberA}','${numberB}');select public.platform_confirm_whatsapp_control(id,routing_version,display_phone,instance_name,true) from public.whatsapp_channels where id in('${numberA}','${numberB}');select public.platform_plan_whatsapp_distribution('${plan}',array['${shop}'::uuid],false);select public.platform_apply_whatsapp_distribution('${plan}');update public.barbershop_settings set logo_url='https://example.invalid/storage/v1/object/public/barbershop-logos/${shop}/logo-ficticia' where barbershop_id='${shop}';insert into auth.users(id,email,raw_user_meta_data) values('${person}','${person}@example.invalid','{}');insert into public.memberships(user_id,barbershop_id,role) values('${person}','${shop}','customer');`,
  );
  actor = person;

  const request = (start = false) =>
    new Request("https://example.invalid/assisted", {
      method: "POST",
      body: JSON.stringify({
        shop,
        action: start ? "start" : "advance",
        ...(start
          ? { phone: "+" + u.split("@")[0], accept: true, accounts: [numberA, numberB] }
          : {}),
      }),
    });
  const drive = async (start = false) => {
    sql(
      `update public.whatsapp_care_access set next_at=clock_timestamp()-interval '1 second' where barbershop_id='${shop}' and customer_id='${person}';`,
    );
    const response = await handleCareAccess(request(start), {
      enabled: true,
      authenticate: async () => ({ id: person, db }),
      service: db,
      observe: async (path, init) => {
        assert.equal(path, "/instance/fetchInstances");
        assert.equal(init.method, "GET");
        return [
          { name: `bc-${numberA}`, connectionStatus: "open", ownerJid: a },
          { name: `bc-${numberB}`, connectionStatus: "open", ownerJid: b },
        ];
      },
      process: (value) => processCareCycle(db, transport, value, asset, true),
    });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return result;
  };
  f.d.socket.groupRequestParticipantsList = async () => [];
  sql(
    `update public.whatsapp_channels set connection_observed_at=clock_timestamp()-interval '1 day' where id in('${numberA}','${numberB}');`,
  );
  let result = await drive(true);
  assert.equal(result.state, "waiting_customer");
  assert.equal(result.data.phone_ready, false);
  assert.equal(result.data.access.active, true);
  assert.equal(createCalls, 1);
  assert.equal(f.sent.length, 0);
  assert.equal(f.raw.desc, undefined);
  assert.equal(f.photos(), 1);
  const initial = result.data.group.cycle_id;
  cycle = initial;
  const windowEnd = result.data.access.expires_at;
  assert.equal(result.data.phone_confirmed, false);
  const overlapping = await Promise.all([drive(), drive()]);
  assert.equal(overlapping.filter((r) => r.state === "waiting").length, 1);
  assert.equal(overlapping.filter((r) => r.state === "waiting_customer").length, 1);
  result = overlapping.find((r) => r.state === "waiting_customer");
  assert.equal(createCalls, 1);
  assert.equal(result.data.access.expires_at, windowEnd);
  console.log(
    "PASS: aceite -> conferência live seletiva -> criação/preparação/convite sem TI; sem mensagem ou descrição pré-entrada; clique/poll não recriam nem estendem janela",
  );
  f.d.socket.groupRequestParticipantsList = async () =>
    f.raw.participants.some((p: any) => p.id === u) ? [] : [{ jid: u }];
  result = await drive();
  assert.equal(result.state, "waiting_first_receipt");
  assert.equal(result.data.phone_ready, false);
  assert.equal(f.sent.filter((m: any) => m.text).length, 1);
  assert.equal(f.sent[0].author, b);
  assert.match(f.raw.desc, /somente no aplicativo/);
  assert.equal(f.raw.participants.find((p: any) => p.id === u).admin, null);
  const sent = f.sent.length;
  result = await drive();
  assert.equal(result.state, "waiting_first_receipt");
  assert.equal(f.sent.length, sent);
  const proof = f.cycle()!;
  await f.d.cycles.evidence(id, proof.lastWelcomeMessageId, a, b, true);
  result = await drive();
  assert.equal(result.state, "active");
  assert.equal(result.data.phone_ready, true);
  assert.equal(result.data.phone_confirmed, false);
  assert.equal(result.data.group.cycle_id, initial);
  console.log(
    "PASS: retorno do WhatsApp admite titular como comum, acolhe pelo segundo admin e só libera código depois do recibo; nenhum OTP automático",
  );
  const hash = "d".repeat(64);
  const challenge = JSON.parse(
    sql(
      `set request.jwt.claim.role='service_role';select public.request_whatsapp_group_phone('${person}','+${u.split("@")[0]}','${hash}','${randomUUID()}');`,
    ),
  ).challenge_id;
  assert.equal(
    await sendGroupLogin(
      db,
      { challengeId: challenge, codeHash: hash, code: "654321" },
      transport,
      true,
    ),
    "accepted",
  );
  assert.ok(sentTo.length > 0);
  assert.ok(sentTo.every((jid) => jid === f.raw.id));
  const confirmed = JSON.parse(
    sql(
      `set request.jwt.claim.role='service_role';select public.check_whatsapp_group_phone('${person}','+${u.split("@")[0]}','${hash}');`,
    ),
  );
  assert.ok(confirmed.whatsapp_verified_at);
  const view = JSON.parse(sql(`select public.care_group_read('${shop}');`));
  assert.equal(view.access.active, false);
  assert.equal(view.phone_confirmed, true);
  assert.equal(createCalls, 1);
  console.log(
    "PASS: clique explícito envia código só ao mesmo grupo; consumo confirma telefone e interrompe acompanhamento antigo",
  );
  console.log(
    "PASS: ensaio com PostgreSQL B&C real e motor Evolution local; nenhum WhatsApp, aparelho ou VPS real",
  );
} finally {
  sql(
    "update public.whatsapp_care_cycle_policy set enabled=false,assisted_access_enabled=false where singleton;update public.whatsapp_send_controls set paused=true where scope='global';",
  );
}
