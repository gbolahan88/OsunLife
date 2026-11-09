"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function ReportUserDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit.");
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-1100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-[#1a1a1a] p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">🚔 Report a User</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-2xl">✅</p>
            <p className="text-sm font-bold">Report submitted.</p>
            <p className="text-xs text-white/60">
              The police will review it. Multiple reports may flag the offender.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-full bg-[#20b978] py-2.5 text-sm font-bold"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-white/70">
                Their username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. zhili8"
                className="w-full rounded-xl bg-[#2a2a2a] px-3 py-2 text-sm outline-none placeholder:text-white/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-white/70">
                What did they do?
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Scam, harassment, offensive content..."
                className="w-full resize-none rounded-xl bg-[#2a2a2a] px-3 py-2 text-sm outline-none placeholder:text-white/30"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold text-red-300">
                {error}
              </p>
            )}
            <button
              onClick={submit}
              disabled={busy || !username.trim() || !reason.trim()}
              className="w-full rounded-full bg-[#bd783c] py-2.5 text-sm font-bold disabled:opacity-40"
            >
              {busy ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}