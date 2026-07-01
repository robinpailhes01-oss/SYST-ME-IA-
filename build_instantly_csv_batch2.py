#!/usr/bin/env python3
"""Génère instantly_leads_batch2.csv (300 leads) depuis leads_with_emails.csv.

- Dédoublonne par email, exclut les leads déjà contactés (batch 1 / targets.json).
- Nettoie le nom d'entreprise depuis le domaine (cohérent avec batch 1).
- Classe le secteur (utilise SECTEUR, sinon l'infère depuis le nom + domaine).
- Hook personnalisé PAR SECTEUR (variable {{hook}}), core/exemple A-B = template Instantly.

Colonnes (= variables Instantly) : email, company, greet, hook, core
"""
import csv, json, re
from urllib.parse import urlparse

N_TARGET = 300

# --- core commun (identique au batch 1) ---
BENEFIT = ("faire grandir votre activité sereinement, pour que vous puissiez "
           "vous concentrer sur l'essentiel")
CORE_DEFAULT = (
    "J'ai automatisé 80 % de ma propre entreprise (location de yacht à Carnon). "
    "Aujourd'hui je construis des infrastructures IA sur-mesure pour des PME. "
    "Chaque entreprise est différente, donc chaque système l'est aussi — "
    "mais le but est toujours le même : " + BENEFIT + "."
)

# --- hooks par secteur ---
HOOKS = {
    "BTP": "Dans le bâtiment, j'imagine que vos journées se passent surtout sur les chantiers — et que répondre aux demandes de devis une fois rentré le soir, c'est une autre paire de manches 👷",
    "Restauration": "En restauration, entre le coup de feu du service et la gestion des réservations, j'imagine qu'il ne reste pas une minute pour répondre à tous les messages 🍽️",
    "Formation": "Dans la formation, j'imagine que vous jonglez en permanence entre la préparation des sessions et les demandes d'inscription qui tombent à toute heure 📚",
    "Transport": "Dans le transport, j'imagine que vous êtes plus souvent sur la route qu'au téléphone — et que rappeler chaque demande de devis prend un temps fou 🚚",
    "Bien-être": "Dans le bien-être, j'imagine qu'entre deux rendez-vous il est difficile de répondre à tous les messages sans casser le moment présent avec vos clients 🌿",
    "Immobilier": "Dans l'immobilier, j'imagine que les demandes arrivent à toute heure et qu'il faut être ultra-réactif, au risque de voir le client filer ailleurs 🏡",
    "Commerce": "Dans le commerce, j'imagine qu'entre l'accueil en boutique et la gestion des commandes, répondre à tous les messages en ligne devient vite mission impossible 🛍️",
    "Automobile": "Dans l'automobile, j'imagine qu'entre l'atelier et le téléphone qui sonne, prendre chaque demande de RDV à la volée n'est pas évident 🚗",
    "Beauté": "Dans la beauté, j'imagine qu'entre deux clientes il est compliqué de répondre aux demandes de rendez-vous sans interrompre la prestation 💅",
    "Loisir": "Dans les loisirs, j'imagine que la gestion des réservations et des demandes d'info devient vite chronophage dès que la saison s'emballe 🎉",
    "Finance": "Dans votre métier du conseil, j'imagine que le temps passé à qualifier les demandes entrantes empiète sur celui réellement consacré à vos clients 📊",
    "Tourisme": "Dans le tourisme, j'imagine que les demandes de réservation et d'info affluent à toute heure, souvent pile quand vous êtes déjà débordé 🧳",
    "Animaux": "Dans votre métier auprès des animaux, j'imagine qu'entre deux soins il est difficile de répondre à toutes les demandes de rendez-vous 🐾",
    "_default": "En découvrant votre activité, je me suis dit qu'entre la gestion du quotidien et les demandes clients qui arrivent à toute heure, il doit être difficile de tout suivre 🙂",
}

