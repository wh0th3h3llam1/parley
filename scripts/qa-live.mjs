import assert from 'node:assert/strict';

const root = 'http://localhost:3000/api/halls';
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const read = async url => (await fetch(url)).json();
const created = await (await post(root, { title: 'Yosemite live transport check', scenario: 'yosemite' })).json();
if (!created.token) throw new Error('Room creation failed.');
const url = `${root}/${created.token}`;

const started = await post(url, { type: 'start' });
let state = await read(url);
if (!started.ok) {
  console.log(JSON.stringify({ result: 'fail', step: 'start', status: started.status, phase: state.phase, relay: state.integrations.relay, error: state.error }));
  process.exitCode = 1;
} else {
  assert.equal(state.phase, 'Agreed');
  assert.deepEqual(state.plans.map(plan => plan.costPerPerson), [500, 430, 410]);
  assert.equal(state.plans.at(-1).source, 'live');
  assert.equal(Object.values(state.plans.at(-1).votes).filter(Boolean).length, 4);
  assert.equal(state.events.every(event => event.payload.transport === 'agent-relay'), true);
  assert.equal(state.integrations.relay, 'connected');

  const revised = post(url, { type: 'message', displayName: 'Alice', text: 'Actually, I can only do $400.' });
  let pending = false;
  for (let attempt = 0; attempt < 240; attempt++) {
    state = await read(url);
    if (state.awaitingHumanConfirmation) { pending = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(pending, true, 'Revised live plan should wait for human confirmation');
  assert.equal(state.plans.at(-1).costPerPerson, 390);
  assert.equal(state.plans.at(-1).version, 4);
  assert.equal((await revised).status, 200);
  const confirmed = await post(url, { type: 'confirm' });
  state = await read(url);
  assert.equal(confirmed.status, 200);
  assert.equal(state.phase, 'Agreed');
  assert.equal(Object.values(state.plans.at(-1).votes).filter(Boolean).length, 4);
  assert.equal(state.events.every(event => event.payload.transport === 'agent-relay'), true);
  console.log(JSON.stringify({ result: 'pass', relay: state.integrations.relay, openai: state.integrations.openai, versions: state.plans.map(plan => plan.costPerPerson), deliveredEvents: state.events.length, finalVotes: 4 }));
}
