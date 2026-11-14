/** Banco B&C real descartável + socket Evolution fictício. Nenhum .env, VPS ou WhatsApp. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
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
    const query = `select public.${name}(${Object.entries(args)
      .map(([k, v]) => `${k}=>${quote(v)}::${types[name][k]}`)
      .join(",")});`;
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
    "update public.whatsapp_send_controls set paused=false where scope='global';update public.whatsapp_care_cycle_policy set enabled=true;update public.whatsapp_group_settings set enrollment_enabled=true,login_enabled=true;",
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
  let view = JSON.parse(sql(`select public.care_group_read('${shop}');`));
  assert.equal(view.cycle_contract, "bc-groups-v3");
  assert.equal(view.platform_participants.length, 2);
  const accounts = view.platform_participants.map((n: any) => "'" + n.id + "'::uuid").join(",");
  view = JSON.parse(
    sql(`select public.care_group_begin('${shop}',true,array[${accounts}],'+${u.split("@")[0]}');`),
  );
  cycle = view.group.cycle_id;
  actor = admin;
  assert.equal(
    await processCareCycle(
      db,
      transport,
      cycle,
      async () => {
        throw Error("Logo fictícia indisponível");
      },
      true,
    ),
    "unknown",
  );
  assert.equal(createCalls, 0, "Logo indisponível bloqueia antes de criar grupo");
  assert.equal(
    sql(`select creation_issued_at is null from public.whatsapp_care_cycles where id='${cycle}';`),
    "t",
  );
  const first = await processCareCycle(db, transport, cycle, asset, true);
  assert.equal(first, "waiting_first_receipt");
  assert.equal(createCalls, 1);
  assert.equal(f.sent.filter((m: any) => m.text).length, 1);
  assert.equal(f.sent[0].author, b);
  console.log(
    "PASS: criação e preparação completas; primeiro envio pelo segundo administrador; código ainda bloqueado",
  );
  const c = f.cycle()!;
  await f.d.cycles.evidence(id, c.firstMessageId, a, b, true);
  sql(`update public.whatsapp_care_cycles set next_run_at=now() where id='${cycle}';`);
  // Mantém cliente fora para gerar convite. A admissão será solicitada depois.
  f.d.socket.groupRequestParticipantsList = async () => [];
  const second = await processCareCycle(db, transport, cycle, asset, true);
  assert.equal(second, "waiting_customer");
  const sent = f.sent.length;
  actor = person;
  view = JSON.parse(sql(`select public.care_group_read('${shop}');`));
  assert.equal(view.group.state, "waiting_customer");
  assert.equal(view.phone_ready, false);
  assert.match(
    JSON.parse(sql(`select to_jsonb(public.care_group_invite('${view.group.id}'));`)),
    /^https:\/\/chat.whatsapp.com\//,
  );
  actor = admin;
  const third = await processCareCycle(db, transport, cycle, asset, true);
  assert.equal(third, "waiting_customer");
  assert.equal(f.sent.length, sent, "reconciliação não fixa de novo nem repete boas-vindas");
  assert.equal(createCalls, 1);
  console.log(
    "PASS: convite autenticado disponível; reconciliação conserva JID e não duplica mensagem/fixação",
  );
  f.d.socket.groupRequestParticipantsList = async () => [{ jid: u }];
  const fourth = await processCareCycle(db, transport, cycle, asset, true);
  assert.equal(fourth, "active");
  assert.equal(createCalls, 1);
  assert.equal(f.raw.participants.find((p: any) => p.id === u).admin, null);
  actor = person;
  view = JSON.parse(sql(`select public.care_group_read('${shop}');`));
  assert.equal(view.group.state, "active");
  assert.equal(view.phone_confirmed, false);
  assert.equal(view.phone_ready, true);
  console.log(
    "PASS: somente cliente consentido entra; boas-vindas de entrada e fixação; entrar não confirma telefone",
  );
  actor = admin;
  const challenge = JSON.parse(
    sql(
      `set request.jwt.claim.role='service_role';select public.request_whatsapp_group_phone('${person}','+${u.split("@")[0]}','${"c".repeat(64)}','${randomUUID()}');`,
    ),
  ).challenge_id;
  f.raw.participants[1].admin = null;
  assert.equal(
    await sendGroupLogin(
      db,
      { challengeId: challenge, codeHash: "c".repeat(64), code: "654321" },
      transport,
      true,
    ),
    "blocked",
  );
  assert.equal(
    sql(`select count(*) from public.whatsapp_send_attempts where challenge_id='${challenge}';`),
    "0",
  );
  f.raw.participants[1].admin = "admin";
  assert.equal(
    await sendGroupLogin(
      db,
      { challengeId: challenge, codeHash: "c".repeat(64), code: "654321" },
      transport,
      true,
    ),
    "accepted",
  );
  const confirmed = JSON.parse(
    sql(
      `set request.jwt.claim.role='service_role';select public.check_whatsapp_group_phone('${person}','+${u.split("@")[0]}','${"c".repeat(64)}');`,
    ),
  );
  assert.equal(confirmed.whatsapp_e164, "+" + u.split("@")[0]);
  assert.ok(confirmed.whatsapp_verified_at);
  assert.equal(
    await sendGroupLogin(
      db,
      { challengeId: challenge, codeHash: "c".repeat(64), code: "654321" },
      transport,
      true,
    ),
    "blocked",
  );
  console.log(
    "PASS: código de confirmação chega somente ao grupo e só com dois administradores; consumo prova o telefone sem duplicar",
  );
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "active");
  sql(
    `update public.auth_otp_challenges set created_at=now()-interval '61 seconds' where id='${challenge}';`,
  );
  const login = JSON.parse(
    sql(
      `set request.jwt.claim.role='service_role';select public.request_whatsapp_group_login('+${u.split("@")[0]}','${"d".repeat(64)}','${randomUUID()}');`,
    ),
  );
  assert.ok(login.challenge_id);
  assert.equal(
    await sendGroupLogin(
      db,
      { challengeId: login.challenge_id, codeHash: "d".repeat(64), code: "654322" },
      transport,
      true,
    ),
    "accepted",
  );
  const checked = JSON.parse(
    sql(
      `set request.jwt.claim.role='service_role';select public.check_whatsapp_group_login('+${u.split("@")[0]}','${"d".repeat(64)}');`,
    ),
  );
  assert.equal(checked.user_id, person);
  console.log("PASS: código de login usa o mesmo grupo e é consumido uma única vez");
  principalOffline = true;
  sql(
    `update public.whatsapp_channels set status='disconnected' where id='${numberA}';update public.whatsapp_number_links set delivery_mode='backup',delivery_reason='technical_failure',version=version+1 where barbershop_id='${shop}';update public.auth_otp_challenges set created_at=now()-interval '61 seconds' where user_id='${person}';`,
  );
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "active");
  const reserveChallenge = JSON.parse(
    sql(
      `set request.jwt.claim.role='service_role';select public.request_whatsapp_group_phone('${person}','+${u.split("@")[0]}','${"e".repeat(64)}','${randomUUID()}');`,
    ),
  ).challenge_id;
  assert.equal(
    await sendGroupLogin(
      db,
      { challengeId: reserveChallenge, codeHash: "e".repeat(64), code: "654323" },
      transport,
      true,
    ),
    "accepted",
  );
  assert.equal(f.sent.filter((m: any) => m.text).at(-1).author, b);
  assert.equal(createCalls, 1);
  console.log(
    "PASS: reserva escolhida manualmente envia no mesmo grupo com principal offline, mantendo os dois administradores",
  );
  principalOffline = false;
  sql(
    `update public.whatsapp_channels set status='open' where id='${numberA}';update public.whatsapp_number_links set delivery_mode='primary',delivery_reason=null,version=version+1 where barbershop_id='${shop}';`,
  );
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "active");

  actor = person;
  view = JSON.parse(sql(`select public.care_group_read('${shop}');`));
  sql(
    `select public.care_group_customer_update('${view.group.id}',${view.group.version},'preferences','{"notifications":true,"monthly_marketing":0,"proactive_paused":false}');`,
  );
  actor = admin;
  sql(
    `set request.jwt.claim.role='service_role';select public.apply_verified_whatsapp('${person}','+${u.split("@")[0]}',true);update public.whatsapp_number_links set enabled=true where barbershop_id='${shop}';`,
  );
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "active");
  const outbox = JSON.parse(
    sql(
      `select to_jsonb(public.enqueue_whatsapp_message('${shop}','+${u.split("@")[0]}','customer.notice','Confirmação de teste — Barba & Cabelo','${randomUUID()}','{"customer_id":"${person}"}'));`,
    ),
  );
  assert.ok(outbox);
  const batch = JSON.parse(
    sql("select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.claim_whatsapp_outbox(5) x;"),
  );
  const delivery = batch.find((x: any) => x.id === outbox);
  assert.ok(delivery);
  const delivered = await sendGroupNotice(
    db,
    { outboxId: outbox, leaseToken: delivery.lease_token },
    transport,
    true,
  );
  assert.equal(delivered.state, "accepted");
  assert.equal(delivered.recorded, true);
  const message = f.sent.filter((m: any) => m.text).at(-1);
  assert.ok(message.text.includes("Ensaio de Ciclo"));
  assert.ok(!message.text.includes("Barba & Cabelo"));
  assert.equal(
    sql(`select destination_kind from public.whatsapp_send_attempts where outbox_id='${outbox}';`),
    "groups",
  );
  console.log(
    "PASS: aviso sai para o grupo com a marca da barbearia, consentimento atual e métrica de grupo",
  );
  actor = person;
  view = JSON.parse(sql(`select public.care_group_read('${shop}');`));

  const originalExpiry = view.group.expires_at;
  // Saída de cliente exige novo consentimento; marketing não é alterado pela volta.
  sql(
    `select public.care_group_customer_update('${view.group.id}',${view.group.version},'preferences','{"notifications":true,"monthly_marketing":3,"proactive_paused":false}');`,
  );
  actor = admin;
  f.raw.participants = f.raw.participants.filter((p: any) => p.id !== u);
  f.d.socket.groupRequestParticipantsList = async () => [];
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "waiting_customer");
  actor = person;
  view = JSON.parse(sql(`select public.care_group_read('${shop}');`));
  assert.equal(view.group.state, "customer_left");
  assert.equal(view.preferences.monthly_marketing, 3);
  view = JSON.parse(
    sql(
      `select public.care_group_customer_update('${view.group.id}',${view.group.version},'rejoin','${JSON.stringify({ accept: true, accounts: view.platform_participants.map((n: any) => n.id) })}');`,
    ),
  );
  assert.equal(view.preferences.monthly_marketing, 3);
  assert.equal(view.group.expires_at, originalExpiry);
  actor = admin;
  f.d.socket.groupRequestParticipantsList = async () => [{ jid: u }];
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "active");
  assert.equal(createCalls, 1);
  console.log(
    "PASS: saída e retorno mantêm grupo, fim do ciclo e limite de marketing, sem criar outro",
  );
  actor = person;
  view = JSON.parse(sql(`select public.care_group_read('${shop}');`));
  sql(
    `select public.care_group_customer_update('${view.group.id}',${view.group.version},'close');`,
  );
  actor = admin;
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "closed");
  assert.ok(f.cycle()?.closed);
  assert.ok(!f.raw.participants.some((p: any) => p.id === u));
  console.log(
    "PASS: encerramento retira cliente, conserva administrador final e confirma saída de ambos",
  );
  // Conversas sem intervalo recebido comprovado ficam pendentes, sem apagar histórico de terceiros.
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "cleanup_pending");
  assert.equal(
    sql(`select cleanup_pending from public.whatsapp_care_cycles where id='${cycle}';`),
    "t",
  );
  // Simula prova real de range por conta para completar o caminho de limpeza.
  const current = f.cycle()!;
  const stamp = Math.floor(Date.now() / 1000);
  current.lastMessages = Object.fromEntries(
    [a, b].map((pn) => [
      pn,
      {
        key: { remoteJid: current.groupJid, id: "range-ficticio", fromMe: false, participant: u },
        messageTimestamp: stamp,
      },
    ]),
  );
  assert.equal(await processCareCycle(db, transport, cycle, asset, true), "cleanup_pending");
  assert.equal(
    sql(`select cleanup_pending from public.whatsapp_care_cycles where id='${cycle}';`),
    "f",
  );
  console.log(
    "PASS: limpeza pendente sem prova; com intervalos comprovados conclui por conta e minimiza o cliente",
  );

  const legacyShop = JSON.parse(
    sql(
      "select public.register_my_barbershop(gen_random_uuid(),'Legado Fictício','America/Sao_Paulo','single',true,'teste','teste','teste');",
    ),
  ).shop_id;
  const legacyId = randomUUID();
  const legacyJid = "223456-7890@g.us";
  sql(`insert into public.memberships(user_id,barbershop_id,role) values('${person}','${legacyShop}','customer');insert into public.whatsapp_group_accounts(barbershop_id,channel_id,authorized_by) values('${legacyShop}','${numberA}','${admin}'),('${legacyShop}','${numberB}','${admin}');
  insert into public.whatsapp_care_groups(id,barbershop_id,customer_id,customer_phone,group_jid,state,account_id,approved_accounts,approved_account_identities)
  select '${legacyId}','${legacyShop}','${person}','+${u.split("@")[0]}','${legacyJid}','paused_unavailable',
    (select id from public.whatsapp_group_accounts where barbershop_id='${legacyShop}' and channel_id='${numberA}'),array_agg(ga.id),jsonb_object_agg(ga.id::text,jsonb_build_object('phone',n.display_phone,'instance',n.instance_name))
  from public.whatsapp_group_accounts ga join public.whatsapp_channels n on n.id=ga.channel_id where ga.barbershop_id='${legacyShop}';`);
  let legacyView = JSON.parse(sql("select public.care_group_admin('read');"));
  assert.equal(legacyView.groups.find((g: any) => g.id === legacyId).legacy, true);
  legacyView = JSON.parse(
    sql(
      `select public.care_group_admin('close_legacy','${JSON.stringify({ group_id: legacyId, version: 1, confirmed: true })}');`,
    ),
  );
  const legacyCycle = legacyView.groups.find((g: any) => g.id === legacyId).cycle_id;
  assert.ok(legacyCycle);
  f = await fixture(legacyJid);
  f.raw.participants = [
    { id: a, admin: "superadmin" },
    { id: b, admin: "admin" },
    { id: u, admin: null },
  ];
  assert.equal(await processCareCycle(db, transport, legacyCycle, asset, true), "closed");
  assert.equal(f.creates(), 0);
  assert.equal(f.sent.length, 0);
  assert.equal(
    sql(`select first_received from public.whatsapp_care_cycles where id='${legacyCycle}';`),
    "f",
  );
  console.log(
    "PASS: grupo legado adotado apenas para encerrar; sem nova criação, código ou boas-vindas",
  );

  console.log("Ensaio integrado local concluído; nenhum WhatsApp ou serviço remoto foi acessado.");
} finally {
  actor = admin;
  sql("update public.whatsapp_care_cycle_policy set enabled=false;");
}
