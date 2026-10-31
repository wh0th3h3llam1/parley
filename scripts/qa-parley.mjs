import assert from 'node:assert/strict';

const root = 'http://localhost:3000/api/halls';
const post = (url, body) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const read = async url => (await fetch(url)).json();
const waitFor = async (url, predicate, label, attempts = 160) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const state = await read(url);
    if (predicate(state)) return state;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const created = await (await post(root, { title: 'Yosemite with friends', scenario: 'yosemite' })).json();
assert.ok(created.token, 'Creates a Yosemite room');
const url = `${root}/${created.token}`;
let state = await read(url);
assert.equal(state.scenario, 'yosemite');
assert.deepEqual(state.travelers.map(person => person.name), ['Alice', 'Parth', 'Aarsh', 'Maya']);
assert.equal(state.travelers.find(person => person.id === 'alice').budget, 420);
assert.equal((await post(url, { type: 'traveler', ...state.travelers.find(person => person.id === 'alice'), availableDay: '2026-11-14' })).status, 400);
assert.equal(state.travelers.find(person => person.id === 'parth').privateRoomRequired, true);
assert.deepEqual(state.travelers.find(person => person.id === 'aarsh').requiredItemIds, ['hike', 'rafting']);

assert.equal((await post(url, { type: 'replay' })).status, 200);
state = await read(url);
assert.equal(state.phase, 'Agreed');
assert.deepEqual(state.plans.map(plan => plan.costPerPerson), [500, 430, 410]);
assert.deepEqual(state.plans.map(plan => plan.version), [1, 2, 3]);
assert.equal(state.plans[0].violations.some(issue => issue.includes('Alice')), true);
assert.equal(state.plans[1].violations.some(issue => issue.includes('Alice')), true);
assert.deepEqual(state.plans[2].violations, []);
assert.equal(Object.values(state.plans[2].votes).filter(Boolean).length, 4);
assert.equal(state.events.some(event => event.sender === 'Alice agent' && event.action === 'object'), true);
assert.equal(state.events.some(event => event.sender === 'Parth agent' && event.action === 'counter'), true);
assert.equal(state.events.some(event => event.sender === 'Aarsh agent' && event.action === 'concede'), true);

const revised = post(url, { type: 'message', displayName: 'Alice', text: 'Actually, I can only do $400.' });
state = await waitFor(url, current => current.awaitingHumanConfirmation, 'human confirmation after Alice changes her budget');
assert.equal(state.travelers.find(person => person.id === 'alice').budget, 400);
assert.equal(state.plans.at(-1).costPerPerson, 390);
assert.equal(state.plans.at(-1).version, 4);
assert.equal(state.phase, 'Voting');
assert.equal((await post(url, { type: 'confirm' })).status, 200);
assert.equal((await revised).status, 200);
state = await read(url);
assert.equal(state.phase, 'Agreed');
assert.equal(state.currentPlanId, state.plans.at(-1).id);
assert.equal(Object.values(state.plans.at(-1).votes).filter(Boolean).length, 4);
assert.equal(state.humanMessages.at(-1).text, 'Actually, I can only do $400.');
assert.equal(state.plans.at(-1).itemIds.includes('rafting'), true);
assert.equal(state.plans.at(-1).itemIds.includes('hike'), true);

const impossible = await (await post(root, { title: 'Impossible cap', scenario: 'yosemite' })).json();
const impossibleUrl = `${root}/${impossible.token}`;
const alice = (await read(impossibleUrl)).travelers.find(person => person.id === 'alice');
assert.equal((await post(impossibleUrl, { type: 'traveler', ...alice, budget: 380 })).status, 200);
assert.equal((await post(impossibleUrl, { type: 'replay' })).status, 200);
const blocked = await read(impossibleUrl);
assert.equal(blocked.phase, 'Blocked');
assert.equal(blocked.plans.length, 0);
assert.match(blocked.error, /Alice.*\$380/);

const shorter = await (await post(root, { title: 'Alice can spend 450', scenario: 'yosemite' })).json();
const shorterUrl = `${root}/${shorter.token}`;
const flexibleAlice = (await read(shorterUrl)).travelers.find(person => person.id === 'alice');
await post(shorterUrl, { type: 'traveler', ...flexibleAlice, budget: 450 });
await post(shorterUrl, { type: 'replay' });
const shorterState = await read(shorterUrl);
assert.deepEqual(shorterState.plans.map(plan => plan.costPerPerson), [500, 430]);
assert.equal(shorterState.phase, 'Agreed');
assert.equal(shorterState.events.some(event => event.sender === 'Alice agent' && event.message.includes('$450')), true);

const stricter = await (await post(root, { title: 'Alice can spend 400', scenario: 'yosemite' })).json();
const stricterUrl = `${root}/${stricter.token}`;
const strictAlice = (await read(stricterUrl)).travelers.find(person => person.id === 'alice');
await post(stricterUrl, { type: 'traveler', ...strictAlice, budget: 400 });
await post(stricterUrl, { type: 'replay' });
const strictState = await read(stricterUrl);
assert.deepEqual(strictState.plans.map(plan => plan.costPerPerson), [500, 430, 410, 390]);
assert.equal(strictState.phase, 'Agreed');
assert.equal(strictState.events.some(event => event.sender === 'Alice agent' && event.message.includes('$400')), true);

console.log(JSON.stringify({ result: 'pass', scenario: 'yosemite', versions: state.plans.map(plan => plan.costPerPerson), votes: 4, humanReplan: true, impossibleCapBlocked: true, editedBudgets: [450, 400] }));
