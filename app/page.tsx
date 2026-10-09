import { Suspense } from "react";
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

  return <GameApp username={username} />;
}
