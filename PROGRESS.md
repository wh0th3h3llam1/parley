# Progress

## Verified

- Project created in the previously empty checkout with Next.js, TypeScript, and plain CSS.
- SQLite hall creation, invitation token, snapshot reload, four travelers, and persistent sample replay.
- API flow: initial plan $128/person, Leo budget $90, new plan $56/person, two versions, and four votes.
- API checks: double start returns 409, conflicting days block with an exact conflict, and reset clears negotiation while retaining human messages.
- Real Edge/Playwright flow: copy link, second-tab access, room navigation, sample replay, budget revision; no browser page errors.
- Desktop and mobile screenshots captured in `artifacts/` and inspected.
- TypeScript check passed after implementation changes (run again at delivery).
- Production build completed successfully.
- Upgraded the new project to Next.js 16.4.3 after the dependency audit identified a PostCSS advisory in Next 15. The production audit now reports zero vulnerabilities, and build, API QA, and Edge/Playwright QA pass on 16.4.3.
- The official Agent Relay SDK registered temporary agents and completed a real send, inbox receive, matching message-ID check, and acknowledgement. The service returned transient 503 overload responses on earlier attempts; the bounded retry passed.
- Final sample API QA and Edge/Playwright browser QA pass after the latest UI changes. The browser check covers clipboard copy, second-tab invitation, edits, replay, budget revision, refresh, and mobile status with zero page errors.
- Final production build, TypeScript check, and production dependency audit pass; the audit reports zero vulnerabilities.
- Replaced runtime JSON and Supabase storage with local SQLite. All 22 pre-existing JSON halls and their invitation tokens were imported; the existing browser hall continued loading.
- API and Edge/Playwright browser QA pass against SQLite, including persistence after refresh. The build and type check pass with Node 22.16.
- Live API QA passes with the server allowed outbound network: a fresh hall agreed with five Relay-delivered events and four votes; a hall with a prior sample plan produced a new live plan and four fresh live accept messages.
- Agent Relay shared-sessions MCP OAuth login completed successfully through `codex mcp login agent-relay-sessions`.

## Blockers

- Supabase is no longer on the runtime path at the user's request. The dormant SQL migration remains for reference.
- The supplied OpenAI key was stored in ignored `.env.local`; `gpt-5.4-mini` model access and the full live app run passed. The app uses a temporary Relaycast workspace for this demo.
- The supplied Agent Relay Cloud API token and Relayfile read key are for different Agent Relay surfaces than the installed Relaycast messaging SDK. The independent real Relay transport check used a temporary workspace.

## Next tasks

1. Replace the temporary Relaycast workspace with the intended long-lived workspace key when available.
2. Use durable hosted storage if deploying to an environment with ephemeral disk.

## RESUME HERE

Start with `npm run dev` to use the verified SQLite backed sample path. The revised sample run requires human confirmation before voting. Live planning has passed with outbound network access; inside a restricted Codex shell, run the dev server with network permission.
