import { Suspense } from "react";
import { connection } from "next/server";
import AuthScreen from "@/components/AuthScreen";
import GameApp from "@/components/GameApp";
import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import { isUsernameAuthConfigured } from "@/lib/supabase-config";

export default function Page() {
  const configured = isUsernameAuthConfigured();
  if (!configured) return <AuthScreen configured={false} />;

  return (
    <Suspense fallback={<AuthScreen configured />}>
      <AuthenticatedGame />
    </Suspense>
  );
}

async function AuthenticatedGame() {
  await connection();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) return <AuthScreen configured />;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", claims.sub)
    .maybeSingle();
  const username = profile?.username ?? "Player";

  // ── Read the public Supabase env vars (must be NEXT_PUBLIC_*) ──
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "in .env.local. Restart the dev server after adding them.",
    );
  }

  return (
    <GameApp
      username={username}
      userId={claims.sub}
      supabaseUrl={supabaseUrl}
      supabaseKey={supabaseKey}
    />
  );
}