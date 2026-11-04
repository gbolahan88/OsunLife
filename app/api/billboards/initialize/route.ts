import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  BILLBOARD_BUCKET,
  BILLBOARD_MAX_FILE_SIZE,
  BILLBOARD_PRICES,
  isBillboardId,
  type BillboardAdType,
} from "@/lib/billboard-ads";

const MIME_TYPES: Record<BillboardAdType, Record<string, string>> = {
  image: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  },
  video: {
    "video/mp4": "mp4",
    "video/webm": "webm",
  },
};

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

function cleanupPendingAd(
  admin: ReturnType<typeof createAdminClient>,
  adId: string,
  storagePath: string,
) {
  return Promise.all([
    admin.storage.from(BILLBOARD_BUCKET).remove([storagePath]),
    admin.from("billboard_ads").delete().eq("id", adId),
  ]).then(([storageResult, rowResult]) => {
    if (storageResult.error) {
      console.error("[billboards] Could not clean up uploaded ad:", storageResult.error);
    }
    if (rowResult.error) {
      console.error("[billboards] Could not clean up pending ad:", rowResult.error);
    }
  });
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
    console.warn("[billboards] Rejected cross-origin ad checkout request.", {
      origin,
      publicOrigin,
    });
    return Response.json({ error: "This request was refused." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > BILLBOARD_MAX_FILE_SIZE + 1024 * 1024) {
    return Response.json({ error: "The ad file must be smaller than 30 MB." }, { status: 413 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return Response.json(
      { error: "Paystack is not configured. Add PAYSTACK_SECRET_KEY on the server." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Sign in to post a billboard ad." }, { status: 401 });
  }
  if (!user.email) {
    return Response.json(
      { error: "Your account needs an email address before you can pay with Paystack." },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Choose an image or video file to advertise." }, { status: 400 });
  }

  const boardIdValue = form.get("boardId");
  const adTypeValue = form.get("adType");
  const file = form.get("file");
  if (
    typeof boardIdValue !== "string" ||
    !isBillboardId(boardIdValue) ||
    (adTypeValue !== "image" && adTypeValue !== "video") ||
    !(file instanceof File)
  ) {
    return Response.json({ error: "The billboard ad details are invalid." }, { status: 400 });
  }

  const adType = adTypeValue;
  const extension = MIME_TYPES[adType][file.type];
  if (!extension) {
    return Response.json(
      { error: adType === "image" ? "Use a JPG, PNG, or WebP image." : "Use an MP4 or WebM video." },
      { status: 400 },
    );
  }
  if (file.size < 1 || file.size > BILLBOARD_MAX_FILE_SIZE) {
    return Response.json({ error: "The ad file must be smaller than 30 MB." }, { status: 400 });
  }

  const admin = createAdminClient();
  const reference = `billboard_${randomUUID().replaceAll("-", "")}`;
  const storagePath = `${user.id}/${reference}.${extension}`;
  const amountKobo = BILLBOARD_PRICES[adType] * 100;
  const { data: ad, error: insertError } = await admin
    .from("billboard_ads")
    .insert({
      user_id: user.id,
      board_id: boardIdValue,
      ad_type: adType,
      amount_kobo: amountKobo,
      paystack_reference: reference,
      media_path: storagePath,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !ad) {
    console.error("[billboards] Could not create pending ad:", insertError);
    return Response.json({ error: "Could not prepare your ad. Please try again." }, { status: 500 });
  }

  const { error: uploadError } = await admin.storage.from(BILLBOARD_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    console.error("[billboards] Ad upload failed:", uploadError);
    await admin.from("billboard_ads").delete().eq("id", ad.id);
    return Response.json({ error: "The ad file could not be uploaded. Please try again." }, { status: 500 });
  }

  try {
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        currency: "NGN",
        reference,
        callback_url: new URL("/api/billboards/callback", publicOrigin).toString(),
        metadata: {
          billboard_ad_id: ad.id,
          billboard_id: boardIdValue,
          ad_type: adType,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    let payload: unknown;
    try {
      payload = await paystackResponse.json();
    } catch {
      payload = null;
    }
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
    if (!paystackResponse.ok || !data || typeof data.authorization_url !== "string") {
      const paystackMessage =
        isRecord(payload) && typeof payload.message === "string"
          ? payload.message.slice(0, 240)
          : null;
      console.error("[billboards] Paystack initialization failed.", {
        httpStatus: paystackResponse.status,
        message: paystackMessage,
      });
      await cleanupPendingAd(admin, ad.id, storagePath);
      return Response.json(
        {
          error: paystackMessage
            ? `Paystack could not start checkout: ${paystackMessage}`
            : `Paystack could not start checkout (HTTP ${paystackResponse.status}). Please try again.`,
        },
        { status: 502 },
      );
    }

    return Response.json({ authorizationUrl: data.authorization_url });
  } catch (error) {
    console.error("[billboards] Paystack request failed:", error);
    await cleanupPendingAd(admin, ad.id, storagePath);
    return Response.json(
      { error: "Could not connect to Paystack. Please check the server's outbound connection and try again." },
      { status: 502 },
    );
  }
}
