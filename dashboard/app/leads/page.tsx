import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadDashboardRow, LeadStatus } from "@/lib/types";
import { BulkActions } from "./bulk-actions";

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

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

type FilterValue = "all" | "to_validate" | "ready" | "sent" | "opened" | "replied" | "quarantine";

type SortValue = "recent" | "roi" | "confidence" | "opened";

type SearchParams = { filter?: string; sort?: string; q?: string };

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "to_validate", label: "À valider" },
  { value: "ready", label: "À envoyer" },
  { value: "sent", label: "Envoyés" },
  { value: "opened", label: "Ouverts" },
  { value: "replied", label: "Répondus" },
  { value: "quarantine", label: "Quarantine" },
];

const SORTS: { value: SortValue; label: string }[] = [
  { value: "recent", label: "Plus récent" },
  { value: "roi", label: "ROI annuel" },
  { value: "confidence", label: "Confiance" },
  { value: "opened", label: "Dernière ouverture" },
];

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0) return "à l'instant";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d}j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

function matchesFilter(row: LeadDashboardRow, filter: FilterValue): boolean {
  switch (filter) {
    case "to_validate":
      return row.messages_pending_review > 0;
    case "ready":
      return row.messages_approved_unsent > 0;
    case "sent":
      return row.messages_sent_count > 0;
    case "opened":
      return row.messages_opened_count > 0;
    case "replied":
      return row.replies_count > 0 || row.status === "replied";
    case "quarantine":
      return row.status === "quarantine" || row.status === "lost";
    default:
      return true;
  }
}

