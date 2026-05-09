# AI Consulting Pipeline — multi-agents

Pipeline complet pour transformer une URL d'entreprise en (1) diagnostic personnalisé,
(2) schéma d'architecture AI visuel, (3) message de prospection prêt à valider.

Stack : **n8n.cloud + Claude API + Supabase**. Solo-friendly, mobile-first, async.

> Référence terrain : Harmonie Yacht (réservations yacht de luxe). Aucun outil
> technique n'est mentionné dans les livrables prospects — on parle uniquement de
> résultats.

## Structure du repo

```
.
├── ARCHITECTURE.md              ← lis ça en premier (Phase 1: réflexion + risques)
├── README.md                    ← ce fichier (déploiement step-by-step)
├── supabase/
│   └── schema.sql               ← tables consulting_*, RLS, vue dashboard
├── n8n/
│   ├── workflow_scout_manual.json     ← entrée manuelle des leads
│   ├── workflow_diagnoser.json        ← agent #1 — analyse business
│   ├── workflow_schema_builder.json   ← agent #2 — génère HTML visuel
│   ├── workflow_pitcher.json          ← agent #3 — drafts email + DM
│   ├── workflow_checker.json          ← quality gate
│   └── workflow_orchestrator.json     ← enchaîne tout
└── tests/
    ├── test_leads.json          ← 3 leads fictifs (hôtel, dentiste, immobilier)
    └── run_smoke.sh             ← script de smoke test
```

## Déploiement — étapes

### 1. Supabase (≈ 5 min)

1. Crée un nouveau projet Supabase (ou utilise un existant — les tables sont préfixées `consulting_`).
2. SQL Editor → **New query** → colle `supabase/schema.sql` → **Run**.
3. Storage → **New bucket** → name `consulting-schemas` → **Public** ✅ → file size 5 MB.
4. Récupère :
   - `Settings → API → Project URL` (ton `SUPABASE_URL`)
   - `Settings → API → service_role` (ton `SUPABASE_SERVICE_KEY`) ⚠️ jamais exposé côté client
   - URL publique du bucket : `https://xxxxx.supabase.co/storage/v1/object/public/consulting-schemas`

### 2. n8n.cloud (≈ 15 min)

1. **Settings → Variables** → ajoute :
   ```
   ANTHROPIC_API_KEY    sk-ant-...
   ANTHROPIC_MODEL      claude-sonnet-4-6
   SUPABASE_URL         https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY eyJ...
   STORAGE_BUCKET_URL   https://xxxxx.supabase.co/storage/v1/object/public/consulting-schemas
   WEBHOOK_SECRET       <génère un random 32 chars : openssl rand -hex 16>
   N8N_BASE_URL         https://YOUR-INSTANCE.app.n8n.cloud
   MAX_LEADS_PER_HOUR   20
   MIN_CONFIDENCE_AUTO  0.6
   ALERT_EMAIL          robin@...
   ```
2. **Workflows → Import from File** pour chacun des 6 JSON dans `n8n/`. Importe dans cet ordre :
   1. `workflow_scout_manual.json`
   2. `workflow_diagnoser.json`
   3. `workflow_schema_builder.json`
   4. `workflow_pitcher.json`
   5. `workflow_checker.json`
   6. `workflow_orchestrator.json`
3. Pour chaque workflow : ouvre-le → vérifie qu'aucun node n'a d'erreur de credentials (les workflows utilisent uniquement les variables d'env, pas de credentials n8n stockés). **Active** chaque workflow.
4. Note les URLs des webhooks (visibles dans le node Webhook de chaque workflow).

### 3. Smoke test (≈ 2 min)

```bash
export N8N_BASE="https://YOUR-INSTANCE.app.n8n.cloud"
export WEBHOOK_SECRET="<le même random qu'en step 2>"

./tests/run_smoke.sh
```

