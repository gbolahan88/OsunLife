"use client";

import { useState, useRef } from "react";
import { X, ImagePlus } from "lucide-react";
import { formatNaira } from "@/lib/format";

const BASE_PRICE_NGN = 500;

export default function SeaPlotDialog({
  plotId,
  width,
  height,
  onClose,
}: {
  plotId: string;
  width: number;
  height: number;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPriceNgn = width * height * BASE_PRICE_NGN;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = async () => {
    if (!file) return alert("Please add a picture.");
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("plotId", plotId);
    formData.append("width", width.toString());
    formData.append("height", height.toString());
    formData.append("linkUrl", linkUrl);
    formData.append("file", file);

    try {
      const res = await fetch("/api/billboards/initialize-plot", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.authorizationUrl) throw new Error(data.error);
      
      // Redirect to Paystack
      window.location.href = data.authorizationUrl;
    } catch (err) {
      console.error(err);
      alert("Failed to start payment.");
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

        <div className="px-5 pb-4 overflow-y-auto scrollbar-hide">
          {/* Image Upload Area */}
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative mb-4 flex h-48 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-[#35a6d9] hover:bg-[#2d90be] transition"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-white">
                <ImagePlus size={32} className="mb-2" />
                <p className="font-bold">Add your picture</p>
                <p className="text-xs opacity-80">{width}×{height} plots · logo, flyer or product</p>
              </div>
            )}
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block text-white/70">What are you selling?</label>
              <input 
                type="text" 
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Mama Tee's Small Chops"
                className="w-full rounded-xl bg-[#2b3138] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-[#1db954]" 
              />
            </div>

            <div>
              <label className="mb-1 block text-white/70">Link</label>
              <input 
                type="url" 
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://instagram.com/yourbrand"
                className="w-full rounded-xl bg-[#2b3138] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-[#1db954]" 
              />
              <p className="mt-1 text-[10px] text-white/50">
                Players who tap your plot go here (WhatsApp, Instagram, your site...).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-[#14181c] p-5">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !file}
            className="w-full rounded-full bg-[#2b3138] py-3.5 text-sm font-bold text-white/50 transition disabled:opacity-50 enabled:bg-[#1db954] enabled:text-white hover:enabled:scale-[1.02]"
          >
            {isSubmitting ? "Processing..." : `Pay ${formatNaira(totalPriceNgn)}`}
          </button>
          <p className="mt-3 text-center text-[10px] text-white/40">
            Secure payment by Paystack. Ads that break our rules are taken down without a refund.
          </p>
        </div>

      </div>
    </div>
  );
}