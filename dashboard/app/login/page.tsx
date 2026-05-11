"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-2">Pipeline AI Consulting</h1>
        <p className="text-sm text-[var(--muted)] mb-8">
          Connexion par lien magique. Tu reçois un email, tu cliques, c'est tout.
        </p>

        {status === "sent" ? (
          <div className="rounded-md border border-[var(--border)] bg-[#0f0f17] p-4">
            <p className="text-sm">
              ✓ Email envoyé à <span className="font-mono">{email}</span>. Clique le lien
              pour te connecter.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.fr"
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f17] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-md bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-black disabled:opacity-50"
            >
              {status === "sending" ? "Envoi…" : "Envoyer le lien"}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-400">{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
