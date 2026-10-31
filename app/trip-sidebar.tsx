"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HallState } from "@/lib/domain";

type RecentTrip = {
  token: string;
  title: string;
  phase: HallState["phase"];
  preview: string;
  lastOpenedAt: number;
};

const storageKey = "trip-parliament:recent-trips:v1";
const tokenPattern = /^[A-Za-z0-9_-]{32}$/;
const phases = new Set<HallState["phase"]>(["Preparing", "Proposing", "Negotiating", "Voting", "Agreed", "Blocked"]);

function readRecentTrips(): RecentTrip[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]") as unknown;
    if (!Array.isArray(saved)) return [];
    return saved.filter((trip): trip is RecentTrip =>
      Boolean(trip && typeof trip === "object" &&
        "token" in trip && typeof trip.token === "string" && tokenPattern.test(trip.token) &&
        "title" in trip && typeof trip.title === "string" && trip.title.length <= 60 &&
        "phase" in trip && typeof trip.phase === "string" && phases.has(trip.phase as HallState["phase"]) &&
        "preview" in trip && typeof trip.preview === "string" &&
        "lastOpenedAt" in trip && typeof trip.lastOpenedAt === "number" && Number.isFinite(trip.lastOpenedAt))
    ).slice(0, 20);
  } catch {
    return [];
  }
}

function saveRecentTrips(trips: RecentTrip[]) {
  try { localStorage.setItem(storageKey, JSON.stringify(trips.slice(0, 20))); } catch { /* Private browsing can disable storage. */ }
}

export default function TripSidebar({ token, hall }: { token: string; hall: HallState }) {
  const router = useRouter();
  const [trips, setTrips] = useState<RecentTrip[]>([]);
  const [creating, setCreating] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newScenario, setNewScenario] = useState<"yosemite" | "san-diego">("yosemite");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = hall.events.at(-1)?.message || hall.humanMessages.at(-1)?.text || "Set the terms and begin planning";

  useEffect(() => {
    const stored = readRecentTrips();
    const current: RecentTrip = { token, title: hall.title, phase: hall.phase, preview: latest, lastOpenedAt: Date.now() };
    const next = [current, ...stored.filter(trip => trip.token !== token)].slice(0, 20);
    setTrips(next);
    saveRecentTrips(next);
  }, [token, hall.title, hall.phase, latest]);

  useEffect(() => {
    const sync = () => setTrips(readRecentTrips());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  async function createTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/halls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, scenario: newScenario }) });
      const data = await response.json();
      if (!response.ok || !tokenPattern.test(data.token || "")) throw new Error(data.error || "Could not create a trip.");
      const next: RecentTrip[] = [{ token: data.token, title, phase: "Preparing" as const, preview: "Set the terms and begin planning", lastOpenedAt: Date.now() }, ...readRecentTrips()].slice(0, 20);
      saveRecentTrips(next);
      setTrips(next); setCreating(false); setNewTitle("");
      router.push(`/h/${data.token}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a trip.");
    } finally { setBusy(false); }
  }

  return <aside className="trip-sidebar" aria-label="Trip chats">
    <div className="trip-sidebar-top"><div><p className="sidebar-caption">Your workspace</p><h2>Rooms</h2></div><button className="mobile-trip-toggle" aria-expanded={mobileOpen} aria-controls="recent-trip-list" onClick={() => setMobileOpen(value => !value)}>{mobileOpen ? "Hide rooms −" : "Show rooms +"}</button><button className="new-trip-button" onClick={() => { setCreating(value => !value); setMobileOpen(true); }} aria-expanded={creating} aria-controls={creating ? "new-trip-form" : undefined}>{creating ? "Close" : "+ New"}</button></div>
    {creating && <form id="new-trip-form" className="new-trip-form" onSubmit={createTrip}>
      <label htmlFor="new-trip-scenario">Sample room</label>
      <select id="new-trip-scenario" value={newScenario} onChange={event => setNewScenario(event.target.value as "yosemite" | "san-diego")}><option value="yosemite">Yosemite weekend · four friends</option><option value="san-diego">San Diego day trip · four friends</option></select>
      <label htmlFor="new-trip-title">Name this room</label>
      <input id="new-trip-title" value={newTitle} onChange={event => setNewTitle(event.target.value)} maxLength={60} placeholder={newScenario === "yosemite" ? "Yosemite with friends" : "San Diego with friends"} required />
      <p>Each room has separate people, messages, and plan history. Yosemite is the guided negotiation demo.</p>
      <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create room →"}</button>
    </form>}
    {error && <p role="alert" className="sidebar-error">{error}</p>}
    <nav id="recent-trip-list" className={`trip-list ${mobileOpen ? "mobile-open" : ""}`} aria-label="Recent rooms">
      {trips.map((trip, index) => <Link key={trip.token} href={`/h/${trip.token}`} className={`trip-item ${trip.token === token ? "selected" : ""}`} aria-current={trip.token === token ? "page" : undefined}>
        <span className="trip-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="trip-item-copy"><strong>{trip.title}</strong><small>{trip.token === token ? latest : trip.preview || "Open conversation"}</small></span>
        <span className={`trip-phase-dot ${trip.phase.toLowerCase()}`} title={trip.phase} role="img" aria-label={trip.phase} />
      </Link>)}
    </nav>
    <div className="trip-sidebar-footer"><span className="trip-foot-route" aria-hidden="true" /><strong>One room, one shared plan.</strong><p>Recent rooms are saved in this browser. Invite links open individual conversations.</p></div>
  </aside>;
}
