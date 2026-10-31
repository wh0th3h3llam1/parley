# Decisions

- **Approved scope:** One seeded San Diego trip, four representatives, three rooms, invitation links, budget disruption, and a visible negotiation. Activity prices are illustrative USD per person.
- **Persistent state:** SQLite is authoritative for all halls on this server. It imported the prior JSON hall snapshots so invitation links remain valid. Browser polling every 1.5 seconds reads persisted snapshots.
- **Sample mode:** A clearly labeled scripted replay in SQLite makes the demo usable when model credentials are absent. Sample decisions do not masquerade as OpenAI or Relay output.
- **Relay causality:** The live coordinator only persists a decision after reading the message from the Relay inbox. The next agent’s prompt uses those received events. A preflight delivery is required in each run.
- **Consensus:** The application validates catalog items and hard constraints, computes prices, and accepts only four yes votes on one unchanged plan version.
- **Execution:** A bounded awaited server request handles a maximum of three rounds. SQLite's conditional update prevents duplicate starts, and writes check the run ID to prevent stale overwrites.
- **Tradeoffs for the hour:** No authentication, bookings, uploads, maps, Terse, or production presence tracking. The invitation token grants full demo hall access.
- **Dependency security:** Upgraded the empty project to Next.js 16.4.3 after audit found a PostCSS advisory through Next 15. The production dependency audit reports zero vulnerabilities.
- **Database substitution:** Supabase is out of the runtime path because the user asked for another database while it is unavailable. Node's built-in SQLite driver gives this local demo a transactional on-disk store without another service. It requires Node 22.16+ and is not a shared hosted database.
- **Relay credentials:** The supplied Cloud API and Relayfile read tokens are not the Relaycast workspace key required by the installed messaging SDK. The verified transport check used a temporary workspace.
- **Runtime network:** The initial live failure was `fetch failed` in a sandboxed dev server. The same workspace and full live flow passed when the server had outbound network access. Live runs clear the active proposal before generating decisions so votes from sample history cannot count toward live consensus.
