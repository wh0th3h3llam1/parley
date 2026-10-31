# Parley demo UI

## Screen job

Show a group decision changing in real time, while keeping people, messages, versions, and votes in one room. Agent chat, Group chat, Media, People, Plan, and recent rooms sit in the left rail. The selected view is centered; negotiation status and representatives sit on the right. The default sample room is Yosemite, and a separate San Diego room demonstrates isolation.

## Visual direction

The existing editorial shell uses warm ivory, charcoal type, terracotta for active decisions, thin borders, serif headings, and sans-serif controls. The conversation has a quiet route-line background. New messages and the typing indicator animate subtly; reduced-motion preferences disable animation. Keyboard focus, selected state, and expanded state are visible and named.

## Main states

- **Ready:** seeded Yosemite profiles explain Alice's $420 cap, Parth's private rooms, Aarsh's hike and rafting, and Maya's vegetarian preference. The empty conversation offers live planning and an explicitly labeled sample replay.
- **Negotiating:** proposals v1–v3 update the plan ribbon and the Plan tab as agent messages appear. Rejected versions show hard-limit violations. Live messages show `delivered via Agent Relay`; sample messages do not.
- **Agreed:** v3 costs $410 and has four votes. The Plan tab shows all versions, itinerary, concessions, and a prepared Alice message that the presenter must send.
- **Reopened:** Alice's lower $400 cap creates v4 at $390. A confirmation banner pauses the final vote for the changed private stay.
- **Final:** after confirmation, v4 has 4/4 acceptance. Earlier versions and the human message remain visible.
- **Failure:** an impossible hard limit blocks the run with a concrete reason. An external Relay error appears without silently switching a live run to sample data.

The browser's recent-room list remembers invitation tokens locally; only the selected room's state is fetched. On mobile, the list folds behind **Show rooms** and the status rail expands below the conversation. The app does not claim access to private files, photos, calendar data, booking inventory, or verified human presence.

## Verification

`scripts/qa-parley-browser.cjs` checks the complete Yosemite sample path, room isolation, no page errors, and desktop widths 1024, 1280, and 1440 px. It writes captures to `artifacts/parley/`. Legacy San Diego browser checks remain in `qa-browser.cjs`, `qa-workspace.cjs`, and `qa-ui.cjs`.