# --- inférence de secteur depuis mots-clés (nom + domaine) ---
KW = [
    ("Restauration", ["restaur","pizz","traiteur","boulang","patiss","brasserie","primeur","boucherie","burger","food","cafe","crepe","sushi","kebab","glacier"]),
    ("BTP", ["plaqu","peinture","toiture","couvertur","macon","maçon","renov","batiment","bâtiment","electric","électric","plomb","clim","chauffage","menuis","carrel","terrass","paysag","jardin","piscine","construction","energ","énerg","isolation","facade","façade","charpent","serrur","vitrer","elec"]),
    ("Beauté", ["coiffure","coiffeur","beaute","beauté","esthe","esthé","ongle","barbier","barber","spa","institut"]),
    ("Bien-être", ["massage","yoga","sophro","naturo","osteo","ostéo","kine","kiné","coach","bien-etre","bienetre","fitness","pilates","reiki","meditation"]),
    ("Automobile", ["auto","garage","carross","pneu","mecan","mécan","lavage","carwash","car-wash"]),
    ("Transport", ["transport","taxi","vtc","livraison","demenag","déménag","fret","logistique","ambulance"]),
    ("Immobilier", ["immo","conciergerie","agence","location","locative","syndic"]),
    ("Formation", ["formation","ecole","école","cours","training","auto-ecole","permis","coaching"]),
    ("Commerce", ["boutique","magasin","vetement","vêtement","mode","deco","déco","fleur","bijou","opticien","librairie"]),
    ("Finance", ["assurance","comptab","finance","courtier","mutuelle","patrimoine","gestion"]),
]


def clean_name(url, fallback):
    try:
        host = urlparse(url if "//" in url else "//" + url).netloc or url
    except Exception:
        host = url
    host = re.sub(r"^www\.", "", host)
    base = host.split("/")[0].rsplit(".", 1)[0]      # retire le TLD
    base = base.split(".")[-1] if "." in base else base
    name = re.sub(r"[-_]+", " ", base).strip()
    name = " ".join(w.capitalize() for w in name.split())
    return name or (fallback.strip() or "votre entreprise")


def infer_sector(declared, text):
    if declared and declared.strip() and declared.strip().lower() != "inconnu":
        return declared.strip()
    t = text.lower()
    for sector, kws in KW:
        if any(k in t for k in kws):
            return sector
    return "_default"


def main():
    used = {t["email"].strip().lower() for t in json.load(open("targets.json"))}

    rows = list(csv.DictReader(open("leads_with_emails.csv", encoding="utf-8-sig")))
    seen, leads = set(), []
    for r in rows:
        email = (r.get("MAIL") or "").strip().lower()
        if not email or "@" not in email or email in used or email in seen:
            continue
        seen.add(email)
        nom = (r.get("NOM") or "").strip()
        url = (r.get("SITE_WEB") or "").strip()
        company = clean_name(url, nom)
        sector = infer_sector(r.get("SECTEUR"), nom + " " + url)
        leads.append({
            "email": email,
            "company": company,
            "greet": company,
            "hook": HOOKS.get(sector, HOOKS["_default"]),
            "core": CORE_DEFAULT,
            "_identified": sector != "_default",
        })

    # priorise les leads à secteur identifié (hooks plus pertinents), puis complète
    leads.sort(key=lambda x: not x["_identified"])
    picked = leads[:N_TARGET]

    with open("instantly_leads_batch2.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["email", "company", "greet", "hook", "core"])
        w.writeheader()
        for l in picked:
            w.writerow({k: l[k] for k in ["email","company","greet","hook","core"]})

    from collections import Counter
    print(f"Disponibles uniques: {len(leads)} | Exportés: {len(picked)}")
    ident = sum(1 for l in picked if l["_identified"])
    print(f"Hooks secteur identifié: {ident} | hook générique: {len(picked)-ident}")
    # répartition des hooks dans le fichier final
    rev = {v: k for k, v in HOOKS.items()}
    c = Counter(rev.get(l["hook"], "?") for l in picked)
    for k, v in c.most_common():
        print(f"  {v:4d}  {k}")


if __name__ == "__main__":
    main()
