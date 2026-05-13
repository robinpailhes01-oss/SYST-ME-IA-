"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SendButton({
  messageId,
  alreadySent,
}: {
  messageId: string;
  alreadySent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(alreadySent);

  async function send() {
    if (
      !confirm(
        "Envoyer ce mail maintenant via Resend ? L'action est définitive.",
      )
    )
      return;
    const res = await fetch(`/api/messages/${messageId}/send`, {
      method: "POST",
    });
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      sent_to?: string;
      sandbox?: boolean;
    };
    if (!res.ok || !j.ok) {
      alert(`Erreur envoi : ${j.error ?? res.statusText}`);
      return;
    }
    setDone(true);
    alert(
      `Mail envoyé à ${j.sent_to}${j.sandbox ? " (mode sandbox)" : ""}.`,
    );
    startTransition(() => router.refresh());
  }

  if (done) {
    return (
      <span className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 inline-flex items-center gap-1">
        ✓ Envoyé
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={pending}
      className="text-xs px-2 py-1 rounded bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 disabled:opacity-50 inline-flex items-center gap-1"
    >
      ✉️ Envoyer via Resend
    </button>
  );
}
