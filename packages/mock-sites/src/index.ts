export type MockSiteBehavior = "instant-confirmation" | "email-code" | "delayed-confirmation" | "card-rule" | "assist-only";

export const MOCK_SITES = [
  { id: "ironworks", name: "IronWorks Gym", behavior: "instant-confirmation" as MockSiteBehavior, proof: "Approved action and immediate confirmation" },
  { id: "pixelvault", name: "PixelVault", behavior: "email-code" as MockSiteBehavior, proof: "AgentMail verification-code reader" },
  { id: "threadhub", name: "ThreadHub", behavior: "delayed-confirmation" as MockSiteBehavior, proof: "Asynchronous verifier" },
  { id: "streambox", name: "StreamBox", behavior: "card-rule" as MockSiteBehavior, proof: "User rule blocks action" },
  { id: "harbor-bank", name: "Harbor Bank", behavior: "assist-only" as MockSiteBehavior, proof: "Hands-off prefilled kit" }
];