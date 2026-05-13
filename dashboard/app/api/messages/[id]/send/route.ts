import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const userClient = await createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM ?? "Robin <onboarding@resend.dev>";
  const redirectTo = process.env.RESEND_REDIRECT_TO;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 },
    );
  }

  const service = createSupabaseServiceClient();

  const { data: message, error: msgErr } = await service
    .from("consulting_messages")
    .select("id,lead_id,channel,body,is_approved,sent_at")
    .eq("id", id)
    .maybeSingle();
  if (msgErr || !message) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }
  if (message.channel !== "email") {
    return NextResponse.json(
      { error: "only email messages can be sent via Resend" },
      { status: 400 },
    );
  }
  if (message.is_approved !== true) {
    return NextResponse.json(
      { error: "message must be approved before sending" },
      { status: 400 },
    );
  }
  if (message.sent_at) {
    return NextResponse.json(
      { error: "message already sent at " + message.sent_at },
      { status: 409 },
    );
  }

  const { data: lead, error: leadErr } = await service
    .from("consulting_leads")
    .select("id,business_name,contact_email,contact_name")
    .eq("id", message.lead_id)
    .maybeSingle();
  if (leadErr || !lead) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  const realRecipient = lead.contact_email;
  const effectiveRecipient = redirectTo || realRecipient;
  if (!effectiveRecipient) {
    return NextResponse.json(
      {
        error:
          "no recipient: lead has no contact_email and RESEND_REDIRECT_TO is not set",
      },
      { status: 400 },
    );
  }

  const sandboxPrefix = redirectTo ? "[TEST] " : "";
  const subject = `${sandboxPrefix}${lead.business_name} — quelques observations`;
  const textBody = message.body;

  const resend = new Resend(apiKey);
  const { data: sendResult, error: sendErr } = await resend.emails.send({
    from: fromAddress,
    to: [effectiveRecipient],
    subject,
    text: textBody,
  });

  if (sendErr) {
    await service.from("consulting_pipeline_logs").insert({
      lead_id: message.lead_id,
      agent: "send",
      step: "failed",
      severity: "error",
      message: `Resend send failed: ${sendErr.message}`,
      payload: { message_id: id, to: effectiveRecipient, error: sendErr },
    });
    return NextResponse.json(
      { error: sendErr.message, details: sendErr },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  await service
    .from("consulting_messages")
    .update({ sent_at: now })
    .eq("id", id);
  await service
    .from("consulting_leads")
    .update({ status: "sent", last_contact_at: now })
    .eq("id", message.lead_id);
  await service.from("consulting_pipeline_logs").insert({
    lead_id: message.lead_id,
    agent: "send",
    step: "completed",
    severity: "info",
    message: "Email sent via Resend",
    payload: {
      message_id: id,
      to: effectiveRecipient,
      resend_id: sendResult?.id,
      sandbox: Boolean(redirectTo),
    },
  });

  return NextResponse.json({
    ok: true,
    resend_id: sendResult?.id,
    sent_to: effectiveRecipient,
    sandbox: Boolean(redirectTo),
  });
}
