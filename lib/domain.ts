export type Phase = "Preparing" | "Proposing" | "Negotiating" | "Voting" | "Agreed" | "Blocked";
export type Action = "propose" | "counter" | "object" | "concede" | "accept";
export type ScenarioId = "san-diego" | "yosemite";
export type Traveler = {
  id: string; name: string; budget: number; availableDay: string;
  dietary: "vegetarian" | "none"; preference: string; agentStatus: string;
  privateRoomRequired?: boolean; requiredItemIds?: string[];
};
export type Event = {
  id: string; runId: string; sequence: number; round: number; sender: string;
  recipient: string; action: Action; message: string; payload: Record<string, unknown>;
  createdAt?: string;
};
export type Plan = {
  id: string; runId: string; version: number; day: string; itemIds: string[];
  costPerPerson: number; totalGroupCost: number; violations: string[];
  votes: Record<string, boolean>; source: "live" | "sample";
};
export type HumanMessage = { id: string; displayName: string; text: string; createdAt: string };
export type HallState = {
  id: string; token: string; title: string; scenario: ScenarioId; scenarioVersion: number; phase: Phase; activeRunId: string | null;
  awaitingHumanConfirmation: boolean;
  planVersion: number; currentPlanId: string | null; error: string | null;
  mode: "sqlite"; travelers: Traveler[]; events: Event[];
  plans: Plan[]; humanMessages: HumanMessage[];
  integrations: { storage: "connected" | "unconfigured" | "failed"; relay: "connected" | "unconfigured" | "failed"; openai: "connected" | "unconfigured" | "failed" };
};
export type CatalogItem = {
  id: string; title: string; day: string; time: string; starts: number; ends: number;
  price: number; category: "activity" | "meal" | "stay" | "transport"; vegetarian: boolean; privateRoom?: boolean;
};

export const DAYS = ["2026-11-14", "2026-11-15"] as const;
export const YOSEMITE_DAYS = ["2027-06-12", "2027-06-13"] as const;
export const CATALOG: CatalogItem[] = [
  { id: "walk14", title: "La Jolla sunrise walk", day: DAYS[0], time: "07:30", starts: 450, ends: 510, price: 0, category: "activity", vegetarian: true },
  { id: "market14", title: "Old Town market stroll", day: DAYS[0], time: "10:00", starts: 600, ends: 690, price: 30, category: "activity", vegetarian: true },
  { id: "thali14", title: "Vegetarian taco lunch", day: DAYS[0], time: "12:30", starts: 750, ends: 810, price: 24, category: "meal", vegetarian: true },
  { id: "fish14", title: "Fish taco lunch", day: DAYS[0], time: "12:30", starts: 750, ends: 810, price: 29, category: "meal", vegetarian: false },
  { id: "kayak14", title: "La Jolla kayaking", day: DAYS[0], time: "15:00", starts: 900, ends: 1020, price: 72, category: "activity", vegetarian: true },
  { id: "beach14", title: "Coronado beach games", day: DAYS[0], time: "15:00", starts: 900, ends: 1020, price: 0, category: "activity", vegetarian: true },
  { id: "dinner14", title: "Garden café dinner", day: DAYS[0], time: "19:00", starts: 1140, ends: 1200, price: 32, category: "meal", vegetarian: true },
  { id: "fort15", title: "Balboa Park walk", day: DAYS[1], time: "09:00", starts: 540, ends: 630, price: 0, category: "activity", vegetarian: true },
  { id: "museum15", title: "Maritime museum", day: DAYS[1], time: "11:00", starts: 660, ends: 750, price: 28, category: "activity", vegetarian: true },
  { id: "lunch15", title: "Vegetarian coastal lunch", day: DAYS[1], time: "13:00", starts: 780, ends: 840, price: 26, category: "meal", vegetarian: true },
  { id: "ferry15", title: "Coronado ferry ride", day: DAYS[1], time: "16:00", starts: 960, ends: 1020, price: 16, category: "activity", vegetarian: true }
];

