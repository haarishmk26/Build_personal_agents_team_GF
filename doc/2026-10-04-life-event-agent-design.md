# Life-Event Paperwork Agent: Design and Plan

Hackathon: Build Personal Agents, Oct 4, 2026. Submission at 16:30 PT.
Status: draft v2, pending approval. Tech stack is intentionally still open (see Open decisions).

## 1. Pitch

One life event (new address, name change, new job) fans out to 30+ accounts, each with its own form, login and wait. The agent finds every account you own from your inbox, plans the change, does the safe ones for you after your approval, and hands you a ready-made kit for the risky ones. It remembers how each site behaves and learns your rules, so it gets faster and more "you" every time.

Why a general bot can't copy it: it depends on your inbox (the account graph), your approval history (your rules), your sent mail (your voice) and your life timeline.

## 1a. Why this is not just a Claude Code session with email access

A coding agent with inbox access could do a rough one-off version: scan mail, list accounts, fill a form. That is not our pitch. **Form filling is the commodity part. Our pitch is trusted delegation: memory, proactivity, verified completion and guardrails.** UI polish helps but is the easiest thing to copy, so it must not be our only answer.

| Difference | A session with email access | This product |
|---|---|---|
| **Memory between runs** | Starts cold each time. You re-explain everything. | Keeps an account graph, your rules and a playbook per site. Faster every time. |
| **Proactive** | Acts only when prompted. | Watches mail and calendar. "Lease ends in 60 days, checklist ready." Acts on forwarded bills. |
| **Verified completion** | Says "done." | Marks done only when the confirmation email arrives. Keeps a log with undo steps and a proof pack. |
| **Guardrails as product behavior** | Only as good as the prompt. One mistake can touch a real bank. | Risk tiers, user rules and approval before every submit are built in. |
| **Own identity** | Uses your mailbox. | The agent has its own inbox (AgentMail) for codes, confirmations and forwards. |
| **Who can use it** | Developers who can set it up. | Anyone. |

**Ideas that make it harder to copy (mostly vision, not built today):**
- **Shared playbooks across users.** Once one agent learns that a gym needs a phone call, everyone benefits. It gets stronger with more users, and a single session can't do it. It also fits the open-source side prize.
- **Event templates with the real checklist.** Marriage, new baby, new job, moving abroad: the 30 things people forget, in order, with deadlines.
- **Household mode.** Two people, shared accounts, separate approvals.
- **The account map as a lasting asset.** A living inventory of where you exist online, with stale data, forgotten subscriptions and risk flags. Useful even when you are not moving.

**Pitch rule:** do not lead with "it fills forms." Lead with "it remembers, it starts on its own, it proves it's done, and it won't do anything risky without you."

**The three differentiators we must show on stage:**
1. A **proactive trigger** (predicted event or forward-to-act).
2. **Verified completion** with the history log and proof pack.
3. **Visible learning** (learned rules and the playbook counter).

## 2. What the user sees

Example user: Maya, moving to 42 Oak St on Nov 1.

1. **Setup (about 2 min, once).** Maya connects her email (read-only) and sets rules like "never touch anything with my card on file." The agent scans and shows a map: Maya in the center, accounts around her, colored by tier. First wow: "12 accounts still have your old address."
2. **Tell it the event.** She types "I'm moving to 42 Oak St on Nov 1." The agent replies with a plan: "38 accounts need updating. I can do 14, I'll prep 9, 15 don't need your address."
3. **Review and approve (main screen).** One card per account:
   - **Safe account (gym, game, forum):** "Ready. Here is exactly what I'll change." Before/after, **Approve** and **Skip**. After approval it fills the form, then a green check appears when the confirmation email arrives.
   - **Rule-blocked account (card on file):** "Your rule says ask first." Needs her explicit OK.
   - **Hands-off account (bank):** "I won't touch this one." A kit: the link, the values to copy, a draft email.
   - Each approval teaches it. After a few: "Auto-approve gyms from now on?"
4. **It keeps working.** Forward any bill or notice to the agent inbox and it works out what to update. A morning note: "Updated 6 yesterday, 2 need you."
5. **Finish.** "31 of 38 done," a mostly green map, a one-click **proof pack** PDF, and a **history log** with undo steps.

