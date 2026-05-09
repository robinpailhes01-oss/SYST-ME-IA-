# Déploiement live — récap

> Tout est déjà créé dans ton n8n.cloud (`https://robinplhs.app.n8n.cloud`) et ton Supabase
> (`consulting-pipeline`). Il te reste **2 credentials à créer** dans n8n.

## Workflows déployés

| Workflow | ID n8n | URL d'édition |
|---|---|---|
| `consulting_scout_manual` | `AoyBLoZd2zChidrl` | https://robinplhs.app.n8n.cloud/workflow/AoyBLoZd2zChidrl |
| `consulting_diagnoser` (V2) | `MK3wV0QNL5fi6VHs` | https://robinplhs.app.n8n.cloud/workflow/MK3wV0QNL5fi6VHs |
| `consulting_schema_builder` | `7t5R5KJfqVLdi2kP` | https://robinplhs.app.n8n.cloud/workflow/7t5R5KJfqVLdi2kP |
| `consulting_pitcher` | `DiLAk2ukrPdWnuNu` | https://robinplhs.app.n8n.cloud/workflow/DiLAk2ukrPdWnuNu |
| `consulting_checker` | `zSOQgrPROE9jvmK5` | https://robinplhs.app.n8n.cloud/workflow/zSOQgrPROE9jvmK5 |
| `consulting_orchestrator` | `SHto1ZdNvM9FQouq` | https://robinplhs.app.n8n.cloud/workflow/SHto1ZdNvM9FQouq |

Tous sont rangés dans le projet `My project` (team). Tu peux les déplacer dans
un projet dédié `consulting-pipeline` via le drag-drop n8n quand tu veux —
**ne renomme pas les workflows**, l'Orchestrateur appelle les autres par URL
de webhook (le nom n'a pas d'impact, juste pour info).

## Webhook secret

```
e0ba5051c783046df4c03edd65b45bc7dfb7c106e132b791
```

Hardcodé dans 6 Code nodes (`Validate Input` de chaque workflow) et 4 HTTP nodes
de l'Orchestrateur. Si tu le changes, modifie partout. Sinon, mets-le dans un
gestionnaire de mots de passe et utilise-le pour tous tes `curl`.

## Webhooks publics

```
POST https://robinplhs.app.n8n.cloud/webhook/consulting/orchestrator
POST https://robinplhs.app.n8n.cloud/webhook/consulting/diagnoser
POST https://robinplhs.app.n8n.cloud/webhook/consulting/schema-builder
POST https://robinplhs.app.n8n.cloud/webhook/consulting/pitcher
POST https://robinplhs.app.n8n.cloud/webhook/consulting/checker
POST https://robinplhs.app.n8n.cloud/webhook/consulting/scout-manual
```

Chaque appel doit contenir le header :
```
x-webhook-secret: e0ba5051c783046df4c03edd65b45bc7dfb7c106e132b791
```

## Credentials à créer (2)

### 1. `Anthropic API` (type : HTTP Header Auth)

n8n.cloud → **Credentials → New Credential → HTTP Header Auth** :

| Champ | Valeur |
|---|---|
| Name (côté credential) | `Anthropic API` |
| Header Name | `x-api-key` |
| Header Value | `sk-ant-...` (ta clé Anthropic) |

→ utilisée par les 4 nodes Claude (Diagnoser Step 1, Diagnoser Step 2, Schema Generator, Pitcher).

### 2. `Supabase consulting-pipeline` (type : HTTP Custom Auth)

n8n.cloud → **Credentials → New Credential → HTTP Custom Auth** :

| Champ | Valeur |
|---|---|
| Name (côté credential) | `Supabase consulting-pipeline` |
| JSON | Voir ci-dessous |

```json
{
  "headers": {
    "apikey": "<TON SERVICE_ROLE_KEY>",
    "Authorization": "Bearer <TON SERVICE_ROLE_KEY>"
  }
}
```

> Récupère ton `service_role` depuis Supabase Studio → Settings → API.
> ⚠️ Pas la `anon` ni la `publishable`. La `service_role` (bypass RLS).

