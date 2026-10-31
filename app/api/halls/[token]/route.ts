import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DAYS, daysForScenario, HallState, YOSEMITE_DAYS } from "@/lib/domain";
import { addHumanMessage, readHall, resetNegotiation, saveHall } from "@/lib/store";
import { runSampleReplay } from "@/lib/replay";
import { runLive } from "@/lib/live";
import { confirmYosemite } from "@/lib/yosemite";

export const runtime = "nodejs";
export const maxDuration = 180;
type Context = { params: Promise<{ token: string }> };
const travelerSchema = z.object({
  type: z.literal("traveler"), id: z.string(), budget: z.number().int().min(0).max(100000),
  availableDay: z.enum([...DAYS, ...YOSEMITE_DAYS]), dietary: z.enum(["none", "vegetarian"]), preference: z.string().trim().min(1).max(100)
});
const actionSchema = z.discriminatedUnion("type", [
  travelerSchema,
  z.object({ type: z.literal("message"), displayName: z.string().trim().min(1).max(40), text: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("replay") }),
  z.object({ type: z.literal("reduceBudget"), amount: z.number().int().min(0).max(100000) }),
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("confirm") })
]);
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { token } = await context.params;
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return json({ error: "Hall not found." }, 404);
    const hall = await readHall(token);
    if (!hall) return json({ error: "Hall not found." }, 404);
    return json(hall);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to load hall." }, 500); }
}

export async function POST(request: NextRequest, context: Context) {
  let hall: HallState | null = null;
  try {
    const { token } = await context.params;
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return json({ error: "Hall not found." }, 404);
    hall = await readHall(token);
    if (!hall) return json({ error: "Hall not found." }, 404);
    if (Number(request.headers.get("content-length") ?? 0) > 8192) return json({ error: "Action is too large." }, 413);
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "Action is too large." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON body." }, 400); }
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Invalid action or field values." }, 400);
    const action = parsed.data;
    if (hall.activeRunId && !["message", "confirm"].includes(action.type)) return json({ error: "A negotiation is already running." }, 409);
    if (action.type === "traveler") {
      const traveler = hall.travelers.find(t => t.id === action.id);
      if (!traveler) return json({ error: "Traveler not found." }, 404);
      if (!daysForScenario(hall.scenario).some(day => day === action.availableDay)) return json({ error: "That day is outside this room's scenario." }, 400);
      Object.assign(traveler, { budget: action.budget, availableDay: action.availableDay, dietary: action.dietary, preference: action.preference });
      hall.phase = "Preparing"; hall.currentPlanId = null; hall.error = null;
      await saveHall(hall);
    } else if (action.type === "message") {
      const match = action.text.match(/(?:only|budget|cap|limit)[^$]{0,35}\$\s*(\d{1,6})\b/i);
      const newBudget = match ? Number(match[1]) : null;
      const aliceBudget = hall.travelers.find(person => person.id === "alice")?.budget;
      const previousPlanId = hall.currentPlanId;
      const previousSource = hall.plans.find(plan => plan.id === previousPlanId)?.source;
      const currentCost = hall.plans.find(plan => plan.id === previousPlanId)?.costPerPerson;
      const budgetChanged = hall.scenario === "yosemite" && hall.phase === "Agreed" && action.displayName.toLowerCase() === "alice" && newBudget !== null && newBudget <= 100000 && aliceBudget !== undefined && currentCost !== undefined && newBudget < aliceBudget && newBudget < currentCost;
      await addHumanMessage(hall, { id: randomUUID(), displayName: action.displayName, text: action.text, createdAt: new Date().toISOString() }, budgetChanged ? { travelerId: "alice", amount: newBudget! } : undefined);
      if (budgetChanged) await (previousSource === "live" ? runLive(token) : runSampleReplay(token));
    } else if (action.type === "confirm") {
      if (!hall.awaitingHumanConfirmation || !hall.activeRunId) return json({ error: "No human confirmation is pending." }, 409);
      if (hall.scenario === "yosemite") await confirmYosemite(token);
      else { hall.awaitingHumanConfirmation = false; await saveHall(hall); }
    } else if (action.type === "reduceBudget") {
      if (hall.scenario === "yosemite") return json({ error: "Alice can revise her budget by sending a message in this demo." }, 400);
      const leo = hall.travelers.find(t => t.id === "leo")!;
      leo.budget = action.amount;
      hall.travelers.forEach(t => { t.agentStatus = "Ready"; });
      hall.phase = "Preparing"; hall.currentPlanId = null; hall.error = null;
      await saveHall(hall);
      return json({ ok: true, next: "replay" });
    } else if (action.type === "reset") {
      await resetNegotiation(hall);
    } else if (action.type === "replay") {
      await runSampleReplay(token);
    } else if (action.type === "start") {
      await runLive(token);
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Action failed." }, 500);
  }
}
