# Life-Event Paperwork Agent: Design

Hackathon: Build Personal Agents (Oct 4, 2026). Build window 12:00 to 16:30.
Status: draft, pending approval.

## Pitch

One life event (new address, name change, new job) fans out to 30+ accounts, each with its own form, login and wait. The agent finds every account you own from your inbox, plans the change, does the safe ones for you, and hands you a ready-made kit for the risky ones. It remembers how each site behaves and learns your rules, so it gets faster and more "you" every time.

Why a general bot can't copy it: it depends on your inbox (the account graph), your sent mail (your voice), your approval history (your rules) and your life timeline.

## Safety model (non-negotiable)

| Tier | Examples | Behavior |
|---|---|---|
| Act | Gym, gaming, forums, loyalty, newsletters | Browser automation fills the change, pauses at submit, runs only after approval |
| Mock | Fake bank, DMV, insurer (we build them) | Same flow as Act, for demo only |
| Assist | Real banks, IRS, DMV, insurance | Never automated. Prefilled checklist, link, draft email or script |

- No passwords stored. User logs in once in a browser session, or a throwaway test account is used.
- Every submit needs explicit approval.
- Read-only access to Gmail. Nothing is sent automatically.

## Architecture

```
Gmail (read-only) --> Discovery --> Account Graph (SQLite)
                                        |
Life Timeline <-- Extractor (Claude) ---+
        |                               |
        v                               v
   Event Planner  -------->  Checklist (Act / Mock / Assist)
        |                               |
   Rules Engine  <-- approvals          v
        |                      Executor (Playwright + Claude)
        v                               |
   Playbook Memory  <-------------------+
                                        v
                       Verifier (confirmation emails) --> UI
```

Units, each with one purpose:

1. **Discovery.** Scans Gmail for welcome emails, receipts and statements. Output: accounts (name, domain, last seen, billing signal, category).
2. **Classifier.** Assigns a tier and a category (bank, gym, utility, etc.). Rule-based first, Claude for ambiguous cases.
3. **Timeline extractor.** Pulls dated life facts (moves, jobs, lease end) from email into a timeline.
4. **Planner.** Given an event (or a predicted one), builds the ranked checklist.
5. **Rules engine.** User rules plus rules learned from approvals and rejections. Applied before any action.
6. **Executor.** Playwright driven by Claude. Fills forms, stops at submit. Uses playbooks when available.
7. **Playbook memory.** Per-site notes (steps, quirks, needs phone call). Counter shown in UI.
8. **Verifier.** Matches confirmation emails to checklist items and marks them done.
9. **Voice drafter.** Writes Assist-tier emails in the user's tone from sent mail samples.
10. **Insights.** Stale-info audit, forgotten accounts, breach flags, subscriptions, deadlines, cost-saver.
11. **UI.** Graph of "you" with accounts turning green, checklist, approvals, morning digest.

## Feature scope

Core (must ship by 16:00):
- Discovery, tiers, checklist, Act and Mock execution with approval, verification, graph UI.

Personal layer (ship in this order as time allows):
1. Stale-info audit (reuses discovery, one-click demo)
2. Rules that learn from approvals
3. Voice-matched draft emails for Assist tier
4. Playbook memory and "learned playbooks" counter
5. Life timeline and predicted events
6. Deadline tracking
7. Privacy side effects (forgotten accounts, subscriptions; breach check only if time)
8. Cost saver
9. Household mode (stretch, pitch slide if not built)

## Stack

TypeScript, Mastra (agent), Playwright (browser), Next.js (UI), SQLite (Neon optional), Claude for extraction, planning and drafting.

## Data model (sketch)

- `accounts(id, name, domain, category, tier, last_seen, billing_signal, stale_fields)`
- `events(id, type, date, source, predicted)`
- `checklist_items(id, event_id, account_id, tier, status, draft)`
- `rules(id, text, source: user|learned, active)`
- `playbooks(domain, steps_json, quirks, success_count)`
- `approvals(id, item_id, decision, ts)`

## Demo plan

- Real inbox for discovery. Cleaned seed data on stage to avoid showing private mail.
- Execute on 2 to 3 low-risk real accounts (gym, game site) plus the mock bank and DMV.
- Show Assist tier for a real bank: kit only, nothing touched.
- Fallback recorded video by 16:00.

## Timeline

| Time | Goal |
|---|---|
| 12:30 | Scaffold, Gmail discovery working |
| 13:30 | Classifier, account graph, mock sites |
| 14:30 | Planner and checklist, rules engine |
| 15:30 | Executor with approval, verifier |
| 16:00 | UI polish, seed data, personal-layer extras |
| 16:30 | Submit with rehearsed demo and fallback video |

## Risks

- Browser automation on live sites is flaky. Mitigation: mock sites guarantee a working demo path.
- Gmail OAuth setup time. Mitigation: use the existing Gmail connector or an exported mbox for the demo.
- Scope. Mitigation: ordered feature list above, cut from the bottom.

## Open items

- Confirm TypeScript stack.
- Choose which real low-risk sites to use for the live demo.
