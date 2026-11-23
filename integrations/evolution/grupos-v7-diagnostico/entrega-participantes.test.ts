import assert from 'node:assert/strict';
import test from 'node:test';
import { executeCycleCommand } from '../src/api/integrations/channel/whatsapp/bc-groups/cycle-engine';
import { fixture, b, u, id, key } from './bc-cycle-fixture';

test('Boas-vindas usam membros atuais depois da entrada e mantêm uma operação por admissão', async () => {
  const f = await fixture();
  await f.create();
  await executeCycleCommand(f.d, 'prepare', f.preparation);
  f.as(b);
  const send = f.d.socket.sendMessage.bind(f.d.socket);
  const destinatarios: string[][] = [];
  f.d.socket.sendMessage = async (grupo, mensagem, opcoes) => {
    assert.equal(opcoes?.useCachedGroupMetadata, false);
    destinatarios.push(f.raw.participants.map((p: {id: string}) => p.id));
    return send(grupo, mensagem, opcoes);
  };
  const pedido = {groupJid: id, operationId: key(3), admissionId: key(101)};
  await assert.rejects(() => executeCycleCommand(f.d, 'welcome', pedido));
  f.raw.participants.push({id: u, admin: null});
  await executeCycleCommand(f.d, 'welcome', pedido);
  await executeCycleCommand(f.d, 'welcome', pedido);
  assert.equal(destinatarios.length, 1);
  assert.ok(destinatarios[0].includes(u));
});
