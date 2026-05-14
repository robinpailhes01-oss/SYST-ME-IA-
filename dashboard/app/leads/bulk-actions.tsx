"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Result = {
  ok: boolean;
  approved?: number;
  sent?: number;
  failed?: number;
  errors?: string[];
};

export function BulkActions({
  pendingCount,
  unsentCount,
}: {
  pendingCount: number;
  unsentCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approve" | "send" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approveAll() {
    if (pendingCount === 0) return;
    if (!confirm(`Approuver les ${pendingCount} mail(s) en attente ?`)) return;
    setBusy("approve");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/messages/bulk-approve", { method: "POST" });
      const body = (await res.json()) as Result;
      if (!res.ok) throw new Error((body as { error?: string }).error || "Erreur");
      setResult(body);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  async function sendQueue() {
    if (unsentCount === 0) return;
    const confirmMsg =
      `Envoyer ${unsentCount} mail(s) approuvé(s) via Resend ?\n\n` +
      "Délai 1.5s entre chaque pour rester sous les limites Resend.";
    if (!confirm(confirmMsg)) return;
    setBusy("send");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/messages/bulk-send", { method: "POST" });
      const body = (await res.json()) as Result;
      if (!res.ok) throw new Error((body as { error?: string }).error || "Erreur");
      setResult(body);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  if (pendingCount === 0 && unsentCount === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-[var(--border)] bg-[#0f0f17] p-3 flex flex-wrap items-center gap-3">
      <span className="text-xs text-[var(--muted)]">Actions en lot:</span>

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={approveAll}
          disabled={busy !== null || pending}
          className="text-xs px-3 py-1.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50"
        >
          {busy === "approve" ? "Approbation…" : `Approuver tout (${pendingCount})`}
        </button>
      )}

      {unsentCount > 0 && (
        <button
          type="button"
          onClick={sendQueue}
          disabled={busy !== null || pending}
          className="text-xs px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          {busy === "send" ? "Envoi…" : `Envoyer la file (${unsentCount})`}
        </button>
      )}

      {result && (
        <span className="text-xs text-emerald-300">
          {result.approved != null && `${result.approved} approuvé(s)`}
          {result.sent != null && `${result.sent} envoyé(s)`}
          {result.failed ? ` · ${result.failed} échec(s)` : ""}
        </span>
      )}

      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}
