import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadDashboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-gray-500/15 text-gray-300",
  diagnosing: "bg-blue-500/15 text-blue-300",
  diagnosed: "bg-cyan-500/15 text-cyan-300",
  schema_ready: "bg-indigo-500/15 text-indigo-300",
  message_ready: "bg-amber-500/15 text-amber-300",
  sent: "bg-emerald-500/15 text-emerald-300",
  replied: "bg-emerald-500/25 text-emerald-200",
  won: "bg-green-500/25 text-green-200",
  lost: "bg-rose-500/15 text-rose-300",
  quarantine: "bg-yellow-500/15 text-yellow-300",
};

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function LeadsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("consulting_dashboard")
    .select("*")
    .order("lead_created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as LeadDashboardRow[];

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-10 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {rows.length} lead{rows.length > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 mb-6">
          <p className="text-sm text-rose-300">{error.message}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[#0f0f17] p-8 text-center">
          <p className="text-sm text-[var(--muted)]">
            Aucun lead pour le moment. Lance un workflow Diagnoser depuis n8n pour
            voir des prospects apparaître ici.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.lead_id}>
              <Link
                href={`/leads/${row.lead_id}`}
                className="block rounded-md border border-[var(--border)] bg-[#0f0f17] p-4 hover:border-[var(--accent)]/40 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-medium truncate">{row.business_name}</h2>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[row.status] ?? "bg-gray-500/15 text-gray-300"}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] truncate">
                      {row.business_sector ?? "—"} · {row.business_url}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {row.total_cost_annual != null && (
                      <div className="text-sm font-medium">
                        {EUR.format(row.total_cost_annual)}/an
                      </div>
                    )}
                    {row.diag_confidence != null && (
                      <div className="text-xs text-[var(--muted)] mt-0.5">
                        conf. {(Number(row.diag_confidence) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>

                {(row.messages_pending_review > 0 || row.messages_sent_count > 0) && (
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    {row.messages_pending_review > 0 && (
                      <span className="text-amber-300">
                        {row.messages_pending_review} message{row.messages_pending_review > 1 ? "s" : ""} à valider
                      </span>
                    )}
                    {row.messages_sent_count > 0 && (
                      <span className="text-emerald-300">
                        {row.messages_sent_count} envoyé{row.messages_sent_count > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
