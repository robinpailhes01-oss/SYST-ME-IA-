# Consulting Dashboard

Mini-dashboard Next.js qui consomme la base Supabase du pipeline AI Consulting.
Conçu mobile-first pour pouvoir piloter depuis ton téléphone.

## Routes

| Path | Auth | Rôle |
|---|---|---|
| `/login` | public | Connexion par magic link |
| `/leads` | privé | Liste de tous les prospects avec statut + ROI |
| `/leads/[id]` | privé | Détail d'un lead : diagnostic, schéma intégré, drafts email/DM, bouton approuver |
| `/s/[schema_id]` | **public** | Sert le schéma HTML inline (ce que tes prospects ouvrent depuis l'email) |

## Sprint A — fixe le problème de schéma qui se download

La raison pour laquelle ton schéma se downloade sur mobile au lieu de s'afficher : Supabase Storage envoie un `Content-Disposition` ambigu. La route `/s/[id]` de ce dashboard lit le HTML directement depuis Postgres et le sert avec les bons headers, donc chaque browser le rend inline.

## Déploiement sur Vercel — 10 minutes

### 1. Push le repo sur GitHub (si pas déjà fait)

```bash
# Depuis la racine du projet (pas dans dashboard/)
git push origin claude/ai-consulting-pipeline-AI8eW
```

### 2. Crée le projet Vercel

1. Va sur https://vercel.com/new
2. **Import Git Repository** → choisis `robinpailhes01-oss/syst-me-ia-`
3. **Root Directory** → clique "Edit" et choisis **`dashboard`** (PAS la racine)
4. **Framework Preset** : Next.js (auto-détecté)
5. **Build Command** : `next build` (par défaut)
6. Avant de cliquer Deploy : ajoute les **Environment Variables** (étape 3)

### 3. Variables d'environnement Vercel

Sur la page de configuration, dans "Environment Variables", ajoute :

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jlcqxtxpvuyfznecpwqu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_7SK1n58qlftfoa93TragOA_FOic00Ra` |
| `SUPABASE_SECRET_KEY` | ton `sb_secret_xxxxxx` (le même que dans la credential n8n "Supabase REST") |

⚠️ Le `SUPABASE_SECRET_KEY` doit être marqué **Sensitive**.

### 4. Configure Supabase Auth pour le domaine Vercel

Une fois la première URL Vercel reçue (ex: `consulting-dashboard-xyz.vercel.app`) :

1. Supabase Studio → **Authentication** → **URL Configuration**
2. **Site URL** : `https://<ton-domaine>.vercel.app`
3. **Redirect URLs** : ajoute `https://<ton-domaine>.vercel.app/auth/callback`

### 5. Première connexion

1. Ouvre `https://<ton-domaine>.vercel.app/login`
2. Tape ton email (`contact@robinpailhes.fr`)
3. Reçois le magic link dans ta boîte → clique
4. Tu es redirigé vers `/leads`

### 6. Update le Pitcher pour utiliser le nouveau URL du schéma

Dans n8n, ouvre `consulting_pitcher` → node **"Construire l'invite du pitcher"** (Build Pitch Prompt) → cherche la ligne qui construit la variable `schema_url`. Remplace `ctx.schema_url` (qui pointe vers Supabase Storage) par :

```js
const schema_url = 'https://<ton-domaine>.vercel.app/s/' + ctx.schema_id;
```

Sauvegarde + Publie. Les futurs messages utiliseront cette URL qui rend toujours inline.

> Pour les schémas DÉJÀ générés, tu peux mettre à jour leurs `public_url` en SQL :
>
> ```sql
> update public.consulting_schemas
> set public_url = 'https://<ton-domaine>.vercel.app/s/' || id;
> ```

## Développement local

```bash
cd dashboard
npm install                  # ou pnpm install
cp .env.example .env.local   # remplis SUPABASE_SECRET_KEY
npm run dev                  # http://localhost:3000
```

## Architecture

```
dashboard/
├── app/
│   ├── login/                  ← magic link
│   ├── auth/callback/route.ts  ← échange code → session
│   ├── leads/                  ← liste + détail prospects
│   ├── s/[id]/route.ts         ← schéma public inline
│   └── api/messages/[id]/approve/  ← action d'approbation
├── lib/
│   ├── supabase/server.ts      ← clients server (user-cookies + service-role)
│   ├── supabase/client.ts      ← client browser
│   └── types.ts                ← types DB
└── middleware.ts               ← refresh session + protection des routes privées
```

## RLS Supabase

La migration `supabase/migrations/0006_dashboard_rls.sql` ajoute :
- `authenticated` peut SELECT sur `consulting_leads`, `consulting_diagnostics`, `consulting_schemas`, `consulting_messages`, `consulting_pipeline_logs`
- `authenticated` peut UPDATE sur `consulting_messages` (pour le bouton approuver)

La route `/s/[id]` utilise la **service_role** côté serveur pour bypass RLS et servir le schéma à n'importe qui avec le lien.

## Sprint B (à venir)

- [ ] Envoi automatique des messages approuvés (Gmail API ou Resend)
- [ ] Tracking pixel pour mesurer le taux d'ouverture
- [ ] Tracking des clics sur le lien du schéma
- [ ] Doc Instagram généré par lead (markdown avec lien profil + DM prêt à coller)
- [ ] Poll IMAP des réponses → mise à jour automatique `replied`
