import test from "node:test";
import assert from "node:assert/strict";
import { resumeExpiredPhoneRevision } from "./resume-phone-revision.ts";
const snapshot = () => ({
  enabled: true,
  group: { id: "grupo-ficticio", version: 3, cycle_state: "waiting_customer" },
  platform_participants: [
    { id: "numero-a", phone: "+5511800000111" },
    { id: "numero-b", phone: "+5511800000222" },
  ],
  phone_revision: {
    id: "revisao-ficticia",
    phase: "waiting",
    enabled: true,
    expired: true,
    declared_phone: "+5511999999999",
  },
});
test("Clique retoma no mesmo grupo e números, sem redigitar telefone, depois de cancelar intenção vencida", async () => {
  const s = snapshot(),
    calls: string[] = [];
  const r = await resumeExpiredPhoneRevision(s, {
    read: async () => {
      calls.push("read");
      return structuredClone(s);
    },
    abort: async (id) => {
      calls.push("abort");
      assert.equal(id, s.phone_revision.id);
      const n = structuredClone(s);
      n.phone_revision.phase = "aborted";
      n.group.version = 4;
      return n;
    },
    revise: async (intent) => {
      calls.push("revise");
      assert.deepEqual(intent, {
        phone: s.phone_revision.declared_phone,
        accounts: ["numero-a", "numero-b"],
        accept: true,
        group: s.group.id,
        version: 4,
      });
      return s;
    },
  });
  assert.equal(r, s);
  assert.deepEqual(calls, ["read", "abort", "revise"]);
});
test("Não renova intenção vigente, fase de vínculo ou grupo encerrado", async () => {
  for (const alter of [
    (s: ReturnType<typeof snapshot>) => {
      s.phone_revision.expired = false;
    },
    (s: ReturnType<typeof snapshot>) => {
      s.phone_revision.phase = "binding";
    },
    (s: ReturnType<typeof snapshot>) => {
      s.group.cycle_state = "closed";
    },
  ]) {
    const s = snapshot();
    alter(s);
    await assert.rejects(
      () =>
        resumeExpiredPhoneRevision(s, {
          read: async () => {
            throw Error("não ler");
          },
          abort: async () => {
            throw Error("não cancelar");
          },
          revise: async () => {
            throw Error("não iniciar");
          },
        }),
      /GROUP_STALE/,
    );
  }
});
test("Mudança de grupo, intenção, telefone ou composição bloqueia antes de cancelar", async () => {
  for (const alter of [
    (s: ReturnType<typeof snapshot>) => {
      s.group.id = "outro";
    },
    (s: ReturnType<typeof snapshot>) => {
      s.phone_revision.id = "nova-intencao";
    },
    (s: ReturnType<typeof snapshot>) => {
      s.phone_revision.declared_phone = "+5511999999998";
    },
    (s: ReturnType<typeof snapshot>) => {
      s.platform_participants[0].phone = "+5511800000333";
    },
  ]) {
    const s = snapshot(),
      next = structuredClone(s);
    alter(next);
    let canceled = false;
    await assert.rejects(
      () =>
        resumeExpiredPhoneRevision(s, {
          read: async () => next,
          abort: async () => {
            canceled = true;
            return s;
          },
          revise: async () => s,
        }),
      /GROUP_STALE/,
    );
    assert.equal(canceled, false);
  }
});
test("Falha no cancelamento ou mudança posterior não inicia nova intenção", async () => {
  for (const fail of [true, false]) {
    const s = snapshot();
    let started = false;
    await assert.rejects(() =>
      resumeExpiredPhoneRevision(s, {
        read: async () => s,
        abort: async () => {
          if (fail) throw Error("resposta perdida");
          const n = structuredClone(s);
          n.phone_revision.phase = "aborted";
          n.platform_participants.pop();
          return n;
        },
        revise: async () => {
          started = true;
          return s;
        },
      }),
    );
    assert.equal(started, false);
  }
});
