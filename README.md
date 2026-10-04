# Life Event Paperwork Agent

A trusted-delegation demo for turning one life event into a safe, verified checklist across a person's accounts.

## Monorepo layout

- `apps/web` — Next.js dashboard: account map, approval cards, and assist kits.
- `packages/core` — domain types, seeded discovery data, safety policy, and moving-event planner.
- `packages/agentmail` — minimal AgentMail API adapter for confirmations and codes.
- `packages/mock-sites` — catalog and behavior contracts for the five deterministic demo sites.
- `doc` — product and demo design.
- `manifests` — Kubernetes deployment manifests.

## Run locally

1. Copy `.env.example` to `.env` and supply the AgentMail API key.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

The current UI is a working planning/approval thin slice backed by seeded accounts. The next implementation step is to wire individual mock-site actions and AgentMail confirmation verification.