function sortRows(rows: LeadDashboardRow[], sort: SortValue): LeadDashboardRow[] {
  const copy = [...rows];
  switch (sort) {
    case "roi":
      return copy.sort((a, b) => (b.total_cost_annual ?? 0) - (a.total_cost_annual ?? 0));
    case "confidence":
      return copy.sort((a, b) => Number(b.diag_confidence ?? 0) - Number(a.diag_confidence ?? 0));
    case "opened":
      return copy.sort((a, b) => {
        const ta = a.last_pixel_hit_at ? new Date(a.last_pixel_hit_at).getTime() : 0;
        const tb = b.last_pixel_hit_at ? new Date(b.last_pixel_hit_at).getTime() : 0;
        return tb - ta;
      });
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.lead_created_at).getTime() - new Date(a.lead_created_at).getTime(),
      );
  }
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filter = (params.filter as FilterValue) ?? "all";
  const sort = (params.sort as SortValue) ?? "recent";
  const q = (params.q ?? "").trim().toLowerCase();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("consulting_dashboard")
    .select("*")
    .limit(500);

  const allRows = (data ?? []) as LeadDashboardRow[];

  const totals = {
    total: allRows.length,
    pending: allRows.reduce((s, r) => s + (r.messages_pending_review > 0 ? 1 : 0), 0),
    approvedUnsent: allRows.reduce((s, r) => s + (r.messages_approved_unsent > 0 ? 1 : 0), 0),
    sent: allRows.reduce((s, r) => s + (r.messages_sent_count > 0 ? 1 : 0), 0),
    opened: allRows.reduce((s, r) => s + (r.messages_opened_count > 0 ? 1 : 0), 0),
    replied: allRows.reduce(
      (s, r) => s + (r.replies_count > 0 || r.status === "replied" ? 1 : 0),
      0,
    ),
  };
  const openRate = totals.sent > 0 ? Math.round((totals.opened / totals.sent) * 100) : 0;

  const filtered = allRows.filter((r) => {
    if (!matchesFilter(r, filter)) return false;
    if (q) {
      const hay = `${r.business_name} ${r.business_sector ?? ""} ${r.contact_email ?? ""} ${r.business_url}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const rows = sortRows(filtered, sort);

  const buildQuery = (overrides: Partial<{ filter: FilterValue; sort: SortValue; q: string }>) => {
    const sp = new URLSearchParams();
    const f = overrides.filter ?? filter;
    const s = overrides.sort ?? sort;
    const qq = overrides.q ?? q;
    if (f !== "all") sp.set("filter", f);
    if (s !== "recent") sp.set("sort", s);
    if (qq) sp.set("q", qq);
    const qs = sp.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-10 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {totals.total} lead{totals.total > 1 ? "s" : ""} · {totals.sent} envoyé
          {totals.sent > 1 ? "s" : ""} · {totals.opened} ouvert
          {totals.opened > 1 ? "s" : ""}
          {totals.sent > 0 && ` · taux d'ouverture ${openRate}%`}
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-6">
        <Stat label="Leads" value={totals.total} />
        <Stat label="À valider" value={totals.pending} tone="amber" />
        <Stat label="À envoyer" value={totals.approvedUnsent} tone="indigo" />
        <Stat label="Envoyés" value={totals.sent} tone="emerald" />
        <Stat label="Ouverts" value={totals.opened} tone="cyan" />
        <Stat label="Répondus" value={totals.replied} tone="green" />
      </section>

      <BulkActions
        pendingCount={totals.pending}
        unsentCount={totals.approvedUnsent}
      />

      <nav className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildQuery({ filter: f.value })}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === f.value
                ? "bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <form action="/leads" method="get" className="flex-1 min-w-[200px]">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Recherche entreprise, secteur, email…"
            className="w-full text-xs px-3 py-2 rounded-md bg-[#0f0f17] border border-[var(--border)] focus:border-[var(--accent)]/50 focus:outline-none"
          />
        </form>
        <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
          <span className="mr-1">Tri:</span>
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={buildQuery({ sort: s.value })}
              className={`px-2 py-1 rounded ${
                sort === s.value
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "hover:text-[var(--fg)]"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 mb-6">
          <p className="text-sm text-rose-300">{error.message}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[#0f0f17] p-8 text-center">
          <p className="text-sm text-[var(--muted)]">
            Aucun lead pour ce filtre.
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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="font-medium truncate">{row.business_name}</h2>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[row.status] ?? "bg-gray-500/15 text-gray-300"}`}
                      >
                        {row.status}
                      </span>
                      {row.messages_opened_count > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200"
                          title={`Ouvert ${row.total_pixel_hits}× · dernier hit ${timeAgo(row.last_pixel_hit_at)}`}
                        >
                          Ouvert {timeAgo(row.last_pixel_hit_at) ?? ""}
                        </span>
                      )}
                      {row.replies_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/25 text-green-200">
                          Répondu
                        </span>
                      )}
                      {row.contact_email == null && row.status !== "lost" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">
                          Sans email
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] truncate">
                      {row.business_sector ?? row.inferred_sector ?? "—"} · {row.business_url}
                    </p>
                    {row.contact_email && (
                      <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate">
                        {row.contact_email}
                      </p>
                    )}
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

                {(row.messages_pending_review > 0 ||
                  row.messages_approved_unsent > 0 ||
                  row.messages_sent_count > 0) && (
                  <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
                    {row.messages_pending_review > 0 && (
                      <span className="text-amber-300">
                        {row.messages_pending_review} à valider
                      </span>
                    )}
                    {row.messages_approved_unsent > 0 && (
                      <span className="text-indigo-300">
                        {row.messages_approved_unsent} prêt à envoyer
                      </span>
                    )}
                    {row.messages_sent_count > 0 && (
                      <span className="text-emerald-300">
                        {row.messages_sent_count} envoyé{row.messages_sent_count > 1 ? "s" : ""}
                        {row.last_sent_at && ` · ${timeAgo(row.last_sent_at)}`}
                      </span>
                    )}
                    {row.messages_opened_count > 0 && (
                      <span className="text-cyan-300">
                        {row.total_pixel_hits} hit{row.total_pixel_hits > 1 ? "s" : ""} pixel
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

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "indigo" | "emerald" | "cyan" | "green";
}) {
  const tones: Record<string, string> = {
    default: "text-[var(--fg)]",
    amber: "text-amber-300",
    indigo: "text-indigo-300",
    emerald: "text-emerald-300",
    cyan: "text-cyan-300",
    green: "text-green-300",
  };
  return (
    <div className="rounded-md border border-[var(--border)] bg-[#0f0f17] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className={`text-xl font-semibold mt-0.5 ${tones[tone]}`}>{value}</div>
    </div>
  );
}
