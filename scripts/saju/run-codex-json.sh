#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
SCHEMA_DIR="${SCRIPT_DIR}/schemas"
ORIGINAL_HOME="${HOME:-}"

PAYLOAD_FILE="$(mktemp -t saju-codex-payload)"
PROMPT_FILE="$(mktemp -t saju-codex-prompt)"
OUTPUT_FILE="$(mktemp -t saju-codex-output)"

cleanup() {
  rm -f "${PAYLOAD_FILE}" "${PROMPT_FILE}" "${OUTPUT_FILE}"
}
trap cleanup EXIT

prepare_codex_runtime_home() {
  if [[ "${SAJU_CODEX_DISABLE_MCP:-true}" != "true" ]]; then
    return 0
  fi

  local runtime_home="${SAJU_CODEX_RUNTIME_HOME:-${ORIGINAL_HOME}/.codex-saju-runtime}"
  local source_codex_dir="${ORIGINAL_HOME}/.codex"
  local runtime_codex_dir="${runtime_home}/.codex"

  mkdir -p "${runtime_codex_dir}"

  if [[ -f "${source_codex_dir}/auth.json" ]]; then
    cp "${source_codex_dir}/auth.json" "${runtime_codex_dir}/auth.json"
  else
    echo "Missing Codex auth file: ${source_codex_dir}/auth.json" >&2
    exit 1
  fi

  if [[ -f "${source_codex_dir}/models_cache.json" ]]; then
    cp "${source_codex_dir}/models_cache.json" "${runtime_codex_dir}/models_cache.json"
  fi

  if [[ -f "${source_codex_dir}/.personality_migration" ]]; then
    cp "${source_codex_dir}/.personality_migration" "${runtime_codex_dir}/.personality_migration"
  fi

  export HOME="${runtime_home}"
}

cat >"${PAYLOAD_FILE}"

MODE="$(
  node --input-type=module - "${PAYLOAD_FILE}" <<'NODE'
import fs from 'node:fs';

const payloadPath = process.argv[2];
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

if (payload && typeof payload === 'object' && 'draft' in payload) {
  process.stdout.write('render');
} else if (payload && typeof payload === 'object' && 'content' in payload) {
  process.stdout.write('review');
} else {
  process.stderr.write('Unsupported saju Codex payload.\n');
  process.exit(1);
}
NODE
)"

SCHEMA_FILE="${SCHEMA_DIR}/${MODE}-output.schema.json"
if [[ ! -f "${SCHEMA_FILE}" ]]; then
  echo "Missing schema file: ${SCHEMA_FILE}" >&2
  exit 1
fi

node --input-type=module - "${PAYLOAD_FILE}" "${PROMPT_FILE}" <<'NODE'
import fs from 'node:fs';

const payloadPath = process.argv[2];
const promptPath = process.argv[3];
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const mode = payload && typeof payload === 'object' && 'draft' in payload ? 'render' : 'review';
const instruction =
  payload && typeof payload === 'object' && typeof payload.instruction === 'string'
    ? payload.instruction.trim()
    : 'Return strict JSON only.';

const prompt = [
  'You are preparing production content for a Korean MBTI + saju service.',
  'Follow the request JSON exactly.',
  'Return only valid JSON that matches the provided output schema.',
  'Do not wrap the answer in markdown or code fences.',
  'Do not call tools, browse, or explain your reasoning.',
  mode === 'render'
    ? 'Preserve the saju-first reasoning, visible evidence, timing interpretation, and monetary flow from the draft. Improve authority, warmth, and readability in Korean.'
    : 'Review the candidate strictly for saju-first reasoning, evidence visibility, subject alignment, timing relevance, and MBTI as a secondary refinement layer.',
  instruction,
  'Request JSON:',
  JSON.stringify(payload, null, 2)
].join('\n\n');

fs.writeFileSync(promptPath, prompt);
NODE

CODEX_ARGS=(
  exec
  -C "${ROOT_DIR}"
  --skip-git-repo-check
  --ephemeral
  --color never
  --output-schema "${SCHEMA_FILE}"
  -o "${OUTPUT_FILE}"
  -
)

if [[ -n "${SAJU_CODEX_MODEL:-}" ]]; then
  CODEX_ARGS+=(-m "${SAJU_CODEX_MODEL}")
fi

if [[ -n "${SAJU_CODEX_PROFILE:-}" ]]; then
  CODEX_ARGS+=(-p "${SAJU_CODEX_PROFILE}")
fi

prepare_codex_runtime_home
codex "${CODEX_ARGS[@]}" <"${PROMPT_FILE}" >/dev/null
cat "${OUTPUT_FILE}"
