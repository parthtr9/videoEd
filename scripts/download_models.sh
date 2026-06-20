#!/usr/bin/env bash
# Downloads required ML models for this pipeline.
# Run once per machine / Lambda container build.
# Safe to re-run — skips files that already exist.
set -euo pipefail

MODELS_DIR="$(cd "$(dirname "$0")/.." && pwd)/models"
mkdir -p "$MODELS_DIR"

# Piper TTS — en_US lessac medium voice
PIPER_BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium"
ONNX="$MODELS_DIR/en_US-lessac-medium.onnx"
JSON="$MODELS_DIR/en_US-lessac-medium.onnx.json"

if [ ! -f "$ONNX" ]; then
  echo "Downloading Piper voice model (~60MB)..."
  curl -L -o "$ONNX" "$PIPER_BASE/en_US-lessac-medium.onnx"
else
  echo "Piper model already present, skipping."
fi

if [ ! -f "$JSON" ]; then
  echo "Downloading Piper voice config..."
  curl -L -o "$JSON" "$PIPER_BASE/en_US-lessac-medium.onnx.json"
else
  echo "Piper config already present, skipping."
fi

echo "All models ready in $MODELS_DIR"
