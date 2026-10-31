import "server-only";
import { randomUUID } from "node:crypto";
import { AgentRelay, type RelayAgentClient } from "@agent-relay/sdk";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { Event, HallState, Plan, validatePlan, YOSEMITE_DAYS } from "./domain";
import { beginRun, readHall, saveHall } from "./store";

type Mode = "live" | "sample";
type ScriptLine = { person: string; to?: string; action: Event["action"]; message: string; round: number; ai?: boolean; payload?: Record<string, unknown> };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const planItems = [
  ["shuttle", "hike", "rafting", "meals80", "lodge260"],
  ["shuttle", "hike", "rafting", "meals80", "cabin190"],
  ["shuttle", "hike", "rafting", "meals60", "cabin190"],
  ["shuttle", "hike", "rafting", "meals60", "inn170"]
];
const lineSchema = z.object({ message: z.string().trim().min(1).max(240) }).strict();

function publicFailure(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [process.env.OPENAI_API_KEY, process.env.RELAY_WORKSPACE_KEY]) {
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  return message.slice(0, 280);
}

function retryableRelay(error: unknown) {
  const relayError = error as { retryable?: boolean; status?: number; statusCode?: number; message?: string };
  return Boolean(relayError.retryable || [429, 502, 503, 504].includes(relayError.status ?? relayError.statusCode ?? 0) || /temporarily overloaded|retry-after/i.test(relayError.message ?? ""));
}

async function retryRelay<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await work(); }
    catch (error) {
      const relayError = error as { retryable?: boolean; retryAfterMs?: number; status?: number; statusCode?: number; message?: string };
      if (!retryableRelay(error) || attempt === 3) throw error;
      await pause(Math.min(relayError.retryAfterMs ?? 1200 * (attempt + 1), 8000));
    }
  }
  throw new Error("Agent Relay retry limit reached.");
}

async function receiveById(client: RelayAgentClient, messageId: string) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const inbox = await retryRelay(() => client.inbox.list({ limit: 100 }));
    const item = inbox.items.find(entry => entry.message.messageId === messageId);
    if (item) {
      await retryRelay(() => client.inbox.ack({ inboxItemId: item.id, state: "read" }));
      return item.message;
    }
    await pause(300);
  }
  throw new Error("Agent Relay did not deliver a negotiation message within 15 seconds.");
}

async function openTransport(runId: string, hall: HallState, mode: Mode) {
  if (mode === "sample") return null;
  // A Cloud API token (cld_at_...) is not a Relaycast workspace key. The SDK
  // can create a temporary Relaycast workspace for this real transport demo.
  const configured = process.env.RELAY_WORKSPACE_KEY?.trim();
  const relay = configured && !configured.startsWith("cld_at_")
    ? new AgentRelay({ workspaceKey: configured })
    : await retryRelay(() => AgentRelay.createWorkspace({ name: `parley-yosemite-${runId.slice(0, 8)}` }));
  let names: string[] = [];
  let registered: RelayAgentClient[] | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    names = ["coordinator", ...hall.travelers.map(person => person.id)].map(name => `parley-${runId.slice(0, 8)}-${attempt}-${name}`);
    try { registered = await relay.workspace.register(names.map(name => ({ name, type: "agent" as const }))); break; }
    catch (error) {
      await Promise.allSettled(names.map(name => relay.workspace.release({ name, deleteAgent: true })));
      if (!retryableRelay(error) || attempt === 2) throw error;
      await pause(1200 * (attempt + 1));
    }
  }
  if (!registered) throw new Error("Agent Relay did not register the representatives.");
  const [coordinator, ...agents] = registered;
  const clients = new Map<string, RelayAgentClient>();
  hall.travelers.forEach((person, index) => clients.set(person.name, agents[index]));
  const prepared = new Map<number, { person: string; id: string; text: string }>();
  return {
    hasPrepared(sequence: number) { return prepared.has(sequence); },
    async prepare(lines: { person: string; text: string; sequence: number }[]) {
      const sent: { person: string; text: string; sequence: number; id: string }[] = [];
      for (let index = 0; index < lines.length; index += 4) {
        const batch = await Promise.all(lines.slice(index, index + 4).map(async line => {
          const sender = clients.get(line.person);
          if (!sender) throw new Error(`Unknown representative: ${line.person}`);
          const result = await retryRelay(() => sender.sendMessage({
            to: `@${coordinator.handle}`, text: line.text,
            idempotencyKey: `${runId}:${line.sequence}`,
            metadata: { hallId: hall.id, runId, sequence: line.sequence, scenario: "yosemite" }
          }));
          return { ...line, id: result.messageId };
        }));
        sent.push(...batch);
      }
      const pending = new Map(sent.map(line => [line.id, line]));
      const deadline = Date.now() + 60000;
      while (pending.size && Date.now() < deadline) {
        const inbox = await retryRelay(() => coordinator.inbox.list({ limit: 100 }));
        for (const item of inbox.items) {
          const line = pending.get(item.message.messageId);
          if (!line) continue;
          if (item.message.text !== line.text) throw new Error("Agent Relay message did not match the delivered decision.");
          await retryRelay(() => coordinator.inbox.ack({ inboxItemId: item.id, state: "read" }));
          prepared.set(line.sequence, { person: line.person, id: line.id, text: line.text });
          pending.delete(line.id);
        }
        if (pending.size) await pause(300);
      }
      if (pending.size) throw new Error("Agent Relay did not deliver every prepared message.");
    },
    async send(person: string, text: string, sequence: number) {
      const ready = prepared.get(sequence);
      if (ready) {
        if (ready.person !== person) throw new Error("Prepared Agent Relay sender did not match the event.");
        return { id: ready.id, text: ready.text };
      }
      const sender = clients.get(person);
      if (!sender) throw new Error(`Unknown representative: ${person}`);
      const sent = await retryRelay(() => sender.sendMessage({
        to: `@${coordinator.handle}`, text,
        idempotencyKey: `${runId}:${sequence}`,
        metadata: { hallId: hall.id, runId, sequence, scenario: "yosemite" }
      }));
      const received = await receiveById(coordinator, sent.messageId);
      if (received.messageId !== sent.messageId || received.text !== text) throw new Error("Agent Relay message did not match the delivered decision.");
      return { id: received.messageId, text: received.text };
    },
    async close() { await Promise.allSettled(names.map(name => relay.workspace.release({ name, deleteAgent: true }))); }
  };
}

