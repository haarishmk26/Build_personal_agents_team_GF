# Data model and application boundaries

The product has three deployable applications and shared packages.

```mermaid
flowchart LR
  Web[apps/web\nNext.js + TypeScript] -->|Bearer token + HTTPS| API[apps/api\nNestJS]
  API --> Core[packages/core\npolicy + planner]
  API --> Mail[packages/agentmail\nconfirmation reader]
  API --> LLM[Neon AI Gateway\nserver-only]
  API --> DB[(Neon Postgres)]
  Web --> Auth[Neon Auth]
  API -->|JWKS token verification| Auth
```

## Persistent model

```mermaid
erDiagram
  APP_USER ||--o{ LIFE_EVENT : creates
  APP_USER ||--o{ ACCOUNT : owns
  LIFE_EVENT ||--o{ CHECKLIST_ITEM : produces
  ACCOUNT ||--o{ CHECKLIST_ITEM : targets
  CHECKLIST_ITEM ||--o{ APPROVAL : receives
  APP_USER ||--o{ APPROVAL : makes
  CHECKLIST_ITEM ||--o{ PROOF : verifies
  ACCOUNT }o--o| PLAYBOOK : uses

  APP_USER { text id PK
             text email }
  LIFE_EVENT { uuid id PK
               text type
               jsonb payload
               text status }
  ACCOUNT { uuid id PK
            text domain
            text category
            text tier
            jsonb stale_fields }
  CHECKLIST_ITEM { uuid id PK
                   text status
                   text action
                   boolean requires_approval }
  APPROVAL { uuid id PK
             text decision
             timestamptz created_at }
  PLAYBOOK { uuid id PK
             text domain
             jsonb steps
             int success_count }
  PROOF { uuid id PK
          text kind
          text reference }
```

## Ownership and safety

- **Web** never receives AgentMail, database, or AI Gateway secrets.
- **API** is the policy-enforcement point. `NeonAuthGuard` validates bearer tokens against Neon Auth’s JWKS before protected routes run.
- **Core** computes deterministic tiers, rules, and approval requirements. An LLM may explain or classify, but cannot authorize execution.
- **Postgres** records the durable account graph, event plan, approvals, and verification proofs.
- **AgentMail** supplies evidence and one-time codes to the API; it is not accessible from the browser.