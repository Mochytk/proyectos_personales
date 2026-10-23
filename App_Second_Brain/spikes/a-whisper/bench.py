"""Spike A: Whisper benchmark for the Mac (throwaway code, never merged).

Compares whisper.cpp (Metal) and faster-whisper (CPU) on three recordings of the
synthetic scripts in refs/. Saves and prints numbers only. Audio, models and
transcripts stay in --out, outside the repo.

Usage, from this folder:
    uv run python bench.py --audio-dir ~/SegundoCerebro-spikes/a/audio
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import wave
from dataclasses import asdict, dataclass
from importlib import metadata
from pathlib import Path

from textmetrics import key_term_hits, wer

HERE = Path(__file__).resolve().parent
REFS = HERE / "refs"
SCRIPTS = ["guion-1", "guion-2", "guion-3"]
AUDIO_EXTENSIONS = [".m4a", ".wav", ".mp3", ".caf", ".aac"]
DEFAULT_OUT = Path.home() / "SegundoCerebro-spikes" / "a"

GGML_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{file}"
# SHA-1 published in https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md (read 23-10-2026).
GGML_MODELS = {
    "small": ("ggml-small.bin", "55356645c2b361a969dfd0ef2c5a50d530afd8d5"),
    "large-v3-turbo-q5_0": ("ggml-large-v3-turbo-q5_0.bin", "e050f7970618a659205450ad97eb95a18d69c9ee"),
    "large-v3-turbo": ("ggml-large-v3-turbo.bin", "4af2b29d7ec73d781377bfd1758ca957a807e941"),
}
# Same repos faster-whisper 1.2.1 uses for "small" and "turbo" (faster_whisper/utils.py).
FW_MODELS = {
    "small": "Systran/faster-whisper-small",
    "turbo": "mobiuslabsgmbh/faster-whisper-large-v3-turbo",
}
FW_FILES = ["config.json", "preprocessor_config.json", "model.bin", "tokenizer.json", "vocabulary.*"]

# A short vocabulary hint, like the one the app would build from your own term list.
PROMPT = (
    "Nota de voz en español de Chile con términos técnicos en inglés: "
    "deploy, merge, pull request, frontend, TypeScript, embeddings, SQLite, Markdown."
)


@dataclass(frozen=True)
class Run:
    name: str
    engine: str  # "whisper.cpp" | "faster-whisper"
    model: str
    prompt: bool = False
    background: bool = False


DEFAULT_RUNS = [
    Run("wcpp-small", "whisper.cpp", "small"),
    Run("wcpp-turbo-q5", "whisper.cpp", "large-v3-turbo-q5_0"),
    Run("wcpp-turbo-q5-prompt", "whisper.cpp", "large-v3-turbo-q5_0", prompt=True),
    Run("wcpp-turbo-q5-background", "whisper.cpp", "large-v3-turbo-q5_0", background=True),
    Run("fw-small-int8", "faster-whisper", "small"),
    Run("fw-turbo-int8", "faster-whisper", "turbo"),
]
FULL_RUNS = [Run("wcpp-turbo-f16", "whisper.cpp", "large-v3-turbo")]


# ---------- downloads with integrity checks ----------


def file_hash(path: Path, algorithm: str) -> str:
    digest = hashlib.new(algorithm)
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, dest: Path) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"  descargando {dest.name} ...", flush=True)
    with urllib.request.urlopen(url) as response, tmp.open("wb") as out:  # noqa: S310 (fixed https URL)
        shutil.copyfileobj(response, out, length=1 << 20)
    tmp.rename(dest)


def ensure_ggml(model: str, models_dir: Path) -> Path:
    filename, expected_sha1 = GGML_MODELS[model]
    path = models_dir / filename
    if not path.exists():
        download(GGML_URL.format(file=filename), path)
    actual = file_hash(path, "sha1")
    if actual != expected_sha1:
        path.unlink()
        sys.exit(f"ERROR: {filename} no coincide con el SHA-1 oficial ({actual}). Lo borré; no se usa.")
    print(f"  {filename}: SHA-1 verificado")
    return path


def ensure_fw(model: str, models_dir: Path) -> tuple[Path, str]:
    from huggingface_hub import HfApi, snapshot_download

    repo_id = FW_MODELS[model]
    info = HfApi().model_info(repo_id, files_metadata=True)
    revision = info.sha or ""
    target = models_dir / f"fw-{model}"
    snapshot_download(repo_id, revision=revision, allow_patterns=FW_FILES, local_dir=target)
    for sibling in info.siblings or []:
        lfs = sibling.lfs
        local = target / sibling.rfilename
        if lfs is None or not local.exists():
            continue
        if file_hash(local, "sha256") != lfs.sha256:
            sys.exit(f"ERROR: {repo_id}/{sibling.rfilename} no coincide con su SHA-256 publicado.")
    print(f"  {repo_id}@{revision[:12]}: SHA-256 verificado")
    return target, revision


# ---------- audio ----------


def find_audio(audio_dir: Path, script: str) -> Path:
    for extension in AUDIO_EXTENSIONS:
        candidate = audio_dir / f"{script}{extension}"
        if candidate.exists():
            return candidate
    sys.exit(f"ERROR: falta {audio_dir}/{script}.m4a (u otro formato de {AUDIO_EXTENSIONS}).")


def to_wav16k(source: Path, dest: Path) -> float:
    """Convert with macOS afconvert to 16 kHz mono PCM, the format whisper.cpp expects."""
    subprocess.run(
        ["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", str(source), str(dest)],
        check=True,
    )
    with wave.open(str(dest)) as wav:
        return wav.getnframes() / wav.getframerate()


# ---------- timed execution ----------

_RSS = re.compile(r"(\d+)\s+maximum resident set size")
# Lines whisper.cpp logs only when the Metal backend is really initialized (not the build flags).
_METAL_IN_USE = re.compile(r"using (?:metal|mtl\d*) backend|ggml_metal_(?:device_)?init", re.IGNORECASE)
_FOOTPRINT = re.compile(r"(\d+)\s+peak memory footprint")


@dataclass(frozen=True)
class Row:
    run: str
    script: str
    audio_s: float
    wall_s: float
    wer: float
    wer_sin_tildes: float
    terms_hit: int
    terms_total: int
    misses: list[str]
    peak_mb: float | None
    metal: bool


@dataclass
class Timed:
    stdout: str
    stderr: str
    wall_s: float
    max_rss_mb: float | None
    peak_footprint_mb: float | None


def run_timed(command: list[str]) -> Timed:
    started = time.perf_counter()
    done = subprocess.run(["/usr/bin/time", "-l", *command], capture_output=True, text=True)
    wall = time.perf_counter() - started
    if done.returncode != 0:
        tail = "\n".join(done.stderr.splitlines()[-15:])
        sys.exit(f"ERROR al ejecutar {command[0]}:\n{tail}")
    rss = _RSS.search(done.stderr)
    footprint = _FOOTPRINT.search(done.stderr)
    return Timed(
        stdout=done.stdout,
        stderr=done.stderr,
        wall_s=wall,
        max_rss_mb=int(rss.group(1)) / 2**20 if rss else None,
        peak_footprint_mb=int(footprint.group(1)) / 2**20 if footprint else None,
    )


def transcribe_whisper_cpp(run: Run, model_path: Path, wav: Path, out_prefix: Path) -> tuple[str, Timed, bool]:
    command = ["whisper-cli", "-m", str(model_path), "-f", str(wav), "-l", "es", "-t", "4", "-otxt", "-of", str(out_prefix)]
    if run.prompt:
        command += ["--prompt", PROMPT]
    if run.background:
        command = ["taskpolicy", "-b", *command]
    timed = run_timed(command)
    used_metal = _METAL_IN_USE.search(timed.stderr) is not None
    text = out_prefix.with_suffix(".txt").read_text(encoding="utf-8")
    return text, timed, used_metal


def transcribe_faster_whisper(run: Run, model_dir: Path, audio: Path) -> tuple[str, Timed]:
    command = [sys.executable, str(HERE / "fw_run.py"), "--model-dir", str(model_dir), "--audio", str(audio)]
    if run.prompt:
        command += ["--prompt", PROMPT]
    timed = run_timed(command)
    result = json.loads(timed.stdout.strip().splitlines()[-1])
    return str(result["text"]), timed


# ---------- report ----------


def system_info() -> dict[str, str]:
    def sh(*command: str) -> str:
        return subprocess.run(command, capture_output=True, text=True).stdout.strip()

    return {
        "chip": sh("sysctl", "-n", "machdep.cpu.brand_string"),
        "ram_gb": str(round(int(sh("sysctl", "-n", "hw.memsize") or 0) / 2**30)),
        "macos": sh("sw_vers", "-productVersion"),
        "whisper.cpp": sh("brew", "list", "--versions", "whisper.cpp") or "desconocida",
        "faster-whisper": metadata.version("faster-whisper"),
        "python": platform.python_version(),
    }


def summarize(rows: list[Row], runs: list[Run]) -> list[dict[str, object]]:
    summary: list[dict[str, object]] = []
    for run in runs:
        mine = [row for row in rows if row.run == run.name]
        if not mine:
            continue
        peaks = [row.peak_mb for row in mine if row.peak_mb is not None]
        summary.append(
            {
                "run": run.name,
                "wer": sum(row.wer for row in mine) / len(mine),
                "wer_sin_tildes": sum(row.wer_sin_tildes for row in mine) / len(mine),
                "terminos": f"{sum(row.terms_hit for row in mine)}/{sum(row.terms_total for row in mine)}",
                "x_tiempo_real": sum(row.audio_s for row in mine) / sum(row.wall_s for row in mine),
                "ram_max_mb": max(peaks) if peaks else None,
                "metal": any(row.metal for row in mine),
            }
        )
    return summary


def markdown(info: dict[str, str], summary: list[dict[str, object]], rows: list[Row]) -> str:
    lines = ["# Spike A: resultados", "", "| Dato | Valor |", "| --- | --- |"]
    lines += [f"| {key} | {value} |" for key, value in info.items()]
    lines += [
        "",
        "| Corrida | WER | WER sin tildes | Términos clave | × tiempo real | RAM máx. (MB) | Metal |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for item in summary:
        ram = item["ram_max_mb"]
        lines.append(
            f"| {item['run']} | {item['wer']:.1%} | {item['wer_sin_tildes']:.1%} | {item['terminos']} "
            f"| {item['x_tiempo_real']:.1f} | {f'{ram:.0f}' if ram is not None else '?'} "
            f"| {'sí' if item['metal'] else 'no'} |"
        )
    lines += ["", "Términos clave que fallaron (de los guiones sintéticos):", ""]
    lines += [f"- {row.run} / {row.script}: {', '.join(row.misses)}" for row in rows if row.misses]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--audio-dir", type=Path, required=True, help="carpeta con guion-1.m4a, guion-2.m4a y guion-3.m4a")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"carpeta de trabajo (por defecto {DEFAULT_OUT})")
    parser.add_argument("--full", action="store_true", help="agrega large-v3-turbo sin cuantizar (1,5 GiB más)")
    parser.add_argument("--only", nargs="*", help="corre solo estas corridas (por nombre)")
    args = parser.parse_args()

    if platform.system() != "Darwin" or platform.machine() != "arm64":
        sys.exit("Este benchmark está pensado para un Mac con Apple silicon.")
    for tool in ("whisper-cli", "afconvert", "taskpolicy"):
        if shutil.which(tool) is None:
            sys.exit(f"ERROR: falta '{tool}' en el PATH. Revisa el README de este spike.")

    runs = DEFAULT_RUNS + (FULL_RUNS if args.full else [])
    if args.only:
        runs = [run for run in runs if run.name in args.only]
    out: Path = args.out.expanduser()
    models_dir, hyp_dir, wav_dir = out / "models", out / "transcripciones", out / "wav"
    for folder in (models_dir, hyp_dir, wav_dir):
        folder.mkdir(parents=True, exist_ok=True)

    print("1/3 Modelos")
    ggml_paths = {run.model: ensure_ggml(run.model, models_dir) for run in runs if run.engine == "whisper.cpp"}
    fw_dirs: dict[str, Path] = {}
    revisions: dict[str, str] = {}
    for run in runs:
        if run.engine == "faster-whisper" and run.model not in fw_dirs:
            fw_dirs[run.model], revisions[run.model] = ensure_fw(run.model, models_dir)

    print("2/3 Audio")
    audio: dict[str, tuple[Path, Path, float]] = {}
    for script in SCRIPTS:
        source = find_audio(args.audio_dir.expanduser(), script)
        wav = wav_dir / f"{script}.wav"
        duration = to_wav16k(source, wav)
        audio[script] = (source, wav, duration)
        print(f"  {script}: {duration:.0f} s")

    print("3/3 Transcripciones (puede tardar varios minutos)")
    terms = json.loads((REFS / "terminos.json").read_text(encoding="utf-8"))
    rows: list[Row] = []
    for run in runs:
        for script in SCRIPTS:
            _source, wav, duration = audio[script]
            print(f"  {run.name} / {script} ...", flush=True)
            if run.engine == "whisper.cpp":
                text, timed, metal = transcribe_whisper_cpp(run, ggml_paths[run.model], wav, hyp_dir / f"{run.name}-{script}")
            else:
                text, timed = transcribe_faster_whisper(run, fw_dirs[run.model], wav)
                metal = False
                (hyp_dir / f"{run.name}-{script}.txt").write_text(text, encoding="utf-8")
            reference = (REFS / f"{script}.txt").read_text(encoding="utf-8")
            hits, misses = key_term_hits(terms[script], text)
            rows.append(
                Row(
                    run=run.name,
                    script=script,
                    audio_s=duration,
                    wall_s=timed.wall_s,
                    wer=wer(reference, text),
                    wer_sin_tildes=wer(reference, text, strip_accents=True),
                    terms_hit=len(hits),
                    terms_total=len(hits) + len(misses),
                    misses=misses,
                    peak_mb=timed.peak_footprint_mb or timed.max_rss_mb,
                    metal=metal,
                )
            )

    info = system_info() | {f"revisión fw-{model}": rev[:12] for model, rev in revisions.items()}
    summary = summarize(rows, runs)
    (out / "results.json").write_text(json.dumps({"system": info, "summary": summary, "rows": [asdict(row) for row in rows]}, indent=2), encoding="utf-8")
    report = markdown(info, summary, rows)
    (out / "results.md").write_text(report, encoding="utf-8")
    print("\n" + report)
    print(f"Copia y pégame el bloque de arriba (también quedó en {out / 'results.md'}).")


if __name__ == "__main__":
    main()