async function draftMessage(openai: OpenAI | null, hall: HallState, line: ScriptLine) {
  if (!line.ai || !openai) return line.message;
  const person = hall.travelers.find(traveler => traveler.name === line.person);
  try {
    const response = await openai.responses.parse({
      model: process.env.OPENAI_MODEL!,
      instructions: `You are ${line.person}'s trip representative in a guided Yosemite demo. Protect this person's hard constraints. Rewrite the provided negotiation sentence in one natural first-person sentence, keeping all prices, decisions, and conditions exactly the same. Do not invent bookings, live availability, private memory, calendar access, or other facts. Return only the message field.`,
      input: JSON.stringify({ profile: person, sharedPlan: hall.plans.at(-1), requiredMeaning: line.message }),
      text: { format: zodTextFormat(lineSchema, "agent_message") }
    });
    const rewritten = response.output_parsed?.message;
    const requiredPrices = line.message.match(/\$\d+/g) ?? [];
    if (rewritten && requiredPrices.every(price => rewritten.includes(price))) {
      hall.integrations.openai = "connected";
      return rewritten;
    }
  } catch { hall.integrations.openai = "failed"; }
  return line.message;
}

function addPlan(hall: HallState, runId: string, index: number, mode: Mode) {
  const itemIds = planItems[index];
  const calc = validatePlan(itemIds, hall.travelers, "yosemite");
  const plan: Plan = {
    id: randomUUID(), runId, version: hall.planVersion + 1, day: calc.day,
    itemIds, costPerPerson: calc.costPerPerson, totalGroupCost: calc.totalGroupCost,
    violations: calc.violations, votes: {}, source: mode
  };
  hall.planVersion = plan.version;
  hall.currentPlanId = plan.id;
  hall.plans.push(plan);
  return plan;
}

function budgetObjector(hall: HallState, plan: Plan) {
  return hall.travelers.find(person => plan.costPerPerson > person.budget) ?? hall.travelers[0];
}

