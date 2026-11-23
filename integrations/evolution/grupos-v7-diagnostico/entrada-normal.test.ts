import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCycleCommand } from '../src/api/integrations/channel/whatsapp/bc-groups/cycle-engine';
import { fixture, b, u, id } from './bc-cycle-fixture';

for (const comprovado of [false, true]) {
  test('Pedido normal com LID e vínculo comprovado=' + comprovado, async () => {
    const f = await fixture();
    await f.create();
    await executeCycleCommand(f.d, 'prepare', f.preparation);
    f.as(b);
    const lid = '123456@lid';
    const consultas: string[] = [];
    f.d.ensurePhoneMapping = async pn => { consultas.push(pn); };
    f.d.resolvePhone = async jid => jid === lid && consultas.includes(u) && comprovado ? u : null;
    f.d.socket.groupRequestParticipantsList = async () => [{jid: lid}] as never;
    const pedidos = await executeCycleCommand(f.d, 'requests', {groupJid:id}) as {phoneNumber:string|null}[];
    assert.deepEqual(consultas, [u]);
    assert.equal(pedidos[0].phoneNumber, comprovado ? u : null);
    if (!comprovado) await assert.rejects(() => executeCycleCommand(f.d,'decide',{groupJid:id,participants:[lid],action:'approve'}));
    assert.equal(f.sent.length,0);
  });
}
