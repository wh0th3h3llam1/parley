import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AgentRelay } from '@agent-relay/sdk';

const suffix = randomUUID().slice(0, 8);
const cacheFile = path.join(process.cwd(), '.data', 'relay-check-workspace');
const temporary = process.argv.includes('--temporary');
let key = temporary ? undefined : process.env.RELAY_WORKSPACE_KEY;
if (!key && !temporary) { try { key = (await readFile(cacheFile, 'utf8')).trim(); } catch {} }
const relay = key ? new AgentRelay({ workspaceKey: key }) : await AgentRelay.createWorkspace({ name: `trip-parliament-check-${suffix}` });
if (!key && !temporary && relay.workspaceKey) { await mkdir(path.dirname(cacheFile), { recursive: true }); await writeFile(cacheFile, relay.workspaceKey); }
let names = [];
async function retry(work) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await work(); }
    catch (error) {
      if (!error.retryable || attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(error.retryAfterMs ?? 1000, 8000)));
    }
  }
}
let registered = false;
try {
  let participants;
  for (let attempt = 0; attempt < 4; attempt++) {
    names = [`tp-check-${suffix}-${attempt}-sender`, `tp-check-${suffix}-${attempt}-receiver`];
    try { participants = await relay.workspace.register(names.map(name => ({ name, type: 'agent' }))); break; }
    catch (error) {
      await Promise.allSettled(names.map(name => relay.workspace.release({ name, deleteAgent: true })));
      if (!error.retryable || attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(error.retryAfterMs ?? 1000, 8000)));
    }
  }
  if (!participants) throw new Error('Agent registration failed.');
  const [sender, receiver] = participants;
  registered = true;
  const sent = await retry(() => sender.sendMessage({ to: `@${receiver.handle}`, text: `adapter check ${suffix}`, idempotencyKey: `check:${suffix}` }));
  let matched = false;
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const inbox = await retry(() => receiver.inbox.list({ limit: 100 }));
    const item = inbox.items.find(item => item.message.messageId === sent.messageId);
    if (item) {
      await retry(() => receiver.inbox.ack({ inboxItemId: item.id, state: 'read' }));
      matched = item.message.text === `adapter check ${suffix}`;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!matched) throw new Error('Send/receive did not match.');
  console.log(JSON.stringify({ result: 'pass', senderRegistered: true, receiverRegistered: true, sent: true, received: true, idMatched: true }));
} finally {
  if (registered) await Promise.allSettled(names.map(name => relay.workspace.release({ name, deleteAgent: true })));
}
