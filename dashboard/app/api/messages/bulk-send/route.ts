import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

export const maxDuration = 300;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bodyToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#6366f1;text-decoration:underline;">$1</a>',
  );
  return linked
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 14px 0;line-height:1.55;">${para.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function getDashboardOrigin(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_DASHBOARD_URL;
  if (env) return env.replace(/\/+$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

const SEND_INTERVAL_MS = 1500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  const userClient = await createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM ?? "Robin <onboarding@resend.dev>";
  const redirectTo = process.env.RESEND_REDIRECT_TO;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const service = createSupabaseServiceClient();

  const { data: queue, error: selErr } = await service
    .from("consulting_messages")
    .select("id,lead_id,body,is_approved,sent_at,channel")
    .eq("channel", "email")
    .is("sent_at", null)
    .eq("is_approved", true);

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const list = queue ?? [];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0 });
  }

  const origin = getDashboardOrigin(request);
  const resend = new Resend(apiKey);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < list.length; i++) {
    const msg = list[i];

    const { data: lead } = await service
      .from("consulting_leads")
      .select("id,business_name,contact_email")
      .eq("id", msg.lead_id)
      .maybeSingle();

    if (!lead) {
      failed++;
      errors.push(`${msg.id}: lead not found`);
      continue;
    }

    const realRecipient = lead.contact_email;
    const effectiveRecipient = redirectTo || realRecipient;
    if (!effectiveRecipient) {
      failed++;
      errors.push(`${lead.business_name}: pas d'email`);
      continue;
    }

    const sandboxPrefix = redirectTo ? "[TEST] " : "";
    const subject = `${sandboxPrefix}${lead.business_name} — quelques observations`;
    const pixelUrl = `${origin}/api/track/open/${msg.id}.gif`;
    const htmlBody = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1a1a1a;max-width:600px;">
${bodyToHtml(msg.body)}
<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;outline:0;visibility:hidden;width:1px;height:1px;">
</body></html>`;

    const { data: sendResult, error: sendErr } = await resend.emails.send({
      from: fromAddress,
      to: [effectiveRecipient],
      subject,
      text: msg.body,
      html: htmlBody,
    });

    if (sendErr) {
      failed++;
      errors.push(`${lead.business_name}: ${sendErr.message}`);
      await service.from("consulting_pipeline_logs").insert({
        lead_id: msg.lead_id,
        agent: "bulk-send",
        step: "failed",
        severity: "error",
        message: `Resend send failed: ${sendErr.message}`,
        payload: { message_id: msg.id, to: effectiveRecipient },
      });
    } else {
      sent++;
      const nowIso = new Date().toISOString();
      await service
        .from("consulting_messages")
        .update({ sent_at: nowIso, provider_message_id: sendResult?.id ?? null })
        .eq("id", msg.id);
      await service
        .from("consulting_leads")
        .update({ status: "sent", last_contact_at: nowIso })
        .eq("id", msg.lead_id);
      await service.from("consulting_pipeline_logs").insert({
        lead_id: msg.lead_id,
        agent: "bulk-send",
        step: "completed",
        severity: "info",
        message: "Email sent via Resend (bulk)",
        payload: {
          message_id: msg.id,
          to: effectiveRecipient,
          resend_id: sendResult?.id,
          sandbox: Boolean(redirectTo),
        },
      });
    }

    if (i < list.length - 1) await sleep(SEND_INTERVAL_MS);
  }

  return NextResponse.json({ ok: true, sent, failed, errors: errors.slice(0, 20) });
}
