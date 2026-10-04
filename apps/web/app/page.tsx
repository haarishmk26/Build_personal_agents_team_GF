"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { bearerToken, neonClient } from "./neon-auth";
type Account = {
  id: string;
  name: string;
  domain: string;
  category: string;
  tier: string;
  last_seen_at: string | null;
};
type Plan = {
  eventId: string;
  address: string;
  items: {
    id: string;
    accountName: string;
    status: string;
    action: string;
    reason: string;
    requiresApproval: boolean;
  }[];
};
export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [address, setAddress] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const load = useCallback(async () => {
    const token = await bearerToken();
    if (!token) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    const sync = await fetch("/api/discovery", { method: "POST", headers });
    if (!sync.ok) {
      setError("We could not refresh your inbox right now. Please try again.");
      setLoading(false);
      return;
    }
    const response = await fetch("/api/accounts", {
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      setError("We could not load your accounts. Please try again.");
      setLoading(false);
      return;
    }
    setAccounts(await response.json());
    setSignedIn(true);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const result = await (neonClient.auth as any).signIn.social({
        provider: "google",
        callbackURL: window.location.origin,
      });
      if (result?.error)
        throw new Error(
          result.error.message ?? "Google sign-in could not start",
        );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Google sign-in could not start",
      );
      setLoading(false);
    }
  }
  async function createPlan(event: FormEvent) {
    event.preventDefault();
    const token = await bearerToken();
    if (!token) return;
    setPlanning(true);
    setError(null);
    try {
      const response = await fetch("/api/plans/move", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ address }),
      });
      if (!response.ok)
        throw new Error("We could not create that review plan.");
      setPlan(await response.json());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not create that review plan.",
      );
    } finally {
      setPlanning(false);
    }
  }
  if (!signedIn)
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <Badge variant="secondary">Personal review queue</Badge>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">
          Know what needs your attention.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Review the services linked to your life in one place. Nothing changes
          without your approval.
        </p>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Sign in to continue</CardTitle>
            <CardDescription>
              Use Google to open your review queue.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              disabled={loading}
              type="button"
              onClick={() => void signInWithGoogle()}
            >
              {loading ? "Loading…" : "Continue with Google"}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <Badge variant="secondary">Your review queue</Badge>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">
            Accounts to review.
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Choose what you want to update, and keep the rest as it is.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Change an address</CardTitle>
          <CardDescription>
            Create a review plan for the accounts below. You approve each change
            before anything is sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={createPlan}
          >
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="New address"
              required
            />
            <Button disabled={planning || accounts.length === 0} type="submit">
              {planning ? "Creating…" : "Create review plan"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {plan && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Review plan ready</CardTitle>
            <CardDescription>
              {plan.items.length} accounts are prepared for {plan.address}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {plan.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium">{item.accountName}</p>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                </div>
                <Badge
                  variant={item.requiresApproval ? "secondary" : "outline"}
                >
                  {item.action}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Services</h2>
        <div className="mt-4 grid gap-3">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-muted-foreground">
                No services are ready to review yet.
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <h3 className="font-medium">{account.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {account.category}
                    </p>
                  </div>
                  <Badge
                    variant={
                      account.tier === "assist" ? "destructive" : "secondary"
                    }
                  >
                    {account.tier}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
