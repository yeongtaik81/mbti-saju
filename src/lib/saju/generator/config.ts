import type { PipelineMode } from './types';

const DEFAULT_LOCAL_CODEX_COMMAND = 'bash scripts/saju/run-codex-json.sh';
export const RULE_VERSION = 'rules-2.0.0';
export const TEMPLATE_VERSION = 'template-3.6.0';
export const PROMPT_VERSION = 'prompt-3.9.0';
export const MODEL_VERSION = 'local-codex-fallback-1.0.0';
export const SUBJECT_RULESET_VERSION = 'subject-rules-1.6.0';
const DEFAULT_PIPELINE_MODE = 'verified-llm-optional';
const DEFAULT_MAX_RENDER_ATTEMPTS = 1;
const DEFAULT_LLM_TIMEOUT_MS = 30_000;

export function resolvePipelineMode(): PipelineMode {
  const raw = process.env.SAJU_PIPELINE_MODE?.trim();
  if (
    raw === 'rule-only' ||
    raw === 'verified-llm-optional' ||
    raw === 'verified-llm-required'
  ) {
    return raw;
  }

  return DEFAULT_PIPELINE_MODE;
}

export function resolveLocalCodexCommand(): string | null {
  if (process.env.SAJU_LLM_MODE !== 'local-codex') {
    return null;
  }

  const configured = process.env.SAJU_LLM_COMMAND?.trim();
  if (configured) {
    return configured;
  }

  return DEFAULT_LOCAL_CODEX_COMMAND;
}

export function resolveMaxRenderAttempts(): number {
  const parsed = Number(process.env.SAJU_LLM_MAX_ATTEMPTS?.trim() ?? '');
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_MAX_RENDER_ATTEMPTS;
}

export function resolveLlmTimeoutMs(): number {
  const parsed = Number(process.env.SAJU_LLM_TIMEOUT_MS?.trim() ?? '');
  if (Number.isFinite(parsed) && parsed >= 5_000) {
    return parsed;
  }

  return DEFAULT_LLM_TIMEOUT_MS;
}

export function isLlmReviewEnabled(): boolean {
  return process.env.SAJU_LLM_REVIEW_ENABLED?.trim().toLowerCase() === 'true';
}
