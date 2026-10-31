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
    } catch (error) { setError(error instanceof Error ? error.message : "Could not create a room."); setBusy(false); }
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
    <header className="site-header"><a className="wordmark" href="/">Parley<span className="wordmark-dot">.</span></a></header>
    <section className="welcome-content">
      <p className="eyebrow">DECIDE TOGETHER</p>
      <h1>Make plans<span className="accent">.</span><br />Find agreement.</h1>
      <p className="welcome-intro">Create a room. Invite your group. Let your agents work through the details.</p>
      <button className="primary-button large" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create room"}<span aria-hidden>↗</span></button>
      <button className="text-button" onClick={() => setJoining(!joining)}>Join with a link <span aria-hidden>→</span></button>
      {joining && <form className="join-form" onSubmit={join}><label htmlFor="invite-link">Invitation link</label><div className="inline-form"><input id="invite-link" value={link} onChange={e => setLink(e.target.value)} placeholder="Paste room link" required /><button type="submit">Enter</button></div></form>}
      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
    <footer className="welcome-footer"><span>One room. One decision.</span><span>Sample room included</span></footer>
  </main>;
}
