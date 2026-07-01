#!/usr/bin/env python3
"""Génère un CSV prêt à importer dans Instantly à partir de targets.json + hooks.json.

Stratégie : 1 ligne = 1 lead, avec le hook personnalisé en variable {{hook}}.
Le reste du mail (core / exemple A-B / signature) est un template commun côté
Instantly, pour que l'A/B test soit géré nativement par Instantly.

Colonnes (= variables Instantly) :
  email, company, greet, hook, core

- greet  : formule d'appel personnalisée
- hook   : phrase d'accroche chaleureuse, propre à chaque entreprise
- core   : bloc positionnement (version "voisin de Carnon" si pertinent, sinon défaut)

Les 4 entreprises déjà contactées par mail sont exclues.
"""
import csv, json

targets = json.load(open("targets.json"))
hooks   = json.load(open("hooks.json"))

# Déjà contactées (mails envoyés) -> à ne pas remettre dans la campagne
ALREADY_SENT = {"Sweetea Patisserie", "Thebeastmakers", "Veg Plaquiste", "Ycb Auto"}

BENEFIT = ("faire grandir votre activité sereinement, pour que vous puissiez "
           "vous concentrer sur l'essentiel")
CORE_DEFAULT = (
    "J'ai automatisé 80 % de ma propre entreprise (location de yacht à Carnon). "
    "Aujourd'hui je construis des infrastructures IA sur-mesure pour des PME. "
    "Chaque entreprise est différente, donc chaque système l'est aussi — "
    "mais le but est toujours le même : " + BENEFIT + "."
)
CORE_NEARBY = (
    "Je l'ai justement automatisée à 80 %, et aujourd'hui je construis des "
    "infrastructures IA sur-mesure pour des PME. Chaque entreprise est différente, "
    "donc chaque système l'est aussi — mais le but est toujours le même : "
    + BENEFIT + "."
)


def main():
    rows = []
    skipped = []
    for t in targets:
        bn = t["business_name"]
        if bn in ALREADY_SENT:
            skipped.append(bn)
            continue
        h = hooks.get(bn)
        if not h:
            skipped.append(bn + " (no hook)")
            continue
        greet, hook = h["greet"], h["hook"]
        core = CORE_NEARBY if "Carnon" in hook else CORE_DEFAULT
        rows.append({
            "email": t["email"],
            "company": bn,
            "greet": greet,
            "hook": hook,
            "core": core,
        })

    with open("instantly_leads.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["email", "company", "greet", "hook", "core"])
        w.writeheader()
        w.writerows(rows)

    print(f"Écrit {len(rows)} leads -> instantly_leads.csv")
    if skipped:
        print(f"Exclus ({len(skipped)}): " + ", ".join(skipped))


if __name__ == "__main__":
    main()
