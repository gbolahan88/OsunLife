import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import { BILLBOARD_BUCKET } from "@/lib/billboard-ads";

const BASE_PRICE_KOBO = 500 * 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPublicOrigin(request: Request) {
  const configuredOrigin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      return null;
    }
    return null;
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || new URL(request.url).protocol.replace(":", "");
  if (!host || (protocol !== "https" && protocol !== "http")) return new URL(request.url).origin;
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const publicOrigin = getPublicOrigin(request);
  let originMatches = false;
  try {
    originMatches = Boolean(publicOrigin && origin && new URL(origin).origin === publicOrigin);
  } catch {
    originMatches = false;
  }
  if (!originMatches || !publicOrigin) {
    console.warn("[sea_plots] Rejected cross-origin request.", { origin, publicOrigin });
    return Response.json({ error: "This request was refused." }, { status: 403 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ error: "Paystack is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return Response.json({ error: "Sign in to buy a sea plot." }, { status: 401 });
  }

  const form = await request.formData();
  const plotId = form.get("plotId") as string;
  const width = parseInt(form.get("width") as string);
  const height = parseInt(form.get("height") as string);
  const linkUrl = form.get("linkUrl") as string;
  const file = form.get("file") as File;

  if (!plotId || !width || !height || !file) {
    return Response.json({ error: "Missing details" }, { status: 400 });
  }

  const admin = createAdminClient();
  const reference = `sea_plot_${randomUUID().replaceAll("-", "")}`;
  const ext = file.type.split("/")[1] || "jpg";
  const mediaPath = `sea/${user.id}/${reference}.${ext}`;
  const amountKobo = BASE_PRICE_KOBO * width * height;

  // 1. Upload the image to Supabase Storage
  const { error: uploadError } = await admin.storage
    .from(BILLBOARD_BUCKET)
    .upload(mediaPath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[sea_plots] Upload error:", uploadError);
    return Response.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // 2. Save to Database as 'pending'
  const { data: plot, error: dbError } = await admin
    .from("sea_plots")
    .insert({
      user_id: user.id,
      plot_id: plotId,
      width,
      height,
      amount_kobo: amountKobo,
      paystack_reference: reference,
      media_path: mediaPath,
      link_url: linkUrl,
    })
    .select("id")
    .single();

  if (dbError || !plot) {
    console.error("[sea_plots] DB insert error:", dbError);
    await admin.storage.from(BILLBOARD_BUCKET).remove([mediaPath]);
    return Response.json({ error: "DB error" }, { status: 500 });
  }

  // 3. Create Paystack Checkout
  try {
    const pRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        currency: "NGN",
        reference,
        // 👇 Using the exact same logic as your working billboard callback
        callback_url: new URL("/api/billboards/callback", publicOrigin).toString(),
        metadata: { type: "sea_plot", plot_id: plot.id },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await pRes.json();
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;

    if (!pRes.ok || !data || typeof data.authorization_url !== "string") {
      await admin.storage.from(BILLBOARD_BUCKET).remove([mediaPath]);
      await admin.from("sea_plots").delete().eq("id", plot.id);
      return Response.json({ error: "Paystack init failed" }, { status: 502 });
    }

    return Response.json({ authorizationUrl: data.authorization_url });
  } catch (err) {
    console.error("[sea_plots] Paystack error:", err);
    await admin.storage.from(BILLBOARD_BUCKET).remove([mediaPath]);
    await admin.from("sea_plots").delete().eq("id", plot.id);
    return Response.json({ error: "Payment init failed" }, { status: 502 });
  }
}