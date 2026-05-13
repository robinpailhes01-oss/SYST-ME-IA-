import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Diagnostic, Lead, Message, Schema } from "@/lib/types";
import { ApproveButton } from "./approve-button";
import { OpenInGmail } from "./open-in-gmail";

export const dynamic = "force-dynamic";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: lead }, { data: diagnostics }, { data: schemas }, { data: messages }] =
    await Promise.all([
      supabase.from("consulting_leads").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("consulting_diagnostics")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("consulting_schemas")
        .select("id,lead_id,diagnostic_id,public_url,created_at")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("consulting_messages")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!lead) notFound();

  const typedLead = lead as Lead;
  const diagnostic = (diagnostics?.[0] ?? null) as Diagnostic | null;
  const schema = (schemas?.[0] ?? null) as Pick<Schema, "id" | "lead_id" | "diagnostic_id" | "public_url" | "created_at"> | null;
  const allMessages = (messages ?? []) as Message[];

  const tasks = (diagnostic?.raw_response?.tasks ?? []).slice(0, 5);
  const accentColor = diagnostic?.schema_accent_color ?? "#f97316";

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <Link href="/leads" className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">
          ← Pipeline
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-semibold">{typedLead.business_name}</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {typedLead.business_sector ?? "—"} ·{" "}
              <a
                href={typedLead.business_url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2"
              >
                {typedLead.business_url}
              </a>
            </p>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border)] text-[var(--fg)]">
            {typedLead.status}
          </span>
        </div>
      </header>

      {diagnostic && (
        <section className="mb-8">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Metric label="Confidence" value={`${((diagnostic.confidence ?? 0) * 100).toFixed(0)}%`} />
            <Metric label="Heures/sem" value={`${diagnostic.total_hours_lost_weekly ?? "—"}h`} />
            <Metric label="Coût annuel" value={diagnostic.total_cost_annual ? EUR.format(diagnostic.total_cost_annual) : "—"} />
          </div>

          {diagnostic.pitch_hook && (
            <blockquote className="border-l-2 pl-3 py-1 mb-4 text-sm italic text-[var(--fg)]" style={{ borderColor: accentColor }}>
              « {diagnostic.pitch_hook} »
            </blockquote>
          )}

          <h2 className="text-sm font-medium mb-2 text-[var(--muted)]">
            Tâches automatisables ({tasks.length})
          </h2>
          <ul className="space-y-2">
            {tasks.map((task, i) => (
              <li
                key={i}
                className="rounded-md border border-[var(--border)] bg-[#0f0f17] p-3"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="font-medium text-sm">
                    {task.rank}. {task.name}
                  </div>
                  <div className="text-xs text-[var(--muted)] shrink-0">
                    {task.hours_lost_weekly}h/sem · {EUR.format(task.annual_cost_eur)}/an
                  </div>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">{task.automation_solution}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {schema && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-[var(--muted)]">Schéma visuel</h2>
            <a
              href={`/s/${schema.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Ouvrir dans un nouvel onglet ↗
            </a>
          </div>
          <iframe
            src={`/s/${schema.id}`}
            className="w-full h-[600px] rounded-md border border-[var(--border)] bg-white"
            title={`Schéma ${typedLead.business_name}`}
          />
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3 text-[var(--muted)]">
          Messages ({allMessages.length})
        </h2>

        {allMessages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Aucun message généré pour ce lead.</p>
        ) : (
          <ul className="space-y-4">
            {allMessages.map((msg) => (
              <MessageCard key={msg.id} message={msg} lead={typedLead} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[#0f0f17] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function MessageCard({ message, lead }: { message: Message; lead: Lead }) {
  const channelLabel = message.channel === "email" ? "📧 Email" : "💬 Instagram";
  const statusBadge = message.sent_at
    ? { text: "envoyé", cls: "bg-emerald-500/15 text-emerald-300" }
    : message.is_approved === true
      ? { text: "approuvé", cls: "bg-amber-500/15 text-amber-300" }
      : message.is_approved === false
        ? { text: "rejeté", cls: "bg-rose-500/15 text-rose-300" }
        : { text: "à valider", cls: "bg-blue-500/15 text-blue-300" };

  const showGmailButton = message.channel === "email" && message.is_approved === true;

  return (
    <li className="rounded-md border border-[var(--border)] bg-[#0f0f17] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{channelLabel}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusBadge.cls}`}>
            {statusBadge.text}
          </span>
          {message.word_count != null && (
            <span className="text-[10px] text-[var(--muted)]">{message.word_count} mots</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showGmailButton && (
            <OpenInGmail
              body={message.body}
              to={lead.contact_email}
              businessName={lead.business_name}
            />
          )}
          <ApproveButton messageId={message.id} initialApproved={message.is_approved} />
        </div>
      </div>

      <pre className="whitespace-pre-wrap text-sm text-[var(--fg)] font-sans">
        {message.body}
      </pre>

      {message.checker_report?.failed_rules && message.checker_report.failed_rules.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--muted)]">
          ⚠️ Checker: {message.checker_report.failed_rules.join(", ")}
        </div>
      )}
    </li>
  );
}
