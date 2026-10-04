# Functional data model
```mermaid
erDiagram
 USER ||--o{ ACCOUNT : owns
 USER ||--o{ LIFE_EVENT : creates
 LIFE_EVENT ||--o{ CHECKLIST_ITEM : plans
 ACCOUNT ||--o{ CHECKLIST_ITEM : targets
 CHECKLIST_ITEM ||--o{ APPROVAL : requires
 CHECKLIST_ITEM ||--o{ PROOF : verifies
 AGENTMAIL_MESSAGE }o--|| ACCOUNT : discovers
 USER { text id PK }
 ACCOUNT { uuid id PK text domain text category text tier }
 LIFE_EVENT { uuid id PK text type jsonb payload }
 CHECKLIST_ITEM { uuid id PK text status boolean requires_approval }
 APPROVAL { uuid id PK text decision }
 PROOF { uuid id PK text kind text reference }
```

Runtime flow: AgentMail → Nest discovery → Neon AI Gateway classification → Neon Postgres account graph → guarded API → Next.js UI. Neon Auth supplies the user identity for every persisted record.