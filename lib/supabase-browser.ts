// lib/supabase-browser.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Same shape createBrowserClient returns. Pinning the type here is what
 * stops `any` from leaking into consumers (MultiplayerProvider, etc.).
 *
 * If you generate DB types with `supabase gen types typescript`, replace
 * `any` with `<Database>`.
 */
export type BrowserClient = SupabaseClient<any, "public", any>;

let client: BrowserClient | null = null;

/** One shared browser client. The url and publishable key come from the server page. */
export function getBrowserClient(url: string, key: string): BrowserClient {
  if (!url || !key) {
    throw new Error(
      `[Supabase] Missing URL or key. url="${url}" key="${key ? "set" : "missing"}". ` +
        `Check the props passed from the server page and your NEXT_PUBLIC_ env vars.`,
    );
  }
  if (!client) client = createBrowserClient(url, key);
  return client;
}