The three screens that must be excellent: the **map**, the **approval card**, and the **kit** for hands-off accounts.

## 3. The five mock websites

We build these so the demo never depends on real sites. Each one teaches a different behavior the agent must handle. All five start with Maya's old address (so the stale-info audit shows 5 stale accounts).

| # | Mock site | Real-world analog | Behavior | What it proves |
|---|---|---|---|---|
| 1 | **IronWorks Gym** | Gym membership | One-page profile form. Submit sends a confirmation email within seconds. | Happy path: plan, approve, fill, verify. |
| 2 | **PixelVault** (game store) | Gaming account | Login, then a two-step address change. Step 2 requires a 6-digit code emailed to the agent inbox. | Agent reads the code from the inbox itself. |
| 3 | **ThreadHub** (forum) | Forum or community | Settings page with address and location. Confirmation email arrives after about 30 seconds. | Async verification. Card stays "pending" until the email lands. |
| 4 | **StreamBox** (subscription) | Streaming or SaaS with billing | Billing address tied to a card on file. | Rules engine blocks auto-action and asks the user. |
| 5 | **Harbor Bank** | Bank | No web address form. Page says "call, visit, or send a secure message with proof of address." | Hands-off tier: agent refuses to automate and produces a prefilled kit and a draft email. |

Each mock site: small standalone web app with a login, a seeded user (Maya), a way to read the current stored address (for before/after and the audit), and an email sender that notifies through AgentMail. One app with five routes is acceptable.

## 4. AgentMail usage

- Agent inbox: `haarish-agent@agentmail.to`. API base `https://api.agentmail.to/v0`.
- Verified: `GET /inboxes/haarish-agent%40agentmail.to/threads?limit=10` returns HTTP 200 with an empty list.
- Credentials live in `.env` (`AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX`). `.env` is gitignored and has never been committed. `.env.example` is committed with placeholders.
- Uses:
  1. **Mock-site confirmations** land in this inbox, and the verifier turns cards green.
  2. **Verification codes** (PixelVault) are read from this inbox.
  3. **Forward-to-act**: forwarded bills and notices arrive here and get parsed into checklist items.
  4. **Assist-tier drafts** are shown to the user, never sent automatically.
- Assumption to verify early: mock sites can send mail to this inbox through the AgentMail send endpoint (sending from the same inbox to itself). Fallback: the mock site posts the message to the app directly and the demo says "simulated email."
- Real Gmail (read-only) is used for account discovery on the live demo. For the stage demo we use seeded data so no private mail is shown.

## 5. Safety model (non-negotiable)

| Tier | Examples | Behavior |
|---|---|---|
| Act | Gym, game, forum, loyalty | Fill, pause at submit, run only after approval |
| Rule-blocked | Anything matching a user rule (card on file, work account) | Ask first, never auto-run |
| Mock | The five mock sites | Same flow as Act, demo only |
| Assist | Real banks, IRS, DMV, insurance | Never automated. Kit and draft only. |

- No passwords stored. Throwaway test accounts or a one-time logged-in session.
- Every submit needs explicit approval.
- Nothing is sent from the user's real mailbox. Gmail is read-only.
- Secrets only in `.env`, never committed.

## 6. Feature scope

**Thin slice (must work first):** discover 3 or more accounts, build a checklist, fill mock site #1 after approval, verify by confirmation email, show it on the map.

**Core:** all five mock sites working, tiers and rules, the approval card, the verifier, the map UI.

**Personal layer, in order:**
1. Stale-info audit
2. Rules that learn from approvals
3. Playbook memory and the "learned playbooks" counter
4. Kit and drafted email for Assist tier
5. Forward-to-act
6. Before/after preview and history log with undo steps
7. Proof pack PDF
8. Life timeline and predicted events, deadline tracking

**Differentiator priorities (from section 1a):** at least one proactive trigger, verified completion with the log and proof pack, and visible learning must be in the demo. If time is short, protect these over extra sites or UI polish. Forward-to-act and predicted events are the cheapest proactive triggers, so treat them as higher priority than the order above suggests.

