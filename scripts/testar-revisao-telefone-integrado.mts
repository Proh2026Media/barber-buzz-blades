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
      console.error("RPC_FICTICIA", name, e);
      throw new Error("Falha na RPC local " + name, { cause: e });
    }
  },
};

Object.assign(types, {
  care_phone_revision_start: {
    p_shop: "uuid",
    p_group: "uuid",
    p_version: "bigint",
    p_phone: "text",
    p_accounts: "uuid[]",
    p_accept: "boolean",
  },
  claim_care_phone_revision: { p_user: "uuid", p_shop: "uuid" },
  record_care_phone_revision_connections: {
    p_id: "uuid",
    p_user: "uuid",
    p_token: "uuid",
    p_observations: "jsonb",
  },
  record_care_phone_revision: {
    p_id: "uuid",
    p_user: "uuid",
    p_token: "uuid",
    p_proof: "jsonb",
    p_invite: "text",
  },
  authorize_care_phone_binding: { p_id: "uuid", p_user: "uuid", p_token: "uuid" },
  finish_care_phone_revision: {
    p_id: "uuid",
    p_user: "uuid",
    p_token: "uuid",
    p_failed: "boolean",
  },
  continue_care_phone_revision: { p_shop: "uuid", p_id: "uuid" },
  care_phone_revision_abort: { p_shop: "uuid", p_id: "uuid" },
});
assert.equal(
  sql("select count(*) from public.whatsapp_care_cycles;"),
  "0",
  "Prepare bancada nova para o ensaio",
);
const numberA = randomUUID(),
  numberB = randomUUID();