export const SEED_TRAVELERS: Traveler[] = [
  { id: "aarsh", name: "Aarsh", budget: 240, availableDay: DAYS[0], dietary: "none", preference: "A little adventure", agentStatus: "Ready" },
  { id: "maya", name: "Maya", budget: 220, availableDay: DAYS[0], dietary: "vegetarian", preference: "Good food", agentStatus: "Ready" },
  { id: "leo", name: "Leo", budget: 200, availableDay: DAYS[0], dietary: "none", preference: "Water activities", agentStatus: "Ready" },
  { id: "priya", name: "Priya", budget: 160, availableDay: DAYS[0], dietary: "vegetarian", preference: "Unhurried afternoons", agentStatus: "Ready" }
];

export const YOSEMITE_CATALOG: CatalogItem[] = [
  { id: "shuttle", title: "Shared valley shuttle", day: YOSEMITE_DAYS[0], time: "07:00", starts: 420, ends: 480, price: 50, category: "transport", vegetarian: true },
  { id: "hike", title: "Valley trail hike", day: YOSEMITE_DAYS[0], time: "09:00", starts: 540, ends: 720, price: 0, category: "activity", vegetarian: true },
  { id: "rafting", title: "River rafting", day: YOSEMITE_DAYS[0], time: "14:00", starts: 840, ends: 960, price: 110, category: "activity", vegetarian: true },
  { id: "meals80", title: "Vegetarian group meals", day: YOSEMITE_DAYS[0], time: "18:00", starts: 1080, ends: 1140, price: 80, category: "meal", vegetarian: true },
  { id: "meals60", title: "Simple vegetarian meals", day: YOSEMITE_DAYS[0], time: "18:00", starts: 1080, ends: 1140, price: 60, category: "meal", vegetarian: true },
  { id: "lodge260", title: "Private lodge rooms", day: YOSEMITE_DAYS[0], time: "20:00", starts: 1200, ends: 1260, price: 260, category: "stay", vegetarian: true, privateRoom: true },
  { id: "cabin190", title: "Private cabin rooms", day: YOSEMITE_DAYS[0], time: "20:00", starts: 1200, ends: 1260, price: 190, category: "stay", vegetarian: true, privateRoom: true },
  { id: "inn170", title: "Private rooms at a budget inn", day: YOSEMITE_DAYS[0], time: "20:00", starts: 1200, ends: 1260, price: 170, category: "stay", vegetarian: true, privateRoom: true },
  { id: "shared140", title: "Shared dorm beds", day: YOSEMITE_DAYS[0], time: "20:00", starts: 1200, ends: 1260, price: 140, category: "stay", vegetarian: true, privateRoom: false }
];

export const YOSEMITE_TRAVELERS: Traveler[] = [
  { id: "alice", name: "Alice", budget: 420, availableDay: YOSEMITE_DAYS[0], dietary: "none", preference: "Keep the trip affordable", agentStatus: "Ready" },
  { id: "parth", name: "Parth", budget: 550, availableDay: YOSEMITE_DAYS[0], dietary: "none", preference: "A comfortable place to stay", privateRoomRequired: true, agentStatus: "Ready" },
  { id: "aarsh", name: "Aarsh", budget: 550, availableDay: YOSEMITE_DAYS[0], dietary: "none", preference: "Hiking and rafting are the point of the trip", requiredItemIds: ["hike", "rafting"], agentStatus: "Ready" },
  { id: "maya", name: "Maya", budget: 500, availableDay: YOSEMITE_DAYS[0], dietary: "vegetarian", preference: "Food everyone can share", agentStatus: "Ready" }
];

export function catalogForScenario(scenario: ScenarioId) { return scenario === "yosemite" ? YOSEMITE_CATALOG : CATALOG; }
export function daysForScenario(scenario: ScenarioId) { return scenario === "yosemite" ? YOSEMITE_DAYS : DAYS; }

