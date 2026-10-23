"""Text normalization, word error rate and key-term hits for the Whisper benchmark."""

import re
import unicodedata

# Sentence punctuation that never carries meaning for search.
_DROP = re.compile(r"[,;!?¿¡\"“”«»()\[\]…]")
# A dot or colon is kept only between digits (23.500, 18:30).
_LOOSE_DOT_COLON = re.compile(r"(?<!\d)[.:]|[.:](?!\d)")
# A hyphen is kept only inside a word (offline-first, aes-gcm).
_LOOSE_HYPHEN = re.compile(r"(?<![\w])-|-(?![\w])")


def normalize(text: str, *, strip_accents: bool = False) -> str:
    text = text.lower().replace("%", " por ciento")
    if strip_accents:
        decomposed = unicodedata.normalize("NFD", text)
        text = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    else:
        text = unicodedata.normalize("NFC", text)
    text = _DROP.sub(" ", text)
    text = _LOOSE_DOT_COLON.sub(" ", text)
    text = _LOOSE_HYPHEN.sub(" ", text)
    return " ".join(text.split())


def tokens(text: str, *, strip_accents: bool = False) -> list[str]:
    return normalize(text, strip_accents=strip_accents).split()


def wer(reference: str, hypothesis: str, *, strip_accents: bool = False) -> float:
    ref = tokens(reference, strip_accents=strip_accents)
    hyp = tokens(hypothesis, strip_accents=strip_accents)
    if not ref:
        raise ValueError("reference must not be empty")
    # Classic Levenshtein distance over words, one row at a time.
    previous = list(range(len(hyp) + 1))
    for i, ref_word in enumerate(ref, start=1):
        current = [i] + [0] * len(hyp)
        for j, hyp_word in enumerate(hyp, start=1):
            cost = 0 if ref_word == hyp_word else 1
            current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
        previous = current
    return previous[-1] / len(ref)


def key_term_hits(terms: list[str], hypothesis: str) -> tuple[list[str], list[str]]:
    """Return (hits, misses); a term hits when its tokens appear contiguously, ignoring accents."""
    hyp = tokens(hypothesis, strip_accents=True)
    hits: list[str] = []
    misses: list[str] = []
    for term in terms:
        needle = tokens(term, strip_accents=True)
        width = len(needle)
        found = any(hyp[k : k + width] == needle for k in range(len(hyp) - width + 1))
        (hits if found else misses).append(term)
    return hits, misses
