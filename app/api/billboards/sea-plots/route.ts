import { createAdminClient } from "@/lib/supabase-admin";
import { BILLBOARD_BUCKET } from "@/lib/billboard-ads";

export async function GET() {
  const admin = createAdminClient();
  const { data: plots, error } = await admin
    .from("sea_plots")
    .select("id, plot_id, width, height, media_path, link_url, status")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());

  if (error) {
    return Response.json({ error: "Failed to load sea plots" }, { status: 500 });
  }

  const formatted = plots.map((p) => ({
    ...p,
    mediaUrl: admin.storage.from(BILLBOARD_BUCKET).getPublicUrl(p.media_path).data.publicUrl,
  }));

  return Response.json(formatted);
}