# Life-Event Paperwork Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an agent that, given an address change, finds the user's accounts from its own AgentMail inbox, plans the update, fills five mock sites after approval, verifies each by confirmation email, and presents it through a distinctive UI (Orbit map, Approval Deck, Watch It Work).

**Architecture:** A Next.js app serves the UI and API routes. A pure-TypeScript agent package (discovery, classifier, rules, planner, verifier, kit, executor) is driven by an orchestrator state machine backed by Neon Postgres. Playwright executes per-site playbooks against five Hono mock sites, streaming steps and screenshots to the UI over SSE. All email goes through AgentMail. LLM calls go through the Neon AI Gateway via one wrapper. Work is split into lanes that integrate only through the shared contracts defined in Wave 0.

**Tech Stack:** TypeScript, Next.js (App Router), Hono, Playwright, Vitest, zod, Neon Postgres (`pg`), Neon Auth, Neon AI Gateway, AgentMail, ngrok.

Design reference: `doc/2026-10-04-life-event-agent-design.md`.

---

## 0. How to use this plan

### 0.1 Schedule (now 14:10 PDT, submit 16:30 PDT)

| Wave | Window | What happens |
|---|---|---|
| **0 Foundation** | 14:10 to 14:40 | One person does tasks 0.1 to 0.3 so contracts exist. Everyone else reads the contracts (section 2) and fixtures, and can start Wave 1 tasks as soon as 0.2 is merged. |
| **1 Parallel build** | 14:40 to 15:25 | All lanes (P, M, G, U) work in parallel against contracts and fixtures. Only ★ tasks are required. |
| **2 Integration** | 15:25 to 15:55 | Lane O wires the orchestrator, API and SSE. UI switches from fixtures to live data. Task F1 proves the thin slice. |
| **3 Polish and ship** | 15:55 to 16:30 | Polish, reset, rehearse, record fallback video by 16:05, README, submit. **Freeze features at 16:00.** |

There are 44 tasks. That is more than 2h20m of wall time for one person, which is why they are split into independent lanes. **Tasks marked ★ are the MVP.** If a lane is behind at the end of Wave 1, drop its non-★ tasks.

### 0.2 Lanes, suggested owners, and file ownership

Each lane owns its directories. Do not edit another lane's files. If you need a contract change, change `packages/shared` in a tiny commit and tell everyone.

| Lane | Scope | Owns | Suggested owner |
|---|---|---|---|
| **0** | Foundation and contracts | repo root, `packages/shared` | Person 1 |
| **P** | Platform: auth, LLM, AgentMail client, ngrok | `packages/shared/src/{llm,mail}`, `apps/web/src/{auth,middleware}`, `scripts/tunnel*` | Person 1 |
| **M** | Five mock sites and seed | `apps/mocks`, `scripts/seed.ts` | Person 2 |
| **G** | Agent logic and executor | `packages/agent` | Person 3 (+ a second agent) |
| **O** | Orchestrator, repository, API, SSE | `apps/web/src/server`, `apps/web/src/app/api` | Person 1 after Wave 0 |
| **U** | UI | `apps/web/src/{app,components,lib}` (except `api`) | Persons 4 and 5 |
| **F** | End to end, demo, ship | `e2e`, `README.md` | Everyone in Wave 3 |

### 0.3 Dependency graph (what blocks what)

```
0.1 -> 0.2 -> 0.3
0.2 -> everything else (contracts and fixtures)
0.3 -> O1
P2 (llm) -> G1(fallback), G5, G6
P3 (mail) -> M1 (deliverEmail), G8, O5
M1 -> M2..M6 -> M7
M2..M6 (selectors) -> G9, G10, G11
G1,G2,G3,G4,G8,G9 -> O2
O1,O2 -> O3,O4 ; O5 needs P3,G1,G7,G8,O1
U1 -> U2..U8, U10 ; U9 needs P1
O3,O4 + U* -> F1
```
Anything with no arrow into it can start the moment 0.2 is merged.

### 0.4 Conventions

- Test runner: `npm test` (Vitest, whole repo) or `npx vitest run <path>`.
- Commit often, small, with a lane prefix: `G: add discovery parser`. Integrate with `git pull --rebase origin personal-agents` then `git push origin personal-agents`.
- Never commit `.env`. Check `git status` before every `git add`. Add files by name.
- Mock sites use throwaway demo credentials (`maya` / `maya-demo`). Real site credentials are never stored.

### 0.5 Decisions made while planning (they refine the design doc)

1. **Tier vs decision.** `Tier` is only `act` or `assist` (what the agent may automate). The mock sites are `act` accounts with `isMock: true`. "Rule-blocked" is a *decision* (`blocked_by_rule` item status), not a tier.
2. **One approval per account.** The Approval Deck's **Approve** authorizes the run. The executor fills the form, spotlights Submit for 1.5 seconds with a visible **Stop** button, then submits. This keeps one click per account and still lets the user abort.
3. **`auto_approve` rules** may only be created for `act` accounts with no card on file. They are the user's own pre-authorization and are logged.
4. **Discovery source.** Every mock email carries a `Site:` line, because email sent through AgentMail from the agent inbox shows the agent as the sender. Discovery reads `Site:` first and falls back to the sender domain.
5. **Fixtures first.** The UI and agent lanes build against `packages/shared/src/fixtures.ts`, so no lane waits for another's backend.

### 0.6 Things to verify against vendor docs (do this early, one person)

Not yet confirmed: Neon Auth SDK setup, Neon AI Gateway URL and model names, AgentMail send and webhook endpoints and signature scheme. Only `GET /v0/inboxes/{inbox}/threads` is confirmed. Each is isolated in one file (`auth.ts`, `llm.ts`, `mail.ts`) so a wrong guess costs one file.

---

## 1. File structure

```
.
├── package.json                      root workspaces and scripts
├── tsconfig.base.json
├── vitest.config.ts
├── .env / .env.example               secrets (env gitignored)
├── scripts/
│   ├── seed.ts                       reset mocks and trigger welcome emails (M7)
│   ├── tunnel.sh                     ngrok (P4)
│   └── register-webhook.ts           AgentMail webhook registration (P4)
├── packages/
│   ├── shared/                       @pa/shared
│   │   ├── migrations/001_init.sql
│   │   └── src/
│   │       ├── index.ts
│   │       ├── env.ts
│   │       ├── types.ts              zod contracts (0.2)
│   │       ├── fixtures.ts           Maya demo data (0.2)
│   │       ├── db/{client.ts,migrate.ts}
│   │       ├── llm.ts                Neon AI Gateway wrapper (P2)
│   │       └── mail.ts               AgentMail client and deliverEmail (P3)
│   └── agent/                        @pa/agent  (lane G)
│       └── src/
│           ├── discovery.ts classifier.ts rules.ts planner.ts command.ts
│           ├── kit.ts forward.ts verifier.ts audit.ts learning.ts
│           └── executor/{playbooks.ts,run.ts,memory.ts}
├── apps/
│   ├── mocks/                        @pa/mocks  (lane M)
│   │   └── src/{server.ts,state.ts,layout.ts,sites/{gym,pixelvault,threadhub,streambox,harborbank}.ts}
│   └── web/                          @pa/web  (lanes U, O, P)
│       └── src/
│           ├── app/{page.tsx,login/,receipt/,api/...}
│           ├── components/{Orbit,ApprovalDeck,WatchItWork,InboxFeed,Kit,CommandBar,Receipt}/
│           ├── lib/{useAppState.ts,fixtures-mode.ts,sse.ts,theme.css}
│           └── server/{repo.ts,orchestrator.ts,bus.ts,ingest.ts,auth.ts}
└── e2e/thin-slice.test.ts
```

---

## 2. Shared contracts (the interface everyone codes against)

These are created in Task 0.2. Read this section before starting any Wave 1 task.

**Mock-site welcome email (the discovery contract)**
```
Subject: Welcome to IronWorks Gym
Body:
Hi Maya, welcome to IronWorks Gym!
Site: ironworks.mock
Account: maya
Address on file: 12 Pine St, Springfield, IL 62701
```
Old address: `12 Pine St, Springfield, IL 62701`. New address: `42 Oak St, Portland, OR 97205`.

**Mock-site selectors (the executor contract)** all sites live on `MOCKS_BASE_URL` (default `http://localhost:4000`).

| Site (`domain`) | Base path | Login | Address form | Special |
|---|---|---|---|---|
| IronWorks Gym (`ironworks.mock`) | `/gym` | `/gym/login`: `#username`, `#password`, `#login` | `/gym/profile`: `#line1 #city #state #zip`, submit `#save` | confirmation email within 2s |
| PixelVault (`pixelvault.mock`) | `/pixelvault` | `/pixelvault/login` same ids | `/pixelvault/address`: fields, submit `#next` → `/pixelvault/verify`: `#code`, submit `#confirm` | emails a 6-digit code on `#next` (subject contains `verification code`, body `Your code is 123456`) |
| ThreadHub (`threadhub.mock`) | `/threadhub` | `/threadhub/login` | `/threadhub/settings`: fields, submit `#save` | confirmation email delayed 30s (`THREADHUB_DELAY_MS`) |
| StreamBox (`streambox.mock`) | `/streambox` | `/streambox/login` | `/streambox/billing`: fields, submit `#save`, shows `Card on file •••• 4242` | `hasCardOnFile` true |
| Harbor Bank (`harborbank.mock`) | `/harborbank` | none | no address form. Page says "call, visit, or send a secure message" | `assist` tier, never automated |

Confirmation email subject: `<Site name>: address updated`, body includes `Site: <domain>` and `Address on file: <new address>`.
Mock endpoints on every site host: `POST /__reset` (restore Maya's old address), `GET /__state` (JSON `{ [domain]: Address }`).

**API routes (lane O implements, lane U consumes)** all require a session.

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/state` | GET | none | `{ accounts: Account[], items: ChecklistItem[], rules: Rule[], events: LifeEvent[] }` |
| `/api/events` | POST | `{ text: string }` (free text command) | `{ event: LifeEvent, items: ChecklistItem[], summary: string }` |
| `/api/items/:id/approve` | POST | `{ alwaysForCategory?: boolean }` | `{ item: ChecklistItem }` |
| `/api/items/:id/skip` | POST | none | `{ item: ChecklistItem }` |
| `/api/items/:id/stop` | POST | none | `{ item: ChecklistItem }` |
| `/api/rules` | POST | `Rule` without id | `{ rule: Rule }` |
| `/api/audit` | GET | none | `{ entries: AuditEntry[] }` |
| `/api/inbox` | GET | none | `{ messages: InboxMessage[] }` |
| `/api/inbox/simulated` | POST | `{ subject, text }` | `{ ok: true }` (fallback when AgentMail send fails) |
| `/api/webhooks/agentmail` | POST | AgentMail webhook body | `200` |
| `/api/stream` | GET | none | SSE of `RunEvent` |

---

# WAVE 0: Foundation (one person, about 30 minutes)

### Task 0.1: Scaffold the monorepo

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`
- Create: `packages/shared/package.json`, `packages/shared/src/index.ts`, `packages/shared/src/env.ts`
- Create: `packages/agent/package.json`, `packages/agent/src/index.ts`
- Create: `apps/mocks/package.json`
- Create: `apps/web` (via create-next-app)
- Modify: `.env.example`

- [ ] **Step 1: Create the root files**

`package.json`:
```json
{
  "name": "personal-agents",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:web": "npm run dev -w @pa/web",
    "dev:mocks": "npm run dev -w @pa/mocks",
    "test": "vitest run",
    "db:migrate": "tsx --env-file=.env packages/shared/src/db/migrate.ts",
    "seed": "tsx --env-file=.env scripts/seed.ts",
    "tunnel": "bash scripts/tunnel.sh"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```
`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```
`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'apps/web/src') } },
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/mocks/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
      'e2e/**/*.test.ts',
    ],
    environment: 'node',
    testTimeout: 15000,
  },
});
```
`packages/shared/package.json`:
```json
{ "name": "@pa/shared", "version": "0.0.0", "private": true, "main": "src/index.ts", "dependencies": { "zod": "^3.23.0", "pg": "^8.13.0" }, "devDependencies": { "@types/pg": "^8.11.0" } }
```
`packages/agent/package.json`:
```json
{ "name": "@pa/agent", "version": "0.0.0", "private": true, "main": "src/index.ts", "dependencies": { "@pa/shared": "*", "playwright": "^1.48.0" } }
```
`apps/mocks/package.json`:
```json
{ "name": "@pa/mocks", "version": "0.0.0", "private": true, "scripts": { "dev": "tsx --env-file=../../.env src/server.ts" }, "dependencies": { "@pa/shared": "*", "hono": "^4.6.0", "@hono/node-server": "^1.13.0" } }
```
`packages/shared/src/env.ts`:
```ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  AGENTMAIL_API_KEY: z.string().optional(),
  AGENTMAIL_INBOX: z.string().default('haarish-agent@agentmail.to'),
  NEON_AI_GATEWAY_URL: z.string().optional(),
  NEON_AI_GATEWAY_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('claude-sonnet-5'),
  LLM_MODE: z.enum(['real', 'fake']).optional(),
  EMAIL_MODE: z.enum(['agentmail', 'simulated']).default('agentmail'),
  AUTH_MODE: z.enum(['neon', 'dev']).default('dev'),
  MOCKS_BASE_URL: z.string().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),
  THREADHUB_DELAY_MS: z.coerce.number().default(30000),
  NGROK_AUTHTOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env & { llmMode: 'real' | 'fake' } {
  const parsed = schema.parse(source);
  const llmMode = parsed.LLM_MODE ?? (parsed.NEON_AI_GATEWAY_KEY ? 'real' : 'fake');
  return { ...parsed, llmMode };
}
```
`packages/shared/src/index.ts`:
```ts
export * from './env';
```
`packages/agent/src/index.ts`:
```ts
export {};
```
`.env.example` (replace contents):
```
AGENTMAIL_API_KEY=your_agentmail_api_key
AGENTMAIL_INBOX=haarish-agent@agentmail.to
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
NEON_AI_GATEWAY_URL=
NEON_AI_GATEWAY_KEY=
LLM_MODEL=claude-sonnet-5
LLM_MODE=fake
EMAIL_MODE=agentmail
AUTH_MODE=dev
MOCKS_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:3000
NGROK_AUTHTOKEN=
```

- [ ] **Step 2: Create the web app**

Run:
```bash
npx create-next-app@latest apps/web --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm --no-turbopack --yes
```
Then edit `apps/web/package.json`: set `"name": "@pa/web"` and add dependencies `"@pa/shared": "*"`, `"@pa/agent": "*"`. Edit `apps/web/next.config.ts`:
```ts
import type { NextConfig } from 'next';
const config: NextConfig = { transpilePackages: ['@pa/shared', '@pa/agent'] };
export default config;
```
Link the root env file so Next.js reads it: `ln -s ../../.env apps/web/.env.local`.

- [ ] **Step 3: Install and write a smoke test**

`packages/shared/src/env.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('defaults to fake LLM mode without a gateway key', () => {
    expect(loadEnv({}).llmMode).toBe('fake');
  });
  it('uses real LLM mode when a gateway key is present', () => {
    expect(loadEnv({ NEON_AI_GATEWAY_KEY: 'k' }).llmMode).toBe('real');
  });
  it('defaults the agent inbox', () => {
    expect(loadEnv({}).AGENTMAIL_INBOX).toBe('haarish-agent@agentmail.to');
  });
});
```
Run: `npm install && npx vitest run packages/shared/src/env.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Confirm `.env` is ignored, then commit**

Run: `git check-ignore .env && git status --short`
Expected: `.env` printed by check-ignore and not listed in status.
```bash
git add package.json tsconfig.base.json vitest.config.ts packages apps .env.example
git commit -m "0: scaffold monorepo, env loader"
git pull --rebase origin personal-agents && git push origin personal-agents
```

---

### Task 0.2: Shared contracts and fixtures

**Files:**
- Create: `packages/shared/src/types.ts`, `packages/shared/src/fixtures.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/types.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Account, ChecklistItem, Rule, InboxMessage, RunEvent, addressToString } from './types';
import { fixtures } from './fixtures';

