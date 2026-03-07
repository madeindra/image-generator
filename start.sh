#!/usr/bin/env bash
# Starts the image generator with API keys from environment variables.
#
# Usage:
#   OPENAI_API_KEY=sk-... GEMINI_API_KEY=AIza... ./start.sh
#   or export them in your shell profile and just run: ./start.sh

DIR="$(cd "$(dirname "$0")" && pwd)"

(sleep 0.5 && open "http://localhost:${PORT:-8080}") &

python3 "${DIR}/server.py"
