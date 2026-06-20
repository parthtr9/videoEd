#!/usr/bin/env python3
"""
Strip background from a product image using rembg (CPU-only).
Usage: python3 remove_bg.py <input_path> <output_path>
Outputs the resolved output path on stdout on success.
All errors go to stderr with a non-zero exit code.
"""
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: remove_bg.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    input_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()

    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from rembg import remove
    except ImportError:
        print(
            "rembg is not installed. Run: pip3 install 'rembg[cpu]'",
            file=sys.stderr,
        )
        sys.exit(2)

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(input_path, "rb") as f:
            input_data = f.read()
        output_data = remove(input_data)
        with open(output_path, "wb") as f:
            f.write(output_data)
    except Exception as e:
        print(f"rembg processing failed: {e}", file=sys.stderr)
        sys.exit(1)

    print(str(output_path))


if __name__ == "__main__":
    main()
