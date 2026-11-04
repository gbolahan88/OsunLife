import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { BILLBOARD_AD_DAYS, BILLBOARD_BUCKET } from "@/lib/billboard-ads";

type PaystackEvent = {
  event?: string;
  data?: { reference?: string };
};

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const signature = request.headers.get("x-paystack-signature");
  if (!secretKey || !signature) {
    return Response.json({ error: "Invalid webhook." }, { status: 401 });
  }

  const body = await request.text();
  const expected = createHmac("sha512", secretKey).update(body).digest("hex");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(body) as PaystackEvent;
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  if (event.event !== "charge.success" || !event.data?.reference) {
    return Response.json({ received: true });
  }

  const reference = event.data.reference;
  if (!/^billboard_[a-f0-9]{32}$/.test(reference)) {
    return Response.json({ received: true });
  }

  const admin = createAdminClient();
  const { data: ad, error: adError } = await admin
    .from("billboard_ads")
    .select("id, amount_kobo, media_path, status")
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (adError) {
    console.error("[billboards] Webhook ad lookup failed:", adError);
    return Response.json({ error: "Could not verify the ad." }, { status: 500 });
  }
  if (!ad || (ad.status !== "pending" && ad.status !== "failed")) {
    return Response.json({ received: true });
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" },
  );
  const payload: unknown = await response.json();
  const payment = (payload as {
    data?: { status?: string; reference?: string; amount?: number; currency?: string };
  } | null)?.data;
  if (
    !response.ok ||
    payment?.status !== "success" ||
    payment.reference !== reference ||
    Number(payment.amount) !== ad.amount_kobo ||
    typeof payment.currency !== "string" ||
    payment.currency.toUpperCase() !== "NGN"
  ) {
    console.error("[billboards] Webhook payment verification did not match.", {
      httpStatus: response.status,
      status: payment?.status,
      referenceMatches: payment?.reference === reference,
      expectedAmount: ad.amount_kobo,
      receivedAmount: payment?.amount,
      receivedCurrency: payment?.currency,
    });
    return Response.json({ error: "Payment verification failed." }, { status: 400 });
  }

  if (ad.status === "failed") {
    const { error: mediaError } = await admin.storage
      .from(BILLBOARD_BUCKET)
      .download(ad.media_path);
    if (mediaError) {
      console.error("[billboards] Verified payment cannot be recovered because the ad file is missing.", {
        reference,
        adId: ad.id,
        mediaError: mediaError.message,
      });
      return Response.json({ received: true });
    }
  }

  const expiresAt = new Date(Date.now() + BILLBOARD_AD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: updateError } = await admin
    .from("billboard_ads")
    .update({ status: "active", expires_at: expiresAt })
    .eq("id", ad.id)
    .eq("status", ad.status);
  if (updateError) {
    console.error("[billboards] Webhook activation failed:", updateError);
    return Response.json({ error: "Could not activate the ad." }, { status: 500 });
  }

  return Response.json({ received: true });
}
