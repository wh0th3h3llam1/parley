import { NextResponse } from "next/server";
import { z } from "zod";
import { createHall } from "@/lib/store";

export const runtime = "nodejs";
const newHallSchema = z.object({ title: z.string().trim().min(1).max(60), scenario: z.enum(["yosemite", "san-diego"]).optional() }).strict();
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 2048) return NextResponse.json({ error: "Trip name is too long." }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 2048) return NextResponse.json({ error: "Trip name is too long." }, { status: 413 });
    let title = "Yosemite weekend";
    let scenario: "yosemite" | "san-diego" = "yosemite";
    if (raw) {
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
      const parsed = newHallSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Enter a trip name (up to 60 characters)." }, { status: 400 });
      title = parsed.data.title;
      scenario = parsed.data.scenario ?? "yosemite";
    }
    const hall = await createHall(title, scenario);
    return NextResponse.json({ token: hall.token, mode: hall.mode, scenario: hall.scenario }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create hall." }, { status: 500 });
  }
}
