"use client";

import { useEffect, useMemo, useRef } from "react";
import { HallState, Plan } from "@/lib/domain";

type ChatItem =
  | { kind: "agent"; id: string; time: string; order: number; event: HallState["events"][number] }
  | { kind: "human"; id: string; time: string; order: number; message: HallState["humanMessages"][number] };

const actionName: Record<HallState["events"][number]["action"], string> = {
  propose: "Proposed", counter: "Countered", object: "Raised a concern", concede: "Compromised", accept: "Accepted"
};

function timeLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function senderId(name: string) {
  return ["alice", "parth", "aarsh", "maya", "leo", "priya"].find(id => name.toLowerCase().startsWith(id)) || "coordinator";
}

export default function Conversation({ hall, plan, busy, onStart, onReplay }: {
  hall: HallState;
  plan: Plan | null;
  busy: string;
  onStart: () => void;
  onReplay: () => void;
}) {
  const threadRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const items = useMemo<ChatItem[]>(() => {
    const events: ChatItem[] = hall.events.map((event, order) => ({ kind: "agent", id: event.id, time: event.createdAt || "", order, event }));
    const humans: ChatItem[] = hall.humanMessages.map((message, order) => ({ kind: "human", id: message.id, time: message.createdAt, order: events.length + order, message }));
    return [...events, ...humans].sort((a, b) => {
      if (!a.time && !b.time) return a.order - b.order;
      if (!a.time) return -1;
      if (!b.time) return 1;
      return a.time.localeCompare(b.time) || a.order - b.order;
    });
  }, [hall.events, hall.humanMessages]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread && nearBottom.current) thread.scrollTop = thread.scrollHeight;
  }, [items.length, hall.phase]);

  useEffect(() => {
    const showLatestAfterResize = () => requestAnimationFrame(() => {
      const thread = threadRef.current;
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
    window.addEventListener("resize", showLatestAfterResize);
    return () => window.removeEventListener("resize", showLatestAfterResize);
  }, []);

  const working = ["Proposing", "Negotiating", "Voting"].includes(hall.phase);
  return <section className="conversation" aria-label="Trip conversation">
    <div className="conversation-plan"><div><span className="conversation-plan-label">{plan ? `Plan v${plan.version}` : "On the table"}</span><strong>{plan ? `${new Date(`${plan.day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · $${plan.costPerPerson} per person` : "No proposal yet"}</strong></div><span className="conversation-plan-votes">{plan ? plan.violations.length ? "Needs revision" : `${Object.values(plan.votes).filter(Boolean).length}/${hall.travelers.length} accept` : `${hall.travelers.length} voices`}</span></div>
    <div className="conversation-thread" ref={threadRef} role="log" aria-label="Messages and agent negotiation" aria-live="polite" aria-relevant="additions" onScroll={event => { const node = event.currentTarget; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100; }}>
      <div className="conversation-day"><span>Trip conversation</span></div>
      {hall.events.length === 0 && <div className="conversation-empty"><div className="empty-route" aria-hidden="true">{hall.travelers.map(person => <span key={person.id}>{person.name[0]}</span>)}</div><p className="empty-overline">The group is here</p><h2>Let the conversation begin.</h2><p>{hall.scenario === "yosemite" ? "Alice has a $420 cap. Parth needs private rooms. Aarsh wants the hike and rafting. Watch their agents work through the tradeoffs." : "Set everyone’s limits, then watch the representatives propose and agree on one day together."}</p><div className="empty-actions"><button className="primary-button" disabled={Boolean(busy || working)} onClick={onStart}>{busy === "Starting" ? "Starting…" : "Start planning →"}</button><button className="secondary-button" disabled={Boolean(busy || working)} onClick={onReplay}>Try sample replay</button></div><small className="demo-disclosure">Seeded demo profiles and illustrative prices. Personal files and calendars are not connected.</small></div>}
      {items.map(item => item.kind === "agent" ? <article className="chat-message agent-message" key={item.id}>
        <span className={`chat-avatar avatar-${senderId(item.event.sender)}`} aria-hidden="true">{item.event.sender[0]}</span>
        <div className="chat-message-main"><div className="chat-message-meta"><strong>{item.event.sender}</strong><span>{actionName[item.event.action]} · Round {item.event.round}{item.time ? ` · ${timeLabel(item.time)}` : ""}</span></div><div className="chat-bubble"><p>{item.event.message}</p></div><small>To {item.event.recipient}{item.event.payload.transport === "agent-relay" ? " · delivered via Agent Relay" : ""}</small></div>
      </article> : <article className="chat-message human-message" key={item.id}>
        <div className="chat-message-main"><div className="chat-message-meta"><strong>{item.message.displayName}</strong><span>{timeLabel(item.time)}</span></div><div className="chat-bubble"><p>{item.message.text}</p></div></div><span className="chat-avatar human-avatar" aria-hidden="true">{item.message.displayName[0]?.toUpperCase()}</span>
      </article>)}
      {working && <div className="chat-typing" role="status"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span><span>{hall.awaitingHumanConfirmation ? "Waiting for your confirmation" : hall.phase === "Voting" ? "Representatives are reviewing the vote" : "Representatives are negotiating"}</span></div>}
      {hall.phase === "Agreed" && <div className="conversation-outcome" role="status"><span className="outcome-icon" aria-hidden="true" /><strong>Plan v{plan?.version} accepted by everyone.</strong><span>Open the Plan tab to see every revision and tradeoff.</span></div>}
    </div>
  </section>;
}
