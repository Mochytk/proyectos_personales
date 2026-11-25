# Throwaway spike: how well does Wikidata describe sagas (series -> members with order -> parent saga)?
import sys, time
from wd import sparql, v
CASES = [  # (kind, English label of the series item)
 ("book","Red Rising Saga"),("book","Harry Potter"),("book","The Hunger Games"),("book","Mistborn"),
 ("book","The Stormlight Archive"),("book","A Song of Ice and Fire"),("book","Dune"),("book","The Witcher"),
 ("book","The Expanse"),("book","Percy Jackson & the Olympians"),("book","Six of Crows"),("book","Discworld"),
 ("book","Foundation series"),("book","Throne of Glass"),("book","The Lord of the Rings"),
 ("film","Marvel Cinematic Universe"),("film","Star Wars"),("film","Harry Potter film series"),("film","The Lord of the Rings film series"),
 ("film","John Wick"),("tv","Star Trek"),
 ("game","The Legend of Zelda"),("game","Mass Effect"),("game","Final Fantasy"),("game","The Witcher video game series"),("game","Dark Souls"),
]
print("kind series                              found members ordered parent es_label  ol_id tmdb rawg")
for kind, label in CASES:
    q = f'''SELECT ?s (COUNT(DISTINCT ?m) AS ?n) (COUNT(DISTINCT ?mo) AS ?no) (SAMPLE(?parentL) AS ?par) (SAMPLE(?esL) AS ?es)
      (COUNT(DISTINCT ?ol) AS ?nol) (COUNT(DISTINCT ?tm) AS ?ntm) (COUNT(DISTINCT ?rw) AS ?nrw) WHERE {{
      ?s rdfs:label "{label}"@en .
      OPTIONAL {{ ?m p:P179 ?st . ?st ps:P179 ?s . OPTIONAL {{ ?st pq:P1545 ?ord . BIND(?m AS ?mo) }}
                 OPTIONAL {{ ?m wdt:P648 ?ol }} OPTIONAL {{ ?m wdt:P4947|wdt:P4983 ?tm }} OPTIONAL {{ ?m wdt:P9968 ?rw }} }}
      OPTIONAL {{ ?s wdt:P179 ?parent . ?parent rdfs:label ?parentL FILTER(lang(?parentL)="en") }}
      OPTIONAL {{ ?s rdfs:label ?esL FILTER(lang(?esL)="es") }}
    }} GROUP BY ?s ORDER BY DESC(?n) LIMIT 1'''
    rows = sparql(q); time.sleep(1.5)
    if not rows or not v(rows[0],"s"):
        print(f"{kind:4} {label[:34]:34} NO"); continue
    b = rows[0]
    print(f"{kind:4} {label[:34]:34} yes   {v(b,'n'):>5}   {v(b,'no'):>5}   {v(b,'par')[:16]:16} {v(b,'es')[:18]:18} {v(b,'nol'):>4} {v(b,'ntm'):>4} {v(b,'nrw'):>4}")
