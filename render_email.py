#!/usr/bin/env python3
"""Render prospecting emails (templates A & B) as HTML + plain text."""

SIGNATURE_HTML = """
<table cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:2px solid #1a73e8;padding-top:10px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="font-size:15px;font-weight:bold;color:#202124;">Robin Pailh&egrave;s</td></tr>
  <tr><td style="font-size:13px;color:#5f6368;padding-top:2px;">Automatisation &amp; IA pour ind&eacute;pendants et PME</td></tr>
  <tr><td style="font-size:13px;color:#5f6368;padding-top:6px;">
    &#9993;&nbsp;<a href="mailto:robin.pailhes01@gmail.com" style="color:#1a73e8;text-decoration:none;">robin.pailhes01@gmail.com</a>
  </td></tr>
</table>
"""

SIGNATURE_TEXT = """
Robin Pailhès
Automatisation & IA pour indépendants et PME
robin.pailhes01@gmail.com
"""

UNSUB_HTML = '<p style="font-size:11px;color:#9aa0a6;margin-top:16px;">Si vous ne souhaitez pas &ecirc;tre recontact&eacute;, r&eacute;pondez simplement STOP &agrave; ce message.</p>'
UNSUB_TEXT = "\nSi vous ne souhaitez pas être recontacté, répondez simplement STOP à ce message."

P = 'style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#202124;line-height:1.55;margin:0 0 14px 0;"'


def template_a(entreprise):
    subject = f"Une idée pour {entreprise}"
    salut = f"Bonjour l'équipe de {entreprise}, j'espère que vous allez bien."
    text = f"""{salut}

Je m'appelle Robin. Il y a quelques mois, j'ai construit toute l'infrastructure IA de mon entreprise (location de yacht à Carnon) — et j'ai vu à quel point ça pouvait changer le quotidien d'un indépendant. Aujourd'hui je l'adapte pour d'autres entrepreneurs qui, comme vous, donnent tout dans leur métier.

Pour une entreprise comme la vôtre, voici quelques exemples concrets de ce que je peux mettre en place :

• Un agent qui répond à vos DM Insta / WhatsApp / Mail 24/7 et qualifie les demandes de RDV pendant que vous travaillez
• Un système qui réduit les no-shows et relance en douceur les clients que vous n'avez pas revus depuis longtemps
• Une réponse personnalisée à chacun de vos avis Google (qui booste votre référencement local)
• Le GEO : faire en sorte que ChatGPT, Gemini ou Perplexity vous recommandent quand quelqu'un cherche une entreprise dans votre secteur (un sujet encore peu connu mais qui devient essentiel)

Et bien plus encore..

Je vous propose un audit gratuit et 100% personnalisé pour voir ce qui ferait vraiment sens chez vous. Aucune obligation derrière.

Si ça vous parle, répondez simplement « oui » à ce mail et je vous prépare ça.

Belle journée,
Robin
{SIGNATURE_TEXT}{UNSUB_TEXT}"""

    html = f"""<div style="max-width:600px;">
<p {P}>Bonjour l'équipe de <strong>{entreprise}</strong>, j'espère que vous allez bien.</p>
<p {P}>Je m'appelle Robin. Il y a quelques mois, j'ai construit toute l'infrastructure IA de mon entreprise (location de yacht à Carnon) — et j'ai vu à quel point ça pouvait changer le quotidien d'un indépendant. Aujourd'hui je l'adapte pour d'autres entrepreneurs qui, comme vous, donnent tout dans leur métier.</p>
<p {P}>Pour une entreprise comme la vôtre, voici quelques exemples concrets de ce que je peux mettre en place :</p>
<ul style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#202124;line-height:1.55;padding-left:20px;margin:0 0 14px 0;">
<li style="margin-bottom:8px;">Un agent qui répond à vos <strong>DM Insta / WhatsApp / Mail 24/7</strong> et qualifie les demandes de RDV pendant que vous travaillez</li>
<li style="margin-bottom:8px;">Un système qui <strong>réduit les no-shows</strong> et relance en douceur les clients que vous n'avez pas revus depuis longtemps</li>
<li style="margin-bottom:8px;">Une <strong>réponse personnalisée à chacun de vos avis Google</strong> (qui booste votre référencement local)</li>
<li style="margin-bottom:8px;">Le <strong>GEO</strong> : faire en sorte que ChatGPT, Gemini ou Perplexity vous recommandent quand quelqu'un cherche une entreprise dans votre secteur (un sujet encore peu connu mais qui devient essentiel)</li>
</ul>
<p {P}>Et bien plus encore..</p>
<p {P}>Je vous propose un <strong>audit gratuit et 100% personnalisé</strong> pour voir ce qui ferait vraiment sens chez vous. Aucune obligation derrière.</p>
<p {P}>Si ça vous parle, répondez simplement « <strong>oui</strong> » à ce mail et je vous prépare ça.</p>
<p {P}>Belle journée,<br>Robin</p>
{SIGNATURE_HTML}
{UNSUB_HTML}
</div>"""
    return subject, text, html


def template_b(entreprise):
    subject = f"Une seule chose à automatiser chez {entreprise}"
    text = f"""Bonjour l'équipe de {entreprise},

Si vous pouviez automatiser une seule chose chez {entreprise}, laquelle ce serait ?

J'ai moi-même automatisé 80% de ma société de location de yacht à Carnon, et c'est pour ça qu'aujourd'hui j'aide aussi les PME à le faire.

Répondez « oui » et je vous partage ça en 20 min, gratuit.

Robin
{SIGNATURE_TEXT}{UNSUB_TEXT}"""

    html = f"""<div style="max-width:600px;">
<p {P}>Bonjour l'équipe de <strong>{entreprise}</strong>,</p>
<p {P}>Si vous pouviez automatiser <strong>une seule chose</strong> chez {entreprise}, laquelle ce serait ?</p>
<p {P}>J'ai moi-même automatisé 80% de ma société de location de yacht à Carnon, et c'est pour ça qu'aujourd'hui j'aide aussi les PME à le faire.</p>
<p {P}>Répondez « <strong>oui</strong> » et je vous partage ça en 20 min, gratuit.</p>
<p {P}>Robin</p>
{SIGNATURE_HTML}
{UNSUB_HTML}
</div>"""
    return subject, text, html


if __name__ == "__main__":
    for fn in (template_a, template_b):
        s, t, h = fn("L'Auberge")
        print("=== SUBJECT:", s, "===")
        print(t)
        print()
