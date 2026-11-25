# Throwaway spike: Open Library work -> Wikidata (P648) -> series (P179), position (P1545), parent saga.
import json, time, urllib.parse, urllib.request
from wd import sparql, v, UA
BOOKS = ["Red Rising","Iron Gold","Dark Age","Golden Son","Harry Potter and the Chamber of Secrets","Catching Fire",
 "The Well of Ascension","Words of Radiance","A Clash of Kings","Dune Messiah","The Last Wish","Leviathan Wakes",
 "The Sea of Monsters","Crooked Kingdom","Guards! Guards!","Foundation and Empire","Crown of Midnight","The Two Towers",
 "The Final Empire","Mort","El nombre del viento","La sombra del viento","Cien años de soledad","Fourth Wing",
 "A Court of Mist and Fury","The Fellowship of the Ring","Elantris","Oathbringer","The Hobbit","Shadow and Bone"]
def ol_work(title):
    url = "https://openlibrary.org/search.json?" + urllib.parse.urlencode({"q": title, "limit": 1, "fields": "key,title,author_name"})
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        d = json.load(r)["docs"]
    return (d[0]["key"].split("/")[-1], d[0].get("title"), (d[0].get("author_name") or ["?"])[0]) if d else None
rows_out = []; hits = 0; with_order = 0; with_parent = 0
for t in BOOKS:
    w = ol_work(t); time.sleep(0.6)
    if not w: print(f"{t[:34]:34} OL: none"); continue
    olid, oltitle, author = w
    q = f'''SELECT ?bookL ?seriesL ?ord ?parentL ?seriesEs WHERE {{
      ?book wdt:P648 "{olid}" .
      OPTIONAL {{ ?book p:P179 ?st . ?st ps:P179 ?series . OPTIONAL {{ ?st pq:P1545 ?ord }}
        OPTIONAL {{ ?series rdfs:label ?seriesL FILTER(lang(?seriesL)="en") }}
        OPTIONAL {{ ?series rdfs:label ?seriesEs FILTER(lang(?seriesEs)="es") }}
        OPTIONAL {{ ?series wdt:P179 ?parent . ?parent rdfs:label ?parentL FILTER(lang(?parentL)="en") }} }}
      OPTIONAL {{ ?book rdfs:label ?bookL FILTER(lang(?bookL)="en") }} }}'''
    rows = sparql(q) or []; time.sleep(1.2)
    found = bool(rows); series = [r for r in rows if v(r,"seriesL")]
    if found: hits += 1
    if any(v(r,"ord") for r in series): with_order += 1
    if any(v(r,"parentL") for r in series): with_parent += 1
    desc = "; ".join(sorted({f"{v(r,'seriesL')} #{v(r,'ord') or '?'}" + (f" ⊂ {v(r,'parentL')}" if v(r,'parentL') else "") for r in series})) or ("in Wikidata, no series" if found else "not linked")
    print(f"{t[:34]:34} {olid:12} {desc[:110]}")
n = len(BOOKS)
print(f"\nlinked {hits}/{n}  with series order {with_order}/{n}  with parent saga {with_parent}/{n}")
