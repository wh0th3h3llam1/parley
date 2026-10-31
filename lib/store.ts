import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { HallState, HumanMessage, ScenarioId, SEED_TRAVELERS, YOSEMITE_TRAVELERS } from "./domain";

const dataDirectory = path.join(process.cwd(), ".data");
const databaseFile = path.join(dataDirectory, "trip-parliament.sqlite");
const legacyFile = path.join(dataDirectory, "halls.json");

function openDatabase() {
  mkdirSync(dataDirectory, { recursive: true });
  const database = new DatabaseSync(databaseFile);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  database.exec(`CREATE TABLE IF NOT EXISTS halls (
    id TEXT PRIMARY KEY,
    invite_token TEXT NOT NULL UNIQUE,
    active_run_id TEXT,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  if (existsSync(legacyFile) && Number((database.prepare("SELECT COUNT(*) AS count FROM halls").get() as { count: number }).count) === 0) {
    const oldHalls = JSON.parse(readFileSync(legacyFile, "utf8")) as HallState[];
    const insert = database.prepare("INSERT OR IGNORE INTO halls (id, invite_token, active_run_id, state_json) VALUES (?, ?, ?, ?)");
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const old of oldHalls) {
        const hall: HallState = {
          ...old,
          mode: "sqlite",
          activeRunId: null,
          phase: old.activeRunId ? "Preparing" : old.phase,
          integrations: { ...old.integrations, storage: "connected" }
        };
        insert.run(hall.id, hall.token, null, JSON.stringify(hall));
      }
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
  }
  // A destination/currency change invalidates old costed plans. Keep invitation
  // links and discussion, with the earlier JSON file as the unchanged backup.
  const oldRows = database.prepare("SELECT id, state_json FROM halls").all() as { id: string; state_json: string }[];
  const updateScenario = database.prepare("UPDATE halls SET active_run_id = NULL, state_json = ? WHERE id = ?");
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const row of oldRows) {
      const hall = JSON.parse(row.state_json) as HallState;
      if (hall.scenarioVersion >= 2) continue;
      hall.scenarioVersion = 2;
      hall.mode = "sqlite";
      hall.travelers = hall.travelers.map(traveler => ({
        ...traveler, budget: Math.max(0, Math.round(traveler.budget / 16)), agentStatus: "Ready"
      }));
      hall.phase = "Preparing"; hall.activeRunId = null; hall.currentPlanId = null;
      hall.awaitingHumanConfirmation = false;
      hall.planVersion = 0; hall.error = null; hall.events = []; hall.plans = [];
      hall.integrations = { storage: "connected", relay: "unconfigured", openai: "unconfigured" };
      updateScenario.run(JSON.stringify(hall), hall.id);
    }
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return database;
}

const database = openDatabase();
const byToken = database.prepare("SELECT state_json, active_run_id FROM halls WHERE invite_token = ?");
const byId = database.prepare("SELECT state_json, active_run_id FROM halls WHERE id = ?");
const insertHall = database.prepare("INSERT INTO halls (id, invite_token, active_run_id, state_json) VALUES (?, ?, ?, ?)");
const updateHall = database.prepare("UPDATE halls SET active_run_id = ?, state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
const updateIfIdle = database.prepare("UPDATE halls SET active_run_id = ?, state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND active_run_id IS NULL");

function deserialize(row: unknown): HallState | null {
  if (!row) return null;
  const saved = row as { state_json: string; active_run_id: string | null };
  const hall = JSON.parse(saved.state_json) as HallState;
  hall.scenario = hall.scenario === "yosemite" ? "yosemite" : "san-diego";
  hall.title = typeof hall.title === "string" && hall.title.trim() ? hall.title : hall.scenario === "yosemite" ? "Yosemite weekend" : "San Diego day trip";
  hall.activeRunId = saved.active_run_id;
  hall.mode = "sqlite";
  hall.integrations.storage = "connected";
  return hall;
}

export async function createHall(title = "Yosemite weekend", scenario: ScenarioId = "yosemite"): Promise<HallState> {
  const hall: HallState = {
    id: randomUUID(), token: randomBytes(24).toString("base64url"), title, scenario, scenarioVersion: scenario === "yosemite" ? 3 : 2, phase: "Preparing",
    activeRunId: null, awaitingHumanConfirmation: false, planVersion: 0, currentPlanId: null, error: null,
    mode: "sqlite", travelers: structuredClone(scenario === "yosemite" ? YOSEMITE_TRAVELERS : SEED_TRAVELERS), events: [], plans: [], humanMessages: [],
    integrations: { storage: "connected", relay: "unconfigured", openai: "unconfigured" }
  };
  insertHall.run(hall.id, hall.token, null, JSON.stringify(hall));
  return hall;
}

export async function readHall(token: string): Promise<HallState | null> {
  return deserialize(byToken.get(token));
}

export async function saveHall(hall: HallState, expectedRunId: string | null = hall.activeRunId) {
  // Human discussion can be added while an awaited agent run is in progress.
  // Merge it from the latest row before writing the run's snapshot.
  database.exec("BEGIN IMMEDIATE");
  try {
    const fresh = deserialize(byId.get(hall.id));
    if (!fresh) throw new Error("Hall not found.");
    if (fresh.activeRunId !== expectedRunId) throw new Error("Hall changed during this action. Refresh and retry.");
    const messages = new Map(fresh.humanMessages.map(message => [message.id, message]));
    hall.humanMessages.forEach(message => messages.set(message.id, message));
    hall.humanMessages = [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    updateHall.run(hall.activeRunId, JSON.stringify(hall), hall.id);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export async function beginRun(hall: HallState, runId: string) {
  const fresh = deserialize(byId.get(hall.id));
  if (!fresh || fresh.activeRunId) return false;
  fresh.activeRunId = runId; fresh.awaitingHumanConfirmation = false; fresh.phase = "Proposing"; fresh.error = null;
  return updateIfIdle.run(runId, JSON.stringify(fresh), hall.id).changes === 1;
}

export async function resetNegotiation(hall: HallState) {
  hall.phase = "Preparing"; hall.activeRunId = null; hall.currentPlanId = null;
  hall.awaitingHumanConfirmation = false;
  hall.planVersion = 0; hall.error = null; hall.events = []; hall.plans = [];
  hall.travelers.forEach(t => { t.agentStatus = "Ready"; });
  await saveHall(hall);
}

export async function addHumanMessage(hall: HallState, message: HumanMessage, budgetChange?: { travelerId: string; amount: number }) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const fresh = deserialize(byId.get(hall.id));
    if (!fresh) throw new Error("Hall not found.");
    fresh.humanMessages.push(message);
    if (budgetChange) {
      const traveler = fresh.travelers.find(person => person.id === budgetChange.travelerId);
      if (!traveler) throw new Error("Traveler not found.");
      traveler.budget = budgetChange.amount;
      fresh.travelers.forEach(person => { person.agentStatus = "Ready"; });
      fresh.currentPlanId = null;
      fresh.phase = "Preparing";
      fresh.error = null;
    }
    updateHall.run(fresh.activeRunId, JSON.stringify(fresh), hall.id);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}