export function validatePlan(itemIds: string[], travelers: Traveler[], scenario: ScenarioId = "san-diego") {
  const catalog = catalogForScenario(scenario);
  const items = itemIds.map(id => catalog.find(item => item.id === id));
  const violations: string[] = [];
  if (items.some(item => !item) || new Set(itemIds).size !== itemIds.length) violations.push("The proposal contains an unknown or repeated catalog item.");
  const valid = items.filter((item): item is CatalogItem => Boolean(item));
  const days = [...new Set(valid.map(item => item.day))];
  if (days.length !== 1) violations.push("Activities must be on one available day.");
  const day = days[0] ?? daysForScenario(scenario)[0];
  for (const traveler of travelers) {
    if (traveler.availableDay !== day) violations.push(`${traveler.name} is unavailable on ${day}.`);
    if (traveler.dietary === "vegetarian" && valid.some(item => item.category === "meal" && !item.vegetarian)) violations.push(`${traveler.name} needs vegetarian meals.`);
    if (traveler.privateRoomRequired && !valid.some(item => item.category === "stay" && item.privateRoom)) violations.push(`${traveler.name} requires a private room.`);
    for (const id of traveler.requiredItemIds ?? []) if (!itemIds.includes(id)) violations.push(`${traveler.name} requires ${catalog.find(item => item.id === id)?.title ?? id}.`);
  }
  const ordered = [...valid].sort((a, b) => a.starts - b.starts);
  for (let i = 1; i < ordered.length; i++) if (ordered[i].starts < ordered[i - 1].ends) violations.push(`${ordered[i - 1].title} overlaps ${ordered[i].title}.`);
  if (!valid.some(item => item.category === "meal")) violations.push("The plan needs at least one meal.");
  if (scenario === "yosemite" && !valid.some(item => item.category === "stay")) violations.push("The Yosemite plan needs a stay.");
  const costPerPerson = valid.reduce((sum, item) => sum + item.price, 0);
  for (const traveler of travelers) if (costPerPerson > traveler.budget) violations.push(`${traveler.name}'s $${traveler.budget} budget is below the $${costPerPerson} per-person cost.`);
  return { day, costPerPerson, totalGroupCost: costPerPerson * travelers.length, violations };
}

export function feasiblePlan(travelers: Traveler[], preferWater = true) {
  const day = travelers[0]?.availableDay;
  if (!day || travelers.some(t => t.availableDay !== day)) return null;
  const choices = day === DAYS[0]
    ? [preferWater ? ["walk14", "thali14", "kayak14", "dinner14"] : ["walk14", "thali14", "beach14", "dinner14"], ["walk14", "thali14", "beach14"], ["walk14", "beach14", "dinner14"]]
    : [["fort15", "museum15", "lunch15", "ferry15"], ["fort15", "lunch15", "ferry15"], ["fort15", "lunch15"]];
  return choices.find(ids => validatePlan(ids, travelers).violations.length === 0) ?? null;
}

export function feasibilityConflict(travelers: Traveler[], scenario: ScenarioId = "san-diego") {
  const days = [...new Set(travelers.map(t => t.availableDay))];
  if (days.length > 1) return `Travelers have different available days: ${travelers.map(t => `${t.name} ${t.availableDay}`).join(", ")}.`;
  const day = days[0];
  const minimumMeal = Math.min(...catalogForScenario(scenario).filter(item => item.day === day && item.category === "meal" && item.vegetarian).map(item => item.price));
  const short = travelers.filter(t => t.budget < minimumMeal);
  if (short.length) return `${short.map(t => `${t.name}'s $${t.budget} budget`).join(" and ")} cannot cover the cheapest vegetarian meal on ${day} ($${minimumMeal} per person).`;
  return `No non-overlapping catalog itinerary on ${day} satisfies every hard constraint.`;
}