→ utilisée par tous les nodes HTTP qui touchent Supabase (REST + Storage).

## Comment attacher les credentials aux workflows

Pour chaque workflow listé en haut :

1. Ouvre le workflow.
2. Clique sur chaque **HTTP Request** node listé dans le bandeau jaune
   "credentials must be configured manually".
3. Dans l'éditeur du node → champ **Credential** → choisis :
   - `Anthropic API` pour les nodes "Claude Step 1/2", "Schema Generator", "Pitcher"
   - `Supabase consulting-pipeline` pour TOUS les autres (Insert, Update, Fetch, Log, Upload, Mark Quarantine, Rate Limit Check)
4. Le node **Scrape Website** du Diagnoser n'a pas besoin de credential
   (c'est une simple GET sur le site externe). Laisse vide.
5. Les nodes **Call Diagnoser/Schema Builder/Pitcher/Checker** de l'Orchestrateur
   n'ont pas besoin de credential non plus (ils s'appellent eux-mêmes via webhook,
   l'auth est dans le header `x-webhook-secret` déjà inclus).

Une fois les credentials attachés, **active** chaque workflow (toggle en haut à droite).

## Smoke test

Une fois tout activé :

```bash
export N8N_BASE="https://robinplhs.app.n8n.cloud"
export WEBHOOK_SECRET="e0ba5051c783046df4c03edd65b45bc7dfb7c106e132b791"

# Test 1 : Diagnoser seul, sur une vraie URL
curl -X POST "$N8N_BASE/webhook/consulting/diagnoser" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"business_name":"Hôtel Test","business_url":"https://un-vrai-site.fr"}' | jq .

# Test 2 : pipeline complet via l'orchestrateur
curl -X POST "$N8N_BASE/webhook/consulting/orchestrator" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"business_name":"Hôtel Test","business_url":"https://un-vrai-site.fr"}' | jq .
```

Réponse attendue Orchestrateur : `{"status":"ok", "lead_id":"...", "confidence":0.85, "next_step":"Awaiting human approval before send"}`. Inspection :

```sql
-- Dans Supabase Studio → SQL Editor
select * from consulting_dashboard order by lead_created_at desc limit 5;
select * from consulting_pipeline_logs order by created_at desc limit 20;
```

## Si quelque chose foire

1. **403 Unauthorized** → tu as oublié le header `x-webhook-secret` ou il est mal copié.
2. **401 sur Claude API** → la credential `Anthropic API` n'est pas attachée au node Claude, ou la clé est invalide.
3. **401 sur Supabase** → pareil pour `Supabase consulting-pipeline`. Vérifie que tu as bien la `service_role` et pas l'`anon`.
4. **Lead bloque en `diagnosing`** → check `consulting_pipeline_logs` pour voir où ça a planté. Les erreurs Claude (timeouts, JSON malformé) sont les plus fréquentes.
5. **Schéma HTML cassé visuellement** → ouvre le `public_url` dans le browser. Si Claude a généré du markdown au lieu de HTML pur, c'est le validateur HTML qui aurait dû rejeter — ouvre le node "Validate Html" pour voir l'output.

## Limites connues à savoir

- **Pas de Variables n8n** → toutes les URLs Supabase et le webhook secret sont en dur dans les Code nodes. Si tu changes de projet Supabase ou rotates le secret, tu dois éditer chaque workflow.
- **URL n8n hardcodée dans l'Orchestrateur** : `https://robinplhs.app.n8n.cloud/...`. Si tu changes d'instance n8n, modifie les 4 nodes "Call X" de l'Orchestrateur.
- **Aucun envoi auto de message**. Tout reste en draft dans `consulting_messages` avec `is_approved IS NULL`. Tu copies-colles depuis Supabase Studio (ou plus tard depuis un dashboard Lovable).

## Coût par lead

Pipeline complet ~ **$0.10 / lead** (Diagnoser V2 ~$0.044 + Schema ~$0.055 + Pitcher ~$0.008 + Checker $0). Hard cap 20 leads/h dans l'Orchestrateur.
