#!/usr/bin/env python3
"""Assemble personalized prospecting emails from targets.json + hooks.json.

Two variants per target (A/B test):
  A – angle "répondre aux demandes 24/7"
  B – angle "automatiser la tâche la plus répétitive"

Output: drafts_plan.json -> [{business_name, variant, greet, to, subject, text, html}, ...]
"""
import json, html as html_mod

targets = json.load(open("targets.json"))
hooks   = json.load(open("hooks.json"))

# ── Variant A ── messages / qualification 24/7
ASSISTANT_A = (
    "un assistant qui répond à vos demandes (mail / WhatsApp / Insta) "
    "24/7 et qui qualifie les prises de contact pendant que vous travaillez"
)
CORE_DEFAULT_A = (
    "J'ai automatisé 80 % de ma propre entreprise (location de yacht à Carnon). "
    "Aujourd'hui j'installe la même chose pour des PME : " + ASSISTANT_A + "."
)
CORE_NEARBY_A = (
    "Je l'ai justement automatisée à 80 %, et aujourd'hui j'installe "
    "la même chose pour des PME : " + ASSISTANT_A + "."
)

# ── Variant B ── tâche la plus répétitive (angle plus large)
ASSISTANT_B = (
    "un système qui identifie votre tâche la plus chronophage "
    "et l'automatise — devis, relances, prise de RDV, réponses clients… "
    "pour que vous passiez votre temps là où vous avez vraiment de la valeur"
)
CORE_DEFAULT_B = (
    "J'ai automatisé 80 % de ma propre entreprise (location de yacht à Carnon). "
    "Aujourd'hui j'installe la même chose pour des PME : " + ASSISTANT_B + "."
)
CORE_NEARBY_B = (
    "Je l'ai justement automatisée à 80 %, et aujourd'hui j'installe "
    "la même chose pour des PME : " + ASSISTANT_B + "."
)

SIG_TEXT = (
    "Robin Pailhès\n"
    "Automatisation & IA pour indépendants et PME\n"
    "robinpailhes.fr"
)
UNSUB_TEXT = "Si vous ne souhaitez pas être recontacté, répondez simplement STOP à ce message."


def esc(s):
    return html_mod.escape(s, quote=False)


def build_one(t, variant: str):
    bn = t["business_name"]
    h  = hooks[bn]
    greet, hook = h["greet"], h["hook"]
    nearby = "Carnon" in hook

    if variant == "A":
        assistant = ASSISTANT_A
        core = CORE_NEARBY_A if nearby else CORE_DEFAULT_A
    else:
        assistant = ASSISTANT_B
        core = CORE_NEARBY_B if nearby else CORE_DEFAULT_B

    subject = f"idée pour {greet}"

    text = (
        f"Bonjour {greet},\n\n"
        f"{hook}\n\n"
        f"{core}\n\n"
        "Je vous propose un audit offert et 100 % personnalisé — concret, sans aucune obligation.\n\n"
        "Si ça vous parle, répondez juste « oui » et je vous prépare ça.\n\n"
        f"Belle journée,\nRobin\n\n--\n{SIG_TEXT}\n\n{UNSUB_TEXT}"
    )

    core_html = esc(core).replace(esc(assistant), f"<strong>{esc(assistant)}</strong>")
    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#202124;line-height:1.6;max-width:600px;">'
        f"<p>Bonjour {esc(greet)},</p>"
        f"<p>{esc(hook)}</p>"
        f"<p>{core_html}</p>"
        "<p>Je vous propose un audit offert et 100 % personnalisé — concret, sans aucune obligation.</p>"
        "<p>Si ça vous parle, répondez juste « oui » et je vous prépare ça.</p>"
        "<p>Belle journée,<br>Robin</p>"
        '<p style="color:#5f6368;font-size:13px;border-top:1px solid #e0e0e0;padding-top:10px;margin-top:18px;">'
        'Robin Pailhès<br>Automatisation &amp; IA pour indépendants et PME<br>'
        '<a href="https://robinpailhes.fr" style="color:#1a73e8;">robinpailhes.fr</a></p>'
        '<p style="color:#9aa0a6;font-size:11px;">'
        'Si vous ne souhaitez pas être recontacté, répondez simplement STOP à ce message.</p>'
        "</div>"
    )
    return {
        "business_name": bn, "variant": variant, "greet": greet,
        "to": t["email"], "subject": subject, "text": text, "html": html,
    }


def main():
    missing = [t["business_name"] for t in targets if t["business_name"] not in hooks]
    if missing:
        raise SystemExit("Missing hooks for: " + ", ".join(missing))

    # A/B test: one variant per business (never both to the same recipient).
    # Alternate A/B for a balanced, deterministic split.
    plan = []
    for i, t in enumerate(targets):
        variant = "A" if i % 2 == 0 else "B"
        plan.append(build_one(t, variant))

    json.dump(plan, open("drafts_plan.json", "w"), ensure_ascii=False, indent=2)
    n_a = sum(1 for d in plan if d["variant"] == "A")
    n_b = sum(1 for d in plan if d["variant"] == "B")
    print(f"Built {len(plan)} drafts ({n_a} variant A, {n_b} variant B) -> drafts_plan.json")


if __name__ == "__main__":
    main()
