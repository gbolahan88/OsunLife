"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  BILLBOARD_AD_DAYS,
  BILLBOARD_MAX_FILE_SIZE,
  BILLBOARD_PRICES,
  type BillboardAdType,
} from "@/lib/billboard-ads";
import { formatNaira } from "@/lib/format";

export default function BillboardAdDialog({
  boardName,
  boardId,
  onClose,
}: {
  boardName: string;
  boardId: string;
  onClose: () => void;
}) {
  const [adType, setAdType] = useState<BillboardAdType>("image");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  function chooseType(type: BillboardAdType) {
    setAdType(type);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose the image or video you want to advertise.");
      return;
    }
    if (file.size > BILLBOARD_MAX_FILE_SIZE) {
      setError("Choose a file smaller than 30 MB.");
      return;
    }
    if (adType === "image" && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (adType === "video" && !["video/mp4", "video/webm"].includes(file.type)) {
      setError("Use an MP4 or WebM video.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("boardId", boardId);
      form.set("adType", adType);
      form.set("file", file);
      const response = await fetch("/api/billboards/initialize", { method: "POST", body: form });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("authorizationUrl" in result) ||
        typeof result.authorizationUrl !== "string"
      ) {
        const message =
          typeof result === "object" && result !== null && "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not start payment. Please try again.";
        throw new Error(message);
      }
      window.location.assign(result.authorizationUrl);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not start payment. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="billboard-ad-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141f2b] p-5 text-white shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Paid promotion</p>
            <h2 id="billboard-ad-title" className="mt-1 text-xl font-extrabold">Advertise on this billboard</h2>
            <p className="mt-1 truncate text-sm text-white/60">{boardName}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={submitting}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {(["image", "video"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => chooseType(type)}
              aria-pressed={adType === type}
              className={`rounded-2xl border p-3 text-left ${
                adType === type ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5"
              }`}
            >
              <span className="block font-bold">{type === "image" ? "🖼️ Image flyer" : "🎬 Short video"}</span>
              <span className="mt-1 block text-sm text-white/65">{formatNaira(BILLBOARD_PRICES[type])} · {BILLBOARD_AD_DAYS} days</span>
            </button>
          ))}
        </div>

        <form className="mt-4" onSubmit={(event) => void submit(event)}>
          <label
            htmlFor="billboard-file"
            className="flex min-h-32 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/5 p-3 text-center"
          >
            {previewUrl && adType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Selected flyer preview" className="max-h-44 max-w-full rounded-xl object-contain" />
            ) : previewUrl && adType === "video" ? (
              <video src={previewUrl} controls muted playsInline className="max-h-44 max-w-full rounded-xl" />
            ) : (
              <>
                <span className="text-3xl">{adType === "image" ? "🖼️" : "🎬"}</span>
                <span className="mt-2 text-sm font-bold">Choose your {adType === "image" ? "flyer" : "video"}</span>
                <span className="mt-1 text-xs text-white/50">
                  {adType === "image" ? "JPG, PNG, or WebP" : "MP4 or WebM"} · Up to 30 MB
                </span>
              </>
            )}
          </label>
          <input
            id="billboard-file"
            type="file"
            accept={adType === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"}
            className="sr-only"
            onChange={(event) => {
                const nextFile = event.currentTarget.files?.[0] ?? null;
                setFile(nextFile);
                setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
                setError(null);
              }}
          />
          {file && <p className="mt-2 truncate text-center text-xs text-white/60">{file.name}</p>}

          <p className="mt-4 text-xs leading-5 text-white/55">
            Your ad appears on this billboard and rotates with other ads for {BILLBOARD_AD_DAYS} days after payment.
            Paystack checkout securely charges {formatNaira(BILLBOARD_PRICES[adType])}.
          </p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[#17a05d] text-sm font-extrabold hover:bg-[#1bb468] disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "Preparing secure checkout…" : `Pay ${formatNaira(BILLBOARD_PRICES[adType])} with Paystack`}
          </button>
        </form>
      </section>
    </div>
  );
}
