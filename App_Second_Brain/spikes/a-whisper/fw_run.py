"""Run one faster-whisper transcription in its own process and print a JSON line.

Kept separate from bench.py so /usr/bin/time measures this model's peak memory alone.
"""

import argparse
import json
import time

from faster_whisper import WhisperModel


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--prompt", default=None)
    args = parser.parse_args()

    started = time.perf_counter()
    model = WhisperModel(
        args.model_dir,
        device="cpu",
        compute_type=args.compute_type,
        cpu_threads=args.threads,
        local_files_only=True,
    )
    loaded = time.perf_counter()
    segments, _info = model.transcribe(
        args.audio, language="es", beam_size=5, initial_prompt=args.prompt
    )
    text = " ".join(segment.text.strip() for segment in segments)  # consuming the generator runs it
    finished = time.perf_counter()
    print(json.dumps({"load_s": loaded - started, "transcribe_s": finished - loaded, "text": text}))


if __name__ == "__main__":
    main()
