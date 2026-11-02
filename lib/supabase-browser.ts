// lib/supabase-browser.ts
import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let client: BrowserClient | null = null;

/** One shared browser client. The url and publishable key come from the server page. */
export function getBrowserClient(url: string, key: string): BrowserClient {
  if (!client) client = createBrowserClient(url, key);
  return client;
}

/** The client the provider already created (null until the provider has mounted). */
export function peekBrowserClient(): BrowserClient | null {
  return client;
}