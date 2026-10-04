# Life-Event Paperwork Agent: Design and Plan

Hackathon: Build Personal Agents, Oct 4, 2026. Submission at 16:30 PT.
Status: draft v4. Stack chosen (section 7a). Implementation plan: `doc/2026-10-04-life-event-agent-implementation-plan.md`.

What changed in v3:
- **No access to the user's real mailbox.** The agent works only from its own AgentMail inbox. The user chooses what the agent sees by forwarding it.
- **The UI is a first-class differentiator,** with a dedicated design section (2a) and a larger build budget.

## 1. Pitch

One life event (new address, name change, new job) fans out to 30+ accounts, each with its own form, login and wait. The agent keeps a map of every account you've shown it, plans the change, does the safe ones for you after your approval, and hands you a ready-made kit for the risky ones. It remembers how each site behaves and learns your rules, so it gets faster and more "you" every time.

**It never gets your mailbox.** You give it its own email address. Whatever you forward or sign up with that address is all it ever sees. Privacy by design, not by promise.

Why a general bot can't copy it: it depends on your account map (built from what you forward), your approval history (your rules), and your life timeline, wrapped in an experience designed for delegation.

## 1a. Why this is not just a Claude Code session with email access

A coding agent with inbox access could do a rough one-off version: scan mail, list accounts, fill a form. That is not our pitch. **Form filling is the commodity part. Our pitch is trusted delegation, memory, proactivity, verified completion and guardrails, delivered through an experience people actually want to use.**

| Difference | A session with email access | This product |
|---|---|---|
| **Privacy** | Needs your real mailbox. | Never sees your mailbox. Only what you forward to its own address. |
| **Memory between runs** | Starts cold each time. You re-explain everything. | Keeps an account graph, your rules and a playbook per site. Faster every time. |
| **Proactive** | Acts only when prompted. | Watches its inbox for forwards and dated notices. "Lease ends in 60 days, checklist ready." |
| **Verified completion** | Says "done." | Marks done only when the confirmation email arrives. Keeps a log with undo steps and a proof pack. |
| **Guardrails as product behavior** | Only as good as the prompt. One mistake can touch a real bank. | Risk tiers, user rules and approval before every submit are built in. |
| **Experience** | A terminal transcript. | A designed interface: the Orbit map, the Approval Deck, Watch It Work (section 2a). |
| **Who can use it** | Developers who can set it up. | Anyone. |

**Ideas that make it harder to copy (mostly vision, not built today):**
- **Shared playbooks across users.** Once one agent learns that a gym needs a phone call, everyone benefits. It gets stronger with more users. It also fits the open-source side prize.
- **Event templates with the real checklist.** Marriage, new baby, new job, moving abroad: the 30 things people forget, in order, with deadlines.
- **Household mode.** Two people, shared accounts, separate approvals.
- **The account map as a lasting asset.** A living inventory of where you exist online, with stale data, forgotten subscriptions and risk flags.

**Pitch rule:** do not lead with "it fills forms." Lead with "it has its own inbox so it never sees yours, it remembers, it starts on its own, it proves it's done, and it won't do anything risky without you."

**The differentiators we must show on stage:**
1. **Privacy by design** (its own inbox, you decide what it sees).
2. A **proactive trigger** (predicted event or forward-to-act).
3. **Verified completion** with the history log and proof pack.
4. **Visible learning** (learned rules and the playbook counter).
5. **The UI itself**, built for the demo (section 2a).

## 2. What the user sees

Example user: Maya, moving to 42 Oak St on Nov 1.

1. **Setup (about 2 min, once).** Maya gets her own agent address. She sets rules like "never touch anything with my card on file." To teach it her accounts she does any of these, by choice:
   - forwards a few receipts or welcome emails to the agent address,
   - sets a one-time auto-forward filter in her own email for receipts (her mailbox, her rules, no access given),
   - uses the agent address as the contact email for new accounts.
   The Orbit map fills in as emails arrive: Maya in the center, accounts around her, colored by tier. First wow: "12 accounts still have your old address."
2. **Tell it the event.** She types "I'm moving to 42 Oak St on Nov 1." The agent replies with a plan: "38 accounts need updating. I can do 14, I'll prep 9, 15 don't need your address."
3. **Review and approve (main screen).** One card per account, shown one at a time in the Approval Deck:
   - **Safe account (gym, game, forum):** "Ready. Here is exactly what I'll change." Before/after, **Approve** and **Skip**. After approval it fills the form while she watches, then a green check appears when the confirmation email arrives.
   - **Rule-blocked account (card on file):** "Your rule says ask first." Needs her explicit OK.
   - **Hands-off account (bank):** "I won't touch this one." A kit: the link, the values to copy, a draft email.
   - Each approval teaches it. After a few: "Auto-approve gyms from now on?"
