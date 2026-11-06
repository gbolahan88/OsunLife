"use client";

import { useState, useEffect } from "react";
import { X, Minus, Plus } from "lucide-react";
import { formatNaira } from "@/lib/format";

const BASE_PRICE_NGN = 500; 
const MAX_SIZE = 3;

// Declare PaystackPop globally
// Declare PaystackPop globally with proper types
type PaystackResponse = {
  reference: string;
  status: string;
  trans: string;
  transaction: string;
  message: string;
};

type PaystackOptions = {
  key: string;
  email: string;
  amount: number;
  currency: string;
  ref: string;
  metadata?: Record<string, unknown>;
  callback: (response: PaystackResponse) => void;
  onClose: () => void;
};

type PaystackHandler = {
  openIframe: () => void;
};

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: PaystackOptions) => PaystackHandler;
    };
  }
}

export default function SeaPlotDialog({
  plotId,
  onClose,
}: {
  plotId: string;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(2);
  const [height, setHeight] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const totalPlots = width * height;
  const totalPriceNgn = totalPlots * BASE_PRICE_NGN;
  const totalPriceUsd = (totalPriceNgn / 1450).toFixed(2);

  // Load Paystack script dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setIsReady(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const adjustWidth = (amount: number) => {
    setWidth(Math.max(1, Math.min(MAX_SIZE, width + amount)));
  };

  const adjustHeight = (amount: number) => {
    setHeight(Math.max(1, Math.min(MAX_SIZE, height + amount)));
  };

  const handleCheckout = () => {
    if (!isReady) return;
    setIsSubmitting(true);

    const reference = `sea_plot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        email: "user@example.com", // Replace with the actual logged-in user's email
        amount: totalPriceNgn * 100, // Paystack expects kobo
        currency: "NGN",
        ref: reference,
        metadata: {
          plotId,
          width,
          height,
          type: "sea_plot",
        },
        callback: function (response: PaystackResponse) {
          // Paystack redirects here after successful payment
          // You should verify this on your backend, but for now, we'll redirect to the success page
          window.location.href = `/?billboardPayment=success&billboardPaymentReference=${response.reference}`;
        },
        onClose: function () {
          setIsSubmitting(false);
        },
      });
      handler.openIframe();
    } catch (error) {
      console.error("Paystack error:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-[#1e2329] text-white shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2b3138] text-xl">
              🏞️
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Sea Plots</h2>
              <p className="text-xs text-white/60">
                Rent a patch of Osun water · ₦500 a plot for 7 days
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <p className="px-5 pb-4 text-xs text-white/70">
          Your ad floats on the open water, where every player looks. Tap a spot, then choose its size.
        </p>

        {/* The Visual Grid Area */}
        <div className="relative mx-5 mb-4 flex h-48 w-[calc(100%-2.5rem)] items-center justify-center overflow-hidden rounded-2xl bg-[#1e3a8a]">
          <div className="absolute left-0 top-0 h-full w-1/3 bg-[#84a873]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')] opacity-20" />
          
          <div className="relative z-10 flex flex-col items-center justify-center rounded-md border-2 border-green-400 bg-green-400/20 shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all duration-200"
               style={{ width: `${width * 30}px`, height: `${height * 30}px` }}>
            <span className="text-xs font-bold text-white drop-shadow-md">
              {width}×{height}
            </span>
          </div>
        </div>

        {/* Size Controls */}
        <div className="mx-5 mb-5 flex items-center justify-center gap-6 rounded-2xl bg-[#2b3138] p-3">
          <div className="flex items-center gap-4">
            <button onClick={() => adjustWidth(-1)} disabled={width <= 1} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b424a] hover:bg-[#4b525a] disabled:opacity-50">
              <Minus size={16} />
            </button>
            <div className="text-center">
              <p className="text-lg font-bold leading-none">{width}</p>
              <p className="text-[10px] text-white/50">Wide</p>
            </div>
            <button onClick={() => adjustWidth(1)} disabled={width >= MAX_SIZE} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b424a] hover:bg-[#4b525a] disabled:opacity-50">
              <Plus size={16} />
            </button>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-4">
            <button onClick={() => adjustHeight(-1)} disabled={height <= 1} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b424a] hover:bg-[#4b525a] disabled:opacity-50">
              <Minus size={16} />
            </button>
            <div className="text-center">
              <p className="text-lg font-bold leading-none">{height}</p>
              <p className="text-[10px] text-white/50">Tall</p>
            </div>
            <button onClick={() => adjustHeight(1)} disabled={height >= MAX_SIZE} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b424a] hover:bg-[#4b525a] disabled:opacity-50">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Price summary */}
        <div className="mx-5 mb-5 flex items-center justify-between rounded-xl bg-[#2b3138] px-4 py-3 text-sm font-semibold">
          <span className="text-white/70">{totalPlots} plots · 7 days</span>
          <span>{formatNaira(totalPriceNgn)} <span className="text-xs font-normal text-white/50">or ${totalPriceUsd}</span></span>
        </div>

        {/* Checkout Button */}
        <div className="bg-[#14181c] p-5">
          <button
            onClick={handleCheckout}
            disabled={isSubmitting || !isReady}
            className="w-full rounded-full bg-[#1db954] py-3.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? "Processing..." : `Use these ${totalPlots} plots`}
          </button>
        </div>

      </div>
    </div>
  );
}