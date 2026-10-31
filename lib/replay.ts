import { randomUUID } from "node:crypto";
import { Event, HallState, Plan, feasibilityConflict, feasiblePlan, validatePlan } from "./domain";
import { beginRun, readHall, saveHall } from "./store";
import { runYosemite } from "./yosemite";

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const beat = () => pause(650 + Math.floor(Math.random() * 600));

export async function runSampleReplay(token: string) {
  const original = await readHall(token);
  if (!original) throw new Error("Hall not found.");
  if (original.scenario === "yosemite") return runYosemite(token, "sample");
  const runId = randomUUID();
  if (!(await beginRun(original, runId))) throw new Error("A negotiation is already running.");
  const hall = (await readHall(token))!;
  hall.travelers.forEach(t => { t.agentStatus = "Ready"; });
  const previous = hall.plans.at(-1);
  const previouslyAgreed = original.phase === "Agreed" && Boolean(original.currentPlanId);
  const selected = feasiblePlan(hall.travelers, !previous);
  const addEvent = async (sender: string, recipient: string, action: Event["action"], message: string, round: number, payload: Record<string, unknown> = {}) => {
    hall.events.push({ id: randomUUID(), runId, sequence: hall.events.filter(e => e.runId === runId).length + 1, round, sender, recipient, action, message, payload, createdAt: new Date().toISOString() });
    await saveHall(hall);
    await beat();
  };
  try {
    await beat();
    if (!selected) {
      const conflict = feasibilityConflict(hall.travelers);
      await addEvent("Coordinator", "Everyone", "object", conflict, 1);
      hall.phase = "Blocked"; hall.error = conflict; hall.activeRunId = null;
      await saveHall(hall, runId); return;
    }
    const calc = validatePlan(selected, hall.travelers);
    const plan: Plan = {
      id: randomUUID(), runId, version: hall.planVersion + 1, day: calc.day,
      itemIds: selected, costPerPerson: calc.costPerPerson, totalGroupCost: calc.totalGroupCost,
      violations: calc.violations, votes: {}, source: "sample"
    };
    hall.planVersion = plan.version; hall.currentPlanId = plan.id; hall.plans.push(plan);
    hall.phase = "Proposing";
    await addEvent("Aarsh agent", "Everyone", "propose", previous ? "A new plan keeps the day and lowers the per-person cost." : "San Diego on Saturday: a shared day with food and time outdoors.", 1, { selectedItemIds: selected, planVersion: plan.version });
    hall.phase = "Negotiating";
    if (previous) {
      await addEvent("Leo agent", "Everyone", "object", `My revised $${hall.travelers.find(t => t.id === "leo")?.budget} budget rules out the earlier $${previous.costPerPerson} plan.`, 1, { requestedChange: "Lower per-person cost" });
      await addEvent("Maya agent", "Leo agent", "counter", "Swap paid kayaking for free beach games; keep the vegetarian meals.", 2, { selectedItemIds: selected });
      await addEvent("Leo agent", "Everyone", "concede", "I’ll give up kayaking so the group can keep this trip affordable.", 2, { concession: "Kayaking replaced with beach games" });
    } else {
      await addEvent("Priya agent", "Aarsh agent", "object", "I prefer an easier afternoon. Can we leave room to slow down?", 1, { requestedChange: "Unhurried afternoon" });
      await addEvent("Aarsh agent", "Priya agent", "concede", "We can keep the morning light and leave a gap before dinner.", 2, { concession: "Unscheduled rest before dinner" });
    }
    hall.phase = "Voting";
    await saveHall(hall, runId);
    if (previous) {
      hall.awaitingHumanConfirmation = true;
      await addEvent("Coordinator", "Everyone", "object", "A human must confirm the revised budget before the representatives cast their votes.", 3, { requiresHumanConfirmation: true });
      const confirmationDeadline = Date.now() + 45000;
      while (Date.now() < confirmationDeadline) {
        if (!(await readHall(token))?.awaitingHumanConfirmation) break;
        await pause(350);
      }
      if ((await readHall(token))?.awaitingHumanConfirmation) throw new Error("Human confirmation was not received within 45 seconds. Retry the negotiation.");
      hall.awaitingHumanConfirmation = false;
      await addEvent("Coordinator", "Everyone", "concede", "The revised budget was confirmed. Voting can continue.", 3);
    }
    for (const traveler of hall.travelers) {
      plan.votes[traveler.id] = true;
      traveler.agentStatus = "Accepted";
      await addEvent(`${traveler.name} agent`, "Everyone", "accept", `I accept plan v${plan.version} within my hard constraints.`, 3, { vote: true, planVersion: plan.version });
    }
    hall.phase = "Agreed"; hall.activeRunId = null;
    hall.awaitingHumanConfirmation = false;
    await saveHall(hall, runId);
  } catch (error) {
    hall.activeRunId = null; hall.phase = previouslyAgreed ? "Agreed" : "Preparing";
    hall.awaitingHumanConfirmation = false;
    hall.currentPlanId = previouslyAgreed ? original.currentPlanId : null;
    hall.error = `Sample replay failed: ${error instanceof Error ? error.message : String(error)}`;
    await saveHall(hall, runId);
    throw error;
  }
}
