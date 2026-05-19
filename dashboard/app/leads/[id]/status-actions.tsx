"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "sent" | "replied" | "won" | "lost" | "quarantine";

const BUTTONS: { value: Status; label: string; emoji: string; cls: string }[] = [
  {
    value: "replied",
    label: "A répondu",
    emoji: "💬",
    cls: "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
  },
  {
    value: "won",
    label: "Signé",
    emoji: "✅",
    cls: "bg-green-500/20 text-green-200 hover:bg-green-500/30",
  },
  {
    value: "lost",
    label: "Perdu",
    emoji: "✗",
    cls: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25",
  },
];

export function StatusActions({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Status | null>(null);

  async function setStatus(next: Status) {
    if (busy) return;
    setBusy(next);
    const res = await fetch(`/api/leads/${leadId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Erreur: ${j.error ?? res.statusText}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  const isFinal = currentStatus === "won" || currentStatus === "lost" || currentStatus === "replied";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {BUTTONS.filter((b) => b.value !== currentStatus).map((b) => (
        <button
          key={b.value}
          type="button"
          onClick={() => setStatus(b.value)}
          disabled={pending || busy !== null}
          className={`text-xs px-2.5 py-1 rounded ${b.cls} disabled:opacity-50 transition`}
          title={`Marquer ce lead comme « ${b.label} »`}
        >
          {b.emoji} {b.label}
        </button>
      ))}
      {isFinal && (
        <button
          type="button"
          onClick={() => setStatus("sent")}
          disabled={pending || busy !== null}
          className="text-xs px-2.5 py-1 rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--border)]/50 disabled:opacity-50 transition"
          title="Revenir au statut 'envoyé'"
        >
          ↺ Réinitialiser
        </button>
      )}
    </div>
  );
}