async function record(hall: HallState, runId: string, line: ScriptLine, mode: Mode, transport: Awaited<ReturnType<typeof openTransport>>, openai: OpenAI | null) {
  const sequence = hall.events.filter(event => event.runId === runId).length + 1;
  const text = transport?.hasPrepared(sequence) ? line.message : await draftMessage(openai, hall, line);
  const delivered = transport ? await transport.send(line.person, text, sequence) : { id: randomUUID(), text };
  const event: Event = {
    id: delivered.id, runId, sequence, round: line.round,
    sender: `${line.person} agent`,
    recipient: line.to ?? "Everyone", action: line.action, message: delivered.text,
    createdAt: new Date().toISOString(),
    payload: { ...line.payload, planVersion: hall.planVersion, transport: transport ? "agent-relay" : "sample" }
  };
  hall.events.push(event);
  if (line.action === "accept") {
    const plan = hall.plans.find(candidate => candidate.id === hall.currentPlanId);
    const person = hall.travelers.find(candidate => candidate.name === line.person);
    if (plan && person) {
      if (plan.violations.length) throw new Error("A representative cannot accept a plan with hard-constraint violations.");
      plan.votes[person.id] = true;
      person.agentStatus = "Accepted";
    }
  } else {
    const person = hall.travelers.find(candidate => candidate.name === line.person);
    if (person) person.agentStatus = line.action === "object" ? "Raised a concern" : "Negotiating";
  }
  await saveHall(hall);
  if (mode === "sample") await pause(650 + Math.floor(Math.random() * 550));
}

function openAiClient(mode: Mode) {
  return mode === "live" && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000, maxRetries: 0 }) : null;
}

export async function runYosemite(token: string, mode: Mode) {
  const original = await readHall(token);
  if (!original) throw new Error("Room not found.");
  const runId = randomUUID();
  if (!(await beginRun(original, runId))) throw new Error("A negotiation is already running.");
  const hall = (await readHall(token))!;
  const lastAgreed = original.plans.filter(plan => original.travelers.every(person => plan.votes[person.id] === true)).at(-1);
  const previousAgreed = Boolean(lastAgreed);
  const revision = Boolean(lastAgreed && hall.plans.length >= 3 && hall.travelers.find(person => person.id === "alice")!.budget < lastAgreed.costPerPerson);
  let transport: Awaited<ReturnType<typeof openTransport>> = null;
  try {
    const finalIndex = revision || validatePlan(planItems[2], hall.travelers, "yosemite").violations.length ? 3 : 2;
    const finalCheck = validatePlan(planItems[finalIndex], hall.travelers, "yosemite");
    if (hall.travelers.some(person => person.availableDay !== YOSEMITE_DAYS[0]) || finalCheck.violations.length) {
      hall.phase = "Blocked"; hall.error = finalCheck.violations.join(" ") || "The group is not available on the same Yosemite day.";
      hall.activeRunId = null; await saveHall(hall, runId); return;
    }
    transport = await openTransport(runId, hall, mode);
    hall.integrations.relay = transport ? "connected" : "unconfigured";
    const openai = openAiClient(mode);
    await saveHall(hall);
    if (revision) {
      const aliceBudget = hall.travelers.find(person => person.id === "alice")!.budget;
      await record(hall, runId, { person: "Alice", action: "object", round: 4, message: `My hard cap is now $${aliceBudget}. The $${lastAgreed!.costPerPerson} agreement has to reopen.` }, mode, transport, openai);
      const plan = addPlan(hall, runId, 3, mode);
      hall.phase = "Negotiating";
      await record(hall, runId, { person: "Parth", action: "counter", round: 4, ai: true, message: `I found private rooms at a budget inn. The group keeps the hike and rafting for $${plan.costPerPerson} per person.` }, mode, transport, openai);
      await record(hall, runId, { person: "Aarsh", action: "concede", round: 4, message: "I can give up the cabin. The hike and rafting stay in the plan." }, mode, transport, openai);
      await record(hall, runId, { person: "Maya", action: "accept", round: 4, message: "The simpler meals are vegetarian, and the new stay keeps us within the cap." }, mode, transport, openai);
      hall.phase = "Voting"; hall.awaitingHumanConfirmation = true;
      await record(hall, runId, { person: "Parth", action: "object", round: 4, message: "The room changed. Please confirm the private budget inn before the remaining agents vote.", payload: { requiresHumanConfirmation: true } }, mode, transport, openai);
      return;
    }
    const first = addPlan(hall, runId, 0, mode);
    hall.phase = "Proposing";
    await record(hall, runId, { person: "Aarsh", action: "propose", round: 1, message: `A Yosemite weekend with private rooms, the valley hike and rafting: $${first.costPerPerson} per person.` }, mode, transport, openai);
    let finalPlan = first;
    let finalRound = 1;
    if (first.violations.length) {
      hall.phase = "Negotiating";
      const objector = budgetObjector(hall, first);
      await record(hall, runId, { person: objector.name, action: "object", round: 1, ai: true, message: `$${first.costPerPerson} doesn't work. My hard cap is $${objector.budget}.` }, mode, transport, openai);
      await record(hall, runId, { person: "Parth", action: "concede", round: 1, ai: true, message: "I can move to a cheaper stay, as long as the rooms stay private." }, mode, transport, openai);
      const second = addPlan(hall, runId, 1, mode);
      await record(hall, runId, { person: "Parth", action: "counter", round: 2, ai: true, message: `Private cabin rooms bring the cost to $${second.costPerPerson}. Hiking and rafting stay.` }, mode, transport, openai);
      finalPlan = second; finalRound = 2;
      if (second.violations.length) {
        const secondObjector = budgetObjector(hall, second);
        await record(hall, runId, { person: secondObjector.name, action: "object", round: 2, message: `$${second.costPerPerson} is closer, but still $${second.costPerPerson - secondObjector.budget} above my $${secondObjector.budget} cap.` }, mode, transport, openai);
        await record(hall, runId, { person: "Maya", action: "concede", round: 2, message: "I can switch to simpler vegetarian meals and save another $20." }, mode, transport, openai);
        const third = addPlan(hall, runId, 2, mode);
        await record(hall, runId, { person: "Maya", action: "counter", round: 3, ai: true, message: `Plan v${third.version} is $${third.costPerPerson}: private rooms, vegetarian meals, hiking and rafting.` }, mode, transport, openai);
        await record(hall, runId, { person: "Aarsh", action: "concede", round: 3, message: "I can give up the premium lodge. Keeping the hike and rafting makes this work for me." }, mode, transport, openai);
        finalPlan = third; finalRound = 3;
        if (third.violations.length) {
          const thirdObjector = budgetObjector(hall, third);
          await record(hall, runId, { person: thirdObjector.name, action: "object", round: 3, message: `The $${third.costPerPerson} version still breaks my $${thirdObjector.budget} cap. We need one more adjustment.` }, mode, transport, openai);
          finalPlan = addPlan(hall, runId, 3, mode); finalRound = 4;
          await record(hall, runId, { person: "Parth", action: "counter", round: 4, message: `Private budget-inn rooms bring the plan to $${finalPlan.costPerPerson}, with hiking and rafting intact.` }, mode, transport, openai);
        }
      }
    }
    hall.phase = "Voting";
    for (const person of hall.travelers) await record(hall, runId, { person: person.name, action: "accept", round: finalRound, message: `I accept plan v${finalPlan.version} at $${finalPlan.costPerPerson} within my hard constraints.` }, mode, transport, openai);
    hall.phase = "Agreed"; hall.activeRunId = null; hall.error = null;
    await saveHall(hall, runId);
  } catch (error) {
    hall.integrations.relay = mode === "live" ? "failed" : hall.integrations.relay;
    hall.phase = previousAgreed ? "Agreed" : "Preparing";
    hall.currentPlanId = lastAgreed?.id ?? null;
    hall.activeRunId = null; hall.awaitingHumanConfirmation = false;
    hall.error = `${mode === "live" ? "Live negotiation" : "Sample replay"} failed: ${publicFailure(error)}`;
    await saveHall(hall, runId);
    throw error;
  } finally { await transport?.close(); }
}