4. **It keeps working.** Forward any bill or notice to the agent address and it works out what to update. A morning note: "Updated 6 yesterday, 2 need you."
5. **Finish.** "31 of 38 done," a mostly green map, a one-click **proof pack**, and a **history log** with undo steps.

## 2a. UI and experience design (our differentiator)

**Principle:** calm, one decision at a time, and always show the agent working. Never a wall of forms. Delegation should feel like handing a task to a careful assistant, not operating a tool.

**Signature moments, in build order:**

1. **The Orbit (map).** Maya in the center, accounts as nodes in rings by tier. Stale accounts pulse amber. When an account is updated the node turns green with a ripple and the progress arc advances. Click a node to open its card.
2. **The Approval Deck.** One card at a time, keyboard-first (Enter approves, Esc skips). The card shows a before/after diff with the changed text highlighted, the tier badge, and a toggle "always do this for gyms." This is where trust is built.
3. **Watch It Work.** A live panel showing the mock site being filled: fields highlight as they are typed, then the agent stops and spotlights the Submit button, dimmed until the user approves. Short first-person status lines: "Opening IronWorks... filling address... waiting for you."
4. **The Inbox Feed.** The agent's inbox as a live timeline. A confirmation email arrives, flies onto the matching card, and stamps it **Verified**. Verification codes are highlighted when the agent reads them.
5. **The Kit.** For hands-off accounts: a clean checklist with a copy button per value, the link, and the draft email. Items tick as she completes them.
6. **Command bar.** One input for everything: "I'm moving to 42 Oak St on Nov 1." Also shows the morning briefing.
7. **The Receipt (proof pack).** A paper-style summary page of every change with timestamps and confirmations, downloadable.

**Design rules:**
- One accent color means "the agent acted." Tier colors stay consistent everywhere, and tiers are also shown with icons so color is never the only signal.
- Motion has meaning and stays under about 300ms: ripples for success, a pulse for "needs you." No decoration for its own sake.
- Large type and high contrast so it reads on a projector. Light and dark themes.
- Every empty, loading and error state is designed, not left blank.
- The agent has a name and a consistent short voice.

**Optional:** use the assistant-ui chat components for the command bar, which could also support the Best UI side prize. Decide once the stack is chosen.

**Scope guard:** the Orbit, Approval Deck and Watch It Work must be excellent. The Inbox Feed and Kit are simpler. The Receipt and theming are last.

## 3. The five mock websites

We build these so the demo never depends on real sites. Each one teaches a different behavior the agent must handle. All five start with Maya's old address (so the stale-info audit shows 5 stale accounts).

| # | Mock site | Real-world analog | Behavior | What it proves |
|---|---|---|---|---|
| 1 | **IronWorks Gym** | Gym membership | One-page profile form. Submit sends a confirmation email within seconds. | Happy path: plan, approve, fill, verify. |
| 2 | **PixelVault** (game store) | Gaming account | Login, then a two-step address change. Step 2 requires a 6-digit code emailed to the agent inbox. | Agent reads the code from the inbox itself. |
| 3 | **ThreadHub** (forum) | Forum or community | Settings page with address and location. Confirmation email arrives after about 30 seconds. | Async verification. Card stays "pending" until the email lands. |
| 4 | **StreamBox** (subscription) | Streaming or SaaS with billing | Billing address tied to a card on file. | Rules engine blocks auto-action and asks the user. |
| 5 | **Harbor Bank** | Bank | No web address form. Page says "call, visit, or send a secure message with proof of address." | Hands-off tier: agent refuses to automate and produces a prefilled kit and a draft email. |

Each mock site: small standalone web app with a login, a seeded user (Maya), a way to read the current stored address (for before/after and the audit), and an email sender that notifies through AgentMail. Each site also sends a **welcome email** to the agent address when Maya's account is created, which is how discovery works in the demo. One app with five routes is acceptable.

## 4. AgentMail usage (the only inbox the agent touches)

- Agent inbox: `haarish-agent@agentmail.to`. API base `https://api.agentmail.to/v0`.
- Verified: `GET /inboxes/haarish-agent%40agentmail.to/threads?limit=10` returns HTTP 200 with an empty list.
- Credentials live in `.env` (`AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX`). `.env` is gitignored and has never been committed. `.env.example` is committed with placeholders.
- **No Gmail or other real-mailbox access, ever.** No OAuth to a personal account.
- Uses:
  1. **Account discovery.** Welcome emails, receipts and forwards that arrive here are parsed into the account map.
  2. **Confirmations.** Mock-site confirmations land here, and the verifier turns cards green.
  3. **Verification codes** (PixelVault) are read from this inbox.
  4. **Forward-to-act.** Forwarded bills and notices become checklist items.
  5. **Assist-tier drafts** are shown to the user, never sent automatically.
