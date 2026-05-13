import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Public schema viewer. Serves the stored HTML inline with Content-Type:
 * text/html so every browser (incl. mobile Safari) renders it instead of
 * triggering a download. The URL prospects receive in their email points here.
 *
 *   GET /s/<schema_uuid>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("consulting_schemas")
    .select("html_content,lead_id,consulting_leads(business_name)")
    .eq("id", id)
    .maybeSingle();

  if (debug) {
    return NextResponse.json(
      {
        id,
        found: Boolean(data),
        html_len: data?.html_content?.length ?? 0,
        html_preview: data?.html_content?.slice(0, 200) ?? null,
        error: error ? { message: error.message, code: error.code } : null,
        env_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        has_secret: Boolean(process.env.SUPABASE_SECRET_KEY),
      },
      { status: 200 },
    );
  }

  if (error || !data?.html_content) {
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><title>Schéma introuvable</title><body style="font-family:system-ui;padding:48px;background:#0a0a0f;color:#e6e6ed"><h1>Schéma introuvable</h1><p>Ce lien a expiré ou est invalide.</p><p style="opacity:.6;font-size:12px">id=${id} err=${error?.message ?? "none"}</p></body>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(data.html_content, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
