#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

REQUIRED_NEXT_TYPE=".next/types/app/api/v1/saju/readings/route.ts"

if [ ! -f "$REQUIRED_NEXT_TYPE" ]; then
  pnpm exec next build >/dev/null
fi

pnpm exec tsc --noEmit