- **Seeding for the demo.** A seed script triggers each mock site's welcome email, plus a few extra realistic forwards (a lease notice, a gym receipt), so the inbox is populated and the Orbit has something to show. Nothing from a real mailbox is used on stage.
- Assumption to verify early: mock sites can send mail to this inbox through the AgentMail send endpoint (sending from the same inbox to itself or from another sender). Fallback: the mock site posts the message to the app directly and the demo says "simulated email."

## 5. Safety model (non-negotiable)

| Tier | Examples | Behavior |
|---|---|---|
| Act | Gym, game, forum, loyalty | Fill, pause at submit, run only after approval |
| Rule-blocked | Anything matching a user rule (card on file, work account) | Ask first, never auto-run |
| Mock | The five mock sites | Same flow as Act, demo only |
| Assist | Real banks, IRS, DMV, insurance | Never automated. Kit and draft only. |

- The agent never has access to the user's real mailbox. It sees only what is forwarded to its own address.
- No passwords stored. Throwaway test accounts or a one-time logged-in session.
- Every submit needs explicit approval.
- Nothing is sent automatically from any real account. Drafts are shown to the user.
- Secrets only in `.env`, never committed.

## 6. Feature scope

**Thin slice (must work first):** a seeded inbox produces 3 or more accounts on the Orbit, a checklist, the Approval Deck for mock site #1, Watch It Work during the fill, verification by the confirmation email, and the node turning green.

**Core:** all five mock sites, tiers and rules, the Approval Deck, the verifier, the Orbit, Watch It Work.

**Personal layer, in order:**
1. Stale-info audit
2. Rules that learn from approvals
3. Playbook memory and the "learned playbooks" counter
4. Kit and drafted email for Assist tier
5. Forward-to-act
6. Inbox Feed
7. History log with undo steps
8. The Receipt (proof pack)
9. Life timeline and predicted events, deadline tracking

**Differentiator priorities (from section 1a):** privacy by design, at least one proactive trigger, verified completion, visible learning and the signature UI moments must be in the demo. If time is short, protect these over extra sites. Forward-to-act and predicted events are the cheapest proactive triggers, so treat them as higher priority than the order above suggests.

**Cut unless time remains:** household mode (pitch slide only), cost saver, breach check, voice-matched drafting, throwaway aliases per site, unknown-site solver.

## 7. Architecture (stack-agnostic)

```
User forwards / signs up with agent address
                 |
          AgentMail inbox  ---> Discovery --> Account Graph (store)
                 |
                 +------------> Verifier / Code reader / Forward-to-act
                                        |
Event (command bar) --> Planner --> Checklist (tier per account)
                          |             |
                     Rules Engine <-- approvals (Approval Deck)
                                        v
                     Executor (browser automation) --> mock and Act sites
                                        |   (streams steps to Watch It Work)
                              Playbook memory, audit log
                                        v
                                       UI
```

Units:
1. **Discovery.** Parses inbox emails into accounts. Output: name, domain, last seen, category, stale fields.
2. **Classifier.** Tier and category.
3. **Planner.** Event to ranked checklist.
4. **Rules engine.** User and learned rules, applied before every action.
5. **Executor.** Drives the browser, stops at submit, streams its steps to the UI.
6. **Verifier.** Reads AgentMail, matches confirmations and codes to items.
7. **Playbooks and audit log.** Per-site learnings, every action recorded with undo steps.
8. **Kit generator.** Prefilled values, link, draft email for Assist items.
9. **UI.** Orbit, Approval Deck, Watch It Work, Inbox Feed, Kit, command bar, Receipt.

## 7a. Chosen stack and infrastructure

| Piece | Choice | Role |
|---|---|---|
| Database | **Neon Postgres** | System of record: accounts, events, checklist items, rules, audit log, playbooks, inbox messages. |
| Authentication | **Neon Auth** | Sign-in for the web app. Every API route requires a session. |
| LLM access | **Neon AI Gateway** | All model calls (discovery fallback, command parsing, kit drafts) go through one wrapper module. |
| Email | **AgentMail** (`haarish-agent@agentmail.to`) | The agent's only inbox: discovery, confirmations, codes, forwards, webhooks. |
| Remote access | **ngrok** | Exposes the web UI to remote viewers and gives AgentMail webhooks a public URL for the live Inbox Feed. |

