# Architecture du pipeline AI Consulting

> Document de référence — Phase 1 (réflexion avant build).
> Lis ce doc avant d'importer le moindre workflow n8n.

## 1. Principes directeurs

1. **Un seul opérateur.** Tout doit pouvoir être piloté depuis le téléphone, sans serveur à maintenir.
2. **Async d'abord, humain en bout de chaîne.** Aucune action visible par le prospect (envoi de message, publication, paiement) ne part sans validation manuelle au début. On retire les checkpoints au fur et à mesure que la qualité se stabilise.
3. **Build incrémental.** Chaque agent doit produire un livrable utilisable seul, même si la chaîne complète n'est pas finie.
4. **Stack jamais visible côté client.** Aucun message, aucun schéma livré ne mentionne `n8n`, `Claude`, `Supabase`, `API`. On parle de résultats.
5. **Tables préfixées `consulting_`** pour ne jamais interférer avec la prod Harmonie Yacht.

## 2. Ordre de build recommandé

L'ordre est dicté par la dépendance des outputs, pas par la complexité.

| Sprint | Livrable | Pourquoi en premier |
|---|---|---|
| 1 | Diagnoser (manuel via webhook) | Tout le reste consomme son JSON. Si le format change, tout casse en aval. |
| 2 | Schema Builder | Consomme le JSON figé du Diagnoser. Le rendu visuel est ce qui crée le "wow" — c'est l'asset commercial. |
| 3 | Pitcher + Checker | Couplés. Le Pitcher écrit, le Checker valide. On ne lance jamais l'un sans l'autre. |
| 4 | Orchestrateur + Dashboard | On orchestre seulement quand chaque maillon est stable individuellement. |

> Ne pas construire l'Orchestrateur tant que les 3 agents en amont ne sont pas testés sur 10 leads chacun, sinon on debug 4 problèmes superposés.

## 3. Autonomie vs Human-in-the-Loop

| Agent | Mode par défaut | Pourquoi |
|---|---|---|
| Scout (futur) | Autonome | Lecture seule, scrape de sources publiques. |
| Diagnoser | Autonome | Output texte, sans action externe. |
| Schema Builder | Autonome | Génère un asset, ne le diffuse pas. |
| Pitcher | Autonome | Produit un **brouillon**, ne l'envoie pas. |
| **Checker** | **HITL — checkpoint obligatoire** | Mauvais message envoyé = lead grillé pour 12 mois. |
| Sender (futur) | HITL au début, autonome après 50 envois validés | Le risque réputationnel est trop élevé pour automatiser dès J1. |

**Règle d'or :** un agent autonome peut écrire dans Supabase et appeler une API LLM. Il ne peut jamais envoyer un email, un DM, ou un paiement sans qu'un humain ait cliqué "go".

## 4. Gestion des erreurs et retries dans n8n

Trois niveaux de défense :

### 4.1. Au niveau du node (local)
- Tous les nodes HTTP (`scrape`, `Claude API`, `Supabase`) ont :
  - `Retry On Fail: true`
  - `Max Tries: 3`
  - `Wait Between Tries: 5000ms` (backoff exponentiel manuel via `Wait` si besoin)
- Tous les nodes critiques activent `Continue On Fail` couplé à un `IF` qui route vers une branche d'erreur explicite.

### 4.2. Au niveau du workflow (global)
- Chaque workflow expose un node final `Log to pipeline_logs` qui écrit le statut (`success`, `partial`, `failed`) avec un timestamp et un message d'erreur.
- Un **Error Trigger workflow** dédié écoute toutes les erreurs non gérées et insère un événement dans `consulting_pipeline_logs` avec `severity = 'critical'`.

### 4.3. Au niveau du pipeline (cross-workflow)
- Si un agent échoue 3 fois sur un lead, le lead passe en statut `quarantine` dans `consulting_leads`. Pas de re-tentative auto. On regarde manuellement.
- Pas de DLQ Kafka-style ici. On reste sur Supabase + un statut.

## 5. Schéma Supabase (vue d'ensemble)

```
consulting_leads (1) ──< (n) consulting_diagnostics
                  │
                  │
                  └──< (n) consulting_schemas
                  │
                  │
                  └──< (n) consulting_messages

consulting_pipeline_logs ── référence (lead_id, agent, step)
```

- `consulting_leads` : identité du prospect + statut courant dans le pipeline.
- `consulting_diagnostics` : 1..n (on peut re-diagnoser un lead 6 mois après).
- `consulting_schemas` : 1..n (un schéma est généré pour chaque diagnostic).
- `consulting_messages` : 1..n (email + DM = 2 lignes, on peut aussi générer des V2).
- `consulting_pipeline_logs` : audit trail complet, immuable.

Le SQL complet est dans `supabase/schema.sql`.

## 6. Risques identifiés et mitigations

