"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ApproveButton({
  messageId,
  initialApproved,
}: {
  messageId: string;
  initialApproved: boolean | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approved, setApproved] = useState(initialApproved);

  async function call(value: boolean) {
    setApproved(value);
    const res = await fetch(`/api/messages/${messageId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_approved: value }),
    });
    if (!res.ok) {
      setApproved(initialApproved);
      const j = await res.json().catch(() => ({}));
      alert(`Erreur: ${j.error ?? res.statusText}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  if (approved === true) {
    return (
      <button
        type="button"
        onClick={() => call(false)}
        disabled={pending}
        className="text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
      >
        Retirer approbation
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => call(true)}
        disabled={pending}
        className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
      >
        Approuver
      </button>
      {approved !== false && (
        <button
          type="button"
          onClick={() => call(false)}
          disabled={pending}
          className="text-xs px-2 py-1 rounded text-[var(--muted)] hover:text-rose-300 disabled:opacity-50"
        >
          Rejeter
        </button>
      )}
    </div>
  );
}