describe('fixtures match contracts', () => {
  it('accounts', () => fixtures.accounts.forEach((a) => Account.parse(a)));
  it('items', () => fixtures.items.forEach((i) => ChecklistItem.parse(i)));
  it('rules', () => fixtures.rules.forEach((r) => Rule.parse(r)));
  it('inbox', () => fixtures.inbox.forEach((m) => InboxMessage.parse(m)));
  it('run events', () => fixtures.runEvents.forEach((e) => RunEvent.parse(e)));
});

describe('addressToString', () => {
  it('formats one line', () => {
    expect(addressToString(fixtures.newAddress)).toBe('42 Oak St, Portland, OR 97205');
  });
});

describe('demo shape', () => {
  it('has exactly five mock accounts and one assist account', () => {
    expect(fixtures.accounts).toHaveLength(5);
    expect(fixtures.accounts.filter((a) => a.tier === 'assist')).toHaveLength(1);
    expect(fixtures.accounts.filter((a) => a.hasCardOnFile)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/shared/src/types.test.ts`
Expected: FAIL, cannot find `./types`.

- [ ] **Step 3: Write the contracts**

`packages/shared/src/types.ts`:
```ts
import { z } from 'zod';

export const Tier = z.enum(['act', 'assist']);
export const Category = z.enum(['gym', 'gaming', 'forum', 'subscription', 'bank', 'utility', 'other']);
export const ItemStatus = z.enum([
  'pending',
  'ready',
  'blocked_by_rule',
  'awaiting_approval',
  'running',
  'awaiting_confirmation',
  'verified',
  'skipped',
  'failed',
  'kit_ready',
]);

export const Address = z.object({
  line1: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
});
export type Address = z.infer<typeof Address>;
export const addressToString = (a: Address) => `${a.line1}, ${a.city}, ${a.state} ${a.zip}`;
export const addressEquals = (a: Address, b: Address) => addressToString(a) === addressToString(b);

export const Account = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  category: Category,
  tier: Tier,
  isMock: z.boolean(),
  addressOnFile: Address.nullable(),
  hasCardOnFile: z.boolean(),
  lastSeen: z.string(),
});
export type Account = z.infer<typeof Account>;

export const LifeEvent = z.object({
  id: z.string(),
  type: z.literal('address_change'),
  newAddress: Address,
  effectiveDate: z.string(),
  predicted: z.boolean(),
  source: z.string(),
});
export type LifeEvent = z.infer<typeof LifeEvent>;

export const Kit = z.object({
  link: z.string(),
  values: z.array(z.object({ label: z.string(), value: z.string() })),
  draftEmail: z.object({ subject: z.string(), body: z.string() }),
});
export type Kit = z.infer<typeof Kit>;

export const ChecklistItem = z.object({
  id: z.string(),
  eventId: z.string(),
  accountId: z.string(),
  tier: Tier,
  status: ItemStatus,
  before: Address.nullable(),
  after: Address,
  ruleId: z.string().nullable(),
  kit: Kit.nullable(),
  updatedAt: z.string(),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const RuleMatch = z.object({
  category: Category.optional(),
  hasCardOnFile: z.boolean().optional(),
  domain: z.string().optional(),
});
export const Rule = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(['user', 'learned']),
  match: RuleMatch,
  action: z.enum(['ask', 'auto_approve', 'skip']),
  active: z.boolean(),
});
export type Rule = z.infer<typeof Rule>;

export const InboxMessage = z.object({
  id: z.string(),
  threadId: z.string(),
  from: z.string(),
  subject: z.string(),
  text: z.string(),
  receivedAt: z.string(),
});
export type InboxMessage = z.infer<typeof InboxMessage>;

export const AuditEntry = z.object({
  id: z.string(),
  ts: z.string(),
  itemId: z.string().nullable(),
  kind: z.enum(['planned', 'approved', 'skipped', 'filled', 'submitted', 'verified', 'failed', 'rule_created', 'stopped']),
  detail: z.string(),
  undo: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const RunEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('step'), itemId: z.string(), text: z.string() }),
  z.object({ type: z.literal('frame'), itemId: z.string(), jpegBase64: z.string() }),
  z.object({ type: z.literal('status'), itemId: z.string(), status: ItemStatus }),
  z.object({ type: z.literal('inbox'), message: InboxMessage }),
  z.object({ type: z.literal('spotlight_submit'), itemId: z.string(), msUntilSubmit: z.number() }),
]);
export type RunEvent = z.infer<typeof RunEvent>;
```
`packages/shared/src/fixtures.ts`:
```ts
import type { Account, Address, ChecklistItem, InboxMessage, Rule, RunEvent } from './types';

const oldAddress: Address = { line1: '12 Pine St', city: 'Springfield', state: 'IL', zip: '62701' };
const newAddress: Address = { line1: '42 Oak St', city: 'Portland', state: 'OR', zip: '97205' };
const now = '2026-10-04T21:00:00.000Z';

const accounts: Account[] = [
  { id: 'acc_gym', name: 'IronWorks Gym', domain: 'ironworks.mock', category: 'gym', tier: 'act', isMock: true, addressOnFile: oldAddress, hasCardOnFile: false, lastSeen: now },
  { id: 'acc_pixel', name: 'PixelVault', domain: 'pixelvault.mock', category: 'gaming', tier: 'act', isMock: true, addressOnFile: oldAddress, hasCardOnFile: false, lastSeen: now },
  { id: 'acc_thread', name: 'ThreadHub', domain: 'threadhub.mock', category: 'forum', tier: 'act', isMock: true, addressOnFile: oldAddress, hasCardOnFile: false, lastSeen: now },
  { id: 'acc_stream', name: 'StreamBox', domain: 'streambox.mock', category: 'subscription', tier: 'act', isMock: true, addressOnFile: oldAddress, hasCardOnFile: true, lastSeen: now },
  { id: 'acc_bank', name: 'Harbor Bank', domain: 'harborbank.mock', category: 'bank', tier: 'assist', isMock: true, addressOnFile: oldAddress, hasCardOnFile: false, lastSeen: now },
];

const rules: Rule[] = [
  { id: 'rule_card', text: 'Never auto-update anything with my card on file', kind: 'user', match: { hasCardOnFile: true }, action: 'ask', active: true },
];

const item = (id: string, accountId: string, tier: 'act' | 'assist', status: ChecklistItem['status'], ruleId: string | null = null): ChecklistItem => ({
  id, eventId: 'evt_1', accountId, tier, status, before: oldAddress, after: newAddress, ruleId, kit: null, updatedAt: now,
});

const items: ChecklistItem[] = [
  item('item_gym', 'acc_gym', 'act', 'awaiting_approval'),
  item('item_pixel', 'acc_pixel', 'act', 'awaiting_approval'),
  item('item_thread', 'acc_thread', 'act', 'awaiting_approval'),
  item('item_stream', 'acc_stream', 'act', 'blocked_by_rule', 'rule_card'),
  {
    ...item('item_bank', 'acc_bank', 'assist', 'kit_ready'),
    kit: {
      link: 'http://localhost:4000/harborbank',
      values: [
        { label: 'New address', value: '42 Oak St, Portland, OR 97205' },
        { label: 'Effective date', value: '2026-11-01' },
      ],
      draftEmail: {
        subject: 'Address change request',
        body: 'Hello,\n\nI am moving to 42 Oak St, Portland, OR 97205 effective 2026-11-01. Please update my address on file.\n\nThanks,\nMaya',
      },
    },
  },
];

const inbox: InboxMessage[] = [
  { id: 'msg_1', threadId: 'thr_1', from: 'haarish-agent@agentmail.to', subject: 'Welcome to IronWorks Gym', text: 'Hi Maya, welcome to IronWorks Gym!\nSite: ironworks.mock\nAccount: maya\nAddress on file: 12 Pine St, Springfield, IL 62701', receivedAt: now },
];

const runEvents: RunEvent[] = [
  { type: 'step', itemId: 'item_gym', text: 'Opening IronWorks...' },
  { type: 'status', itemId: 'item_gym', status: 'running' },
  { type: 'spotlight_submit', itemId: 'item_gym', msUntilSubmit: 1500 },
  { type: 'inbox', message: inbox[0] },
];

export const fixtures = { oldAddress, newAddress, accounts, rules, items, inbox, runEvents };
```
`packages/shared/src/index.ts`:
```ts
export * from './env';
export * from './types';
export { fixtures } from './fixtures';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/shared/src/types.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit and announce**

```bash
git add packages/shared/src
git commit -m "0: shared contracts and demo fixtures"
git pull --rebase origin personal-agents && git push origin personal-agents
```
**Tell the team the contracts are merged. Wave 1 can start.**

---

### Task 0.3: Neon schema, db client, migrations

**Files:**
- Create: `packages/shared/migrations/001_init.sql`
- Create: `packages/shared/src/db/client.ts`, `packages/shared/src/db/migrate.ts`
- Test: `packages/shared/src/db/migrate.test.ts`

**Manual prerequisite (2 min):** create a Neon project, copy its connection string into `.env` as `DATABASE_URL`. Never commit it.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/db/migrate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { query, close } from './client';
import { migrate } from './migrate';

describe.skipIf(!process.env.DATABASE_URL)('migrations', () => {
  it('creates the core tables and is idempotent', async () => {
    await migrate();
    await migrate();
    const r = await query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public'",
    );
    const names = r.rows.map((x) => x.table_name);
    for (const t of ['accounts', 'events', 'checklist_items', 'rules', 'audit_log', 'playbooks', 'inbox_messages']) {
      expect(names).toContain(t);
    }
    await close();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL=$(grep ^DATABASE_URL .env | cut -d= -f2-) npx vitest run packages/shared/src/db/migrate.test.ts`
Expected: FAIL, cannot find `./client`.

- [ ] **Step 3: Implement**

`packages/shared/migrations/001_init.sql`:
```sql
create table if not exists accounts (
  id text primary key,
  user_id text not null,
  name text not null,
  domain text not null,
  category text not null,
  tier text not null,
  is_mock boolean not null default false,
  address_on_file jsonb,
  has_card_on_file boolean not null default false,
  last_seen timestamptz not null default now(),
  unique (user_id, domain)
);
create table if not exists events (
  id text primary key,
  user_id text not null,
  type text not null,
  new_address jsonb not null,
  effective_date text not null,
  predicted boolean not null default false,
  source text not null,
  created_at timestamptz not null default now()
);
create table if not exists checklist_items (
  id text primary key,
  user_id text not null,
  event_id text not null references events(id),
  account_id text not null references accounts(id),
  tier text not null,
  status text not null,
  before jsonb,
  after jsonb not null,
  rule_id text,
  kit jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists rules (
  id text primary key,
  user_id text not null,
  text text not null,
  kind text not null,
  match jsonb not null,
  action text not null,
  active boolean not null default true
);
create table if not exists audit_log (
  id bigserial primary key,
  user_id text not null,
  ts timestamptz not null default now(),
  item_id text,
  kind text not null,
  detail text not null,
  undo text
);
create table if not exists playbooks (
  domain text primary key,
  quirks text not null default '',
  success_count integer not null default 0
);
create table if not exists inbox_messages (
  id text primary key,
  user_id text not null,
  thread_id text not null,
  from_addr text not null,
  subject text not null,
  body text not null,
  received_at timestamptz not null,
  processed boolean not null default false
);
```
`packages/shared/src/db/client.ts`:
```ts
import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

export const query = <T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  getPool().query<T>(text, params);

export async function close() {
  await pool?.end();
  pool = null;
}
```
`packages/shared/src/db/migrate.ts`:
```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, close } from './client';

export async function migrate() {
  await query('create table if not exists _migrations (name text primary key, applied_at timestamptz default now())');
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const done = await query('select 1 from _migrations where name = $1', [file]);
    if (done.rowCount) continue;
    await query(readFileSync(join(dir, file), 'utf8'));
    await query('insert into _migrations (name) values ($1)', [file]);
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  migrate().then(() => close()).then(() => console.log('migrated'));
}
```
Add to `packages/shared/src/index.ts`: `export { query, close } from './db/client';`

- [ ] **Step 4: Run to verify it passes**

Run: `npm run db:migrate && npx vitest run packages/shared/src/db/migrate.test.ts`
Expected: prints `migrated`, then the test passes (or is skipped when `DATABASE_URL` is unset).

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "0: neon schema, db client, migrations"
git pull --rebase origin personal-agents && git push origin personal-agents
```

---

# LANE P: Platform

### Task P1: Neon Auth gate ★

**Files:**
- Create: `apps/web/src/server/auth.ts`, `apps/web/src/middleware.ts`
- Test: `apps/web/src/server/auth.test.ts`

**First (10 min max):** read the current Neon Auth docs, enable Neon Auth on the Neon project, install the SDK it specifies, and set its env vars in `.env`. If this is not working after 20 minutes, use the fallback in Step 3b.

- [ ] **Step 1: Write the failing test**

`apps/web/src/server/auth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { requireUser, HttpError } from './auth';

describe('requireUser', () => {
  it('returns the demo user in dev mode', async () => {
    const u = await requireUser(new Request('http://x/api/state'), { mode: 'dev' });
    expect(u.id).toBe('maya-demo');
  });
  it('throws 401 in neon mode without a session', async () => {
    await expect(requireUser(new Request('http://x/api/state'), { mode: 'neon', getSession: async () => null })).rejects.toMatchObject({ status: 401 });
  });
  it('returns the session user in neon mode', async () => {
    const u = await requireUser(new Request('http://x/api/state'), { mode: 'neon', getSession: async () => ({ id: 'u1' }) });
    expect(u.id).toBe('u1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/server/auth.test.ts`
Expected: FAIL, cannot find `./auth`.

- [ ] **Step 3: Implement**

`apps/web/src/server/auth.ts`:
```ts
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type SessionUser = { id: string };
type Opts = { mode?: 'dev' | 'neon'; getSession?: (req: Request) => Promise<SessionUser | null> };

export async function requireUser(req: Request, opts: Opts = {}): Promise<SessionUser> {
  const mode = opts.mode ?? (process.env.AUTH_MODE as 'dev' | 'neon') ?? 'dev';
  if (mode === 'dev') return { id: 'maya-demo' };
  const getSession = opts.getSession ?? neonGetSession;
  const user = await getSession(req);
  if (!user) throw new HttpError(401, 'Not signed in');
  return user;
}

// Replace the body with the call from the Neon Auth SDK docs. It must return { id } or null.
async function neonGetSession(_req: Request): Promise<SessionUser | null> {
  throw new Error('Wire neonGetSession to the Neon Auth SDK');
}
```
`apps/web/src/middleware.ts` redirects unauthenticated page requests to `/login` when `AUTH_MODE=neon`, and lets `/api/webhooks/agentmail`, `/login` and static assets through (webhooks are verified by signature in O5).

- [ ] **Step 3b (fallback only):** if Neon Auth is blocked, implement `neonGetSession` as a cookie check against `DEMO_PASSCODE` from `.env`, and tell the team in chat. The tunnel must never go up with `AUTH_MODE=dev`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/server/auth.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/auth.ts apps/web/src/server/auth.test.ts apps/web/src/middleware.ts
git commit -m "P: auth gate with dev bypass"
```

---

### Task P2: Neon AI Gateway wrapper ★

**Files:**
- Create: `packages/shared/src/llm.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/llm.test.ts`

Confirm the Gateway base URL, auth header and model id in the Neon docs. The code below assumes an OpenAI-compatible `/chat/completions` endpoint. If it differs, change only `callGateway`.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/llm.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { completeJson } from './llm';

const schema = z.object({ city: z.string() });

describe('completeJson', () => {
  it('uses the fake handler in fake mode', async () => {
    const out = await completeJson({ system: 's', user: 'u', schema, mode: 'fake', fake: () => ({ city: 'Portland' }) });
    expect(out.city).toBe('Portland');
  });
  it('validates real responses against the schema and retries once', async () => {
    let calls = 0;
    const call = async () => (++calls === 1 ? '{"nope":1}' : '{"city":"Oslo"}');
    const out = await completeJson({ system: 's', user: 'u', schema, mode: 'real', callGateway: call });
    expect(out.city).toBe('Oslo');
    expect(calls).toBe(2);
  });
  it('throws after the retry fails', async () => {
    await expect(completeJson({ system: 's', user: 'u', schema, mode: 'real', callGateway: async () => 'garbage' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/shared/src/llm.test.ts`
Expected: FAIL, cannot find `./llm`.

- [ ] **Step 3: Implement**

`packages/shared/src/llm.ts`:
```ts
import type { z } from 'zod';
import { loadEnv } from './env';

type Gateway = (system: string, user: string) => Promise<string>;

type Opts<T extends z.ZodTypeAny> = {
  system: string;
  user: string;
  schema: T;
  mode?: 'real' | 'fake';
  fake?: () => z.infer<T>;
  callGateway?: Gateway;
};

async function defaultGateway(system: string, user: string): Promise<string> {
  const env = loadEnv();
  const res = await fetch(`${env.NEON_AI_GATEWAY_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.NEON_AI_GATEWAY_KEY}` },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages: [
        { role: 'system', content: `${system}\nRespond with a single JSON object only.` },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

const extractJson = (s: string) => s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1);

export async function completeJson<T extends z.ZodTypeAny>(o: Opts<T>): Promise<z.infer<T>> {
  const mode = o.mode ?? loadEnv().llmMode;
  if (mode === 'fake') {
    if (!o.fake) throw new Error('fake mode requires a fake handler');
    return o.schema.parse(o.fake());
  }
  const call = o.callGateway ?? defaultGateway;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return o.schema.parse(JSON.parse(extractJson(await call(o.system, o.user))));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
```
Add `export { completeJson } from './llm';` to `index.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/shared/src/llm.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "P: LLM gateway wrapper with fake mode"
```

---

### Task P3: AgentMail client and deliverEmail ★

**Files:**
- Create: `packages/shared/src/mail.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/mail.test.ts`

**Verify first:** list messages, get message and send endpoints in the AgentMail docs. Only the threads `GET` is confirmed. Adjust `paths` below to match.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/mail.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createMailClient, normalizeMessage, deliverEmail } from './mail';

describe('normalizeMessage', () => {
  it('maps tolerant field names into InboxMessage', () => {
    const m = normalizeMessage({ message_id: 'm1', thread_id: 't1', from: 'a@b.c', subject: 'Hi', text: 'Body', created_at: '2026-10-04T00:00:00Z' });
    expect(m).toMatchObject({ id: 'm1', threadId: 't1', from: 'a@b.c', subject: 'Hi', text: 'Body' });
  });
});

describe('createMailClient', () => {
  it('lists messages with bearer auth', async () => {
    const calls: { url: string; auth: string | null }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, auth: new Headers(init.headers).get('authorization') });
      return new Response(JSON.stringify({ messages: [{ message_id: 'm1', thread_id: 't1', from: 'x', subject: 's', text: 't', created_at: '2026-10-04T00:00:00Z' }] }));
    }) as unknown as typeof fetch;
    const client = createMailClient({ apiKey: 'k', inbox: 'haarish-agent@agentmail.to', fetch: fakeFetch });
    const msgs = await client.listMessages();
    expect(msgs).toHaveLength(1);
    expect(calls[0].auth).toBe('Bearer k');
    expect(calls[0].url).toContain('haarish-agent%40agentmail.to');
  });
});