const map: Record<string, string> = {
  bcPhoneRevision: "phoneRevision",
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
try {
  sql(
    "update public.whatsapp_send_controls set paused=false where scope='global';update public.whatsapp_care_cycle_policy set enabled=true,assisted_access_enabled=true where singleton;update public.whatsapp_group_settings set enrollment_enabled=true,login_enabled=true where singleton;",
  );
  sql(
    `select public.platform_create_whatsapp_channel('${numberA}','Revisão A');select public.platform_create_whatsapp_channel('${numberB}','Revisão B');update public.whatsapp_channels set display_phone=case id when '${numberA}' then '+${a.split("@")[0]}' else '+${b.split("@")[0]}' end,status='open' where id in('${numberA}','${numberB}');select public.platform_confirm_whatsapp_control(id,routing_version,display_phone,instance_name,true) from public.whatsapp_channels where id in('${numberA}','${numberB}');`,
  );
  let index = 0;
  for (const kind of ["exact", "alias", "closing"]) {
    const alias = kind === "alias",
      closing = kind === "closing";
    index++;
    actor = admin;
    const person = randomUUID();
    const oldPhone = closing ? "+551196666555" : alias ? "+551197777666" : "+551198888777";
    const declared = closing ? "+5511996666555" : alias ? "+5511997777666" : "+5511998888777";
    const physical = alias ? oldPhone : declared;
    const shop = JSON.parse(
      sql(
        "select public.register_my_barbershop(gen_random_uuid(),'Revisão Fictícia','America/Sao_Paulo','single',true,'teste','teste','teste');",
      ),
    ).shop_id;
    sql(
      `select public.platform_plan_whatsapp_distribution('${randomUUID()}',array['${shop}'::uuid],true);`,
    );
    const plan = randomUUID();
    sql(
      `select public.platform_plan_whatsapp_distribution('${plan}',array['${shop}'::uuid],false);select public.platform_apply_whatsapp_distribution('${plan}');select public.platform_set_whatsapp_route('${shop}',null,(select version from public.whatsapp_number_links where barbershop_id='${shop}' and staff_id is null and removed_at is null),'${numberA}','${numberB}',null,'primary',false,false,false);update public.barbershop_settings set logo_url='https://example.invalid/storage/v1/object/public/barbershop-logos/${shop}/logo' where barbershop_id='${shop}';insert into auth.users(id,email,raw_user_meta_data) values('${person}','${person}@example.invalid','{}');update public.profiles set whatsapp_e164='${oldPhone}',whatsapp_verified_at=null where id='${person}';insert into public.memberships(user_id,barbershop_id,role) values('${person}','${shop}','customer');`,
    );
    const f = await fixture("123456-" + (7890 + index) + "@g.us");
    f.raw.creation = Math.floor(Date.now() / 1000);
    let requests: any[] = [],
      creates = 0,
      binds = 0,
      finalizes = 0,
      injected = false;
    const destinations: string[] = [];
    const originalSend = f.d.socket.sendMessage;
    f.d.socket.sendMessage = async (jid: string, ...args: any[]) => {
      destinations.push(jid);
      return originalSend(jid, ...args);
    };
    f.d.socket.groupRequestParticipantsList = async () =>
      requests.filter((r) => !f.raw.participants.some((p: any) => p.id === r.jid));
    f.d.resolveCandidate = async (pn) => {
      assert.equal(pn, declared.slice(1) + "@s.whatsapp.net");
      return physical.slice(1) + "@s.whatsapp.net";
    };
    f.d.resolvePhone = async (lid) =>
      lid === "12345678@lid" ? physical.slice(1) + "@s.whatsapp.net" : null;
    const transport = async (path: string, init: RequestInit = {}) => {
      const url = new URL(path, "https://example.invalid"),
        parts = url.pathname.split("/"),
        endpoint = parts[2],
        instance = parts[3];
      assert.ok(map[endpoint], endpoint);
      assert.ok([`bc-${numberA}`, `bc-${numberB}`].includes(instance));
      f.as(instance === `bc-${numberA}` ? a : b);
      const body = init.body ? JSON.parse(String(init.body)) : Object.fromEntries(url.searchParams);
      const command =
        endpoint === "joinRequests" && init.method === "POST" ? "decide" : map[endpoint];
      if (command === "create") creates++;
      if (command === "phoneRevision" && body.action === "bind") binds++;
      if (command === "phoneRevision" && body.action === "finalize") finalizes++;
      const result = await executeGroupCommand(f.d, command, body);
      if (
        command === "phoneRevision" &&
        !injected &&
        body.action === (alias ? "finalize" : "bind")
      ) {
        injected = true;
        throw Error("Resposta fictícia perdida após commit remoto");
      }
      return result;
    };
    actor = person;
    const drive = async (body: Record<string, unknown> = { action: "advance" }, ok = true) => {
      sql(
        `update public.whatsapp_care_access set next_at=clock_timestamp()-interval '1 second' where customer_id='${person}' and barbershop_id='${shop}';update public.whatsapp_phone_revisions set next_at=clock_timestamp()-interval '1 second' where customer_id='${person}' and barbershop_id='${shop}';`,
      );
      const response = await handleCareAccess(
        new Request("https://example.invalid/access", {
          method: "POST",
          body: JSON.stringify({ shop, action: "advance", ...body }),
        }),
        {
          enabled: true,
          authenticate: async () => ({ id: person, db }),
          service: db,
          observe: async () => [
            { name: `bc-${numberA}`, connectionStatus: "open", ownerJid: a },
            { name: `bc-${numberB}`, connectionStatus: "open", ownerJid: b },
          ],
          revisionTransport: transport,
          process: (value) =>
            processCareCycle(
              db,
              transport,
              value,
              async () => ({ base64: f.preparation.logoBase64, sha256: f.preparation.logoHash }),
              true,
              (code) => console.error("CICLO_FICTICIO", code),
            ),
        },
      );
      const result = await response.json();
      assert.equal(response.status, ok ? 200 : 503, JSON.stringify(result));
      return result;
    };
    let result = await drive({
      action: "start",
      phone: oldPhone,
      accept: true,
      accounts: [numberA, numberB],
    });
    assert.equal(result.state, "waiting_customer");
    assert.equal(creates, 1);
    assert.equal(f.sent.length, 0);
    const cycle = result.data.group.cycle_id,
      group = result.data.group.id;
    if (alias) {
      // Histórico legítimo anterior à regra pós-entrada: não é um novo envio deste ensaio.
      const legacy = randomUUID();
      const prior = f.cycle()!;
      Object.assign(prior, {
        firstWelcomeOperation: legacy,
        firstMessageId: "legado-recebido",
        firstSenderJid: b,
        firstReceived: true,
        lastWelcomeOperation: legacy,
        lastWelcomeMessageId: "legado-recebido",
      });
      await f.d.cycles.saveCycle(prior);
      sql(
        `insert into public.whatsapp_care_cycle_steps(id,cycle_id,phase,revision,instance_name,request_hash,state,provider_id) values('${legacy}','${cycle}','welcome','initial','bc-${numberB}','${"f".repeat(64)}','accepted','legado-recebido');update public.whatsapp_care_cycles set first_received=true,first_message_id='legado-recebido' where id='${cycle}';`,
      );
    }
    const dates = sql(
      `select jsonb_build_array(created_at,expires_at) from public.whatsapp_care_cycles where id='${cycle}';`,
    );
    result = await drive({
      action: "revise",
      phone: declared,
      group,
      version: result.data.group.version,
      accept: true,
      accounts: [numberA, numberB],
    });
    assert.equal(result.state, "phone_waiting");
    assert.equal(result.data.phone, declared);
    assert.equal(result.data.phone_ready, false);
    assert.equal(result.data.phone_revision.pending, true);
    assert.equal(
      sql(`select customer_phone from public.whatsapp_care_groups where id='${group}';`),
      oldPhone,
    );
    assert.equal(f.cycle()!.customerJid, oldPhone.slice(1) + "@s.whatsapp.net");
    assert.equal(f.sent.length, 0);
    // Alias passa pelo pedido LID autenticado; a outra variante usa PN exato.
    requests = [{ jid: alias ? "12345678@lid" : physical.slice(1) + "@s.whatsapp.net" }];
    result = await drive();
    assert.equal(result.state, "phone_binding");
    assert.equal(binds, 0);
    assert.equal(
      sql(`select phase from public.whatsapp_phone_revisions where cycle_id='${cycle}';`),
      "binding",
    );
    result = await drive({}, !alias ? false : true);
    if (alias) {
      assert.equal(result.state, "phone_binding");
      await drive({}, false);
    }
    assert.equal(f.sent.length, 0);
    assert.equal(sql(`select public.care_cycle_available('${cycle}');`), "f");
    if (closing) {
      sql(`delete from auth.users where id='${person}';`);
      const closed = await processCareCycle(
        db,
        transport,
        cycle,
        async () => ({ base64: f.preparation.logoBase64, sha256: f.preparation.logoHash }),
        true,
        (code) => console.error("FECHAMENTO_FICTICIO", code),
      );
      assert.equal(closed, "closed");
      assert.equal(f.sent.length, 0);
      assert.equal(creates, 1);
      assert.equal(
        sql(`select count(*) from public.whatsapp_phone_aliases where customer_id='${person}';`),
        "0",
      );
      assert.equal(
        sql(
          `select customer_id is null from public.whatsapp_phone_revisions where cycle_id='${cycle}';`,
        ),
        "t",
      );
      console.log(
        "PASS: exclusão da conta durante bind incerto preserva diário e encerra o mesmo grupo sem código/acolhimento ou novo grupo",
      );
      continue;
    }
    result = await drive();
    assert.equal(result.state, "phone_revised");
    assert.equal(result.data.phone, declared);
    assert.equal(result.data.phone_confirmed, false);
    assert.equal(
      sql(`select customer_phone from public.whatsapp_care_groups where id='${group}';`),
      physical,
    );
    assert.equal(sql(`select whatsapp_e164 from public.profiles where id='${person}';`), oldPhone);
    assert.equal(binds, 1);
    assert.equal(finalizes, 1);
    assert.equal(creates, 1);
    assert.equal(f.sent.length, 0);
    assert.equal(
      sql(
        `select jsonb_build_array(created_at,expires_at) from public.whatsapp_care_cycles where id='${cycle}';`,
      ),
      dates,
    );
    result = await drive();
    assert.equal(result.state, "waiting_first_receipt");
    assert.equal(result.data.phone_ready, false);
    assert.equal(f.sent.filter((m: any) => m.text).length, 1);
    assert.equal(f.sent[0].author, b);
    const proof = f.cycle()!;
    await f.d.cycles.evidence(f.raw.id, proof.lastWelcomeMessageId, a, b, true);
    result = await drive();
    assert.equal(result.state, "active");
    assert.equal(result.data.phone_ready, true);
    const hash = "d".repeat(64);
    const challenge = JSON.parse(
      sql(
        `set request.jwt.claim.role='service_role';select public.request_whatsapp_group_phone('${person}','${declared}','${hash}','${randomUUID()}');`,
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
    const verified = JSON.parse(
      sql(
        `set request.jwt.claim.role='service_role';select public.check_whatsapp_group_phone('${person}','${declared}','${hash}');`,
      ),
    );
    assert.equal(verified.whatsapp_e164, declared);
    assert.ok(verified.whatsapp_verified_at);
    assert.ok(destinations.every((v) => v === f.raw.id));
    assert.equal(sql(`select public.care_verified_physical('${person}','${declared}');`), physical);
    result = JSON.parse(sql(`select public.care_group_read('${shop}');`));
    assert.equal(result.phone_confirmed, true);
    assert.equal(result.phone, declared);
    const beforeFinalCheck = f.sent.length;
    result = await drive();
    assert.equal(result.data.phone_ready, true);
    assert.equal(
      f.sent.length,
      beforeFinalCheck,
      "Conferência pós-OTP não repete acolhimento/código",
    );
    // Login usa o telefone declarado; o transporte usa PN físico somente com prova gravada.
    sql(
      `update public.auth_otp_challenges set created_at=now()-interval '2 minutes' where user_id='${person}';`,
    );
    const loginHash = "e".repeat(64),
      login = JSON.parse(
        sql(
          `set request.jwt.claim.role='service_role';select public.request_whatsapp_group_login('${declared}','${loginHash}','${randomUUID()}');`,
        ),
      );
    assert.ok(login.challenge_id);
    assert.equal(
      await sendGroupLogin(
        db,
        { challengeId: login.challenge_id, codeHash: loginHash, code: "123456" },
        transport,
        true,
      ),
      "accepted",
    );
    const session = JSON.parse(
      sql(
        `set request.jwt.claim.role='service_role';select public.check_whatsapp_group_login('${declared}','${loginHash}');`,
      ),
    );
    assert.equal(session.user_id, person);
    actor = admin;
    const second = JSON.parse(
      sql(
        "select public.register_my_barbershop(gen_random_uuid(),'Outra Loja Fictícia','America/Sao_Paulo','single',true,'teste','teste','teste');",
      ),
    ).shop_id;
    const secondPlan = randomUUID();
    sql(
      `select public.platform_plan_whatsapp_distribution('${secondPlan}',array['${second}'::uuid],false);select public.platform_apply_whatsapp_distribution('${secondPlan}');select public.platform_set_whatsapp_route('${second}',null,(select version from public.whatsapp_number_links where barbershop_id='${second}' and staff_id is null and removed_at is null),'${numberA}','${numberB}',null,'primary',false,false,false);insert into public.memberships(user_id,barbershop_id,role) values('${person}','${second}','customer');`,
    );
    actor = person;
    const another = JSON.parse(
      sql(
        `select public.care_group_begin('${second}',true,array['${numberA}'::uuid,'${numberB}'::uuid],'${declared}');`,
      ),
    );
    assert.equal(another.phone, declared);
    assert.equal(another.phone_confirmed, true);
    assert.equal(
      sql(`select customer_phone from public.whatsapp_care_groups where id='${another.group.id}';`),
      physical,
    );
    console.log(
      "PASS: " +
        (alias ? "alias autoritativo + LID" : "PN exato") +
        "; resposta perdida " +
        (alias ? "de finalize" : "de bind") +
        " recuperada sem recriar; mesmo ano, perfil só após OTP, login e outra loja com telefone declarado",
    );
  }
  console.log(
    "PASS: revisão completa contra PostgreSQL B&C real e extensão Evolution local, somente sockets fictícios",
  );
} finally {
  sql(
    "update public.whatsapp_care_cycle_policy set enabled=false,assisted_access_enabled=false where singleton;update public.whatsapp_send_controls set paused=true where scope='global';",
  );
}
