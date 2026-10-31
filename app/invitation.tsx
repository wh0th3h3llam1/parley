"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Invitation({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setUrl(`${window.location.origin}/h/${token}`); }, [token]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setError(""); setTimeout(() => setCopied(false), 2400); }
    catch { setError("Copy failed. Select and copy the URL above."); }
  }
  return <main className="invite-page">
    <header className="site-header"><Link className="wordmark" href="/">Parley<span className="wordmark-dot">.</span></Link><span className="header-note">Room invitation</span></header>
    <section className="invite-card"><p className="eyebrow">YOUR ROOM IS READY</p><h1>Bring everyone<br />to the table.</h1><p>Share this private invitation with your group. Anyone with the link can access this demo room.</p>
      <label htmlFor="hall-url">Invitation link</label><div className="copy-row"><input id="hall-url" readOnly value={url} onFocus={e => e.target.select()} /><button onClick={copy}>{copied ? "Copied" : "Copy link"}</button></div>
      {error && <p role="alert" className="error-text">{error}</p>}
      <Link className="primary-button" href={`/h/${token}`}>Enter chat <span aria-hidden>→</span></Link>
    </section>
    <footer className="welcome-footer"><span>Four representatives · one Yosemite demo</span><span>Bearer link · keep it among your group</span></footer>
  </main>;
}