describe('deliverEmail', () => {
  it('falls back to the simulated endpoint when sending fails', async () => {
    const posted: string[] = [];
    await deliverEmail({ subject: 's', text: 't' }, {
      send: async () => { throw new Error('boom'); },
      postSimulated: async (b) => { posted.push(b.subject); },
    });
    expect(posted).toEqual(['s']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/shared/src/mail.test.ts`
Expected: FAIL, cannot find `./mail`.

- [ ] **Step 3: Implement**

`packages/shared/src/mail.ts`:
```ts
import type { InboxMessage } from './types';
import { loadEnv } from './env';

const BASE = 'https://api.agentmail.to/v0';

export function normalizeMessage(raw: Record<string, any>): InboxMessage {
  return {
    id: String(raw.message_id ?? raw.id),
    threadId: String(raw.thread_id ?? raw.threadId ?? ''),
    from: String(Array.isArray(raw.from) ? raw.from[0] : raw.from ?? ''),
    subject: String(raw.subject ?? ''),
    text: String(raw.text ?? raw.body ?? raw.preview ?? ''),
    receivedAt: String(raw.created_at ?? raw.timestamp ?? new Date().toISOString()),
  };
}

type ClientOpts = { apiKey: string; inbox: string; fetch?: typeof fetch };

export function createMailClient(o: ClientOpts) {
  const f = o.fetch ?? fetch;
  const inbox = encodeURIComponent(o.inbox);
  const headers = { authorization: `Bearer ${o.apiKey}`, 'content-type': 'application/json' };
  return {
    async listMessages(limit = 50): Promise<InboxMessage[]> {
      const res = await f(`${BASE}/inboxes/${inbox}/messages?limit=${limit}`, { headers });
      if (!res.ok) throw new Error(`AgentMail list ${res.status}`);
      const data = (await res.json()) as { messages?: Record<string, any>[] };
      return (data.messages ?? []).map(normalizeMessage);
    },
    async send(to: string, subject: string, text: string): Promise<void> {
      const res = await f(`${BASE}/inboxes/${inbox}/messages/send`, { method: 'POST', headers, body: JSON.stringify({ to, subject, text }) });
      if (!res.ok) throw new Error(`AgentMail send ${res.status}`);
    },
  };
}

type Deliver = {
  send?: (to: string, subject: string, text: string) => Promise<void>;
  postSimulated?: (b: { subject: string; text: string }) => Promise<void>;
};

export async function deliverEmail(msg: { subject: string; text: string }, d: Deliver = {}) {
  const env = loadEnv();
  const send = d.send ?? ((to, s, t) => createMailClient({ apiKey: env.AGENTMAIL_API_KEY ?? '', inbox: env.AGENTMAIL_INBOX }).send(to, s, t));
  const postSimulated = d.postSimulated ?? (async (b) => {
    await fetch(`${env.WEB_BASE_URL}/api/inbox/simulated`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  });
  if (env.EMAIL_MODE === 'simulated') return postSimulated(msg);
  try {
    await send(env.AGENTMAIL_INBOX, msg.subject, msg.text);
  } catch {
    await postSimulated(msg);
  }
}
```
Add `export * from './mail';` to `index.ts`. **Then run the real check once** and note the result in chat: `npx tsx --env-file=.env -e "import('@pa/shared').then(async m=>{const c=m.createMailClient({apiKey:process.env.AGENTMAIL_API_KEY!,inbox:process.env.AGENTMAIL_INBOX!});await c.send(process.env.AGENTMAIL_INBOX!,'ping','hello');console.log(await c.listMessages())})"`. If the inbox cannot send to itself, set `EMAIL_MODE=simulated` for the demo and tell the team.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/shared/src/mail.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "P: AgentMail client and deliverEmail fallback"
```

---

### Task P4: ngrok tunnel and webhook registration

**Files:**
- Create: `scripts/tunnel.sh`, `scripts/tunnel-url.ts`, `scripts/register-webhook.ts`
- Test: `scripts/tunnel-url.test.ts` (add `scripts/**/*.test.ts` to `vitest.config.ts` includes)

**Safety:** only expose the web app (port 3000). Do not start the tunnel unless `AUTH_MODE=neon` (or the passcode fallback) is on.

- [ ] **Step 1: Write the failing test**

`scripts/tunnel-url.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseTunnelUrl } from './tunnel-url';

describe('parseTunnelUrl', () => {
  it('picks the https public url', () => {
    const json = { tunnels: [{ public_url: 'http://a.ngrok.app' }, { public_url: 'https://a.ngrok.app' }] };
    expect(parseTunnelUrl(json)).toBe('https://a.ngrok.app');
  });
  it('returns null when there is no tunnel', () => {
    expect(parseTunnelUrl({ tunnels: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/tunnel-url.test.ts`
Expected: FAIL, cannot find `./tunnel-url`.

- [ ] **Step 3: Implement**

`scripts/tunnel-url.ts`:
```ts
export function parseTunnelUrl(json: { tunnels: { public_url: string }[] }): string | null {
  return json.tunnels.find((t) => t.public_url.startsWith('https://'))?.public_url ?? null;
}
```
`scripts/tunnel.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
set -a; . ./.env; set +a
if [ "${AUTH_MODE:-dev}" = "dev" ]; then
  echo "Refusing to open a public tunnel with AUTH_MODE=dev. Set AUTH_MODE=neon first." >&2
  exit 1
fi
ngrok config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null
ngrok http 3000 --log=stdout
```
`scripts/register-webhook.ts`: reads the URL from `http://127.0.0.1:4040/api/tunnels` via `parseTunnelUrl`, then registers `${url}/api/webhooks/agentmail` with the AgentMail webhooks API (check the docs for the exact endpoint). Print the URL on success.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/tunnel-url.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts vitest.config.ts
git commit -m "P: ngrok tunnel script with auth guard, webhook registration"
```

---

# LANE M: Mock sites

### Task M1: Mock harness, state, layout, email hook ★

**Files:**
- Create: `apps/mocks/src/state.ts`, `apps/mocks/src/layout.ts`, `apps/mocks/src/server.ts`
- Test: `apps/mocks/src/state.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mocks/src/state.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { createState } from './state';

describe('mock state', () => {
  it('starts every site with the old address', () => {
    const s = createState();
    expect(s.get('ironworks.mock')).toEqual(fixtures.oldAddress);
  });
  it('updates and resets', () => {
    const s = createState();
    s.set('ironworks.mock', fixtures.newAddress);
    expect(s.get('ironworks.mock')).toEqual(fixtures.newAddress);
    s.reset();
    expect(s.get('ironworks.mock')).toEqual(fixtures.oldAddress);
  });
  it('exposes a snapshot for /__state', () => {
    expect(Object.keys(createState().snapshot()).sort()).toEqual(
      ['harborbank.mock', 'ironworks.mock', 'pixelvault.mock', 'streambox.mock', 'threadhub.mock'],
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/mocks/src/state.test.ts`
Expected: FAIL, cannot find `./state`.

- [ ] **Step 3: Implement**

`apps/mocks/src/state.ts`:
```ts
import { fixtures, type Address } from '@pa/shared';

export const DOMAINS = ['ironworks.mock', 'pixelvault.mock', 'threadhub.mock', 'streambox.mock', 'harborbank.mock'] as const;
export type Domain = (typeof DOMAINS)[number];

export function createState() {
  let data = new Map<string, Address>(DOMAINS.map((d) => [d, { ...fixtures.oldAddress }]));
  return {
    get: (d: string) => data.get(d)!,
    set: (d: string, a: Address) => void data.set(d, a),
    reset: () => { data = new Map(DOMAINS.map((d) => [d, { ...fixtures.oldAddress }])); },
    snapshot: () => Object.fromEntries(data) as Record<string, Address>,
  };
}
export type MockState = ReturnType<typeof createState>;
```
`apps/mocks/src/layout.ts`:
```ts
export const page = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;max-width:420px;margin:48px auto;padding:0 16px}input{display:block;margin:8px 0;padding:8px;width:100%;box-sizing:border-box}button{padding:10px 16px}</style>
</head><body><h1>${title}</h1>${body}</body></html>`;

export const addressFields = (a: { line1: string; city: string; state: string; zip: string }) =>
  `<input id="line1" name="line1" value="${a.line1}"><input id="city" name="city" value="${a.city}">
<input id="state" name="state" value="${a.state}"><input id="zip" name="zip" value="${a.zip}">`;

export const loginForm = (action: string) =>
  `<form method="post" action="${action}"><input id="username" name="username" value="maya">
<input id="password" name="password" type="password" value="maya-demo"><button id="login">Log in</button></form>`;
```
`apps/mocks/src/server.ts` creates a `Hono` app, creates one `MockState`, mounts each `sites/*.ts` factory (`gymSite(state, mailer)` returning a Hono sub-app) under its base path, exposes `POST /__reset` and `GET /__state`, and listens on port 4000. Each site factory takes a `mailer: (subject, text) => Promise<void>` so tests inject a spy; the real server passes `(subject, text) => deliverEmail({ subject, text })`. Export `createApp({ state, mailer })` for tests.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/mocks/src/state.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/mocks
git commit -m "M: mock harness, state, layout"
```

---

### Task M2: IronWorks Gym site ★

**Files:**
- Create: `apps/mocks/src/sites/gym.ts`
- Modify: `apps/mocks/src/server.ts` (mount it)
- Test: `apps/mocks/src/sites/gym.test.ts`

This is the template for M3 to M6.

- [ ] **Step 1: Write the failing test**

`apps/mocks/src/sites/gym.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { createApp } from '../server';
import { createState } from '../state';

const form = (a = fixtures.newAddress) => new URLSearchParams({ ...a }).toString();

describe('gym', () => {
  it('renders the profile form with the selectors the executor needs', async () => {
    const app = createApp({ state: createState(), mailer: async () => {} });
    const html = await (await app.request('/gym/profile')).text();
    for (const id of ['line1', 'city', 'state', 'zip', 'save']) expect(html).toContain(`id="${id}"`);
  });
  it('saves the address and emails a confirmation containing Site and the new address', async () => {
    const state = createState();
    const sent: { subject: string; text: string }[] = [];
    const app = createApp({ state, mailer: async (subject, text) => void sent.push({ subject, text }) });
    const res = await app.request('/gym/profile', { method: 'POST', body: form(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(res.status).toBeLessThan(400);
    expect(state.get('ironworks.mock')).toEqual(fixtures.newAddress);
    expect(sent[0].subject).toBe('IronWorks Gym: address updated');
    expect(sent[0].text).toContain('Site: ironworks.mock');
    expect(sent[0].text).toContain('Address on file: 42 Oak St, Portland, OR 97205');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/mocks/src/sites/gym.test.ts`
Expected: FAIL, route 404 or missing `createApp` export.

- [ ] **Step 3: Implement**

`apps/mocks/src/sites/gym.ts`:
```ts
import { Hono } from 'hono';
import { addressToString, type Address } from '@pa/shared';
import { page, addressFields, loginForm } from '../layout';
import type { MockState } from '../state';

const DOMAIN = 'ironworks.mock';
export type Mailer = (subject: string, text: string) => Promise<void>;

export function gymSite(state: MockState, mailer: Mailer) {
  const app = new Hono();
  app.get('/login', (c) => c.html(page('IronWorks Gym', loginForm('/gym/login'))));
  app.post('/login', (c) => c.redirect('/gym/profile'));
  app.get('/profile', (c) =>
    c.html(page('IronWorks Gym: profile', `<form method="post" action="/gym/profile">${addressFields(state.get(DOMAIN))}<button id="save">Save</button></form>`)),
  );
  app.post('/profile', async (c) => {
    const body = (await c.req.parseBody()) as Record<string, string>;
    const a: Address = { line1: body.line1, city: body.city, state: body.state, zip: body.zip };
    state.set(DOMAIN, a);
    void mailer('IronWorks Gym: address updated', `Your address was updated.\nSite: ${DOMAIN}\nAddress on file: ${addressToString(a)}`);
    return c.html(page('IronWorks Gym', '<p id="saved">Saved. A confirmation email is on its way.</p>'));
  });
  return app;
}
```
In `server.ts`: `export function createApp({ state, mailer })` builds the root `Hono`, `app.route('/gym', gymSite(state, mailer))`, and the `/__reset` and `/__state` endpoints.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/mocks`
Expected: all mock tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mocks
git commit -m "M: IronWorks gym mock site"
```

---

### Task M3: PixelVault (two-step, emailed code) ★

**Files:**
- Create: `apps/mocks/src/sites/pixelvault.ts`; modify `server.ts` to mount at `/pixelvault`
- Test: `apps/mocks/src/sites/pixelvault.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { createApp } from '../server';
import { createState } from '../state';

const post = (app: ReturnType<typeof createApp>, path: string, data: Record<string, string>) =>
  app.request(path, { method: 'POST', body: new URLSearchParams(data).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });

describe('pixelvault', () => {
  it('emails a 6-digit code on step 1 and only commits after the right code', async () => {
    const state = createState();
    const sent: { subject: string; text: string }[] = [];
    const app = createApp({ state, mailer: async (subject, text) => void sent.push({ subject, text }) });

    await post(app, '/pixelvault/address', { ...fixtures.newAddress });
    expect(state.get('pixelvault.mock')).toEqual(fixtures.oldAddress);
    const codeMail = sent.find((m) => /verification code/i.test(m.subject))!;
    const code = /Your code is (\d{6})/.exec(codeMail.text)![1];

    await post(app, '/pixelvault/verify', { code: '000000' });
    expect(state.get('pixelvault.mock')).toEqual(fixtures.oldAddress);

    await post(app, '/pixelvault/verify', { code });
    expect(state.get('pixelvault.mock')).toEqual(fixtures.newAddress);
    expect(sent.at(-1)!.subject).toBe('PixelVault: address updated');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/mocks/src/sites/pixelvault.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implement**

Follow `gym.ts`. Keep `pending: { address, code } | null` in the site closure. `POST /address` stores `pending` with a random 6-digit code, emails subject `PixelVault verification code` and body `Your code is ${code}\nSite: pixelvault.mock`, and redirects to `/pixelvault/verify`. `GET /address` renders `addressFields` with submit `#next`. `GET /verify` renders `<input id="code">` and button `#confirm`. `POST /verify` commits only if `code` matches, then mails `PixelVault: address updated` with the `Site:` and `Address on file:` lines. Wrong code renders `<p id="error">Wrong code</p>`. Reset `pending` when `/__reset` runs (export a `reset()` from the factory and call it from `createApp`'s reset).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/mocks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mocks
git commit -m "M: PixelVault two-step code flow"
```

---

### Task M4: ThreadHub (delayed confirmation) ★

**Files:**
- Create: `apps/mocks/src/sites/threadhub.ts`; mount at `/threadhub`
- Test: `apps/mocks/src/sites/threadhub.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { createApp } from '../server';
import { createState } from '../state';

describe('threadhub', () => {
  it('saves immediately but emails only after the configured delay', async () => {
    const state = createState();
    const sent: string[] = [];
    const app = createApp({ state, mailer: async (s) => void sent.push(s), threadhubDelayMs: 50 });
    await app.request('/threadhub/settings', { method: 'POST', body: new URLSearchParams({ ...fixtures.newAddress }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(state.get('threadhub.mock')).toEqual(fixtures.newAddress);
    expect(sent).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 120));
    expect(sent).toEqual(['ThreadHub: address updated']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/mocks/src/sites/threadhub.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Copy `gym.ts`, change the base path, page title, domain, subject to `ThreadHub: address updated`, route to `/settings`, and wrap the mailer call in `setTimeout(..., delayMs)`. `createApp` accepts `threadhubDelayMs` (default `loadEnv().THREADHUB_DELAY_MS`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/mocks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mocks
git commit -m "M: ThreadHub delayed confirmation"
```

---

### Task M5: StreamBox (card on file) and M6: Harbor Bank (no form) ★

**Files:**
- Create: `apps/mocks/src/sites/streambox.ts`, `apps/mocks/src/sites/harborbank.ts`; mount both
- Test: `apps/mocks/src/sites/streambox.test.ts`, `apps/mocks/src/sites/harborbank.test.ts`

- [ ] **Step 1: Write the failing tests**

`streambox.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createApp } from '../server';
import { createState } from '../state';

describe('streambox', () => {
  it('shows the card on file and the address form', async () => {
    const app = createApp({ state: createState(), mailer: async () => {} });
    const html = await (await app.request('/streambox/billing')).text();
    expect(html).toContain('Card on file •••• 4242');
    expect(html).toContain('id="save"');
  });
});
```
`harborbank.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createApp } from '../server';
import { createState } from '../state';

describe('harborbank', () => {
  it('has no address form and tells the user to call, visit or message', async () => {
    const app = createApp({ state: createState(), mailer: async () => {} });
    const html = await (await app.request('/harborbank')).text();
    expect(html).not.toContain('id="line1"');
    expect(html).toMatch(/call, visit, or send a secure message/i);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run apps/mocks/src/sites/streambox.test.ts apps/mocks/src/sites/harborbank.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Implement**

StreamBox: copy `gym.ts`; the page is `/billing`, includes `<p>Card on file •••• 4242</p>`, and the confirmation subject is exactly `StreamBox: address updated` (the verifier depends on the `address updated` phrase). Harbor Bank: `GET /harborbank` renders a paragraph `Address changes: call, visit, or send a secure message with proof of address.` and a secure-message form (`<textarea id="message">`, button `#send`) that does nothing but show confirmation. No address inputs anywhere.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run apps/mocks`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mocks
git commit -m "M: StreamBox and Harbor Bank mock sites"
```

---

### Task M7: Seed script ★

**Files:**
- Create: `scripts/seed.ts`, `scripts/seed-messages.ts`
- Test: `scripts/seed-messages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildSeedMessages } from './seed-messages';

describe('buildSeedMessages', () => {
  it('has a welcome email per mock site in the discovery format', () => {
    const msgs = buildSeedMessages();
    const welcomes = msgs.filter((m) => m.subject.startsWith('Welcome to'));
    expect(welcomes).toHaveLength(5);
    for (const m of welcomes) {
      expect(m.text).toMatch(/^Site: \S+\.mock$/m);
      expect(m.text).toContain('Address on file: 12 Pine St, Springfield, IL 62701');
    }
  });
  it('includes a lease-ending notice for the proactive trigger', () => {
    expect(buildSeedMessages().some((m) => /lease/i.test(m.subject))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/seed-messages.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`scripts/seed-messages.ts` exports `buildSeedMessages(): { subject: string; text: string }[]` producing the five welcome emails (names: IronWorks Gym / `ironworks.mock`, PixelVault / `pixelvault.mock`, ThreadHub / `threadhub.mock`, StreamBox / `streambox.mock`, Harbor Bank / `harborbank.mock`) in the exact format from section 2, plus: `{ subject: 'Your lease ends Dec 1', text: 'Notice: your lease at 12 Pine St ends 2026-12-01. Please confirm your move-out date.' }`. `scripts/seed.ts` calls `POST ${MOCKS_BASE_URL}/__reset`, then `deliverEmail` for each seed message with a 300 ms gap (so the Orbit fills one node at a time on stage).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run scripts/seed-messages.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts
git commit -m "M: seed script and seed messages"
```

---

# LANE G: Agent logic (pure functions, driven by fixtures)

### Task G1: Discovery parser ★

**Files:**
- Create: `packages/agent/src/discovery.ts`
- Test: `packages/agent/src/discovery.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { discoverAccount } from './discovery';

describe('discoverAccount', () => {
  it('parses a welcome email', async () => {
    const acc = await discoverAccount(fixtures.inbox[0]);
    expect(acc).toMatchObject({ domain: 'ironworks.mock', name: 'IronWorks Gym', addressOnFile: fixtures.oldAddress });
  });
  it('ignores emails with no account signal', async () => {
    const acc = await discoverAccount({ ...fixtures.inbox[0], subject: 'Lunch?', text: 'Want to grab lunch?' });
    expect(acc).toBeNull();
  });
  it('falls back to the sender domain when there is no Site line', async () => {
    const acc = await discoverAccount({ ...fixtures.inbox[0], from: 'no-reply@pixelvault.mock', subject: 'Welcome to PixelVault', text: 'Hi\nAddress on file: 12 Pine St, Springfield, IL 62701' });
    expect(acc?.domain).toBe('pixelvault.mock');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/discovery.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { Address, InboxMessage } from '@pa/shared';

export type Discovered = { name: string; domain: string; addressOnFile: Address | null };

const ADDRESS = /Address on file:\s*(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5})/;

export async function discoverAccount(msg: InboxMessage): Promise<Discovered | null> {
  const welcome = /^Welcome to (.+)$/i.exec(msg.subject);
  const site = /^Site:\s*(\S+)$/m.exec(msg.text)?.[1];
  const fromDomain = /@([\w.-]+)$/.exec(msg.from)?.[1];
  const domain = site ?? (welcome ? fromDomain : undefined);
  if (!welcome || !domain) return null;
  const m = ADDRESS.exec(msg.text);
  const addressOnFile = m ? { line1: m[1], city: m[2], state: m[3], zip: m[4] } : null;
  return { name: welcome[1].trim(), domain, addressOnFile };
}
```
(An LLM fallback via `completeJson` for non-welcome emails is a stretch goal. Do not add it before the rest of the lane passes.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/discovery.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/discovery.ts packages/agent/src/discovery.test.ts
git commit -m "G: discovery parser for welcome emails"
```

---

### Task G2: Classifier ★

**Files:**
- Create: `packages/agent/src/classifier.ts`
- Test: `packages/agent/src/classifier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { classify } from './classifier';

describe('classify', () => {
  it.each([
    ['ironworks.mock', 'IronWorks Gym', { category: 'gym', tier: 'act', hasCardOnFile: false }],
    ['pixelvault.mock', 'PixelVault', { category: 'gaming', tier: 'act', hasCardOnFile: false }],
    ['threadhub.mock', 'ThreadHub', { category: 'forum', tier: 'act', hasCardOnFile: false }],
    ['streambox.mock', 'StreamBox', { category: 'subscription', tier: 'act', hasCardOnFile: true }],
    ['harborbank.mock', 'Harbor Bank', { category: 'bank', tier: 'assist', hasCardOnFile: false }],
  ])('%s', (domain, name, expected) => {
    expect(classify({ domain, name })).toMatchObject({ ...expected, isMock: true });
  });
  it('treats unknown real banks as assist', () => {
    expect(classify({ domain: 'chase.com', name: 'Chase Bank' })).toMatchObject({ category: 'bank', tier: 'assist', isMock: false });
  });
  it('defaults unknown sites to other / assist (never automate by accident)', () => {
    expect(classify({ domain: 'example.org', name: 'Example' })).toMatchObject({ category: 'other', tier: 'assist' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/classifier.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

A lookup table for the five mock domains (category, `tier`, `hasCardOnFile`), keyword matching on the name (`bank`, `credit union`, `irs`, `dmv`, `insurance` → category `bank` or `other`, tier `assist`), and a default of `{ category: 'other', tier: 'assist', hasCardOnFile: false }`. `isMock = domain.endsWith('.mock')`. Only the five known mock domains and a short allowlist of gym/game/forum keywords return `act`. **Default must be `assist`.**

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/classifier.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/classifier.ts packages/agent/src/classifier.test.ts
git commit -m "G: classifier with safe default"
```

---

### Task G3: Rules engine ★

**Files:**
- Create: `packages/agent/src/rules.ts`
- Test: `packages/agent/src/rules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures, type Rule } from '@pa/shared';
import { evaluateRules } from './rules';

const [gym, , , stream, bank] = fixtures.accounts;
const cardRule = fixtures.rules[0];

describe('evaluateRules', () => {
  it('asks for accounts with a card on file', () => {
    expect(evaluateRules(stream, [cardRule])).toMatchObject({ decision: 'ask', rule: cardRule });
  });
  it('returns none when no rule matches', () => {
    expect(evaluateRules(gym, [cardRule]).decision).toBe('none');
  });
  it('ask beats auto_approve', () => {
    const auto: Rule = { id: 'r2', text: 'auto subs', kind: 'learned', match: { category: 'subscription' }, action: 'auto_approve', active: true };
    expect(evaluateRules(stream, [auto, cardRule]).decision).toBe('ask');
  });
  it('never auto-approves assist accounts', () => {
    const auto: Rule = { id: 'r3', text: 'auto banks', kind: 'learned', match: { category: 'bank' }, action: 'auto_approve', active: true };
    expect(evaluateRules(bank, [auto]).decision).toBe('none');
  });
  it('ignores inactive rules', () => {
    expect(evaluateRules(stream, [{ ...cardRule, active: false }]).decision).toBe('none');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/rules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { Account, Rule } from '@pa/shared';

export type Decision = { decision: 'skip' | 'ask' | 'auto_approve' | 'none'; rule?: Rule };
const priority = { skip: 3, ask: 2, auto_approve: 1 } as const;

const matches = (r: Rule, a: Account) =>
  (r.match.category === undefined || r.match.category === a.category) &&
  (r.match.hasCardOnFile === undefined || r.match.hasCardOnFile === a.hasCardOnFile) &&
  (r.match.domain === undefined || r.match.domain === a.domain);

export function evaluateRules(account: Account, rules: Rule[]): Decision {
  const hits = rules.filter((r) => r.active && matches(r, account));
  const allowed = hits.filter((r) => r.action !== 'auto_approve' || (account.tier === 'act' && !account.hasCardOnFile));
  if (!allowed.length) return { decision: 'none' };
  const best = allowed.reduce((a, b) => (priority[b.action] > priority[a.action] ? b : a));
  return { decision: best.action, rule: best };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/rules.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/rules.ts packages/agent/src/rules.test.ts
git commit -m "G: rules engine with safety guards"
```

---

### Task G4: Planner ★

**Files:**
- Create: `packages/agent/src/planner.ts`
- Test: `packages/agent/src/planner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { plan } from './planner';

const event = { id: 'evt_1', type: 'address_change' as const, newAddress: fixtures.newAddress, effectiveDate: '2026-11-01', predicted: false, source: 'chat' };

describe('plan', () => {
  const { items, summary } = plan(event, fixtures.accounts, fixtures.rules);
  const byAccount = Object.fromEntries(items.map((i) => [i.accountId, i]));

  it('marks safe accounts awaiting approval', () => {
    expect(byAccount.acc_gym.status).toBe('awaiting_approval');
    expect(byAccount.acc_pixel.status).toBe('awaiting_approval');
  });
  it('blocks the card-on-file account by rule', () => {
    expect(byAccount.acc_stream).toMatchObject({ status: 'blocked_by_rule', ruleId: 'rule_card' });
  });
  it('sends assist accounts to the kit track', () => {
    expect(byAccount.acc_bank).toMatchObject({ tier: 'assist', status: 'pending' });
  });
  it('skips accounts already on the new address or with no address on file', () => {
    const accounts = [
      { ...fixtures.accounts[0], addressOnFile: fixtures.newAddress },
      { ...fixtures.accounts[1], addressOnFile: null },
    ];
    expect(plan(event, accounts, []).items).toHaveLength(0);
  });
  it('summarizes counts for the chat reply', () => {
    expect(summary).toContain('5');
    expect(summary).toMatch(/can do 3/);
    expect(summary).toMatch(/prep 2/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/planner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { addressEquals, type Account, type ChecklistItem, type LifeEvent, type Rule } from '@pa/shared';
import { evaluateRules } from './rules';

export function plan(event: LifeEvent, accounts: Account[], rules: Rule[]) {
  const now = new Date().toISOString();
  const items: ChecklistItem[] = [];
  for (const a of accounts) {
    if (!a.addressOnFile || addressEquals(a.addressOnFile, event.newAddress)) continue;
    const base = {
      id: `item_${event.id}_${a.id}`, eventId: event.id, accountId: a.id, tier: a.tier,
      before: a.addressOnFile, after: event.newAddress, ruleId: null as string | null, kit: null, updatedAt: now,
    };
    if (a.tier === 'assist') { items.push({ ...base, status: 'pending' }); continue; }
    const d = evaluateRules(a, rules);
    if (d.decision === 'skip') items.push({ ...base, status: 'skipped', ruleId: d.rule!.id });
    else if (d.decision === 'ask') items.push({ ...base, status: 'blocked_by_rule', ruleId: d.rule!.id });
    else items.push({ ...base, status: 'awaiting_approval', ruleId: d.rule?.id ?? null });
  }
  const doable = items.filter((i) => i.tier === 'act' && i.status === 'awaiting_approval').length;
  const prep = items.filter((i) => i.tier === 'assist' || i.status === 'blocked_by_rule').length;
  const summary = `${items.length} accounts need updating. I can do ${doable}, I'll prep ${prep}.`;
  return { items, summary };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/planner.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/planner.ts packages/agent/src/planner.test.ts
git commit -m "G: planner builds checklist and summary"
```

---

### Task G5: Command parser (free text to event) ★

**Files:**
- Create: `packages/agent/src/command.ts`
- Test: `packages/agent/src/command.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseCommand } from './command';

describe('parseCommand (fake LLM mode)', () => {
  it('extracts a US address and date with the rule-based fast path', async () => {
    const e = await parseCommand("I'm moving to 42 Oak St, Portland, OR 97205 on Nov 1", { mode: 'fake' });
    expect(e.newAddress).toEqual({ line1: '42 Oak St', city: 'Portland', state: 'OR', zip: '97205' });
    expect(e.effectiveDate).toMatch(/-11-01$/);
  });
  it('throws a clear error when no address is found in fake mode', async () => {
    await expect(parseCommand('hello there', { mode: 'fake' })).rejects.toThrow(/address/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/command.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Rule-based regex fast path first: `(\d+ [\w .]+?),\s*([\w .]+?),\s*([A-Z]{2})\s+(\d{5})` plus month-name date parse (assume current year, Nov 1 → `2026-11-01`). If the regex fails and `mode === 'real'`, call `completeJson` with a zod schema `{ newAddress: Address, effectiveDate: string }`. In fake mode, no regex match throws `Error('Could not find an address in that message')`. Return `{ newAddress, effectiveDate }`. The orchestrator builds the `LifeEvent` around it.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/command.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/command.ts packages/agent/src/command.test.ts
git commit -m "G: command parser with regex fast path"
```

---

### Task G6: Kit generator ★

**Files:**
- Create: `packages/agent/src/kit.ts`
- Test: `packages/agent/src/kit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { buildKit } from './kit';

describe('buildKit', () => {
  it('prefills the values and drafts an email naming the new address and date', async () => {
    const kit = await buildKit(fixtures.accounts[4], fixtures.newAddress, '2026-11-01', { mode: 'fake' });
    expect(kit.link).toContain('/harborbank');
    expect(kit.values).toEqual(expect.arrayContaining([{ label: 'New address', value: '42 Oak St, Portland, OR 97205' }]));
    expect(kit.draftEmail.body).toContain('42 Oak St, Portland, OR 97205');
    expect(kit.draftEmail.body).toContain('2026-11-01');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/kit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`buildKit(account, newAddress, effectiveDate, { mode })`. Link: `${MOCKS_BASE_URL}/harborbank` for mock banks, else `https://${account.domain}`. Values: new address, effective date, old address. Draft email: in fake mode a template (`Hello,\n\nI am moving to ${addr} effective ${date}. Please update my address on file.\n\nThanks,\nMaya`); in real mode call `completeJson` with schema `{ subject, body }` and a system prompt that asks for a short polite email in the user's tone. The email is **never sent**.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/kit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/kit.ts packages/agent/src/kit.test.ts
git commit -m "G: kit generator for assist accounts"
```

---

### Task G7: Forward-to-act and predicted events

**Files:**
- Create: `packages/agent/src/forward.ts`
- Test: `packages/agent/src/forward.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { detectNotice } from './forward';

describe('detectNotice', () => {
  it('turns a lease-ending notice into a predicted move event', () => {
    const n = detectNotice({ id: 'm', threadId: 't', from: 'x', subject: 'Your lease ends Dec 1', text: 'Notice: your lease at 12 Pine St ends 2026-12-01.', receivedAt: '2026-10-04T00:00:00Z' });
    expect(n).toMatchObject({ kind: 'lease_ending', date: '2026-12-01', daysUntil: 58 });
  });
  it('returns null for ordinary mail', () => {
    expect(detectNotice({ id: 'm', threadId: 't', from: 'x', subject: 'Hi', text: 'Hello', receivedAt: '2026-10-04T00:00:00Z' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/forward.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`detectNotice(msg, today = new Date(msg.receivedAt))`: match `/lease/i` in subject plus an ISO date in the body (`\d{4}-\d{2}-\d{2}`). Return `{ kind: 'lease_ending', date, daysUntil }` where `daysUntil` is whole days between `today` and the date. Return `null` otherwise. The UI uses it for the proactive banner "Your lease ends in 58 days. I've prepared a move checklist."

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/forward.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/forward.ts packages/agent/src/forward.test.ts
git commit -m "G: forward-to-act lease notice detection"
```

---

### Task G8: Verifier (confirmations and codes) ★

**Files:**
- Create: `packages/agent/src/verifier.ts`
- Test: `packages/agent/src/verifier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { matchConfirmation, extractCode } from './verifier';

const msg = (subject: string, text: string) => ({ id: 'm', threadId: 't', from: 'x', subject, text, receivedAt: '2026-10-04T00:00:00Z' });
const awaiting = fixtures.items.map((i) => ({ ...i, status: 'awaiting_confirmation' as const }));

describe('matchConfirmation', () => {
  it('matches a confirmation to the item by Site line and new address', () => {
    const m = msg('IronWorks Gym: address updated', 'Site: ironworks.mock\nAddress on file: 42 Oak St, Portland, OR 97205');
    expect(matchConfirmation(m, awaiting, fixtures.accounts)?.id).toBe('item_gym');
  });
  it('does not match when the address is still the old one', () => {
    const m = msg('IronWorks Gym: address updated', 'Site: ironworks.mock\nAddress on file: 12 Pine St, Springfield, IL 62701');
    expect(matchConfirmation(m, awaiting, fixtures.accounts)).toBeNull();
  });
  it('also matches items still marked running, because the email can beat the executor', () => {
    const m = msg('IronWorks Gym: address updated', 'Site: ironworks.mock\nAddress on file: 42 Oak St, Portland, OR 97205');
    const running = fixtures.items.map((i) => ({ ...i, status: 'running' as const }));
    expect(matchConfirmation(m, running, fixtures.accounts)?.id).toBe('item_gym');
  });
  it('ignores items that have not been submitted', () => {
    const m = msg('IronWorks Gym: address updated', 'Site: ironworks.mock\nAddress on file: 42 Oak St, Portland, OR 97205');
    expect(matchConfirmation(m, fixtures.items, fixtures.accounts)).toBeNull();
  });
});

describe('extractCode', () => {
  it('finds a 6-digit code in a verification email', () => {
    expect(extractCode(msg('PixelVault verification code', 'Your code is 123456\nSite: pixelvault.mock'), 'pixelvault.mock')).toBe('123456');
  });
  it('returns null for a different site', () => {
    expect(extractCode(msg('PixelVault verification code', 'Your code is 123456\nSite: pixelvault.mock'), 'threadhub.mock')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/verifier.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { addressToString, type Account, type ChecklistItem, type InboxMessage } from '@pa/shared';

const siteOf = (m: InboxMessage) => /^Site:\s*(\S+)$/m.exec(m.text)?.[1];

export function matchConfirmation(msg: InboxMessage, items: ChecklistItem[], accounts: Account[]): ChecklistItem | null {
  if (!/address updated/i.test(msg.subject)) return null;
  const site = siteOf(msg);
  const onFile = /^Address on file:\s*(.+)$/m.exec(msg.text)?.[1]?.trim();
  if (!site || !onFile) return null;
  return (
    items.find((i) => {
      const acc = accounts.find((a) => a.id === i.accountId);
      return (i.status === 'awaiting_confirmation' || i.status === 'running') && acc?.domain === site && addressToString(i.after) === onFile;
    }) ?? null
  );
}

export function extractCode(msg: InboxMessage, domain: string): string | null {
  if (siteOf(msg) !== domain || !/verification code/i.test(msg.subject)) return null;
  return /\b(\d{6})\b/.exec(msg.text)?.[1] ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/verifier.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/verifier.ts packages/agent/src/verifier.test.ts
git commit -m "G: verifier matches confirmations and extracts codes"
```

---

### Task G9: Playbooks and executor core with the gym playbook ★

**Files:**
- Create: `packages/agent/src/executor/playbooks.ts`, `packages/agent/src/executor/run.ts`
- Test: `packages/agent/src/executor/run.test.ts`

**Requires:** M1 and M2 merged, `npx playwright install chromium` done, mock server running (`npm run dev:mocks`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serve } from '@hono/node-server';
import { fixtures, type RunEvent } from '@pa/shared';
import { createApp } from '../../../../apps/mocks/src/server';
import { createState } from '../../../../apps/mocks/src/state';
import { runPlaybook } from './run';
import { playbooks } from './playbooks';

let server: ReturnType<typeof serve>;
const state = createState();
const sent: string[] = [];

beforeAll(() => {
  server = serve({ fetch: createApp({ state, mailer: async (s) => void sent.push(s) }).fetch, port: 4010 });
});
afterAll(() => server.close());

describe('runPlaybook (gym)', () => {
  it('logs in, fills, spotlights submit, submits, and emits steps', async () => {
    const events: RunEvent[] = [];
    await runPlaybook({
      playbook: playbooks['ironworks.mock'],
      itemId: 'item_gym',
      address: fixtures.newAddress,
      baseUrl: 'http://localhost:4010',
      emit: (e) => events.push(e),
      submitDelayMs: 50,
      shouldStop: () => false,
      readCode: async () => null,
    });
    expect(state.get('ironworks.mock')).toEqual(fixtures.newAddress);
    expect(events.some((e) => e.type === 'step')).toBe(true);
    expect(events.some((e) => e.type === 'spotlight_submit')).toBe(true);
    expect(events.some((e) => e.type === 'frame')).toBe(true);
    expect(sent).toContain('IronWorks Gym: address updated');
  });
  it('does not submit when stopped during the spotlight', async () => {
    state.reset();
    let stop = false;
    await runPlaybook({
      playbook: playbooks['ironworks.mock'], itemId: 'item_gym', address: fixtures.newAddress,
      baseUrl: 'http://localhost:4010',
      emit: (e) => { if (e.type === 'spotlight_submit') stop = true; },
      submitDelayMs: 50, shouldStop: () => stop, readCode: async () => null,
    });
    expect(state.get('ironworks.mock')).toEqual(fixtures.oldAddress);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/executor/run.test.ts`
Expected: FAIL, cannot find `./run`.

- [ ] **Step 3: Implement**

`playbooks.ts` defines the type and the gym entry from the selector table in section 2:
```ts
export type Playbook = {
  domain: string;
  name: string;
  login: { path: string; submit: string } | null;
  addressPath: string;
  submit: string;
  codeStep: { path: string; input: string; confirm: string } | null;
};

export const playbooks: Record<string, Playbook> = {
  'ironworks.mock': { domain: 'ironworks.mock', name: 'IronWorks Gym', login: { path: '/gym/login', submit: '#login' }, addressPath: '/gym/profile', submit: '#save', codeStep: null },
};
```
`run.ts` signature: `runPlaybook({ playbook, itemId, address, baseUrl, emit, submitDelayMs, shouldStop, readCode })`. Launch headless Chromium with a 1280x720 viewport. For each step call `emit({type:'step', itemId, text})` and `emit({type:'frame', itemId, jpegBase64})` (page screenshot, `type:'jpeg', quality:60`). Sequence: log in if `login`, go to `addressPath`, fill `#line1 #city #state #zip` (clear first), emit a frame, `emit({type:'spotlight_submit', itemId, msUntilSubmit: submitDelayMs})`, wait `submitDelayMs`, return without clicking if `shouldStop()`, otherwise click `submit`. If `codeStep`, wait for `/verify`, call `readCode()` (poll up to 20 s), fill `input`, click `confirm`. Always close the browser in `finally`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/executor/run.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/executor
git commit -m "G: playwright executor core and gym playbook"
```

---

### Task G10: PixelVault playbook (reads the code from the inbox) ★

**Files:**
- Modify: `packages/agent/src/executor/playbooks.ts`
- Test: `packages/agent/src/executor/pixelvault.test.ts`

- [ ] **Step 1: Write the failing test**

Same server setup as G9 on port 4011, using the mock's mailer to capture the emailed code:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serve } from '@hono/node-server';
import { fixtures } from '@pa/shared';
import { createApp } from '../../../../apps/mocks/src/server';
import { createState } from '../../../../apps/mocks/src/state';
import { runPlaybook } from './run';
import { playbooks } from './playbooks';
import { extractCode } from '../verifier';

let server: ReturnType<typeof serve>;
const state = createState();
const inbox: { subject: string; text: string }[] = [];
beforeAll(() => { server = serve({ fetch: createApp({ state, mailer: async (subject, text) => void inbox.push({ subject, text }) }).fetch, port: 4011 }); });
afterAll(() => server.close());

describe('pixelvault playbook', () => {
  it('reads the verification code from the inbox and completes the change', async () => {
    await runPlaybook({
      playbook: playbooks['pixelvault.mock'], itemId: 'item_pixel', address: fixtures.newAddress,
      baseUrl: 'http://localhost:4011', emit: () => {}, submitDelayMs: 50, shouldStop: () => false,
      readCode: async () => {
        const m = inbox.find((x) => /verification code/i.test(x.subject));
        return m ? extractCode({ id: 'x', threadId: 'x', from: 'x', receivedAt: '', ...m }, 'pixelvault.mock') : null;
      },
    });
    expect(state.get('pixelvault.mock')).toEqual(fixtures.newAddress);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/executor/pixelvault.test.ts`
Expected: FAIL (no playbook for `pixelvault.mock`).

- [ ] **Step 3: Implement**

Add the entry:
```ts
'pixelvault.mock': { domain: 'pixelvault.mock', name: 'PixelVault', login: { path: '/pixelvault/login', submit: '#login' }, addressPath: '/pixelvault/address', submit: '#next', codeStep: { path: '/pixelvault/verify', input: '#code', confirm: '#confirm' } },
```
`run.ts` already supports `codeStep` from G9. Make `readCode` poll every 500 ms up to 20 s inside `run.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/executor/pixelvault.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/executor
git commit -m "G: PixelVault playbook with inbox code reading"
```

---

### Task G11: ThreadHub and StreamBox playbooks ★

**Files:**
- Modify: `packages/agent/src/executor/playbooks.ts`
- Test: `packages/agent/src/executor/playbooks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { playbooks } from './playbooks';

describe('playbook registry', () => {
  it('covers every automatable mock site and never the bank', () => {
    expect(Object.keys(playbooks).sort()).toEqual(['ironworks.mock', 'pixelvault.mock', 'streambox.mock', 'threadhub.mock']);
    expect(playbooks['harborbank.mock']).toBeUndefined();
  });
  it('points each at the selector contract', () => {
    expect(playbooks['threadhub.mock']).toMatchObject({ addressPath: '/threadhub/settings', submit: '#save' });
    expect(playbooks['streambox.mock']).toMatchObject({ addressPath: '/streambox/billing', submit: '#save' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/executor/playbooks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add entries (login paths `/threadhub/login` and `/streambox/login`, submit `#login`, `codeStep: null`):
```ts
'threadhub.mock': { domain: 'threadhub.mock', name: 'ThreadHub', login: { path: '/threadhub/login', submit: '#login' }, addressPath: '/threadhub/settings', submit: '#save', codeStep: null },
'streambox.mock': { domain: 'streambox.mock', name: 'StreamBox', login: { path: '/streambox/login', submit: '#login' }, addressPath: '/streambox/billing', submit: '#save', codeStep: null },
```
Do not add Harbor Bank. The absence of a playbook is what keeps it hands-off.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/executor/playbooks.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/executor
git commit -m "G: ThreadHub and StreamBox playbooks"
```

---

### Task G12: Audit log entries, undo text, and Receipt data

**Files:**
- Create: `packages/agent/src/audit.ts`
- Test: `packages/agent/src/audit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { makeAuditEntry, buildReceipt } from './audit';

describe('audit', () => {
  it('writes undo steps for a submitted change', () => {
    const e = makeAuditEntry('submitted', fixtures.items[0], fixtures.accounts[0]);
    expect(e.undo).toContain('12 Pine St, Springfield, IL 62701');
    expect(e.detail).toContain('IronWorks Gym');
  });
  it('has no undo for a skipped item', () => {
    expect(makeAuditEntry('skipped', fixtures.items[0], fixtures.accounts[0]).undo).toBeNull();
  });
  it('builds a receipt of verified changes with counts', () => {
    const items = fixtures.items.map((i, n) => ({ ...i, status: n < 2 ? ('verified' as const) : i.status }));
    const r = buildReceipt(items, fixtures.accounts, []);
    expect(r.verified).toHaveLength(2);
    expect(r.total).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/audit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`makeAuditEntry(kind, item, account)` returns an `AuditEntry` (id `aud_${Date.now()}_${item.id}`, `ts` now, `detail` like `Submitted address change at ${account.name}`). For `submitted` and `verified`, `undo` is `Change your address at ${account.name} back to ${addressToString(item.before!)}`. Other kinds have `undo: null`. `buildReceipt(items, accounts, audit)` returns `{ verified: {item, account}[], kits: ..., total: items.length, generatedAt }`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/audit.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/audit.ts packages/agent/src/audit.test.ts
git commit -m "G: audit entries with undo, receipt builder"
```

---

### Task G13: Learned rules and playbook counter

**Files:**
- Create: `packages/agent/src/learning.ts`
- Test: `packages/agent/src/learning.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { suggestRule, countLearnedPlaybooks } from './learning';

const [gym, pixel, thread, stream] = fixtures.accounts;

describe('suggestRule', () => {
  it('suggests auto-approve for a category after 3 approvals and no rejections', () => {
    const history = [gym, gym, gym].map((a) => ({ account: a, decision: 'approved' as const }));
    expect(suggestRule(history, [])).toMatchObject({ match: { category: 'gym' }, action: 'auto_approve', kind: 'learned' });
  });
  it('needs three approvals', () => {
    expect(suggestRule([gym, gym].map((a) => ({ account: a, decision: 'approved' as const })), [])).toBeNull();
  });
  it('never suggests for card-on-file accounts', () => {
    expect(suggestRule([stream, stream, stream].map((a) => ({ account: a, decision: 'approved' as const })), [])).toBeNull();
  });
  it('does not suggest what already exists', () => {
    const existing = [{ id: 'r', text: '', kind: 'learned' as const, match: { category: 'gym' as const }, action: 'auto_approve' as const, active: true }];
    expect(suggestRule([gym, gym, gym].map((a) => ({ account: a, decision: 'approved' as const })), existing)).toBeNull();
  });
});

describe('countLearnedPlaybooks', () => {
  it('counts domains with at least one verified success', () => {
    expect(countLearnedPlaybooks({ 'ironworks.mock': 2, 'pixelvault.mock': 0, 'threadhub.mock': 1 })).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/agent/src/learning.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`suggestRule(history, existingRules)`: group by `account.category`; for the first category with `>= 3` approvals, zero `rejected`, an `act` tier, no card on file, and no existing rule with the same category and action, return a `Rule` with `id: rule_learned_${category}`, `text: 'Auto-approve ${category} accounts'`, `kind: 'learned'`, `match: { category }`, `action: 'auto_approve'`, `active: true`. Otherwise `null`. `countLearnedPlaybooks(successCounts)` returns the number of entries with count `> 0`. The orchestrator **only asks the user** and creates the rule after the user accepts.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/agent/src/learning.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/learning.ts packages/agent/src/learning.test.ts
git commit -m "G: learned rule suggestions and playbook counter"
```

---

# LANE O: Orchestrator, repository, API (mostly Wave 2; O1 can start in Wave 1)

### Task O1: Repository layer ★

**Files:**
- Create: `apps/web/src/server/repo.ts`
- Test: `apps/web/src/server/repo.test.ts` (skipped without `DATABASE_URL`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { fixtures } from '@pa/shared';
import { migrate } from '../../../../packages/shared/src/db/migrate';
import { createRepo } from './repo';

describe.skipIf(!process.env.DATABASE_URL)('repo', () => {
  const user = `test-${Date.now()}`;
  beforeAll(async () => { await migrate(); });

  it('upserts accounts and reads them back', async () => {
    const repo = createRepo(user);
    await repo.upsertAccount(fixtures.accounts[0]);
    await repo.upsertAccount({ ...fixtures.accounts[0], name: 'Renamed Gym' });
    const list = await repo.listAccounts();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Renamed Gym');
  });
  it('saves items and updates their status', async () => {
    const repo = createRepo(user);
    await repo.upsertAccount(fixtures.accounts[0]);
    await repo.saveEvent({ id: 'evt_1', type: 'address_change', newAddress: fixtures.newAddress, effectiveDate: '2026-11-01', predicted: false, source: 'chat' });
    await repo.saveItems([fixtures.items[0]]);
    await repo.setItemStatus('item_gym', 'verified');
    expect((await repo.listItems()).find((i) => i.id === 'item_gym')?.status).toBe('verified');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/server/repo.test.ts`
Expected: FAIL (module missing), or skipped without a database.

- [ ] **Step 3: Implement**

`createRepo(userId)` returns: `upsertAccount`, `listAccounts`, `saveEvent`, `listEvents`, `saveItems`, `listItems`, `getItem`, `setItemStatus`, `setItemKit`, `listRules`, `saveRule`, `addAudit`, `listAudit`, `saveInboxMessage` (returns false if the id already exists, using `on conflict do nothing`), `listInbox`, `markProcessed`, `playbookSuccess(domain)` (increments), `playbookCounts()`. Use `query` from `@pa/shared` with parameterized SQL; map snake_case rows to the zod shapes and `parse` them before returning. Seed the default card rule (`fixtures.rules[0]`) the first time `listRules` finds none.

- [ ] **Step 4: Run to verify it passes**

Run: `DATABASE_URL=… npx vitest run apps/web/src/server/repo.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server
git commit -m "O: repository layer on neon"
```

---

### Task O2: Orchestrator state machine ★

**Files:**
- Create: `apps/web/src/server/orchestrator.ts`, `apps/web/src/server/bus.ts`
- Test: `apps/web/src/server/orchestrator.test.ts`

**Depends on:** G1 to G6, G8, G9, O1 (but tested with fakes, so it can start in Wave 1).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures, type ChecklistItem, type Rule, type Account, type RunEvent } from '@pa/shared';
import { createOrchestrator, type Deps } from './orchestrator';

function fakeDeps() {
  let items: ChecklistItem[] = [];
  const events: RunEvent[] = [];
  const rules: Rule[] = [...fixtures.rules];
  const deps: Deps = {
    repo: {
      listAccounts: async () => fixtures.accounts as Account[],
      listRules: async () => rules,
      saveEvent: async () => {},
      saveItems: async (i) => { items = i; },
      listItems: async () => items,
      getItem: async (id) => items.find((i) => i.id === id)!,
      setItemStatus: async (id, s) => { items = items.map((i) => (i.id === id ? { ...i, status: s } : i)); },
      setItemKit: async (id, kit) => { items = items.map((i) => (i.id === id ? { ...i, kit, status: 'kit_ready' } : i)); },
      addAudit: async () => {},
      playbookSuccess: async () => {},
      saveRule: async (r) => { rules.push({ ...r, id: 'rule_new' }); return { ...r, id: 'rule_new' }; },
    },
    runPlaybook: async ({ emit, itemId }) => { emit({ type: 'step', itemId, text: 'filling' }); },
    emit: (e) => events.push(e),
    llmMode: 'fake',
    parse: async () => ({ newAddress: fixtures.newAddress, effectiveDate: '2026-11-01' }),
  };
  return { deps, events, getItems: () => items };
}

describe('orchestrator', () => {
  it('plans from a command and attaches a kit to assist items', async () => {
    const { deps, getItems } = fakeDeps();
    const o = createOrchestrator(deps);
    const out = await o.handleCommand('moving to 42 Oak St, Portland, OR 97205 on Nov 1');
    expect(out.items).toHaveLength(5);
    expect(getItems().find((i) => i.accountId === 'acc_bank')?.status).toBe('kit_ready');
  });
  it('approve runs the playbook and moves to awaiting_confirmation', async () => {
    const { deps, getItems } = fakeDeps();
    const o = createOrchestrator(deps);
    await o.handleCommand('x');
    const gym = getItems().find((i) => i.accountId === 'acc_gym')!;
    await o.approve(gym.id, {});
    expect(getItems().find((i) => i.id === gym.id)?.status).toBe('awaiting_confirmation');
  });
  it('refuses to approve assist items', async () => {
    const { deps, getItems } = fakeDeps();
    const o = createOrchestrator(deps);
    await o.handleCommand('x');
    const bank = getItems().find((i) => i.accountId === 'acc_bank')!;
    await expect(o.approve(bank.id, {})).rejects.toThrow(/assist/i);
  });
  it('an inbox confirmation marks the item verified', async () => {
    const { deps, getItems } = fakeDeps();
    const o = createOrchestrator(deps);
    await o.handleCommand('x');
    const gym = getItems().find((i) => i.accountId === 'acc_gym')!;
    await o.approve(gym.id, {});
    await o.handleInbox({ id: 'm9', threadId: 't', from: 'x', subject: 'IronWorks Gym: address updated', text: 'Site: ironworks.mock\nAddress on file: 42 Oak St, Portland, OR 97205', receivedAt: '2026-10-04T00:00:00Z' });
    expect(getItems().find((i) => i.id === gym.id)?.status).toBe('verified');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/server/orchestrator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`createOrchestrator(deps)` returns `{ handleCommand, approve, skip, stop, handleInbox }`. Define `Deps` as the interface the test builds (repo subset, `runPlaybook`, `emit`, `llmMode`, `parse`). Behavior:
- `handleCommand(text)`: `parse` → build `LifeEvent` (id `evt_${Date.now()}`), `plan(...)`, `saveEvent`, `saveItems`, `buildKit` for each assist item then `setItemKit`, audit `planned`, return `{ event, items, summary }`.
- `approve(itemId, { alwaysForCategory })`: load the item, throw if `tier === 'assist'` (`Assist items are never automated`) or status not in `awaiting_approval` / `blocked_by_rule`. Set `running`, emit `status`, audit `approved`. Look up the account's playbook by `domain` in `playbooks` (no playbook means fail the item with `No playbook`, which is how Harbor Bank stays hands-off). Call `deps.runPlaybook({ playbook, itemId, address: item.after, emit, shouldStop: () => stopped.has(itemId), readCode })` where `readCode` polls the latest inbox messages via `extractCode`. The caller (`wire.ts` or the e2e test) adds `baseUrl` and `submitDelayMs`. After it returns without a stop, set `awaiting_confirmation` **only if the item is still `running`** (the confirmation email can arrive first and already mark it `verified`), then audit `submitted`. On exception set `failed`, audit `failed`. If `alwaysForCategory`, call `suggestRule`-style rule creation through `saveRule` (only when G3's guards allow) and audit `rule_created`.
- `stop(itemId)` adds to the `stopped` set, audits `stopped`.
- `handleInbox(msg)`: emit `inbox`, `matchConfirmation` against items awaiting confirmation, set `verified`, `playbookSuccess(domain)`, audit `verified`, emit `status`.
- `bus.ts`: tiny in-memory pub/sub (`subscribe(fn) → unsubscribe`, `publish(event)`) used by the SSE route and as `deps.emit`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/server/orchestrator.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server
git commit -m "O: orchestrator state machine and event bus"
```

---

### Task O3: REST routes ★

**Files:**
- Create: `apps/web/src/app/api/state/route.ts`, `events/route.ts`, `items/[id]/approve/route.ts`, `items/[id]/skip/route.ts`, `items/[id]/stop/route.ts`, `rules/route.ts`, `audit/route.ts`, `inbox/route.ts`, `inbox/simulated/route.ts`
- Create: `apps/web/src/server/wire.ts` (builds the real orchestrator from the repo, playbooks, bus and gateway)
- Test: `apps/web/src/app/api/state/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/server/wire', () => ({
  getContext: async () => ({
    user: { id: 'maya-demo' },
    repo: { listAccounts: async () => [], listItems: async () => [], listRules: async () => [], listEvents: async () => [] },
  }),
}));

import { GET } from './route';

describe('GET /api/state', () => {
  it('returns the four collections', async () => {
    const res = await GET(new Request('http://x/api/state'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accounts: [], items: [], rules: [], events: [] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/app/api/state/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Each route calls `getContext(req)` from `server/wire.ts`, which runs `requireUser` and returns `{ user, repo: createRepo(user.id), orchestrator }`, maps `HttpError` to its status, and uses the response shapes in section 2. `wire.ts` builds the orchestrator once per process (module-level singleton) with the real `runPlaybook`, `bus.publish` as `emit`, and the AgentMail-backed `readCode`. `/api/inbox/simulated` inserts the message into the repo and calls `orchestrator.handleInbox`. Mark route files with `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/app/api/state/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "O: REST routes and wiring"
```

---

### Task O4: SSE stream ★

**Files:**
- Create: `apps/web/src/app/api/stream/route.ts`, `apps/web/src/server/sse.ts`
- Test: `apps/web/src/server/sse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { formatSse } from './sse';
import { createBus } from './bus';

describe('formatSse', () => {
  it('formats an event as a data line terminated by a blank line', () => {
    expect(formatSse({ type: 'step', itemId: 'i', text: 'hi' })).toBe('data: {"type":"step","itemId":"i","text":"hi"}\n\n');
  });
});

describe('bus', () => {
  it('delivers to subscribers and stops after unsubscribe', () => {
    const bus = createBus();
    const got: string[] = [];
    const off = bus.subscribe((e) => got.push(e.type));
    bus.publish({ type: 'step', itemId: 'i', text: 't' });
    off();
    bus.publish({ type: 'step', itemId: 'i', text: 't' });
    expect(got).toEqual(['step']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/server/sse.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`sse.ts`: `formatSse(e: RunEvent) => \`data: ${JSON.stringify(e)}\n\n\``. `bus.ts` exports `createBus()` and a default singleton. The route returns a `ReadableStream` with headers `content-type: text/event-stream`, `cache-control: no-cache`, subscribes to the bus, writes a `: ping` comment every 15 s, and unsubscribes on `req.signal` abort. Requires a session.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/server/sse.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "O: SSE stream and event bus"
```

---

### Task O5: Inbox ingestion (webhook and polling) ★

**Files:**
- Create: `apps/web/src/server/ingest.ts`, `apps/web/src/app/api/webhooks/agentmail/route.ts`, `apps/web/src/instrumentation.ts`
- Test: `apps/web/src/server/ingest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { ingestMessage } from './ingest';

describe('ingestMessage', () => {
  it('discovers an account from a welcome email and classifies it', async () => {
    const accounts: any[] = [];
    const processed: string[] = [];
    await ingestMessage(fixtures.inbox[0], {
      saveInboxMessage: async () => true,
      upsertAccount: async (a) => void accounts.push(a),
      markProcessed: async (id) => void processed.push(id),
      handleInbox: async () => {},
      notice: () => {},
    });
    expect(accounts[0]).toMatchObject({ domain: 'ironworks.mock', category: 'gym', tier: 'act' });
    expect(processed).toEqual([fixtures.inbox[0].id]);
  });
  it('skips messages it has already seen', async () => {
    const accounts: any[] = [];
    await ingestMessage(fixtures.inbox[0], {
      saveInboxMessage: async () => false,
      upsertAccount: async (a) => void accounts.push(a),
      markProcessed: async () => {},
      handleInbox: async () => {},
      notice: () => {},
    });
    expect(accounts).toHaveLength(0);
  });
  it('always forwards the message to the verifier path', async () => {
    let handled = 0;
    await ingestMessage(fixtures.inbox[0], {
      saveInboxMessage: async () => true, upsertAccount: async () => {}, markProcessed: async () => {},
      handleInbox: async () => { handled++; }, notice: () => {},
    });
    expect(handled).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/server/ingest.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`ingestMessage(msg, deps)`: `saveInboxMessage` returns false for duplicates, in which case return. Then `handleInbox` (verifier path and the inbox event), `discoverAccount` → `classify` → `upsertAccount` (id `acc_${domain}`, `lastSeen` now), `detectNotice` → `deps.notice` (publishes a proactive banner event), then `markProcessed`. The webhook route verifies the AgentMail signature per their docs (reject with 401 if invalid), normalizes the body with `normalizeMessage`, and calls `ingestMessage`. `instrumentation.ts` starts a 5 s poll loop (`mail.listMessages()` → `ingestMessage`) as the fallback that works even when the webhook is not registered. Dedup makes the two paths safe together.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/server/ingest.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "O: inbox ingestion via webhook and polling"
```

---

# LANE U: UI (builds against `fixtures` first, switches to live data in Wave 2)

**UI rule for every U task:** build the component to take props typed from `@pa/shared`, render it on a dev route `/dev/<name>` fed by `fixtures`, and unit-test only the pure logic. Visual acceptance is a checklist the author verifies in the browser (`npm run dev:web`) before committing.

### Task U1: Design system, shell, data hook, fixtures mode ★

**Files:**
- Create: `apps/web/src/lib/theme.css`, `apps/web/src/lib/fixtures-mode.ts`, `apps/web/src/lib/useAppState.ts`, `apps/web/src/lib/reduce.ts`, `apps/web/src/components/ui.tsx`, `apps/web/src/app/layout.tsx`
- Test: `apps/web/src/lib/reduce.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { initialState, reduce } from './reduce';

const base = { ...initialState, items: fixtures.items, accounts: fixtures.accounts };

describe('reduce', () => {
  it('applies status events to the matching item', () => {
    const s = reduce(base, { type: 'status', itemId: 'item_gym', status: 'verified' });
    expect(s.items.find((i) => i.id === 'item_gym')?.status).toBe('verified');
  });
  it('appends inbox messages newest first and de-duplicates by id', () => {
    const msg = fixtures.inbox[0];
    const s = reduce(reduce(base, { type: 'inbox', message: msg }), { type: 'inbox', message: msg });
    expect(s.inbox).toHaveLength(1);
  });
  it('stores the latest frame and step per item', () => {
    let s = reduce(base, { type: 'step', itemId: 'item_gym', text: 'Filling...' });
    s = reduce(s, { type: 'frame', itemId: 'item_gym', jpegBase64: 'abc' });
    expect(s.live['item_gym']).toMatchObject({ step: 'Filling...', frame: 'abc' });
  });
  it('tracks the submit spotlight', () => {
    const s = reduce(base, { type: 'spotlight_submit', itemId: 'item_gym', msUntilSubmit: 1500 });
    expect(s.live['item_gym'].spotlightMs).toBe(1500);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/lib/reduce.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`reduce.ts`: state shape `{ accounts, items, rules, inbox, live: Record<itemId, { step?, frame?, spotlightMs? }> }` and a pure `reduce(state, RunEvent)`. `useAppState()` returns `{ state, approve, skip, stop, sendCommand }`. In `NEXT_PUBLIC_USE_FIXTURES=1` it loads `fixtures` and simulates events locally with timers (so the UI lane never waits). Otherwise it fetches `/api/state`, opens `EventSource('/api/stream')` and pipes events through `reduce`. `theme.css` defines the tokens: one accent color (`--agent`) meaning "the agent acted", tier colors with icons, spacing, radii, `--ease`, motion durations (`--fast: 160ms`, `--base: 260ms`), light and dark variants, large base type (18px). `ui.tsx` exports `Button`, `Badge` (with icon per status so color is never the only signal), `Card`.

**Acceptance:** `/dev/ui` shows every `ItemStatus` as a `Badge` with an icon, in light and dark.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/lib/reduce.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "U: design tokens, shell, state reducer, fixtures mode"
```

---

### Task U2: The Orbit (map) ★

**Files:**
- Create: `apps/web/src/components/Orbit/Orbit.tsx`, `apps/web/src/components/Orbit/layout.ts`
- Test: `apps/web/src/components/Orbit/layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { layoutNodes, nodeState } from './layout';

describe('layoutNodes', () => {
  it('places every account on a ring at an even angle with no overlap', () => {
    const nodes = layoutNodes(fixtures.accounts, 400);
    expect(nodes).toHaveLength(5);
    const pts = new Set(nodes.map((n) => `${Math.round(n.x)},${Math.round(n.y)}`));
    expect(pts.size).toBe(5);
  });
  it('puts assist accounts on the outer ring', () => {
    const nodes = layoutNodes(fixtures.accounts, 400);
    const bank = nodes.find((n) => n.id === 'acc_bank')!;
    const gym = nodes.find((n) => n.id === 'acc_gym')!;
    const dist = (n: { x: number; y: number }) => Math.hypot(n.x - 200, n.y - 200);
    expect(dist(bank)).toBeGreaterThan(dist(gym));
  });
});

describe('nodeState', () => {
  it('is stale when the account has an old address and no verified item', () => {
    expect(nodeState(fixtures.accounts[0], [])).toBe('stale');
  });
  it('is done when its item is verified', () => {
    expect(nodeState(fixtures.accounts[0], [{ ...fixtures.items[0], status: 'verified' }])).toBe('done');
  });
  it('is working while running or awaiting confirmation', () => {
    expect(nodeState(fixtures.accounts[0], [{ ...fixtures.items[0], status: 'running' }])).toBe('working');
  });
  it('is hands_off for assist accounts', () => {
    expect(nodeState(fixtures.accounts[4], fixtures.items)).toBe('hands_off');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/components/Orbit/layout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`layout.ts`: `layoutNodes(accounts, size)` places `act` accounts on an inner ring (radius 0.28 × size) and `assist` on the outer ring (0.42 × size), angles evenly spaced with a start offset so nodes never overlap; `nodeState(account, items)` returns `'stale' | 'working' | 'done' | 'hands_off' | 'fresh'` (assist wins first, then verified → done, running/awaiting_confirmation → working, `addressOnFile` present → stale). `Orbit.tsx` renders an SVG: "Maya" in the center, nodes as circles with an icon and label, `stale` pulsing amber (CSS keyframes, 1.6 s), `working` showing a spinning arc, `done` turning green with a one-time ripple, a progress arc around the center (`verified / total`). Clicking a node calls `onSelect(accountId)`. Nodes animate in one by one as accounts arrive.

**Acceptance (check in the browser at `/dev/orbit`):** five nodes on two rings; stale ones pulse; changing an item's status in the dev controls turns the node green with a ripple; the progress arc advances; labels are readable at projector size; works at 360 px width.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/components/Orbit/layout.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Orbit apps/web/src/app/dev
git commit -m "U: Orbit map"
```

---

### Task U3: The Approval Deck ★

**Files:**
- Create: `apps/web/src/components/ApprovalDeck/ApprovalDeck.tsx`, `diff.ts`, `deck.ts`
- Test: `apps/web/src/components/ApprovalDeck/deck.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { diffAddress } from './diff';
import { deckQueue, keyAction } from './deck';

describe('diffAddress', () => {
  it('marks only the changed fields', () => {
    const d = diffAddress(fixtures.oldAddress, fixtures.newAddress);
    expect(d.filter((f) => f.changed).map((f) => f.field)).toEqual(['line1', 'city', 'state', 'zip']);
    expect(diffAddress(fixtures.oldAddress, { ...fixtures.oldAddress, zip: '99999' }).filter((f) => f.changed).map((f) => f.field)).toEqual(['zip']);
  });
});

describe('deckQueue', () => {
  it('lists awaiting_approval and blocked_by_rule items, safe ones first', () => {
    const q = deckQueue(fixtures.items);
    expect(q.map((i) => i.id)).toEqual(['item_gym', 'item_pixel', 'item_thread', 'item_stream']);
  });
  it('excludes assist, running and verified items', () => {
    const items = fixtures.items.map((i) => (i.id === 'item_gym' ? { ...i, status: 'verified' as const } : i));
    expect(deckQueue(items).map((i) => i.id)).not.toContain('item_gym');
    expect(deckQueue(items).map((i) => i.id)).not.toContain('item_bank');
  });
});

describe('keyAction', () => {
  it('maps Enter to approve and Escape to skip', () => {
    expect(keyAction('Enter')).toBe('approve');
    expect(keyAction('Escape')).toBe('skip');
    expect(keyAction('a')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/components/ApprovalDeck/deck.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`diff.ts`: `diffAddress(before, after)` returns `{ field, before, after, changed }[]` for `line1, city, state, zip`. `deck.ts`: `deckQueue(items)` filters `awaiting_approval` and `blocked_by_rule` with `tier === 'act'`, ordered awaiting first then blocked; `keyAction(key)` maps `Enter` → `approve`, `Escape` → `skip`. `ApprovalDeck.tsx` shows one card at a time: account name and tier badge, the before/after diff with changed text highlighted, a rule banner on blocked cards ("Your rule: never auto-update anything with my card on file. Approve anyway?"), **Approve** and **Skip** buttons, a toggle "Always do this for gym accounts" (hidden for blocked and card-on-file cards), keyboard handling via `keyAction`, and a card exit animation (slide and fade, `--base`). When the queue is empty it shows "All caught up."

**Acceptance (at `/dev/deck`):** Enter approves, Esc skips, the next card slides in, blocked card shows the rule banner and no "always" toggle, buttons have visible focus rings, empty state renders.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/components/ApprovalDeck/deck.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ApprovalDeck apps/web/src/app/dev
git commit -m "U: Approval Deck"
```

---

### Task U4: Watch It Work ★

**Files:**
- Create: `apps/web/src/components/WatchItWork/WatchItWork.tsx`, `steps.ts`
- Test: `apps/web/src/components/WatchItWork/steps.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { liveView } from './steps';

describe('liveView', () => {
  it('shows an idle message when nothing is running', () => {
    expect(liveView({}, 'item_gym')).toMatchObject({ mode: 'idle' });
  });
  it('shows the latest step and frame while running', () => {
    expect(liveView({ item_gym: { step: 'Filling address', frame: 'abc' } }, 'item_gym')).toMatchObject({ mode: 'running', step: 'Filling address', frame: 'abc' });
  });
  it('switches to spotlight with a countdown when submit is imminent', () => {
    expect(liveView({ item_gym: { step: 'x', frame: 'abc', spotlightMs: 1500 } }, 'item_gym')).toMatchObject({ mode: 'spotlight', ms: 1500 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/components/WatchItWork/steps.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`steps.ts`: `liveView(live, itemId)` returns `{ mode: 'idle' }`, `{ mode: 'running', step, frame }` or `{ mode: 'spotlight', step, frame, ms }`. `WatchItWork.tsx` renders the latest `jpegBase64` frame in a browser-chrome frame, a first-person status line ("Opening IronWorks... filling address...") with a typing animation, and in `spotlight` mode a dimmed overlay with a spotlight ring, a countdown bar draining over `ms`, and a **Stop** button calling `onStop(itemId)`. In idle it shows "Nothing running. Approve a card to watch me work."

**Acceptance (at `/dev/watch`, driven by the fixtures simulator):** frames update smoothly, the spotlight ring and countdown bar appear, Stop is clickable and keyboard reachable, nothing is blank before the first frame.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/components/WatchItWork/steps.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/WatchItWork apps/web/src/app/dev
git commit -m "U: Watch It Work live panel"
```

---

### Task U5: Inbox Feed

**Files:**
- Create: `apps/web/src/components/InboxFeed/InboxFeed.tsx`, `classify.ts`
- Test: `apps/web/src/components/InboxFeed/classify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { classifyMessage } from './classify';

const m = (subject: string, text = '') => ({ id: 'x', threadId: 't', from: 'f', subject, text, receivedAt: '2026-10-04T00:00:00Z' });

describe('classifyMessage', () => {
  it('labels confirmations', () => expect(classifyMessage(m('IronWorks Gym: address updated')).kind).toBe('confirmation'));
  it('labels verification codes and extracts the code to highlight', () => {
    expect(classifyMessage(m('PixelVault verification code', 'Your code is 123456'))).toMatchObject({ kind: 'code', code: '123456' });
  });
  it('labels welcome emails as discovery', () => expect(classifyMessage(m('Welcome to ThreadHub')).kind).toBe('discovery'));
  it('labels lease notices as notice', () => expect(classifyMessage(m('Your lease ends Dec 1')).kind).toBe('notice'));
  it('falls back to other', () => expect(classifyMessage(m('Lunch?')).kind).toBe('other'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/components/InboxFeed/classify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`classifyMessage(msg)` returns `{ kind: 'confirmation' | 'code' | 'discovery' | 'notice' | 'other', code?: string }` from subject patterns. `InboxFeed.tsx` is a live timeline, newest first. New messages animate in; a `confirmation` shows a **Verified** stamp; a `code` highlights the digits and notes "Read by the agent"; a `discovery` shows "Found account"; a `notice` shows a proactive banner "Your lease ends in N days. I've prepared a move checklist" (N from `detectNotice`).

**Acceptance:** messages animate in, the code highlight and Verified stamp are visible, the empty state reads "Waiting for the first email".

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/components/InboxFeed/classify.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/InboxFeed
git commit -m "U: Inbox Feed"
```

---

### Task U6: The Kit view ★

**Files:**
- Create: `apps/web/src/components/Kit/Kit.tsx`, `kit.ts`
- Test: `apps/web/src/components/Kit/kit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { kitProgress, toggleDone } from './kit';

const kit = fixtures.items[4].kit!;

describe('kit progress', () => {
  it('counts the link, each value, and the email as checklist steps', () => {
    expect(kitProgress(kit, new Set()).total).toBe(1 + kit.values.length + 1);
  });
  it('tracks completed steps', () => {
    const done = toggleDone(new Set(), 'link');
    expect(kitProgress(kit, done)).toMatchObject({ done: 1 });
    expect(toggleDone(done, 'link').size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/components/Kit/kit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`kit.ts`: `kitProgress(kit, doneSet)` returns `{ done, total }`; `toggleDone(set, key)` returns a new `Set`. `Kit.tsx` shows "I won't touch this one" with the reason, an **Open page** button (the link), one row per value with a **Copy** button (shows "Copied" for 1.5 s), the draft email with a **Copy email** button and a note "Not sent. Review and send it yourself", and a checklist that ticks off as the user marks steps, with a small progress ring.

**Acceptance (at `/dev/kit`):** every Copy button writes to the clipboard, the progress ring updates, nothing in the Kit calls the API to send mail.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/components/Kit/kit.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Kit
git commit -m "U: Kit view for hands-off accounts"
```

---

### Task U7: Command bar and morning briefing

**Files:**
- Create: `apps/web/src/components/CommandBar/CommandBar.tsx`, `briefing.ts`
- Test: `apps/web/src/components/CommandBar/briefing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { briefing } from './briefing';

describe('briefing', () => {
  it('summarizes verified, waiting and needs-you counts', () => {
    const items = fixtures.items.map((i, n) => ({ ...i, status: n === 0 ? ('verified' as const) : n === 1 ? ('awaiting_confirmation' as const) : i.status }));
    const b = briefing(items);
    expect(b.verified).toBe(1);
    expect(b.waiting).toBe(1);
    expect(b.needsYou).toBe(3);
    expect(b.line).toContain('1 done');
  });
  it('says there is nothing to do when the list is empty', () => {
    expect(briefing([]).line).toMatch(/nothing/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/components/CommandBar/briefing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`briefing(items)` counts `verified`, `awaiting_confirmation` (waiting), and items needing the user (`awaiting_approval`, `blocked_by_rule`, `kit_ready`) and builds a line like `1 done, 1 waiting for confirmation, 3 need you.` `CommandBar.tsx` is one focused input (focus on `/`), placeholder "Tell me what changed, like: I'm moving to 42 Oak St, Portland, OR 97205 on Nov 1". Enter posts to `sendCommand`, shows the returned `summary` as the agent's reply with a typing effect, an inline error on failure ("I couldn't find an address in that"), and a disabled state while sending. The briefing line shows above it.

**Acceptance:** `/` focuses the input, Enter sends, error and loading states render.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/components/CommandBar/briefing.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CommandBar
git commit -m "U: command bar and briefing"
```

---

### Task U8: The Receipt (proof pack)

**Files:**
- Create: `apps/web/src/app/receipt/page.tsx`, `apps/web/src/components/Receipt/Receipt.tsx`, `rows.ts`
- Test: `apps/web/src/components/Receipt/rows.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { receiptRows } from './rows';

describe('receiptRows', () => {
  it('lists only verified items with name, before, after', () => {
    const items = fixtures.items.map((i) => (i.id === 'item_gym' ? { ...i, status: 'verified' as const } : i));
    const rows = receiptRows(items, fixtures.accounts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'IronWorks Gym', before: '12 Pine St, Springfield, IL 62701', after: '42 Oak St, Portland, OR 97205' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/components/Receipt/rows.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`receiptRows(items, accounts)` maps verified items to `{ name, before, after }` strings. `Receipt.tsx` is a paper-style page (serif heading, ruled rows, a verified stamp per row, total line "N of M changes verified", a section for hands-off accounts showing "Handled by you"), with a **Print / Save as PDF** button using `window.print()` and print CSS (`@media print` hides chrome, fits A4). `receipt/page.tsx` loads state through `useAppState` and renders `Receipt`.

**Acceptance (at `/receipt`):** prints cleanly to one page, no app chrome in the print preview.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/components/Receipt/rows.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "U: Receipt page"
```

---

### Task U9: Login page and app composition ★

**Files:**
- Create: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/page.tsx`
- Test: `apps/web/src/lib/layoutState.test.ts`, `apps/web/src/lib/layoutState.ts`

**Depends on:** P1 for the real login. Build the composition first against `AUTH_MODE=dev`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixtures } from '@pa/shared';
import { focusedItemId } from './layoutState';

describe('focusedItemId', () => {
  it('prefers a running item so Watch It Work follows the action', () => {
    const items = fixtures.items.map((i) => (i.id === 'item_pixel' ? { ...i, status: 'running' as const } : i));
    expect(focusedItemId(items, null)).toBe('item_pixel');
  });
  it('falls back to the selected account item', () => {
    expect(focusedItemId(fixtures.items, 'acc_thread')).toBe('item_thread');
  });
  it('falls back to the first deck item', () => {
    expect(focusedItemId(fixtures.items, null)).toBe('item_gym');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/lib/layoutState.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`layoutState.ts`: `focusedItemId(items, selectedAccountId)` returns the running item's id, else the item of the selected account, else the first `deckQueue` item. `page.tsx` composes the screen: command bar and briefing on top; the Orbit left; the Approval Deck right (or the Kit when a hands-off node is selected); Watch It Work below the deck; the Inbox Feed as a side drawer; a link to `/receipt`. `login/page.tsx` shows a centered sign-in using the Neon Auth component or the passcode form from P1's fallback.

**Acceptance:** the whole demo script from the design doc runs on this one screen using fixtures mode, with no layout shift when panels update.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/lib/layoutState.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "U: page composition and login"
```

---

### Task U10: Polish pass

**Files:**
- Modify: files under `apps/web/src/components`, `apps/web/src/lib/theme.css`

- [ ] **Step 1: Define the checklist as a test of the tokens**

`apps/web/src/lib/theme.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'theme.css'), 'utf8');

describe('theme', () => {
  it('defines the agent accent, motion tokens, and a dark variant', () => {
    expect(css).toContain('--agent');
    expect(css).toContain('--fast');
    expect(css).toContain('--base');
    expect(css).toContain('prefers-color-scheme: dark');
  });
  it('respects reduced motion', () => {
    expect(css).toContain('prefers-reduced-motion');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/lib/theme.test.ts`
Expected: FAIL on `prefers-reduced-motion` until it is added.

- [ ] **Step 3: Implement the polish**

Add a `@media (prefers-reduced-motion: reduce)` block that disables the pulse, ripple and slide animations. Then go through each acceptance list from U2 to U8 and fix anything that fails. Add designed empty, loading and error states to every panel. Verify at 1920x1080 (projector), 1280x720 and 360 px wide. Confirm no color-only signals.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/lib/theme.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "U: polish, empty states, reduced motion"
```

---

# LANE F: Integration and shipping (Wave 2 and 3)

### Task F1: End-to-end thin slice ★

**Files:**
- Create: `e2e/thin-slice.test.ts`

Runs the orchestrator, real Playwright executor, and real mock server, with simulated email so it needs no network.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serve } from '@hono/node-server';
import { fixtures, type ChecklistItem, type Rule } from '@pa/shared';
import { createApp } from '../apps/mocks/src/server';
import { createState } from '../apps/mocks/src/state';
import { createOrchestrator, type Deps } from '../apps/web/src/server/orchestrator';
import { runPlaybook } from '../packages/agent/src/executor/run';

let server: ReturnType<typeof serve>;
const state = createState();
let orchestrator: ReturnType<typeof createOrchestrator>;
let items: ChecklistItem[] = [];

beforeAll(() => {
  const mail: { id: string; subject: string; text: string }[] = [];
  server = serve({
    fetch: createApp({ state, mailer: async (subject, text) => {
      const msg = { id: `m${mail.length}`, threadId: 't', from: 'agent', subject, text, receivedAt: new Date().toISOString() };
      mail.push(msg);
      setTimeout(() => orchestrator.handleInbox(msg), 50);
    } }).fetch,
    port: 4020,
  });
  const rules: Rule[] = [...fixtures.rules];
  const deps: Deps = {
    repo: {
      listAccounts: async () => fixtures.accounts,
      listRules: async () => rules,
      saveEvent: async () => {},
      saveItems: async (i) => { items = i; },
      listItems: async () => items,
      getItem: async (id) => items.find((i) => i.id === id)!,
      setItemStatus: async (id, s) => { items = items.map((i) => (i.id === id ? { ...i, status: s } : i)); },
      setItemKit: async (id, kit) => { items = items.map((i) => (i.id === id ? { ...i, kit, status: 'kit_ready' } : i)); },
      addAudit: async () => {},
      playbookSuccess: async () => {},
      saveRule: async (r) => ({ ...r, id: 'r' }),
    },
    runPlaybook: (o) => runPlaybook({ ...o, baseUrl: 'http://localhost:4020', submitDelayMs: 50 }),
    emit: () => {},
    llmMode: 'fake',
    parse: async () => ({ newAddress: fixtures.newAddress, effectiveDate: '2026-11-01' }),
  };
  orchestrator = createOrchestrator(deps);
});
afterAll(() => server.close());

describe('thin slice', () => {
  it('plans, approves the gym, fills the mock site, and verifies from the confirmation email', async () => {
    await orchestrator.handleCommand('moving to 42 Oak St, Portland, OR 97205 on Nov 1');
    const gym = items.find((i) => i.accountId === 'acc_gym')!;
    await orchestrator.approve(gym.id, {});
    expect(state.get('ironworks.mock')).toEqual(fixtures.newAddress);
    await new Promise((r) => setTimeout(r, 400));
    expect(items.find((i) => i.id === gym.id)?.status).toBe('verified');
    expect(items.find((i) => i.accountId === 'acc_bank')?.status).toBe('kit_ready');
    expect(items.find((i) => i.accountId === 'acc_stream')?.status).toBe('blocked_by_rule');
  }, 30000);
});
```

- [ ] **Step 2: Run to verify it fails (until the lanes are merged)**

Run: `npx vitest run e2e/thin-slice.test.ts`
Expected: FAIL while any dependency task is missing, then PASS once they are all in.

- [ ] **Step 3: Fix integration gaps**

When it fails, read the error and fix the owning lane's file. Common causes: a selector mismatch between a mock site and a playbook (fix the mock, the selector table in section 2 is the contract), a subject or `Site:` line mismatch (fix the mock, the verifier tests define the format), a type mismatch (fix the contract in `packages/shared` and tell the team).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run e2e/thin-slice.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "F: end-to-end thin slice test"
```

---

### Task F2: Demo run-through, reset, fallback video ★

**Files:**
- Create: `scripts/demo-reset.ts`, `doc/demo-checklist.md`

- [ ] **Step 1: Write the demo reset**

`scripts/demo-reset.ts`: truncate this user's `checklist_items`, `events`, `audit_log`, `inbox_messages` and non-seed `rules` in Neon, call `${MOCKS_BASE_URL}/__reset`, then run the seed (M7). Add `"demo:reset": "tsx --env-file=.env scripts/demo-reset.ts"` to the root `package.json`.

- [ ] **Step 2: Write the checklist**

`doc/demo-checklist.md`, in this order: `npm run demo:reset`; start `dev:mocks` and `dev:web`; confirm `AUTH_MODE=neon` before `npm run tunnel`; open the public URL on a second device; run the design doc's section 8 script top to bottom twice; note any step that stutters.

- [ ] **Step 3: Run it twice**

Run the full script twice end to end. Fix anything that does not reset cleanly.

- [ ] **Step 4: Record the fallback video by 16:05**

Record the second clean run (QuickTime screen recording). Save it outside the repo, name `demo-fallback.mp4`, and keep it open in a tab.

- [ ] **Step 5: Commit**

```bash
git add scripts/demo-reset.ts doc/demo-checklist.md package.json
git commit -m "F: demo reset and checklist"
```

---

### Task F3: README, open source hygiene, submit

**Files:**
- Create: `README.md`, `LICENSE`

- [ ] **Step 1: Verify no secrets**

Run: `git log --all --oneline -- .env | wc -l && git grep -nE "am_us_inbox_|postgres://[^ ]*:[^ ]*@" -- . ':!doc' ':!.env.example' | head`
Expected: `0` and no matches.

- [ ] **Step 2: Write the README**

Include: the one-line pitch, the privacy-by-design point, a 30-second quickstart (`npm install`, copy `.env.example` to `.env`, `npm run db:migrate`, `npm run dev:mocks`, `npm run dev:web`, `npm run seed`), the architecture diagram from the design doc, the five mock sites table, and how to run tests.

- [ ] **Step 3: Add the MIT license**

Create `LICENSE` with the MIT text and the team's names (for the open-source side prize).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass (database tests are skipped without `DATABASE_URL`, which is fine).

- [ ] **Step 5: Commit, push, submit**

```bash
git add README.md LICENSE
git commit -m "F: README and license"
git pull --rebase origin personal-agents && git push origin personal-agents
```
Then submit through the hackathon's form with the repo link and the demo video.

---

## 3. Parallel assignment cheat sheet

| Start when | Tasks that can run at the same time |
|---|---|
| After 0.2 | **P1, P2, P3, P4** (platform), **M1**, **G1, G2, G3, G4, G5, G6, G7, G8, G12, G13** (all pure, fixture-driven), **U1** |
| After M1 | **M2, M3, M4, M5/M6** (four mock sites in parallel), then **M7** |
| After U1 | **U2, U3, U4, U5, U6, U7, U8** (seven UI components in parallel) |
| After M2 + 0.2 | **G9**, then **G10, G11** |
| After 0.3 | **O1** |
| After G1 to G6, G8, G9, O1 | **O2**, then **O3, O4, O5** in parallel |
| After P1 and U1 to U7 | **U9**, then **U10** |
| After everything above | **F1**, **F2**, **F3** |

That is up to 16 tasks runnable at once in Wave 1, so with 5 people (or several subagents) the critical path is: 0.1 → 0.2 → M1 → M2 → G9 → O2 → O3/O4 → F1, about 60 to 75 minutes of dependent work if nobody blocks.

## 4. Risks specific to this plan

- **Wave 0 is the single blocker.** Keep it to 30 minutes. If the Neon database is not ready, 0.3 can finish later without blocking anyone except O1.
- **Vendor guesses** (section 0.6) cost at most one file each. Do those checks first thing in Wave 1.
- **Selector and email-format drift** between mocks, playbooks and the verifier is the likeliest integration failure. The contracts in section 2 are the source of truth. Fix the code, not the contract, unless the whole team agrees.
- **Public tunnel.** Never run `npm run tunnel` with `AUTH_MODE=dev` (the script refuses).
- **Time.** 44 tasks do not fit 2h20m for a small team. Ship ★ tasks first and cut the rest.
