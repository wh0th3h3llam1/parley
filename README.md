# Parley

Parley is a local demo of group decisions made through a shared room. The featured Yosemite room follows four seeded representatives through objections, concessions, four plan versions, a human budget change, a stay confirmation, and unanimous acceptance. A separate San Diego room keeps the earlier day-trip scenario available. Rooms have independent invitation links, messages, people, votes, and plan histories.

The Yosemite itinerary and USD prices are illustrative. The app does not search travel inventory, book anything, inspect personal files, read calendars, or know a person's past trips. Those are product ideas in the pitch, not capabilities claimed by this demo.

## Run

Node.js 22.16+ is required for the built-in SQLite driver.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Room state is stored in `.data/trip-parliament.sqlite`; the recent-room list is stored only in the current browser. Anyone with a room's bearer invitation link can access that demo room, so do not use real personal data.

## Two modes

- **Try sample replay** runs the scripted Yosemite negotiation with varied pauses. It uses SQLite only and labels itself as a sample. This is the reliable presentation path when external services are unavailable.
- **Start planning** runs the same guided decision sequence through the real Agent Relay SDK. Each representative sends its line to the coordinator, which reads and acknowledges the delivered message before it becomes a saved event. OpenAI rewrites selected representative lines using the seeded profile while the plan structure and hard-limit validation remain deterministic. Live events are marked `delivered via Agent Relay` in the conversation. This is a guided demo of transport and agent dialogue, not an autonomous general-purpose planner.

Configure `.env.local` from `.env.example` for live OpenAI dialogue. `OPENAI_API_KEY` and `OPENAI_MODEL` are server-only. `RELAY_WORKSPACE_KEY` must be a **Relaycast workspace key**; an Agent Relay Cloud API token or Relayfile key is a different credential. If the key is absent or starts with `cld_at_`, the Yosemite live demo creates a temporary Relaycast workspace through the SDK. SQLite needs no database credential. Restart the server after changing environment variables.

The Agent Relay Sessions MCP configured in Codex is separate from the application's Relaycast SDK transport.

## Two-minute Yosemite workflow

For a timed presenter click path, see [DEMO.md](DEMO.md).

1. Create a room and share its invitation link. Open **People** to show Alice's $420 cap, Parth's private-room rule, Aarsh's required hike and rafting, and Maya's vegetarian preference.
2. Open **Agent chat**. Choose **Start planning** for real Relay delivery or **Try sample replay** for the labeled local version. The group proposes $500, Alice rejects it, Parth changes the stay to reach $430, and Maya changes meals to reach $410. All four agents accept plan v3.
3. Open **Plan** to show the three versions, itinerary, votes, hard limits, and concessions. Use **Draft Alice's $400 message**, then send it in the conversation.
4. The room reopens and creates plan v4 at $390 while keeping private rooms, hiking, rafting, and vegetarian meals. Confirm the new private stay when prompted. The remaining representatives vote; the room returns to **Agreed** with 4/4 acceptance.
5. Create a separate San Diego room from **+ New** to demonstrate different travelers and isolated conversations.

The browser polls the selected room every 1.5 seconds. Sample lines have short randomized delays so the negotiations can be seen; the live path waits for actual SDK delivery. A budget message only changes the plan automatically when sent as Alice while an agreed Yosemite plan exceeds her new lower cap. Other human messages remain group discussion.

## Checks

With `npm run dev` running:

```powershell
npm run typecheck
npm run build
node scripts/qa-parley.mjs
node scripts/qa-api.mjs
node scripts/qa-live.mjs
```

`qa-parley.mjs` verifies the Yosemite proposal sequence, hard-limit violations, budget interruption, human confirmation, and final votes. `qa-api.mjs` retains regression coverage for San Diego and room state. `qa-live.mjs` creates a new Yosemite room and requires a real Relay-delivered live plan with four acceptances. It needs outbound network access and a healthy Agent Relay service. To check SDK transport on its own, run `node --env-file=.env.local scripts/check-relay.mjs`; add `--temporary` to create a fresh temporary Relaycast workspace. `node --env-file=.env.local scripts/check-openai.mjs` checks structured OpenAI dialogue separately.

Browser checks use Playwright and Edge in this workspace. Set `NODE_PATH` to the bundled Playwright `node_modules`, then run `node scripts/qa-parley-browser.cjs`, `node scripts/qa-browser.cjs`, `node scripts/qa-workspace.cjs`, and `node scripts/qa-ui.cjs`. The new demo screenshots are in `artifacts/parley/`.

## Current boundaries

SQLite is local to one server. A deployment with ephemeral disk needs durable storage. The app has no user authentication or verified human presence. The earlier Supabase SQL migration is retained for reference but is not used; Terse is not integrated. Agent Relay Sessions MCP OAuth is separate from the app SDK. External Relaycast availability affects only **Start planning**; the sample replay remains usable.
