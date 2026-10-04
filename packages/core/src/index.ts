export type AccountTier = "act" | "rule-blocked" | "mock" | "assist";
export type ChecklistStatus = "ready" | "blocked" | "awaiting_approval" | "awaiting_verification" | "completed";

export interface Account {
  id: string;
  name: string;
  domain: string;
  category: "gym" | "gaming" | "forum" | "subscription" | "bank";
  tier: AccountTier;
  hasCardOnFile?: boolean;
  staleAddress: boolean;
}

export interface ChecklistItem {
  id: string;
  account: Account;
  status: ChecklistStatus;
  reason: string;
  action: string;
  approvalRequired: boolean;
}

export interface UserRule {
  id: string;
  text: string;
  blocksCardOnFile?: boolean;
}

export const SEEDED_ACCOUNTS: Account[] = [
  { id: "ironworks", name: "IronWorks Gym", domain: "ironworks.example", category: "gym", tier: "mock", staleAddress: true },
  { id: "pixelvault", name: "PixelVault", domain: "pixelvault.example", category: "gaming", tier: "mock", staleAddress: true },
  { id: "threadhub", name: "ThreadHub", domain: "threadhub.example", category: "forum", tier: "mock", staleAddress: true },
  { id: "streambox", name: "StreamBox", domain: "streambox.example", category: "subscription", tier: "mock", hasCardOnFile: true, staleAddress: true },
  { id: "harbor-bank", name: "Harbor Bank", domain: "harborbank.example", category: "bank", tier: "assist", staleAddress: true }
];

export const DEFAULT_RULES: UserRule[] = [
  { id: "card-on-file", text: "Ask me before changing any account with a card on file.", blocksCardOnFile: true }
];

export function planMovingEvent(accounts: Account[], rules: UserRule[] = DEFAULT_RULES): ChecklistItem[] {
  const cardRuleActive = rules.some((rule) => rule.blocksCardOnFile);
  return accounts.filter((account) => account.staleAddress).map((account) => {
    if (account.tier === "assist") {
      return { id: `move-${account.id}`, account, status: "ready", approvalRequired: false, reason: "Financial account: this service is hands-off.", action: "Open a prefilled update kit" };
    }
    if (cardRuleActive && account.hasCardOnFile) {
      return { id: `move-${account.id}`, account, status: "blocked", approvalRequired: true, reason: "Your card-on-file rule requires an additional approval.", action: "Request a one-time exception" };
    }
    return { id: `move-${account.id}`, account, status: "awaiting_approval", approvalRequired: true, reason: "Safe demo flow: the agent will pause before submit.", action: "Preview and approve address change" };
  });
}