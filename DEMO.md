# Parley: two-minute Yosemite demo

## Before presenting

Run `npm run dev` and open `http://localhost:3000`. Use a fresh **Create room** so the first version is v1. Keep the window at a desktop width. Have the invitation link ready to copy. If the Agent Relay SDK check succeeds, use **Start planning**; otherwise use the clearly labeled **Try sample replay** and describe it as a replay. The replay has short random pauses and follows the same visible decisions.

## Click path

| Time | Show | Action |
| --- | --- | --- |
| 0:00–0:30 | Room and invitation | Create a room, copy invitation, enter Agent chat. Explain that each room has its own people and plan. |
| 0:30–1:00 | Seeded personal context | Open **People**. Point to Alice's $420 cap, Parth's private-room rule, Aarsh's required hike and rafting, and Maya's vegetarian preference. These are demo profiles; no files or calendars are connected. |
| 1:00–1:30 | Negotiation | Open **Agent chat** and start the run. The $500 proposal fails Alice's cap. Parth changes the stay for v2 at $430. Maya simplifies meals for v3 at $410. Open **Plan** to show the version history and 4/4 vote. |
| 1:30–1:52 | Human interruption | On **Plan**, click **Draft Alice's $400 message**; in **Group chat**, send it. The room reopens, Parth finds a private budget inn, and v4 reaches $390 without losing hiking or rafting. Click **Confirm private stay**. |
| 1:52–2:00 | Result | Show **Agreed**, v4, $390 per person, and 4/4 acceptance. |

## What the demo proves

The sample proves the UI, room state, constraints, versioning, human message trigger, confirmation, and votes. The live path additionally requires each representative line to be delivered by the Agent Relay SDK and acknowledged by a coordinator before it is saved; live messages say `delivered via Agent Relay`. OpenAI rewrites selected live agent lines from the seeded profiles. The bargaining sequence is guided so the presentation is repeatable.

SQLite stores this local demo. Supabase and Terse are not connected, and there is no travel booking or personal-data ingestion. Use the real integration description in the closing line rather than claiming those services are already running.
