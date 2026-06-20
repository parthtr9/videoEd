#!/usr/bin/env python3
"""
Generate speech audio from text using Piper TTS (CPU-only, free).
Usage: python3 synthesize_speech.py <text> <output_wav_path> <model_path>
Prints the resolved output path to stdout on success.
All errors go to stderr with a non-zero exit code.
"""
import sys
import wave
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 4:
        print(
            "Usage: synthesize_speech.py <text> <output_wav_path> <model_path>",
            file=sys.stderr,
        )
        sys.exit(1)

    text = sys.argv[1]
    output_path = Path(sys.argv[2]).resolve()
    model_path = Path(sys.argv[3]).resolve()

    if not text.strip():
        print("Text must not be empty.", file=sys.stderr)
        sys.exit(1)

    if not model_path.exists():
        print(f"Model file not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    config_path = Path(str(model_path) + ".json")
    if not config_path.exists():
        print(f"Model config not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from piper import PiperVoice
    except ImportError:
        print(
            "piper-tts is not installed. Run: pip3 install piper-tts",
            file=sys.stderr,
        )
        sys.exit(2)

    try:
        voice = PiperVoice.load(str(model_path), config_path=str(config_path), use_cuda=False)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(output_path), "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)
    except Exception as e:
        print(f"Piper synthesis failed: {e}", file=sys.stderr)
        sys.exit(1)

    print(str(output_path))


if __name__ == "__main__":
    main()
