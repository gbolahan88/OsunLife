import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { BILLBOARD_AD_DAYS, BILLBOARD_BUCKET } from "@/lib/billboard-ads";

function redirectToMap(request: NextRequest, result: "success" | "failed" | "pending") {
  const url = new URL("/", request.url);
  url.searchParams.set("billboardPayment", result);
  const reference =
    request.nextUrl.searchParams.get("reference") ??
    request.nextUrl.searchParams.get("trxref");
  
  if (reference && /^(billboard|sea_plot)_[a-f0-9]{32}$/.test(reference)) {
    url.searchParams.set("billboardPaymentReference", reference);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const reference =
    request.nextUrl.searchParams.get("reference") ??
    request.nextUrl.searchParams.get("trxref");
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  
  if (!reference || !/^(billboard|sea_plot)_[a-f0-9]{32}$/.test(reference) || !secretKey) {
    return redirectToMap(request, "pending");
  }

  const admin = createAdminClient();
  const isSeaPlot = reference.startsWith("sea_plot_");
  const table = isSeaPlot ? "sea_plots" : "billboard_ads";

  // 1. Just verify with Paystack first
  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" },
    );
    const payload = await response.json();
    const data = payload?.data;

    if (!response.ok || !data || data.status !== "success") {
       // If Paystack says it's failed, mark it as failed in DB
       if (data?.status === "failed" || data?.status === "abandoned") {
          await admin.from(table).update({ status: "failed" }).eq("paystack_reference", reference);
       }
       return redirectToMap(request, data?.status === "failed" ? "failed" : "pending");
    }

    // 2. Payment is successful. Activate the ad.
    const expiresAt = new Date(Date.now() + BILLBOARD_AD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    const { error: activateError } = await admin
      .from(table)
      .update({ status: "active", expires_at: expiresAt })
      .eq("paystack_reference", reference)
      .in("status", ["pending", "failed"]); // Allows recovering failed ones too

    if (activateError) {
      console.error("[payments] Activate error:", activateError);
      // Even if DB update fails, if Paystack says success, send them to success
      return redirectToMap(request, "success");
    }

    return redirectToMap(request, "success");
  } catch (error) {
    console.error("[payments] Verification error:", error);
    return redirectToMap(request, "pending");
  }
}