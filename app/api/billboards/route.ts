import { createAdminClient } from "@/lib/supabase-admin";
import { BILLBOARD_BUCKET, isBillboardId } from "@/lib/billboard-ads";

export async function GET(request: Request) {
  const boardId = new URL(request.url).searchParams.get("boardId");
  if (boardId && !isBillboardId(boardId)) {
    return Response.json({ error: "Unknown billboard." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ads, error } = await admin
    .from("billboard_ads")
    .select("id, board_id, ad_type, media_path")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(120);

  if (error) {
    console.error("[billboards] Could not load active ads:", error);
    return Response.json({ error: "Billboard ads are temporarily unavailable." }, { status: 500 });
  }

  const visibleAds = (ads ?? [])
    .filter((ad) => !boardId || ad.board_id === boardId)
    .map((ad) => ({
      id: ad.id,
      boardId: ad.board_id,
      adType: ad.ad_type,
      mediaUrl: admin.storage.from(BILLBOARD_BUCKET).getPublicUrl(ad.media_path).data.publicUrl,
    }));

  return Response.json(visibleAds, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=30" },
  });
}
