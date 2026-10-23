"""Tests for the text metrics used by the Whisper benchmark (stdlib unittest only)."""

import json
import unittest
from pathlib import Path

from textmetrics import key_term_hits, normalize, tokens, wer


class NormalizeTest(unittest.TestCase):
    def test_lowercases_and_drops_sentence_punctuation(self) -> None:
        self.assertEqual(normalize("Ya, nota rápida. ¿Cachai?"), "ya nota rápida cachai")

    def test_strips_accents_on_request(self) -> None:
        self.assertEqual(normalize("Búsqueda híbrida", strip_accents=True), "busqueda hibrida")

    def test_keeps_numbers_with_inner_separators(self) -> None:
        self.assertEqual(normalize("son 23.500 pesos, a las 18:30."), "son 23.500 pesos a las 18:30")

    def test_keeps_inner_hyphens(self) -> None:
        self.assertEqual(normalize("modo offline-first - y AES-GCM"), "modo offline-first y aes-gcm")

    def test_spells_out_percent(self) -> None:
        self.assertEqual(normalize("como 62%"), "como 62 por ciento")


class WerTest(unittest.TestCase):
    def test_identical_text_has_zero_error(self) -> None:
        self.assertEqual(wer("Hola, mundo.", "hola mundo"), 0.0)

    def test_counts_substitutions_insertions_and_deletions(self) -> None:
        # one substitution (b->x) and one deletion (d) over four reference words
        self.assertAlmostEqual(wer("a b c d", "a x c"), 0.5)
        # one insertion over two reference words
        self.assertAlmostEqual(wer("a b", "a b c"), 0.5)

    def test_accent_insensitive_mode(self) -> None:
        self.assertEqual(wer("búsqueda híbrida", "busqueda hibrida", strip_accents=True), 0.0)
        self.assertAlmostEqual(wer("búsqueda híbrida", "busqueda hibrida"), 1.0)

    def test_empty_reference_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            wer("", "algo")


class KeyTermTest(unittest.TestCase):
    def test_matches_whole_token_sequences_only(self) -> None:
        hyp = "hacer el threat model porque si no me pillan"
        hits, misses = key_term_hits(["threat model", "po", "pillan"], hyp)
        self.assertEqual(hits, ["threat model", "pillan"])
        self.assertEqual(misses, ["po"])

    def test_is_accent_insensitive(self) -> None:
        hits, misses = key_term_hits(["bacan", "profe guia"], "lo bacán es el profe guía")
        self.assertEqual(misses, [])
        self.assertEqual(hits, ["bacan", "profe guia"])


class FixturesTest(unittest.TestCase):
    def test_every_key_term_appears_in_its_own_script(self) -> None:
        refs = Path(__file__).parent / "refs"
        terms = json.loads((refs / "terminos.json").read_text(encoding="utf-8"))
        for name, script_terms in terms.items():
            _, misses = key_term_hits(script_terms, (refs / f"{name}.txt").read_text(encoding="utf-8"))
            self.assertEqual(misses, [], name)


class TokensTest(unittest.TestCase):
    def test_splits_on_whitespace_after_normalizing(self) -> None:
        self.assertEqual(tokens("  Pull   request, merge. "), ["pull", "request", "merge"])


if __name__ == "__main__":
    unittest.main()
