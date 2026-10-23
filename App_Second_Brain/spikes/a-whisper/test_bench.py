"""Tests for the report logic of bench.py; the Mac-only parts run on the Mac itself."""

import unittest

from bench import _FOOTPRINT, _METAL_IN_USE, _RSS, Row, Run, markdown, summarize

# Trimmed stderr of `/usr/bin/time -l` on macOS.
TIME_STDERR = """
        2.31 real         5.02 user         0.48 sys
           734855168  maximum resident set size
              812345  peak memory footprint
"""


def row(run: str, script: str, wer: float, hit: int, wall: float, peak: float | None) -> Row:
    return Row(run, script, 60.0, wall, wer, wer / 2, hit, 18, ["po"] if hit < 18 else [], peak, run.startswith("wcpp"))


class TimeParsingTest(unittest.TestCase):
    def test_reads_rss_and_footprint_in_bytes(self) -> None:
        rss = _RSS.search(TIME_STDERR)
        footprint = _FOOTPRINT.search(TIME_STDERR)
        assert rss is not None and footprint is not None
        self.assertEqual(int(rss.group(1)), 734855168)
        self.assertEqual(int(footprint.group(1)), 812345)


class MetalDetectionTest(unittest.TestCase):
    def test_build_flags_alone_do_not_count_as_metal(self) -> None:
        self.assertIsNone(_METAL_IN_USE.search("system_info: n_threads = 4 | Metal : EMBED_LIBRARY = 1 |"))

    def test_backend_initialization_counts_as_metal(self) -> None:
        self.assertIsNotNone(_METAL_IN_USE.search("whisper_backend_init_gpu: using MTL0 backend"))
        self.assertIsNotNone(_METAL_IN_USE.search("ggml_metal_init: allocating"))


class ReportTest(unittest.TestCase):
    def test_summary_averages_wer_and_sums_time(self) -> None:
        runs = [Run("wcpp-small", "whisper.cpp", "small"), Run("fw-small-int8", "faster-whisper", "small")]
        rows = [
            row("wcpp-small", "guion-1", 0.10, 18, 10.0, 500.0),
            row("wcpp-small", "guion-2", 0.20, 17, 20.0, 600.0),
            row("fw-small-int8", "guion-1", 0.30, 16, 60.0, None),
        ]
        summary = summarize(rows, runs)
        first = summary[0]
        self.assertAlmostEqual(float(first["wer"]), 0.15)  # type: ignore[arg-type]
        self.assertEqual(first["terminos"], "35/36")
        self.assertAlmostEqual(float(first["x_tiempo_real"]), 4.0)  # type: ignore[arg-type]
        self.assertEqual(first["ram_max_mb"], 600.0)
        self.assertIsNone(summary[1]["ram_max_mb"])

    def test_markdown_lists_runs_and_misses_without_transcripts(self) -> None:
        runs = [Run("wcpp-small", "whisper.cpp", "small")]
        rows = [row("wcpp-small", "guion-3", 0.25, 17, 15.0, 512.0)]
        report = markdown({"chip": "Apple M1"}, summarize(rows, runs), rows)
        self.assertIn("| wcpp-small | 25.0% | 12.5% | 17/18 | 4.0 | 512 | sí |", report)
        self.assertIn("- wcpp-small / guion-3: po", report)


if __name__ == "__main__":
    unittest.main()
