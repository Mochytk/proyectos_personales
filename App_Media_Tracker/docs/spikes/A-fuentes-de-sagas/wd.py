# Throwaway spike helper (phase 0): minimal Wikidata SPARQL client. Not production code.
import json, sys, time, urllib.parse, urllib.request
UA = "MediaTrackerSpike/0.1 (personal research spike)"
def sparql(q):
    req = urllib.request.Request("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q), headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)["results"]["bindings"]
        except Exception as e:
            time.sleep(5 * (attempt + 1))
    return None
v = lambda b, k: b.get(k, {}).get("value", "")
if __name__ == "__main__":
    for b in sparql('SELECT ?p ?l WHERE { VALUES ?p { wd:P648 wd:P4947 wd:P4983 wd:P9968 wd:P8270 } ?p rdfs:label ?l FILTER(lang(?l)="en") }') or []:
        print(v(b,"p").split("/")[-1], v(b,"l"))
