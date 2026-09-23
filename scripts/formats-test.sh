#!/usr/bin/env bash
# Requires the compose extractor to be healthy. All tooling runs in containers.
set -Eeuo pipefail
docker compose run --rm --no-deps -T extractor python tests/generate_format_inputs.py |
  docker compose run --rm --no-deps -T -e OPENAI_API_KEY= -e NVIDIA_API_KEY= -e LLM_MODEL= backend node scripts/verify-formats.mjs
