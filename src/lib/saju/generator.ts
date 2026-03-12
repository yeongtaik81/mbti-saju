import { Prisma } from '@prisma/client';
import {
  isLlmReviewEnabled,
  MODEL_VERSION,
  PROMPT_VERSION,
  resolveLocalCodexCommand,
  resolveMaxRenderAttempts,
  resolvePipelineMode,
  RULE_VERSION,
  TEMPLATE_VERSION
} from './generator/config';
import { buildRuleBasedDraft } from './generator/draft';
import { reviewByLocalCodex, tryGenerateByLocalCodex } from './generator/llm';
import {
  finalizeContent,
  validateFinalGuard,
  validateGeneratedCandidate
} from './generator/validate';
import {
  type GeneratedSajuContent,
  type SajuGenerationInput,
  SajuGenerationFailureError
} from './generator/types';

export type {
  BirthInfo,
  GeneratedSajuContent,
  LlmCandidate,
  LlmReviewResult,
  PipelineMode,
  RuleDraft,
  SajuGenerationInput,
  SajuInternalMetadata,
  SajuSections,
  SubjectContext
} from './generator/types';
export { SajuGenerationFailureError } from './generator/types';
export {
  MODEL_VERSION,
  PROMPT_VERSION,
  RULE_VERSION,
  TEMPLATE_VERSION
} from './generator/config';

function toJsonDetail(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

export async function generateSajuContent(
  input: SajuGenerationInput
): Promise<GeneratedSajuContent> {
  const pipelineMode = resolvePipelineMode();
  const draft = buildRuleBasedDraft(input, pipelineMode);
  const draftValidationIssues = validateGeneratedCandidate(input, draft);
  if (draftValidationIssues.length > 0) {
    throw new SajuGenerationFailureError({
      stage: 'RULE_DRAFT',
      reasonCode: 'RULE_DRAFT_INVALID',
      message: '규칙 기반 초안이 필수 품질 기준을 통과하지 못했습니다.',
      detail: draftValidationIssues
    });
  }

  let content = finalizeContent(draft, draft);
  let llmRendered = false;
  let llmReviewed = false;
  let lastRenderIssues: string[] = [];
  let lastRenderDetail: Prisma.JsonValue | undefined;

  if (pipelineMode !== 'rule-only') {
    if (!resolveLocalCodexCommand()) {
      if (pipelineMode === 'verified-llm-required') {
        throw new SajuGenerationFailureError({
          stage: 'LLM_RENDER',
          reasonCode: 'LLM_NOT_CONFIGURED',
          message: 'LLM 생성기가 설정되어 있지 않습니다.'
        });
      }
    } else {
      for (
        let attempt = 0;
        attempt < resolveMaxRenderAttempts();
        attempt += 1
      ) {
        const llmResult = await tryGenerateByLocalCodex(input, draft);
        if (!llmResult.candidate) {
          lastRenderIssues = llmResult.issues ?? [
            'LLM이 유효한 JSON 결과를 반환하지 않았습니다.'
          ];
          lastRenderDetail = toJsonDetail({
            attempt: attempt + 1,
            issues: lastRenderIssues,
            llmDebug: llmResult.debug ?? null
          });
          continue;
        }

        const candidate = finalizeContent(llmResult.candidate, draft);
        const candidateIssues = validateGeneratedCandidate(input, candidate);
        if (candidateIssues.length > 0) {
          lastRenderIssues = candidateIssues;
          lastRenderDetail = toJsonDetail({
            attempt: attempt + 1,
            issues: candidateIssues,
            llmDebug: llmResult.debug ?? null
          });
          continue;
        }

        if (isLlmReviewEnabled()) {
          const reviewResult = await reviewByLocalCodex(input, candidate);
          if (reviewResult.review) {
            llmReviewed = true;
            if (!reviewResult.review.approved) {
              lastRenderIssues = reviewResult.review.issues;
              lastRenderDetail = toJsonDetail({
                attempt: attempt + 1,
                issues: reviewResult.review.issues,
                reviewScore: reviewResult.review.score,
                llmDebug: reviewResult.debug ?? null
              });
              continue;
            }
          } else if (pipelineMode === 'verified-llm-required') {
            lastRenderIssues = reviewResult.issues ?? [
              'LLM 리뷰어가 결과를 검증하지 못했습니다.'
            ];
            lastRenderDetail = toJsonDetail({
              attempt: attempt + 1,
              issues: lastRenderIssues,
              llmDebug: reviewResult.debug ?? null
            });
            continue;
          }
        }

        content = candidate;
        llmRendered = true;
        break;
      }

      if (!llmRendered && pipelineMode === 'verified-llm-required') {
        throw new SajuGenerationFailureError({
          stage: llmReviewed ? 'LLM_REVIEW' : 'LLM_RENDER',
          reasonCode: llmReviewed ? 'LLM_REVIEW_REJECTED' : 'LLM_RENDER_FAILED',
          message: 'LLM 기반 해석 생성이 품질 기준을 충족하지 못했습니다.',
          detail:
            lastRenderDetail ??
            toJsonDetail({
              issues: lastRenderIssues
            })
        });
      }
    }
  }

  const contentValidationIssues = validateGeneratedCandidate(input, content);
  if (contentValidationIssues.length > 0) {
    throw new SajuGenerationFailureError({
      stage: 'CODE_VALIDATE',
      reasonCode: 'CONTENT_VALIDATION_FAILED',
      message: '생성된 해석이 필수 섹션 검증을 통과하지 못했습니다.',
      detail: contentValidationIssues
    });
  }

  const finalGuardIssues = validateFinalGuard(content);
  if (finalGuardIssues.length > 0) {
    throw new SajuGenerationFailureError({
      stage: 'FINAL_GUARD',
      reasonCode: 'FINAL_GUARD_FAILED',
      message: '생성된 해석이 최종 품질 가드를 통과하지 못했습니다.',
      detail: finalGuardIssues
    });
  }

  const metadata = {
    ...draft.internalMetadata,
    pipeline: {
      mode: pipelineMode,
      llmRendered,
      llmReviewed
    }
  };

  return {
    summary: content.summary,
    sectionsJson: content.sectionsJson,
    metadata,
    resultJson: {
      summary: content.summary,
      sectionsJson: content.sectionsJson,
      metadata
    } as Prisma.InputJsonValue,
    versions: {
      ruleVersion: RULE_VERSION,
      templateVersion: TEMPLATE_VERSION,
      promptVersion: PROMPT_VERSION,
      modelVersion: MODEL_VERSION
    }
  };
}
