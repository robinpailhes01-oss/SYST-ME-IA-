import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["sent", "replied", "won", "lost", "quarantine"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !ALLOWED.has(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...ALLOWED].join(", ")}` },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("consulting_leads")
    .update({ status: body.status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