**Cut unless time remains:** household mode (pitch slide only), cost saver, breach check, voice-matched drafting, throwaway aliases per site, unknown-site solver.

## 7. Architecture (stack-agnostic)

```
Inbox (Gmail read) --> Discovery --> Account Graph (store)
AgentMail inbox  ----> Verifier / Code reader / Forward-to-act
                                        |
Event (user chat) --> Planner --> Checklist (tier per account)
                          |             |
                     Rules Engine <-- approvals
                                        v
                     Executor (browser automation) --> mock and Act sites
                                        |
                              Playbook memory, audit log
                                        v
                                       UI
```

Units:
1. **Discovery.** Finds accounts from email. Output: name, domain, last seen, category, stale fields.
2. **Classifier.** Tier and category.
3. **Planner.** Event to ranked checklist.
4. **Rules engine.** User and learned rules, applied before every action.
5. **Executor.** Drives the browser, stops at submit.
6. **Verifier.** Reads AgentMail, matches confirmations and codes to items.
7. **Playbooks and audit log.** Per-site learnings, every action recorded with undo steps.
8. **Kit generator.** Prefilled values, link, draft email for Assist items.
9. **UI.** Map, approval cards, kits, chat, morning note.

## 8. Demo script (about 4 minutes)

0. Open with the proactive trigger: the agent says "Your lease ends in 60 days, I've prepared a move checklist," or a forwarded bill gets turned into a task.
1. Run the audit: "5 accounts still have your old address."
2. Say "I'm moving to 42 Oak St." The plan appears.
3. Approve IronWorks: green after its email.
4. PixelVault: the agent reads the code from the inbox itself.
5. ThreadHub: pending, then green after the delay.
6. StreamBox: blocked by Maya's own rule, she approves.
7. Harbor Bank: refuses, shows the kit and the draft email.
8. Show the proof pack, the history log and the playbook counter.
Fallback: recorded video ready by 16:00.

## 9. Implementation plan (task level)

Durations are budgets. A step-by-step plan with exact files, tests and commands comes after the stack is chosen.

| # | Task | Budget | Done when |
|---|---|---|---|
| 0 | Repo, `.env`, AgentMail check, project scaffold | 0:20 | Threads call returns 200 from code, `.env` ignored |
| 1 | Mock sites 1 and 5 (gym, bank) plus seeded data and email sender | 0:40 | Gym update sends an email that appears in the inbox |
| 2 | Mock sites 2, 3, 4 (code step, delayed email, card-on-file) | 0:50 | Each site shows its distinct behavior |
| 3 | Account graph and seeded discovery | 0:30 | 5 accounts listed with stale flags |
| 4 | Planner, tiers, rules engine | 0:40 | "Moving" produces a checklist with correct tiers |
| 5 | Executor with approval, plus verifier | 0:60 | Gym card goes green end to end (thin slice) |
| 6 | Remaining sites through executor (code reading, async wait) | 0:40 | All five behaviors demoed |
| 7 | UI: map, approval cards, kit, chat | 0:60 | Demo script runs from the UI |
| 8 | Personal layer (audit, learned rules, playbook counter, proof pack) | 0:40 | Items 1 to 3 and 7 from section 6 |
| 9 | Rehearsal, seed data cleanup, fallback video, submission | 0:30 | Video recorded, submission done |

Work streams (assign once team size is known): mock sites and email, agent logic (planner, rules, executor, verifier), UI.

## 10. Risks

- Browser automation flakiness: all five mock sites give a guaranteed path.
- Email send between inbox and itself may be restricted: fallback in section 4.
- Scope: ordered list in section 6, cut from the bottom.
- Looking like "just Claude Code with a UI": lead the pitch with section 1a, and make sure the three differentiators are visible in the demo.
- Secrets: `.env` gitignored, checked against history before every push.

## 11. Open decisions

- Tech stack (deliberately deferred).
- Team size and who owns which work stream.
- Which real low-risk sites, if any, appear in the live demo beyond the mocks.
- Whether Gmail discovery is live or seeded on stage.