Defaults I chose where you did not specify (change if the team prefers): **TypeScript** everywhere, **Next.js** for UI and API routes, **Playwright** for the executor, **Hono** for the five mock sites, **Vitest** for tests, **zod** for shared contracts.

Rules for the infrastructure:
- **ngrok exposes only the web UI** and the AgentMail webhook route. The mock sites and the executor stay local. Everything behind the UI requires a Neon Auth session, because a public tunnel to a laptop is otherwise open to anyone.
- All LLM calls go through one module, so the Gateway's request format is isolated in a single file.
- Nothing is hard-wired to AgentMail's webhooks. If they are not ready, polling feeds the same pipeline.

To verify against current vendor docs during Wave 1 (not yet confirmed): the Neon Auth setup steps, the Neon AI Gateway endpoint and model names, and the AgentMail send and webhook endpoints. Only the threads `GET` has been tested so far.

## 8. Demo script (about 4 minutes)

0. Open with privacy and a proactive trigger: "This agent has its own inbox, it never sees mine." The agent says "Your lease ends in 60 days, I've prepared a move checklist," or a forwarded bill turns into a task.
1. The Orbit fills as seeded emails arrive. Run the audit: "5 accounts still have your old address."
2. Type "I'm moving to 42 Oak St." The plan appears.
3. Approval Deck, IronWorks: approve, watch the fill, green after its email lands in the Inbox Feed.
4. PixelVault: the agent reads the code from the inbox itself.
5. ThreadHub: pending, then green after the delay.
6. StreamBox: blocked by Maya's own rule, she approves.
7. Harbor Bank: refuses, shows the Kit and the draft email.
8. Show the Receipt, the history log and the playbook counter.
Fallback: recorded video ready by 16:00.

## 9. Implementation plan (task level)

Budgets are person-hours, not wall-clock. Streams run in parallel. The detailed step-by-step plan, split into parallel lanes with exact files, tests and commands, is in `doc/2026-10-04-life-event-agent-implementation-plan.md`. That plan supersedes this table for scheduling.

| # | Task | Budget | Done when |
|---|---|---|---|
| 0 | Repo, `.env`, AgentMail check, project scaffold | 0:20 | Threads call returns 200 from code, `.env` ignored |
| 1 | Mock sites 1 and 5 (gym, bank) plus seeded data, welcome and confirmation emails | 0:40 | Gym update sends an email that appears in the inbox |
| 2 | Mock sites 2, 3, 4 (code step, delayed email, card-on-file) | 0:50 | Each site shows its distinct behavior |
| 3 | Inbox discovery and account graph, plus the seed script | 0:30 | Seeded inbox yields 5 accounts with stale flags |
| 4 | Planner, tiers, rules engine | 0:40 | "Moving" produces a checklist with correct tiers |
| 5 | Executor with approval and step streaming, plus verifier | 0:60 | Gym card goes green end to end (thin slice) |
| 6 | Remaining sites through executor (code reading, async wait) | 0:40 | All five behaviors demoed |
| 7a | UI foundation: design system, Orbit, command bar | 0:45 | Orbit renders from live data, nodes change state |
| 7b | UI: Approval Deck, Watch It Work, Inbox Feed, Kit | 0:60 | Demo script runs from the UI |
| 8 | Personal layer (audit, learned rules, playbook counter, Receipt) | 0:40 | Items 1 to 3 and 8 from section 6 |
| 9 | UI polish, motion, empty states, rehearsal, fallback video, submission | 0:45 | Video recorded, submission done |

Work streams (assign once team size is known): mock sites and email, agent logic (discovery, planner, rules, executor, verifier), UI (7a, 7b, 9).

## 10. Risks

- Browser automation flakiness: all five mock sites give a guaranteed path.
- Email send into the inbox may be restricted: fallback in section 4.
- Without real-mailbox access, discovery depends on forwards: the seed script and welcome emails guarantee a populated demo.
- UI scope creep: protect the Orbit, Approval Deck and Watch It Work first, then cut from the bottom of section 2a.
- Scope: ordered list in section 6, cut from the bottom.
- Looking like "just Claude Code with a UI": lead the pitch with section 1a, and make sure the differentiators are visible in the demo.
- Secrets: `.env` gitignored, checked against history before every push.

## 11. Open decisions

- Whether to use assistant-ui for the command bar.
- Vendor details still to verify: Neon Auth, Neon AI Gateway, AgentMail send and webhooks (section 7a).
- Team size and who owns which work stream.
- The agent's name and voice.
- Which real low-risk sites, if any, appear in the live demo beyond the mocks.
- Which onboarding path to show on stage: forward, auto-forward filter, or signing up with the agent address.
