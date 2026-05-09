#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Smoke test — runs the full pipeline against the 3 fictitious leads.
# Prereqs:
#   - All 6 workflows imported and ACTIVE in n8n.cloud
#   - Env vars set in n8n (ANTHROPIC_API_KEY, SUPABASE_*, WEBHOOK_SECRET)
#   - Below: set N8N_BASE and WEBHOOK_SECRET to match your instance
# ---------------------------------------------------------------------
set -euo pipefail

N8N_BASE="${N8N_BASE:-https://YOUR-INSTANCE.app.n8n.cloud}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:?must be set}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (apt install jq | brew install jq)"; exit 1
fi

echo "==> Test 1/3: full orchestrator on each lead"
jq -c '.[]' tests/test_leads.json | while read -r lead; do
  name=$(echo "$lead" | jq -r '.business_name')
  echo "  → $name"
  curl -sS -X POST "$N8N_BASE/webhook/consulting/orchestrator" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: $WEBHOOK_SECRET" \
    -d "$lead" \
    | jq '{status, lead_id, confidence, next_step}'
  echo
done

echo "==> Test 2/3: re-run on the same lead (idempotency check)"
first_lead=$(jq -c '.[0]' tests/test_leads.json)
curl -sS -X POST "$N8N_BASE/webhook/consulting/orchestrator" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d "$first_lead" \
  | jq '{status, lead_id, note: "should reuse existing lead, append a fresh diagnostic"}'

echo
echo "==> Test 3/3: bad payload (missing sector)"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST "$N8N_BASE/webhook/consulting/diagnoser" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"business_name":"Bad","business_url":"https://example.com"}'

echo
echo "✓ Smoke run done. Inspect Supabase tables:"
echo "  - consulting_leads (status: should be 'message_ready' or 'quarantine')"
echo "  - consulting_diagnostics (3+ rows)"
echo "  - consulting_schemas (open public_url in browser to QA visuals)"
echo "  - consulting_messages (2 per lead: email + instagram)"
echo "  - consulting_pipeline_logs (audit trail)"
