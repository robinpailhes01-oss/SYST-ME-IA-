import { type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(PIXEL_GIF.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cleanId = id.replace(/\.gif$/i, "");

  if (!UUID_RE.test(cleanId)) {
    return new Response(PIXEL_GIF, { status: 200, headers: PIXEL_HEADERS });
  }

  const ua = request.headers.get("user-agent") ?? "";
  const looksLikeBot = /GoogleImageProxy|YahooMailProxy|bingbot|crawl/i.test(ua);

  if (!looksLikeBot) {
    const service = createSupabaseServiceClient();
    const nowIso = new Date().toISOString();

    const { data: existing } = await service
      .from("consulting_messages")
      .select("id,opened_at,opened_count,lead_id")
      .eq("id", cleanId)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {
        opened_count: (existing.opened_count ?? 0) + 1,
        last_opened_at: nowIso,
      };
      if (!existing.opened_at) updates.opened_at = nowIso;

      await service.from("consulting_messages").update(updates).eq("id", cleanId);

      if (!existing.opened_at) {
        await service.from("consulting_pipeline_logs").insert({
          lead_id: existing.lead_id,
          agent: "tracker",
          step: "opened",
          severity: "info",
          message: "Email pixel first hit",
          payload: { message_id: cleanId, user_agent: ua.slice(0, 200) },
        });
      }
    }
  }

  return new Response(PIXEL_GIF, { status: 200, headers: PIXEL_HEADERS });
}
