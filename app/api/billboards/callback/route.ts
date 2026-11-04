import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { BILLBOARD_AD_DAYS, BILLBOARD_BUCKET } from "@/lib/billboard-ads";

type PaystackVerification = {
  status?: unknown;
  reference?: unknown;
  amount?: unknown;
  currency?: unknown;
};

function redirectToMap(request: NextRequest, result: "success" | "failed" | "pending") {
  const url = new URL("/", request.url);
  url.searchParams.set("billboardPayment", result);
  const reference =
    request.nextUrl.searchParams.get("reference") ??
    request.nextUrl.searchParams.get("trxref");
  if (reference && /^billboard_[a-f0-9]{32}$/.test(reference)) {
    url.searchParams.set("billboardPaymentReference", reference);
  }
  return NextResponse.redirect(url);
}

function amountMatches(value: unknown, expected: number) {
  return (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) &&
    Number(value) === expected;
}

export async function GET(request: NextRequest) {
  const reference =
    request.nextUrl.searchParams.get("reference") ??
    request.nextUrl.searchParams.get("trxref");
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!reference || !/^billboard_[a-f0-9]{32}$/.test(reference)) {
    console.warn("[billboards] Payment callback did not include a valid reference.");
    return redirectToMap(request, "pending");
  }
  if (!secretKey) {
    console.error("[billboards] Cannot verify callback: PAYSTACK_SECRET_KEY is not configured.");
    return redirectToMap(request, "pending");
  }

  const admin = createAdminClient();
  const { data: ad, error: adError } = await admin
    .from("billboard_ads")
    .select("id, amount_kobo, media_path, status")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (adError) {
    console.error("[billboards] Could not find callback ad:", adError);
    return redirectToMap(request, "pending");
  }
  if (!ad) {
    console.error("[billboards] Payment callback has no matching ad record.");
    return redirectToMap(request, "pending");
  }
  if (ad.status === "active") return redirectToMap(request, "success");
  if (ad.status !== "pending" && ad.status !== "failed") {
    console.error("[billboards] Payment callback found an unexpected ad status.", {
      status: ad.status,
    });
    return redirectToMap(request, "pending");
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" },
    );
    const payload: unknown = await response.json();
    const data = (payload as { data?: PaystackVerification } | null)?.data;
    if (!response.ok || !data) {
      console.error("[billboards] Paystack verification request failed.", {
        httpStatus: response.status,
        message:
          typeof (payload as { message?: unknown } | null)?.message === "string"
            ? (payload as { message: string }).message.slice(0, 200)
            : null,
      });
      return redirectToMap(request, "pending");
    }
    if (data.status !== "success") {
      if (data.status === "failed" || data.status === "abandoned") {
        if (ad.status === "pending") {
          const { error: updateError } = await admin
            .from("billboard_ads")
            .update({ status: "failed" })
            .eq("id", ad.id)
            .eq("status", "pending");
          if (updateError) {
            console.error("[billboards] Could not mark unsuccessful payment:", updateError);
          }
          await admin.storage.from(BILLBOARD_BUCKET).remove([ad.media_path]);
        }
        return redirectToMap(request, "failed");
      }
      return redirectToMap(request, "pending");
    }

    if (
      data.reference !== reference ||
      !amountMatches(data.amount, ad.amount_kobo) ||
      typeof data.currency !== "string" ||
      data.currency.toUpperCase() !== "NGN"
    ) {
      console.error("[billboards] Successful payment details do not match the pending ad.", {
        referenceMatches: data.reference === reference,
        expectedAmount: ad.amount_kobo,
        receivedAmount: data.amount,
        receivedCurrency: data.currency,
      });
      return redirectToMap(request, "pending");
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
        return redirectToMap(request, "pending");
      }
    }

    const expiresAt = new Date(Date.now() + BILLBOARD_AD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: activated, error: activateError } = await admin
      .from("billboard_ads")
      .update({ status: "active", expires_at: expiresAt })
      .eq("id", ad.id)
      .eq("status", ad.status)
      .select("id")
      .maybeSingle();

    if (activateError) {
      console.error("[billboards] Could not activate paid ad:", activateError);
      return redirectToMap(request, "pending");
    }
    if (!activated) {
      const { data: currentAd, error: currentAdError } = await admin
        .from("billboard_ads")
        .select("status")
        .eq("id", ad.id)
        .maybeSingle();
      if (currentAdError) {
        console.error("[billboards] Could not confirm concurrently activated ad:", currentAdError);
        return redirectToMap(request, "pending");
      }
      if (currentAd?.status === "active") return redirectToMap(request, "success");
    }
    return redirectToMap(request, activated ? "success" : "pending");
  } catch (error) {
    console.error("[billboards] Payment verification request failed:", error);
    return redirectToMap(request, "pending");
  }
}
