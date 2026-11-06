import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import { randomUUID } from "node:crypto";

const BASE_PRICE_KOBO = 500 * 100; // ₦500 in kobo

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ error: "Paystack secret key missing." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email) {
    return Response.json({ error: "Sign in to buy a sea plot." }, { status: 401 });
  }

  const body = await request.json();
  const { plotId, width, height } = body;

  if (!plotId || !width || !height) {
    return Response.json({ error: "Invalid plot details." }, { status: 400 });
  }

  const amountKobo = BASE_PRICE_KOBO * width * height;
  const reference = `sea_plot_${randomUUID().replaceAll("-", "")}`;

  const admin = createAdminClient();
  
  // 1. Save the pending plot to your database
  const { data: plot, error: insertError } = await admin
    .from("sea_plots") // Make sure you create this table in Supabase
    .insert({
      user_id: user.id,
      plot_id: plotId,
      width: width,
      height: height,
      amount_kobo: amountKobo,
      paystack_reference: reference,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !plot) {
    console.error("[sea_plots] Insert error:", insertError);
    return Response.json({ error: "Could not prepare your plot." }, { status: 500 });
  }

  // 2. Initialize Paystack exactly like the billboard does
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
        callback_url: `${process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/billboards/callback`,
        metadata: {
          type: "sea_plot",
          plot_id: plot.id,
          grid_coordinates: plotId,
        },
      }),
    });

    const data = await paystackResponse.json();
    
    if (!paystackResponse.ok || !data.data?.authorization_url) {
      throw new Error(data.message || "Paystack initialization failed.");
    }

    return Response.json({ authorizationUrl: data.data.authorization_url });
  } catch (error) {
    console.error("[sea_plots] Paystack error:", error);
    // Cleanup if Paystack fails
    await admin.from("sea_plots").delete().eq("id", plot.id);
    return Response.json({ error: "Could not connect to Paystack." }, { status: 502 });
  }
}