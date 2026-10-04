"use client";
import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

export const neonClient = createClient({
  auth: { adapter: BetterAuthReactAdapter(), url: "https://ep-summer-pond-b4fnxnmd.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth" },
  dataApi: { url: "https://ep-summer-pond-b4fnxnmd.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1" }
});
export async function bearerToken() { const result:any = await neonClient.auth.getSession(); return result?.data?.session?.token ?? result?.session?.token ?? null; }