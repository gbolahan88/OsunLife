import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to report a user." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const reportedUsername = typeof body?.username === "string" ? body.username.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (reportedUsername.length < 2) {
    return NextResponse.json({ error: "Enter a valid username." }, { status: 400 });
  }
  if (reason.length < 5) {
    return NextResponse.json({ error: "Please explain why you're reporting them." }, { status: 400 });
  }
  if (reportedUsername.toLowerCase() === (user.email?.split("@")[0] ?? "").toLowerCase()) {
    return NextResponse.json({ error: "You can't report yourself." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check if the reported user actually exists
  const { data: target } = await admin
    .from("profiles")
    .select("username")
    .ilike("username", reportedUsername)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "No user found with that username." }, { status: 404 });
  }

  // Prevent duplicate reports from the same user against the same target
  const { data: existing } = await admin
    .from("user_reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("reported_username", target.username)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You already reported this user." }, { status: 400 });
  }

  const { error } = await admin.from("user_reports").insert({
    reporter_id: user.id,
    reported_username: target.username,
    reason,
  });

  if (error) {
    console.error("[reports] Insert error:", error);
    return NextResponse.json({ error: "Could not save report." }, { status: 500 });
  }

  // Count reports for this user (auto-flag if 3+)
  const { count } = await admin
    .from("user_reports")
    .select("id", { count: "exact", head: true })
    .eq("reported_username", target.username)
    .eq("status", "pending");

  if (count && count >= 3) {
    // Mark them as wanted (add a column to profiles if you don't have one)
    await admin
      .from("profiles")
      .update({ wanted: true })
      .ilike("username", target.username);
  }

  return NextResponse.json({ ok: true, reportCount: count ?? 1 });
}