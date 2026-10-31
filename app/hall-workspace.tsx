"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { catalogForScenario, HallState, Plan } from "@/lib/domain";
import TripSidebar from "./trip-sidebar";
import Conversation from "./conversation";
import { AgentRoom, MediaBoard } from "./rooms";

type View = "Conversation" | "Travelers" | "Plan";
const views: View[] = ["Conversation", "Travelers", "Plan"];
const stages = ["Preparing", "Proposing", "Negotiating", "Voting", "Agreed"];
const money = (amount: number) => `$${amount.toLocaleString("en-US")}`;
const date = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

export default function HallWorkspace({ token }: { token: string }) {
  const [hall, setHall] = useState<HallState | null>(null);
  const [view, setView] = useState<View>("Conversation");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sending, setSending] = useState(false);
  const [budget, setBudget] = useState("90");
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showStatus, setShowStatus] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/halls/${token}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setHall(data); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load this trip."); }
  }, [token]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 1500);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => { if (hall && !displayName) setDisplayName(hall.travelers[0]?.name ?? ""); }, [hall, displayName]);

  async function act(body: Record<string, unknown>, label: string) {
    setBusy(label); setError("");
    try {
      const response = await fetch(`/api/halls/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
      await refresh();
      return false;
    } finally { setBusy(""); }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || !displayName.trim() || sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch(`/api/halls/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "message", displayName: displayName.trim(), text: message.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  const current = useMemo(() => hall?.plans.find(plan => plan.id === hall.currentPlanId) ?? null, [hall]);
  const lastAgreed = hall?.plans.filter(plan => hall.travelers.every(traveler => plan.votes[traveler.id] === true)).at(-1) ?? null;
  const previous = hall && hall.plans.length > 1 ? hall.plans.at(-2)! : null;
  const accepting = current ? Object.values(current.votes).filter(Boolean).length : 0;

  if (!hall) return <main className="loading-screen"><p className="wordmark">Parley<span className="wordmark-dot">.</span></p><p>{error || "Opening this room…"}</p><Link href="/">Back to welcome</Link></main>;

  const catalog = catalogForScenario(hall.scenario);
  const place = hall.scenario === "yosemite" ? "Yosemite" : "San Diego";
  const working = ["Proposing", "Negotiating", "Voting"].includes(hall.phase);
  const title = view === "Conversation" ? hall.title : view === "Travelers" ? "Your travelers." : hall.phase === "Agreed" ? "The agreed plan." : "The plan board.";
  const description = view === "Conversation" ? "Your group and its representatives, in one conversation." : view === "Travelers" ? "Seeded demo profiles. Set each person’s limits and preferences." : "Every revision, vote and compromise behind this decision.";

  return <main className="hall-shell workspace-shell">
    <header className="hall-header"><Link className="wordmark" href="/">Parley<span className="wordmark-dot">.</span></Link><span className="hall-tag">{place} demo <span>·</span> {hall.phase}</span><Link className="share-link" href={`/invite/${token}`}>Share invitation ↗</Link></header>
    <div className="hall-grid workspace-grid">
      <TripSidebar token={token} hall={hall} />
      <section className={`room-content workspace-content ${view === "Conversation" ? "conversation-view" : ""}`}>
        <div className="room-heading"><div><p className="eyebrow">{place} · private room</p><h1>{title}</h1><p className="room-description">{description}</p></div><span className="phase-badge" aria-live="polite">{hall.phase}</span></div>
        <nav className="view-tabs" aria-label="Trip views">{views.map(item => <button key={item} className={view === item ? "active" : ""} aria-pressed={view === item} onClick={() => setView(item)}>{item}{item === "Conversation" && working && <span className="tab-live-dot" aria-hidden="true" />}</button>)}</nav>
        {hall.awaitingHumanConfirmation && <div className="confirmation-banner" role="status"><div><span className="status-kicker">Your decision</span><strong>Human confirmation needed</strong><p>{hall.scenario === "yosemite" ? "The agents found a cheaper private stay. Confirm the replacement before they finish voting." : "Leo’s revised budget changes the plan. Confirm it before the agents vote."}</p></div><button className="primary-button" disabled={busy === "Confirming"} onClick={() => void act({ type: "confirm" }, "Confirming")}>{busy === "Confirming" ? "Confirming…" : hall.scenario === "yosemite" ? "Confirm private stay →" : "Confirm revised budget →"}</button></div>}
        {working && view !== "Conversation" && !hall.awaitingHumanConfirmation && <div className="negotiation-live" role="status" aria-live="polite"><span className="live-mark" aria-hidden="true" /><div><strong>Representatives are negotiating</strong><p>{hall.events.at(-1)?.message || "The first proposal is being prepared. This can take a few seconds."}</p></div><button className="live-room-link" onClick={() => setView("Conversation")}>Open conversation →</button></div>}
        {view === "Conversation" && <Conversation hall={hall} plan={current} busy={busy} onStart={() => void act({ type: "start" }, "Starting")} onReplay={() => void act({ type: "replay" }, "Replaying")} />}
        {view === "Travelers" && <AgentRoom hall={hall} plan={current} onSave={async traveler => { await act({ type: "traveler", ...traveler }, `Saving ${traveler.name}`); }} />}
        {view === "Plan" && <>{!current && lastAgreed && <div className="history-banner"><span>Previous agreement · v{lastAgreed.version}</span><strong>{date(lastAgreed.day)} · {money(lastAgreed.costPerPerson)} per person</strong><p>Kept for comparison. This plan’s votes no longer apply to the revised constraints.</p></div>}<MediaBoard hall={hall} plan={current} previous={previous} /></>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {hall.error && <div className="error-banner" role="status">{hall.error}</div>}
        <div className="room-bottom">
          {view === "Conversation" ? <form className="chat-composer conversation-composer" onSubmit={sendMessage}><label className="composer-name"><span>Your name</span><input aria-label="Your name" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={40} required /></label><label className="composer-message"><span>Message your group</span><textarea aria-label="Discussion message" value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Write a message…" maxLength={500} rows={1} required /></label><button type="submit" disabled={sending || !message.trim()}>{sending ? "Sending…" : "Send →"}</button></form>
          : view === "Plan" && hall.scenario === "yosemite" ? <div className="bottom-action"><div><strong>{hall.awaitingHumanConfirmation ? "One confirmation away." : current?.version === 4 && hall.phase === "Agreed" ? "The group found its answer." : "What if a hard limit changes?"}</strong><span>{hall.awaitingHumanConfirmation ? "Confirm the cheaper private stay above so the remaining agents can vote." : current?.version === 4 && hall.phase === "Agreed" ? "Four agents accepted the revised private stay, hike and rafting." : "Alice can lower her cap in the conversation. The agents will reopen the plan."}</span></div>{current?.version !== 4 && hall.phase === "Agreed" && <button className="primary-button" onClick={() => { setDisplayName("Alice"); setMessage("Actually, I can only do $400."); setView("Conversation"); }}>Draft Alice’s $400 message →</button>}</div>
          : view === "Plan" ? <div className="bottom-action"><div><strong>Change the terms</strong><span>Reduce Leo’s budget and see what changes.</span></div><div className="budget-action"><label htmlFor="leo-budget">Leo’s new budget</label><div><span>$</span><input id="leo-budget" type="number" min="0" max="100000" value={budget} onChange={event => setBudget(event.target.value)} /></div><button className="primary-button" disabled={Boolean(busy)} onClick={async () => { if (await act({ type: "reduceBudget", amount: Number(budget) }, "Updating")) await act({ type: hall.plans.at(-1)?.source === "sample" ? "replay" : "start" }, "Renegotiating"); }}>{hall.plans.at(-1)?.source === "sample" ? "Reduce & sample replay →" : "Reduce & renegotiate →"}</button></div></div>
          : <div className="bottom-action"><div><strong>Ready to negotiate?</strong><span>Four representatives will work toward one acceptable plan.</span></div><div className="action-buttons"><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void act({ type: "replay" }, "Replaying")}>{busy === "Replaying" ? "Replaying…" : "Sample replay"}</button><button className="primary-button" disabled={Boolean(busy)} onClick={() => void act({ type: "start" }, "Starting")}>Start planning →</button></div></div>}
        </div>
      </section>
      <aside className={`status-rail ${showStatus ? "expanded" : ""}`}><button className="mobile-status-toggle" aria-expanded={showStatus} aria-controls="negotiation-details" onClick={() => setShowStatus(!showStatus)}>Negotiation status <span>{showStatus ? "−" : "+"}</span></button><div className="status-inner" id="negotiation-details"><p className="eyebrow">This room</p><h2>{hall.phase === "Blocked" ? "Needs attention." : hall.phase === "Agreed" ? "All agreed." : working ? "Finding common ground." : "Ready when you are."}</h2><div className="stage-list">{stages.map((stage, index) => <div key={stage} className={`stage ${hall.phase === stage ? "current" : ""} ${stages.indexOf(hall.phase) > index ? "done" : ""}`}><span className="stage-mark" aria-label={stages.indexOf(hall.phase) > index ? "Completed" : undefined}>{stages.indexOf(hall.phase) > index ? "" : String(index + 1).padStart(2, "0")}</span><span>{stage}</span></div>)}</div><div className="vote-box"><strong>{accepting}/{hall.travelers.length} accept</strong><span>{current ? `Plan v${current.version}` : "No current vote"}</span></div>{current && <div className="rail-plan-preview"><span>Current proposal</span><strong>{money(current.costPerPerson)} <small>per person</small></strong><p>{current.itemIds.map(id => catalog.find(item => item.id === id)?.title).filter(Boolean).join(" · ")}</p><button onClick={() => setView("Plan")}>Review plan →</button></div>}<div className="rail-divider" /><p className="eyebrow">At the table</p><div className="agent-statuses">{hall.travelers.map(traveler => <div key={traveler.id}><span className={`avatar avatar-${traveler.id}`}>{traveler.name[0]}</span><div><strong>{traveler.name}</strong><span>Agent: {traveler.agentStatus}</span></div><span className="presence">Human: unknown</span></div>)}</div><details className="rail-details"><summary>Connection details</summary><div className="integration"><span>Storage</span><strong>SQLite local</strong></div><div className="integration"><span>Agent Relay</span><strong>{current?.source === "sample" ? "Sample replay · not used" : hall.integrations.relay}</strong></div><div className="integration"><span>OpenAI</span><strong>{current?.source === "sample" ? "Sample replay · not used" : hall.integrations.openai}</strong></div><button className="reset-button" onClick={() => { if (window.confirm("Reset this room’s demo negotiation? Traveler preferences and discussion messages remain.")) void act({ type: "reset" }, "Resetting"); }} disabled={Boolean(busy)}>Reset this room’s negotiation</button></details></div></aside>
    </div>
  </main>;
}
