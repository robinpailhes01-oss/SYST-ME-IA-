import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

export async function POST() {
  const userClient = await createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = createSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  const { data: pending, error: selErr } = await service
    .from("consulting_messages")
    .select("id")
    .is("is_approved", null);

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  const ids = (pending ?? []).map((m) => m.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, approved: 0 });
  }

  const { error: updErr } = await service
    .from("consulting_messages")
    .update({ is_approved: true })
    .in("id", ids);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await service.from("consulting_pipeline_logs").insert({
    agent: "bulk-approve",
    step: "completed",
    severity: "info",
    message: `Bulk approved ${ids.length} message(s)`,
    payload: { message_ids: ids, at: nowIso },
  });

  return NextResponse.json({ ok: true, approved: ids.length });
}
