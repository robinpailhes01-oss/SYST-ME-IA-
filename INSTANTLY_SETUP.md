# Campagne Instantly — guide de setup (10 min)

## Ce que tu as
- **`instantly_leads.csv`** — 67 leads, hooks personnalisés inclus (les 4 déjà contactés par mail sont exclus : Sweetea Patisserie, Thebeastmakers, Veg Plaquiste, Ycb Auto).
- Colonnes = variables Instantly : `email`, `company`, `greet`, `hook`, `core`.

## Étape 1 — Importer les leads
1. Instantly → **Leads → Import → Upload CSV** → choisis `instantly_leads.csv`.
2. Mappe les colonnes :
   - `email` → **Email**
   - `company` → **Company Name**
   - `greet`, `hook`, `core` → **Custom Variables** (garde les mêmes noms).
3. Valide l'import.

## Étape 2 — Créer la campagne + l'A/B test
Dans **Campaign → Sequences**, crée le **1er email** avec **2 variantes** (bouton « Add variant »). Instantly enverra 50/50 A vs B et te sortira les stats par variante.

**Objet (les 2 variantes) :**
```
idée pour {{greet}}
```

### Variante A — angle « disponibilité 24/7 »
```
Bonjour {{greet}},

{{hook}}

{{core}}

Par exemple, un assistant qui répond à vos demandes (mail / WhatsApp / Insta) 24/7 et qualifie vos contacts pendant que vous travaillez.

Je vous propose un audit offert et 100 % personnalisé — concret, sans aucune obligation.

Si ça vous parle, répondez juste « oui » et je vous prépare ça.

Belle journée,
Robin

--
Robin Pailhès
Automatisation & IA pour indépendants et PME
```

### Variante B — angle « gain de temps »
```
Bonjour {{greet}},

{{hook}}

{{core}}

Par exemple, en automatisant votre tâche la plus chronophage — devis, relances, prise de RDV, réponses clients…

Je vous propose un audit offert et 100 % personnalisé — concret, sans aucune obligation.

Si ça vous parle, répondez juste « oui » et je vous prépare ça.

Belle journée,
Robin

--
Robin Pailhès
Automatisation & IA pour indépendants et PME
```

> Pas de lien dans la signature (volontaire) : ça évite l'avertissement Google Safe Browsing et améliore la délivrabilité. Le CTA est de répondre « oui ».

## Étape 3 — Relances (le plus important)
Ajoute 2 follow-ups dans la séquence (la majorité des réponses viennent des relances) :

**Relance 1 (J+3) :**
```
Bonjour {{greet}},

Je me permets un petit up 🙂 Avez-vous eu un moment pour y penser ?
Si l'idée d'un audit offert vous tente, un simple « oui » suffit.

Belle journée,
Robin
```

**Relance 2 (J+6) :**
```
Bonjour {{greet}},

Promis, c'est mon dernier message 🙂 Si ce n'est pas le bon moment, aucun souci.
Je laisse la porte ouverte : répondez « oui » quand vous voulez en discuter.

Belle journée,
Robin
```

## Étape 4 — Réglages délivrabilité (à ne pas zapper)
- **Warm-up** activé sur la boîte d'envoi (≥ 2 semaines idéalement avant gros volume).
- **Limite/jour** : commence à **20–30 mails/jour**, monte progressivement.
- **Délai entre envois** : 60–180 s aléatoire.
- **Tracking** : ouverture ON, clic OFF (pas de lien de toute façon → meilleure délivrabilité).
- **Stop on reply** : ON (arrête la séquence dès qu'ils répondent).

## Les datas que tu auras ensuite
Open rate · Reply rate · Bounce rate · **A vs B** (quelle accroche convertit le mieux) · réponses positives. De quoi itérer sur les prochaines vagues.
