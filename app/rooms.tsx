"use client";

import { useEffect, useState } from "react";
import { catalogForScenario, daysForScenario, HallState, Plan, Traveler } from "@/lib/domain";

const money = (amount: number) => `$${amount.toLocaleString("en-US")}`;
const date = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

export function AgentRoom({ hall, plan, onSave }: { hall: HallState; plan: Plan | null; onSave: (traveler: Traveler) => void }) {
  const [drafts, setDrafts] = useState(hall.travelers);
  const travelerKey = JSON.stringify(hall.travelers);
  useEffect(() => { setDrafts(hall.travelers); }, [travelerKey]);
  const catalog = catalogForScenario(hall.scenario);
  const days = daysForScenario(hall.scenario);
  const latest = hall.events.filter(event => ["object", "counter", "concede"].includes(event.action)).at(-1) ?? hall.events.at(-1);
  const change = (id: string, patch: Partial<Traveler>) => setDrafts(previous => previous.map(person => person.id === id ? { ...person, ...patch } : person));

  return <div className="agent-room">
    <span className="suggestion">{hall.scenario === "yosemite" ? "Yosemite weekend · guided demo" : "San Diego day trip · sample destination"}</span>
    <div className="section-topline"><h2>At the table</h2><span>Hard limits <b>●</b> preferences <em>○</em></span></div>
    <div className="traveler-grid">{drafts.map(person => <form key={person.id} className="traveler-card" onSubmit={event => { event.preventDefault(); onSave(person); }}>
      <div className="traveler-top"><span className={`avatar avatar-${person.id}`}>{person.name[0]}</span><div><h3>{person.name}</h3><span>Represented by {person.name} agent</span></div></div>
      {(person.privateRoomRequired || person.requiredItemIds?.length) && <p className="traveler-hard-rules">{person.privateRoomRequired && <span>Private room required</span>}{person.requiredItemIds?.map(id => <span key={id}>{catalog.find(item => item.id === id)?.title ?? id} required</span>)}</p>}
      <div className="field-pair"><label>Budget <span className="hard-dot">●</span><div className="amount-input"><span>$</span><input type="number" min="0" max="100000" value={person.budget} onChange={event => change(person.id, { budget: Number(event.target.value) })} /></div></label><label>Available day <span className="hard-dot">●</span><select value={person.availableDay} onChange={event => change(person.id, { availableDay: event.target.value })}>{days.map(day => <option key={day} value={day}>{new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</option>)}</select></label></div>
      <div className="field-pair"><label>Dietary <span className="hard-dot">●</span><select value={person.dietary} onChange={event => change(person.id, { dietary: event.target.value as Traveler["dietary"] })}><option value="none">No restriction</option><option value="vegetarian">Vegetarian</option></select></label><label>Preference <span className="soft-dot">○</span><input value={person.preference} onChange={event => change(person.id, { preference: event.target.value })} /></label></div>
      <button className="save-button" type="submit">Save preferences →</button>
    </form>)}</div>
    <div className="proposal-strip"><div><p className="eyebrow">Current proposal</p><h2>{plan ? `${date(plan.day)} · ${money(plan.costPerPerson)} / person` : hall.scenario === "yosemite" ? "A shared Yosemite weekend" : "A shared day in San Diego"}</h2><p>{plan ? plan.itemIds.map(id => catalog.find(item => item.id === id)?.title).join(" · ") : "Start planning or choose Sample replay to put a proposal on the table."}</p></div><div className="latest-note"><span>Latest exchange</span><strong>{latest ? `${latest.sender} → ${latest.recipient}` : "Waiting for the first proposal"}</strong><p>{latest?.message || "The negotiation will appear here as it happens."}</p></div></div>
  </div>;
}

export function MediaBoard({ hall, plan, previous }: { hall: HallState; plan: Plan | null; previous: Plan | null }) {
  const catalog = catalogForScenario(hall.scenario);
  const concessions = hall.events.filter(event => event.action === "concede");
  const accepted = (candidate: Plan) => hall.travelers.every(person => candidate.votes[person.id] === true);
  return <div className="media-board">
    <div className="plan-ribbon"><span>{!plan ? "Plan board" : plan.source === "sample" ? "Guided sample replay" : "Live plan · Agent Relay"}</span><strong>{plan ? `${date(plan.day)} · v${plan.version}` : "Waiting for a proposal"}</strong></div>
    {hall.plans.length > 0 && <div className="plan-history"><div className="section-topline"><h2>How the plan changed</h2><span>{hall.plans.length} version{hall.plans.length === 1 ? "" : "s"}</span></div><ol>{hall.plans.map(candidate => <li key={candidate.id} className={candidate.id === hall.currentPlanId ? "current" : ""}><span>v{candidate.version}</span><strong>{money(candidate.costPerPerson)}</strong><small>{accepted(candidate) ? "Accepted" : candidate.violations.length ? "Over a hard limit" : "Under review"}</small></li>)}</ol></div>}
    {plan ? <><div className="board-columns"><div><div className="section-topline"><h2>{hall.scenario === "yosemite" ? "Weekend itinerary" : "Day itinerary"}</h2><span>Illustrative USD · per person</span></div><div className="itinerary">{plan.itemIds.map(id => { const item = catalog.find(entry => entry.id === id); return item ? <div key={id}><span>{item.time}</span><strong>{item.title}</strong><em>{money(item.price)}</em></div> : null; })}<div className="itinerary-total"><span>Per person</span><strong>{money(plan.costPerPerson)}</strong></div><div className="itinerary-total group"><span>Group of {hall.travelers.length}</span><strong>{money(plan.totalGroupCost)}</strong></div></div></div><div><div className="section-topline"><h2>Acceptance</h2><span>{Object.values(plan.votes).filter(Boolean).length}/{hall.travelers.length} accept</span></div><div className="vote-list">{hall.travelers.map(person => <div key={person.id}><span className={`avatar avatar-${person.id}`}>{person.name[0]}</span><strong>{person.name}</strong><span>{plan.votes[person.id] ? "Accepted" : "Awaiting vote"}</span></div>)}</div><div className="constraint-box"><strong>Hard constraints</strong><p>{plan.violations.length ? plan.violations.join(" ") : "No violations in this plan."}</p></div></div></div><div className="board-columns lower"><div><div className="section-topline"><h2>Who compromised?</h2></div>{concessions.length ? concessions.map(event => <p className="concession" key={event.id}><strong>{event.sender.replace(" agent", "")}</strong><span>{event.message}</span></p>) : <p className="muted">No concessions recorded yet.</p>}</div><div><div className="section-topline"><h2>Before / after</h2></div>{previous ? <div className="comparison"><div><span>Before · v{previous.version}</span><strong>{money(previous.costPerPerson)}</strong><p>{previous.itemIds.map(id => catalog.find(item => item.id === id)?.title).join(" · ")}</p></div><span className="comparison-arrow">→</span><div><span>After · v{plan.version}</span><strong>{money(plan.costPerPerson)}</strong><p>{plan.itemIds.map(id => catalog.find(item => item.id === id)?.title).join(" · ")}</p></div></div> : <p className="muted">The first revision will appear here.</p>}</div></div></> : <div className="empty-state"><h2>No plan on the board yet.</h2><p>Start the conversation to see proposals, objections, and tradeoffs.</p></div>}
    <p className="board-note">Illustrative {hall.scenario === "yosemite" ? "Yosemite" : "San Diego"} activities and USD prices. No travel search, booking, or availability claim.</p>
  </div>;
}
