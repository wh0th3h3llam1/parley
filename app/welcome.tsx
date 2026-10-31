"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Welcome() {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/halls", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(`/invite/${data.token}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not create a hall."); setBusy(false); }
  }
  function join(event: React.FormEvent) {
    event.preventDefault();
    try {
      const url = new URL(link.trim(), window.location.origin);
      const parts = url.pathname.split("/").filter(Boolean);
      const token = parts.at(-1);
      if (!token || !["h", "invite"].includes(parts[0])) throw new Error("Paste a Parley invitation link.");
      router.push(`/h/${token}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Invalid link."); }
  }
  return <main className="welcome-page">
    <header className="site-header"><a className="wordmark" href="/">Parley<span className="wordmark-dot">.</span></a><span className="header-note">Plans people can agree on</span></header>
    <section className="welcome-content">
      <p className="eyebrow">A ROOM FOR GETTING TO YES</p>
      <h1>Plan together<span className="accent">.</span><br />Without the group chat spiral.</h1>
      <p className="welcome-intro">Invite your people, set the limits that matter, and watch their agents negotiate a plan everyone can accept. Trips, dinners, shared purchases: start with a guided Yosemite weekend.</p>
      <button className="primary-button large" onClick={create} disabled={busy}>{busy ? "Creating room…" : "Create Yosemite room"}<span aria-hidden>↗</span></button>
      <button className="text-button" onClick={() => setJoining(!joining)}>Join with a link <span aria-hidden>→</span></button>
      {joining && <form className="join-form" onSubmit={join}><label htmlFor="invite-link">Invitation URL</label><div className="inline-form"><input id="invite-link" value={link} onChange={e => setLink(e.target.value)} placeholder="Paste your hall link" required /><button type="submit">Enter</button></div></form>}
      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
    <footer className="welcome-footer"><span>Four people. Four representatives. One shared plan.</span><span>Illustrative demo profiles and prices · no bookings or live availability</span></footer>
  </main>;
}