Le script lance les 3 leads fictifs à travers l'Orchestrateur et imprime les statuts.

## Comment piloter au quotidien

### Pour ajouter un lead manuel

```bash
curl -X POST "$N8N_BASE/webhook/consulting/orchestrator" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{
    "business_name": "Boulangerie Maeva",
    "business_url": "https://boulangerie-maeva.fr",
    "business_sector": "restauration"
  }'
```

Réponse attendue : `{ "status": "ok", "lead_id": "...", "next_step": "Awaiting human approval before send" }`.

Le pipeline tourne ~30-90 secondes (3 appels Claude + scrape + uploads).

### Pour valider un message avant envoi

Depuis Supabase Studio ou un dashboard mobile (Lovable, à venir Sprint 4) :

```sql
-- voir tous les messages prêts à envoyer
select id, lead_id, channel, body, checker_passed, checker_report
from consulting_messages
where is_approved is null and sent_at is null
order by created_at desc;

-- approuver un message (ne l'envoie pas — c'est juste un go pour copier/coller)
update consulting_messages set is_approved = true where id = '...';
```

Puis copie/colle le `body` dans Gmail / Instagram DM. **Pas d'envoi auto en v1.**

### Pour suivre le pipeline

Vue agrégée :

```sql
select * from consulting_dashboard order by lead_created_at desc limit 50;
```

Audit complet d'un lead :

```sql
select agent, step, severity, message, payload, created_at
from consulting_pipeline_logs
where lead_id = '...'
order by created_at;
```

## Coûts API — par lead

Calculé sur Claude Sonnet 4 (tarifs 2026 : $3/M input, $15/M output).

| Étape | Tokens in | Tokens out | Coût |
|---|---|---|---|
| Diagnoser | ~4000 | ~1000 | $0.027 |
| Schema Builder | ~700 | ~3500 | $0.055 |
| Pitcher | ~500 | ~400 | $0.008 |
| Checker (regex only, 0 LLM) | 0 | 0 | $0.000 |
| **Total** | | | **~$0.09** |

**Marge de sécurité** (retries, drafts régénérés) : budget **$0.15 / lead**.

À 1000 leads/mois : ~$150/mois de Claude. Cap technique en place : `MAX_LEADS_PER_HOUR=20`.

## Plan de build progressif

| Sprint | Période | Livrable | Test de validation |
|---|---|---|---|
| 1 | J1-J2 | Diagnoser fonctionnel via webhook | 5 URLs réelles → JSON exploitable |
| 2 | J3-J4 | Schema Builder | 3 secteurs → screenshots OK sur mobile |
| 3 | J5-J6 | Pitcher + Checker | Pipeline Diagnoser→Schema→Pitcher enchaîné |
| 4 | S2 | Orchestrateur + dashboard mobile | Première prospection réelle |

## Risques & garde-fous (résumé)

Détails complets dans `ARCHITECTURE.md`.

- **Anti-bot scraping** : fallback en mode "secteur seul" → confidence < 0.6 → quarantine.
- **JSON malformé Claude** : 1 retry auto. Si 2e échec → quarantine + log critical.
- **Doublons** : contrainte unique `business_url` + check `last_contact_at + 60j`.
- **Rate limit** : `MAX_LEADS_PER_HOUR` lu par l'Orchestrateur, qui refuse de démarrer.
- **Prompt injection** : contenu scraped wrappé entre délimiteurs `---SCRAPED CONTENT START---`.

## Ce qu'on ne fait PAS en v1

- Scout auto (Apollo / scraping LinkedIn) → on commence en manuel.
- Sender automatique → on copie/colle, pour préserver la qualité avant scale.
- A/B testing prompts → itération manuelle.
- Multi-langue → FR uniquement.

À ajouter une fois 50 leads passés en stable.

## Licence & confidentialité

Repo privé. Aucune clé en dur. Tous les secrets passent par `n8n vars` ou Supabase env.
