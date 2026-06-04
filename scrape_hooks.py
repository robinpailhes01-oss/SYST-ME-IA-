#!/usr/bin/env python3
"""Scrape lead websites to extract personalization signals (hook material).

Input : targets.json  -> [{"lead_id":..., "business_name":..., "url":...}, ...]
Output: hooks_raw.json -> {lead_id: {title, description, h1, about, name_guess, ok}}

We only extract *signals* here. The actual short hook sentence is written by a
human/LLM from these signals (better quality than regex templating).
"""
import re, sys, json, html
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

ABOUT_PATHS = ["", "a-propos", "a-propos/", "qui-sommes-nous", "qui-sommes-nous/",
               "about", "notre-equipe", "equipe", "contact"]

# High-confidence first-name patterns. We keep these strict on purpose:
# a wrong first name is worse than none.
NAME_PATTERNS = [
    r"je m['’]appelle\s+([A-ZÉÈÀÂ][a-zéèêàâïî]{2,15})",
    r"moi,?\s+c['’]est\s+([A-ZÉÈÀÂ][a-zéèêàâïî]{2,15})",
    r"(?:gérant|gerant|fondateur|fondatrice|dirigeant|dirigeante|créateur|créatrice|propriétaire)\s*[:\-–]?\s+([A-ZÉÈÀÂ][a-zéèêàâïî]{2,15})",
    r"(?:dirigé|géré|fondé|créé)\s+par\s+([A-ZÉÈÀÂ][a-zéèêàâïî]{2,15})",
]

# Words that look like a name token but aren't first names -> reject.
NAME_STOPWORDS = {
    "Notre", "Votre", "Nous", "Vous", "Cette", "Notre", "Toute", "Plus",
    "Bonjour", "Merci", "Bienvenue", "Depuis", "Avec", "Pour", "Dans",
    "Société", "Entreprise", "Equipe", "Équipe", "Service", "Contact",
    "Accueil", "Mentions", "Politique", "Conditions",
}


def clean_text(s):
    if not s:
        return ""
    s = html.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def fetch(url, session):
    try:
        r = session.get(url, headers=HEADERS, timeout=12, allow_redirects=True)
        ct = r.headers.get("Content-Type", "")
        if r.status_code == 200 and ("html" in ct or "text" in ct or ct == ""):
            # requests defaults to ISO-8859-1 when the charset isn't in the
            # HTTP header, which mojibakes UTF-8 French pages. Trust the
            # detected encoding instead.
            if "charset" not in ct.lower():
                r.encoding = r.apparent_encoding or r.encoding
            return r.text
    except Exception:
        pass
    return None


def guess_name(full_text):
    for pat in NAME_PATTERNS:
        m = re.search(pat, full_text)
        if m:
            cand = m.group(1).strip()
            if cand and cand not in NAME_STOPWORDS and cand[0].isupper():
                return cand
    return ""


def extract_signals(url):
    if not url or not isinstance(url, str):
        return {"ok": False}
    url = url.strip()
    if not url.startswith("http"):
        url = "http://" + url
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    domain = parsed.netloc
    session = requests.Session()

    title = description = h1 = about = name_guess = ""
    got_any = False
    seen = set()

    candidates = [url] + [urljoin(base + "/", p) for p in ABOUT_PATHS]
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        text = fetch(c, session)
        if not text:
            continue
        got_any = True
        soup = BeautifulSoup(text, "html.parser")

        # homepage-level meta (only set once, from the first good page)
        if not title and soup.title and soup.title.string:
            title = clean_text(soup.title.string)[:160]
        if not description:
            md = soup.find("meta", attrs={"name": "description"}) \
                or soup.find("meta", attrs={"property": "og:description"})
            if md and md.get("content"):
                description = clean_text(md["content"])[:300]
        if not h1:
            htag = soup.find(["h1", "h2"])
            if htag:
                h1 = clean_text(htag.get_text())[:160]

        # visible text for name + about snippet
        for s in soup(["script", "style", "noscript"]):
            s.decompose()
        vis = clean_text(soup.get_text(" "))
        if not name_guess:
            name_guess = guess_name(vis)
        if not about and ("propos" in c or "qui-sommes" in c or "equipe" in c):
            about = vis[:400]

        if len(seen) >= 5:
            break

    return {
        "ok": got_any,
        "title": title,
        "description": description,
        "h1": h1,
        "about": about,
        "name_guess": name_guess,
    }


def worker(item):
    lid = item["lead_id"]
    try:
        sig = extract_signals(item.get("url"))
    except Exception as e:
        sig = {"ok": False, "error": str(e)[:120]}
    sig["business_name"] = item.get("business_name")
    return lid, sig


def main():
    targets = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "targets.json"))
    out = {}
    total = len(targets)
    print(f"Scraping {total} sites for hooks...", flush=True)
    done = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        futs = {ex.submit(worker, t): t for t in targets}
        for f in as_completed(futs):
            lid, sig = f.result()
            out[lid] = sig
            done += 1
            if done % 10 == 0 or done == total:
                ok = sum(1 for v in out.values() if v.get("ok"))
                names = sum(1 for v in out.values() if v.get("name_guess"))
                print(f"  {done}/{total} done | {ok} reachable | {names} names", flush=True)
    json.dump(out, open("hooks_raw.json", "w"), ensure_ascii=False, indent=2)
    print(f"DONE. Saved hooks_raw.json", flush=True)


if __name__ == "__main__":
    main()
