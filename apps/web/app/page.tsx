"use client";

import { useMemo, useState } from "react";
import { DEFAULT_RULES, planMovingEvent, SEEDED_ACCOUNTS, type ChecklistItem } from "@life-agent/core";

const nextStatus: Record<string, ChecklistItem["status"]> = {
  "awaiting_approval": "awaiting_verification",
  "awaiting_verification": "completed",
  blocked: "awaiting_approval"
};

export default function Home() {
  const initialPlan = useMemo(() => planMovingEvent(SEEDED_ACCOUNTS, DEFAULT_RULES), []);
  const [items, setItems] = useState(initialPlan);
  const completeCount = items.filter((item) => item.status === "completed").length;
  const advance = (id: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, status: nextStatus[item.status] ?? item.status } : item));

  return <main>
    <header><span className="eyebrow">LIFE EVENT AGENT</span><h1>Your move is already in motion.</h1><p>Maya is moving to <strong>42 Oak St</strong> on Nov 1. We found five accounts with a stale address.</p></header>
    <section className="summary"><div><span>Progress</span><strong>{completeCount} / {items.length}</strong></div><div><span>Rule active</span><strong>Ask before card-on-file changes</strong></div><div><span>Proof inbox</span><strong>AgentMail connected</strong></div></section>
    <section className="layout">
      <aside className="map"><h2>Account map</h2><p>Every circle is an account discovered from Maya’s mail.</p><div className="orbit"><div className="maya">Maya</div>{items.map((item, index) => <div key={item.id} className={`node n${index} ${item.status}`}>{item.account.name}</div>)}</div><div className="legend"><span className="dot ready" /> needs action <span className="dot done" /> verified</div></aside>
      <section className="checklist"><div className="section-heading"><div><span className="eyebrow">MOVE CHECKLIST</span><h2>Review each change</h2></div><button className="quiet">Learned playbooks: 3</button></div>{items.map((item) => <article key={item.id} className={`card ${item.status}`}><div><span className="badge">{item.account.tier}</span><h3>{item.account.name}</h3><p>{item.reason}</p></div><div className="card-action"><span className="status">{item.status.replaceAll("_", " ")}</span>{item.status === "ready" && <button onClick={() => advance(item.id)}>Open kit</button>}{item.status === "blocked" && <button onClick={() => advance(item.id)}>Allow once</button>}{item.status === "awaiting_approval" && <button onClick={() => advance(item.id)}>Approve change</button>}{item.status === "awaiting_verification" && <button onClick={() => advance(item.id)}>Check confirmation</button>}{item.status === "completed" && <span className="verified">✓ Verified</span>}</div></article>)}</section>
    </section>
  </main>;
}