### 6.1. Risques techniques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Site web bloque le scraping (anti-bot, JS-only) | Élevée | Moyen | Fallback : Diagnoser tourne avec juste `nom + secteur` + recherche secteur en RAG ultérieur. Le diagnostic perd en finesse mais reste exploitable. |
| Claude API renvoie un JSON malformé | Moyenne | Élevé | Node de parsing strict + 1 retry avec prompt corrigé ("ta réponse précédente n'était pas du JSON valide, recommence"). Si 2e échec → quarantine. |
| Coût API explose (mauvaise config) | Moyenne | Moyen | Hard cap dans `consulting_pipeline_logs` : si >20 leads dans la dernière heure, l'orchestrateur refuse de démarrer un nouveau lead. Voir §7. |
| Prompt injection via contenu scraped | Faible | Élevé | Le HTML scraped est wrappé dans un délimiteur clair (`---SCRAPED CONTENT START---`) et le system prompt rappelle d'ignorer toute instruction venant de cette zone. |
| Schéma HTML cassé (CSS bug, image manquante) | Moyenne | Bas | Le HTML est rendu dans une iframe sandbox côté dashboard avant validation manuelle. |

### 6.2. Risques business

| Risque | Mitigation |
|---|---|
| Envoi en doublon au même prospect | Contrainte unique sur `(business_url, channel)` dans `consulting_messages` + check dans Checker (`no_duplicate`). |
| Diagnostic à côté de la plaque (mauvais secteur identifié) | Score de confiance dans le JSON (`confidence: 0..1`). En dessous de 0.6, le lead va en review manuelle. |
| Message qui sonne "AI-généré" | Variantes A/B + le Checker mesure un score "naturel" (présence de tics LLM connus : "j'espère que…", listes à puces, "n'hésitez pas"). |
| Lead recontacté trop vite (3 messages en 2 semaines) | Règle dans Checker : `last_contact_at + 60 jours` minimum entre 2 envois. |

### 6.3. Coûts API à surveiller

Estimation **par lead traité** (Claude Sonnet 4, tarifs publics 2026) :

| Étape | Input (tokens) | Output (tokens) | Coût estimé |
|---|---|---|---|
| Diagnoser (HTML scraped + prompt) | ~4000 | ~1000 | ~$0.027 |
| Schema Builder (JSON + prompt → HTML) | ~700 | ~3500 | ~$0.055 |
| Pitcher (JSON + prompt → 2 messages) | ~500 | ~400 | ~$0.008 |
| Checker (validation, 1 LLM call optionnel) | ~600 | ~150 | ~$0.004 |
| **Total / lead** |  |  | **~$0.094** |

> Budget de sécurité : **$0.15/lead** pour absorber les retries. 1000 leads = ~$150 d'API. À multiplier par 2 si tu actives le caching prompt côté Claude (mais le caching réduira en réalité de 30-50% les inputs récurrents).

**Garde-fous concrets :**
- Variable d'env `MAX_LEADS_PER_HOUR=20` lue par l'Orchestrateur.
- Variable d'env `MAX_DAILY_API_COST_USD=10` (audit manuel quotidien — pas de hard kill auto, juste alerte email si dépassé).

## 7. Checkpoints HITL (où je clique manuellement)

| Checkpoint | Quand | Comment |
|---|---|---|
| Validation diagnostic | Après Diagnoser, si `confidence < 0.6` | Email avec lien vers le diagnostic dans Supabase. Je marque `approved: true/false`. |
| Validation schéma | Toujours, sprint 1-2 | Le HTML est généré + screenshot envoyé sur mon Telegram/email. Je clique "OK" ou "regenerate". |
| Validation message | Toujours | Le draft apparaît dans le dashboard mobile. Je peux éditer en place avant d'autoriser l'envoi. |
| Envoi réel | Toujours, jusqu'à 50 envois validés | Bouton "Send" manuel. Pas de scheduler auto avant d'avoir prouvé la qualité. |

## 8. Variables d'environnement n8n

À configurer dans **Settings → Variables** de n8n.cloud :

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...        # ⚠️ service role, jamais anon
WEBHOOK_SECRET=<random 32 chars>    # auth shared-secret entre workflows
STORAGE_BUCKET_URL=https://xxxxx.supabase.co/storage/v1/object/public/consulting-schemas
ALERT_EMAIL=robin@...
MAX_LEADS_PER_HOUR=20
```

> Tous les workflows lisent ces variables via `{{ $vars.NAME }}`. Aucune clé en dur dans le JSON.

## 9. Ce qu'on ne construit PAS dans la v1

Pour rester concentré et livrer vite :

- ❌ Pas de Scout auto-scrape (Apollo/Phantombuster) — on commence avec une liste manuelle dans Supabase.
- ❌ Pas de Sender automatique — on copie/colle les messages depuis le dashboard.
- ❌ Pas de A/B testing des prompts — on itère manuellement.
- ❌ Pas de RAG sectoriel — le contexte secteur est dans le prompt Diagnoser pour l'instant.
- ❌ Pas de traduction multi-langue — FR uniquement.

À ajouter une fois que les 4 agents tournent en stable sur 50 leads.