export async function confirmYosemite(token: string) {
  const hall = await readHall(token);
  if (!hall?.activeRunId || !hall.awaitingHumanConfirmation) throw new Error("No Yosemite confirmation is pending.");
  const runId = hall.activeRunId;
  const plan = hall.plans.find(candidate => candidate.id === hall.currentPlanId);
  if (!plan || plan.violations.length) throw new Error("The revised plan does not satisfy every hard constraint.");
  let transport: Awaited<ReturnType<typeof openTransport>> = null;
  try {
    transport = await openTransport(runId, hall, plan.source);
    hall.awaitingHumanConfirmation = false;
    await record(hall, runId, { person: "Parth", action: "concede", round: 5, message: "The private stay is confirmed. We can finish voting." }, plan.source, transport, null);
    for (const person of hall.travelers.filter(person => !plan.votes[person.id])) {
      await record(hall, runId, { person: person.name, action: "accept", round: 5, message: `I accept plan v${plan.version} at $${plan.costPerPerson}. The revised constraints are met.` }, plan.source, transport, null);
    }
    hall.phase = "Agreed"; hall.activeRunId = null; hall.error = null;
    await saveHall(hall, runId);
  } catch (error) {
    hall.error = `Confirmation failed: ${publicFailure(error)}`;
    hall.awaitingHumanConfirmation = true;
    await saveHall(hall, runId);
    throw error;
  } finally { await transport?.close(); }
}
