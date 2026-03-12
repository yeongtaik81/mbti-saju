import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tryGenerateByLocalCodexMock, reviewByLocalCodexMock } = vi.hoisted(
  () => ({
    tryGenerateByLocalCodexMock: vi.fn(),
    reviewByLocalCodexMock: vi.fn()
  })
);

vi.mock('@/lib/saju/generator/llm', () => ({
  tryGenerateByLocalCodex: tryGenerateByLocalCodexMock,
  reviewByLocalCodex: reviewByLocalCodexMock
}));

import { buildRuleBasedDraft } from '@/lib/saju/generator/draft';
import { generateSajuContent } from '@/lib/saju/generator';
import { createSelfGenerationInput } from './fixtures';

const ENV_KEYS = [
  'SAJU_PIPELINE_MODE',
  'SAJU_LLM_MODE',
  'SAJU_LLM_COMMAND',
  'SAJU_LLM_REVIEW_ENABLED',
  'SAJU_LLM_MAX_ATTEMPTS'
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('generateSajuContent pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns a rule-only result without invoking llm helpers', async () => {
    process.env.SAJU_PIPELINE_MODE = 'rule-only';
    const input = createSelfGenerationInput('BASIC');

    const result = await generateSajuContent(input);

    expect(result.metadata.pipeline).toEqual({
      mode: 'rule-only',
      llmRendered: false,
      llmReviewed: false
    });
    expect(tryGenerateByLocalCodexMock).not.toHaveBeenCalled();
    expect(reviewByLocalCodexMock).not.toHaveBeenCalled();
  });

  it('falls back to the rule draft when llm rendering is optional and unavailable', async () => {
    process.env.SAJU_PIPELINE_MODE = 'verified-llm-optional';
    process.env.SAJU_LLM_MODE = 'local-codex';
    process.env.SAJU_LLM_COMMAND = 'echo mock';
    tryGenerateByLocalCodexMock.mockResolvedValue({
      candidate: null,
      issues: ['LLM 응답을 JSON으로 파싱하지 못했습니다.'],
      debug: {
        mode: 'render',
        command: 'bash scripts/saju/run-codex-json.sh',
        timeoutMs: 45000,
        failureType: 'JSON_PARSE_ERROR'
      }
    });

    const input = createSelfGenerationInput('WEALTH');
    const result = await generateSajuContent(input);

    expect(result.metadata.pipeline).toEqual({
      mode: 'verified-llm-optional',
      llmRendered: false,
      llmReviewed: false
    });
    expect(tryGenerateByLocalCodexMock).toHaveBeenCalledTimes(1);
  });

  it('fails immediately when llm is required but not configured', async () => {
    process.env.SAJU_PIPELINE_MODE = 'verified-llm-required';
    delete process.env.SAJU_LLM_MODE;
    delete process.env.SAJU_LLM_COMMAND;

    await expect(
      generateSajuContent(createSelfGenerationInput('CAREER'))
    ).rejects.toMatchObject({
      stage: 'LLM_RENDER',
      reasonCode: 'LLM_NOT_CONFIGURED'
    });
  });

  it('marks llm render and review as successful when required mode passes review', async () => {
    process.env.SAJU_PIPELINE_MODE = 'verified-llm-required';
    process.env.SAJU_LLM_MODE = 'local-codex';
    process.env.SAJU_LLM_COMMAND = 'echo mock';
    process.env.SAJU_LLM_REVIEW_ENABLED = 'true';

    const input = createSelfGenerationInput('ROMANCE');
    const llmCandidate = buildRuleBasedDraft(input, 'verified-llm-required');

    tryGenerateByLocalCodexMock.mockResolvedValue({
      candidate: llmCandidate
    });
    reviewByLocalCodexMock.mockResolvedValue({
      review: {
        approved: true,
        issues: [],
        score: 0.98
      }
    });

    const result = await generateSajuContent(input);

    expect(result.metadata.pipeline).toEqual({
      mode: 'verified-llm-required',
      llmRendered: true,
      llmReviewed: true
    });
    expect(reviewByLocalCodexMock).toHaveBeenCalledTimes(1);
  });

  it('fails with llm review rejection details when required review rejects the output', async () => {
    process.env.SAJU_PIPELINE_MODE = 'verified-llm-required';
    process.env.SAJU_LLM_MODE = 'local-codex';
    process.env.SAJU_LLM_COMMAND = 'echo mock';
    process.env.SAJU_LLM_REVIEW_ENABLED = 'true';
    process.env.SAJU_LLM_MAX_ATTEMPTS = '1';

    const input = createSelfGenerationInput('MARRIAGE');
    const llmCandidate = buildRuleBasedDraft(input, 'verified-llm-required');

    tryGenerateByLocalCodexMock.mockResolvedValue({
      candidate: llmCandidate
    });
    reviewByLocalCodexMock.mockResolvedValue({
      review: {
        approved: false,
        issues: ['문장이 너무 일반적입니다.'],
        score: 0.42
      },
      debug: {
        mode: 'review',
        command: 'bash scripts/saju/run-codex-json.sh',
        timeoutMs: 45000,
        failureType: 'SCHEMA_MISMATCH'
      }
    });

    await expect(generateSajuContent(input)).rejects.toMatchObject({
      stage: 'LLM_REVIEW',
      reasonCode: 'LLM_REVIEW_REJECTED',
      detail: {
        issues: ['문장이 너무 일반적입니다.'],
        reviewScore: 0.42
      }
    });
  });

  it('stores render debug details when required llm rendering fails before parsing', async () => {
    process.env.SAJU_PIPELINE_MODE = 'verified-llm-required';
    process.env.SAJU_LLM_MODE = 'local-codex';
    process.env.SAJU_LLM_COMMAND = 'echo mock';
    process.env.SAJU_LLM_MAX_ATTEMPTS = '1';

    tryGenerateByLocalCodexMock.mockResolvedValue({
      candidate: null,
      issues: ['LLM 응답을 JSON으로 파싱하지 못했습니다.'],
      debug: {
        mode: 'render',
        command: 'bash scripts/saju/run-codex-json.sh',
        timeoutMs: 45000,
        failureType: 'JSON_PARSE_ERROR',
        stderrPreview: 'unexpected token',
        stdoutPreview: 'not-json'
      }
    });

    await expect(
      generateSajuContent(createSelfGenerationInput('BASIC'))
    ).rejects.toMatchObject({
      stage: 'LLM_RENDER',
      reasonCode: 'LLM_RENDER_FAILED',
      detail: {
        issues: ['LLM 응답을 JSON으로 파싱하지 못했습니다.'],
        llmDebug: {
          failureType: 'JSON_PARSE_ERROR',
          stderrPreview: 'unexpected token',
          stdoutPreview: 'not-json'
        }
      }
    });
  });
});
