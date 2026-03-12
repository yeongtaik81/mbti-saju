import { spawn } from 'node:child_process';
import { resolveLlmTimeoutMs, resolveLocalCodexCommand } from './config';
import { isLlmCandidate, isLlmReviewResult } from './validate';
import type {
  LlmCandidate,
  LocalCodexDebugInfo,
  LocalCodexRenderResult,
  LocalCodexReviewResult,
  SajuGenerationInput
} from './types';

function previewText(value: unknown, maxLength = 1200): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength)}…`
    : trimmed;
}

function buildExecFailureDebug(input: {
  mode: 'render' | 'review';
  command: string | null;
  timeoutMs: number;
  error: unknown;
}): LocalCodexDebugInfo {
  const target = input.error as
    | (Error & {
        stdout?: string;
        stderr?: string;
        code?: number | string | null;
        signal?: string | null;
        killed?: boolean;
      })
    | undefined;

  const timedOut =
    /timed out/i.test(target?.message ?? '') ||
    (target?.killed === true &&
      (target?.signal === 'SIGTERM' || target?.signal === 'SIGKILL'));

  const failureType = timedOut
    ? 'TIMEOUT'
    : target?.signal === 'SIGKILL'
      ? 'PROCESS_KILLED'
      : 'EXEC_ERROR';

  return {
    mode: input.mode,
    command: input.command,
    timeoutMs: input.timeoutMs,
    failureType,
    errorMessage: target?.message ?? 'Unknown execution error',
    stdoutPreview: previewText(target?.stdout),
    stderrPreview: previewText(target?.stderr),
    exitCode:
      typeof target?.code === 'number'
        ? target.code
        : typeof target?.code === 'string'
          ? Number(target.code) || null
          : null,
    signal: target?.signal ?? null,
    killed: target?.killed ?? false
  };
}

function runLocalCodexCommand(input: {
  command: string;
  payload: string;
  timeoutMs: number;
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-lc', input.command], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let killedByTimeout = false;

    const finish = (
      error:
        | (Error & {
            stdout?: string;
            stderr?: string;
            code?: number | null;
            signal?: string | null;
            killed?: boolean;
          })
        | null,
      result?: { stdout: string; stderr: string }
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutHandle);

      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve(result ?? { stdout, stderr });
    };

    const timeoutHandle = setTimeout(() => {
      killedByTimeout = true;
      child.kill('SIGKILL');
    }, input.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      const target = error as Error & {
        stdout?: string;
        stderr?: string;
        code?: number | null;
        signal?: string | null;
        killed?: boolean;
      };
      target.killed = killedByTimeout;
      finish(target);
    });

    child.on('close', (code, signal) => {
      if (code === 0 && !signal) {
        finish(null, { stdout, stderr });
        return;
      }

      const error = new Error(
        killedByTimeout
          ? `Command timed out after ${input.timeoutMs}ms`
          : `Command exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`
      ) as Error & {
        stdout?: string;
        stderr?: string;
        code?: number | null;
        signal?: string | null;
        killed?: boolean;
      };

      error.code = code;
      error.signal = signal;
      error.killed = killedByTimeout;
      finish(error);
    });

    child.stdin.on('error', (error) => {
      const target = error as Error & {
        stdout?: string;
        stderr?: string;
        code?: number | null;
        signal?: string | null;
        killed?: boolean;
      };
      target.killed = killedByTimeout;
      finish(target);
    });

    child.stdin.end(input.payload);
  });
}

export async function tryGenerateByLocalCodex(
  input: SajuGenerationInput,
  draft: LlmCandidate
): Promise<LocalCodexRenderResult> {
  if (process.env.SAJU_LLM_MODE !== 'local-codex') {
    return {
      candidate: null,
      issues: ['SAJU_LLM_MODE가 local-codex가 아닙니다.'],
      debug: {
        mode: 'render',
        command: null,
        timeoutMs: resolveLlmTimeoutMs(),
        failureType: 'NOT_ENABLED'
      }
    };
  }

  const command = resolveLocalCodexCommand();
  if (!command) {
    return {
      candidate: null,
      issues: ['로컬 Codex 실행 커맨드가 설정되어 있지 않습니다.'],
      debug: {
        mode: 'render',
        command: null,
        timeoutMs: resolveLlmTimeoutMs(),
        failureType: 'NOT_CONFIGURED'
      }
    };
  }

  const timeoutMs = resolveLlmTimeoutMs();

  try {
    const { stdout, stderr } = await runLocalCodexCommand({
      command,
      payload: JSON.stringify(
        {
          input,
          draft,
          instruction:
            'Return strict JSON only. Write in warm Korean, like a thoughtful woman in her 30s or 40s speaking to a friend. Do not stack isolated one-line statements. Each major section should read as 1 or 2 connected paragraphs, with 2 to 4 sentences per paragraph. Respect the selected scenario and make the reading feel specific to that situation rather than a generic category summary. The upper visual section already shows technical saju data, so do not fill the body text with jargon such as 원국, 십성, 지장간, 12운성, 현금흐름, 포지셔닝, 리스크, 운영, 구조화. Use easy everyday language in the body. If you mention that an element is strong or weak, immediately explain what that means in daily life. Do not expose internal classifier labels or type names such as 누수관리형, 긴장성장형, 균형축적형, 신중거리형 그대로 in user-facing prose. Paraphrase their meaning in plain Korean instead. Avoid repeating the same key noun such as 흐름, 기준, 관계, 운 more than necessary inside one paragraph; vary the wording naturally in plain Korean. If MBTI is missing, do not mention that it is missing or unavailable; simply open with a gentle temperament sentence in plain Korean. Keep interpretation weighting as saju 70~80% and MBTI 20~30%. Blend MBTI naturally across the result instead of creating a standalone MBTI section, and connect MBTI and saju in the same paragraph. Open the major user-facing sections (summary, overview, narrativeFlow, relationshipFlow, wealthFlow, timingHint, caution) with one short MBTI-framed sentence before continuing into saju reasoning. Use clear, confident phrasing such as "~합니다", "~편입니다", "~하기 쉬운 흐름입니다". Avoid vague hedging like "가능성이 있습니다". Give practical and specific advice. actions must contain exactly 3 items. Keep JSON schema: {summary, sectionsJson:{overview,coreSignal,caution,actions,reflectionQuestion,storyTitle?,sajuEvidence?,sajuBasis?,subjectLens?,narrativeFlow?,tenYearFlow?,currentDaewoon?,yearlyFlow?,wealthFlow?,relationshipFlow?,pairDynamic?,attractionPoint?,conflictTrigger?,communicationTip?,relationshipLens?,careerMoneyLens?,timingHint?}}.'
        },
        null,
        2
      ),
      timeoutMs
    });

    const stdoutPreview = previewText(stdout);
    const stderrPreview = previewText(stderr);
    if (!stdoutPreview) {
      return {
        candidate: null,
        issues: ['LLM이 비어 있는 응답을 반환했습니다.'],
        debug: {
          mode: 'render',
          command,
          timeoutMs,
          failureType: 'EMPTY_STDOUT',
          stdoutPreview,
          stderrPreview
        }
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout) as unknown;
    } catch (error) {
      return {
        candidate: null,
        issues: ['LLM 응답을 JSON으로 파싱하지 못했습니다.'],
        debug: {
          mode: 'render',
          command,
          timeoutMs,
          failureType: 'JSON_PARSE_ERROR',
          errorMessage:
            error instanceof Error ? error.message : 'JSON parse error',
          stdoutPreview,
          stderrPreview
        }
      };
    }

    if (!isLlmCandidate(parsed)) {
      return {
        candidate: null,
        issues: ['LLM JSON이 기대한 해석 스키마와 맞지 않습니다.'],
        debug: {
          mode: 'render',
          command,
          timeoutMs,
          failureType: 'SCHEMA_MISMATCH',
          stdoutPreview,
          stderrPreview
        }
      };
    }

    return {
      candidate: parsed
    };
  } catch (error) {
    const debug = buildExecFailureDebug({
      mode: 'render',
      command,
      timeoutMs,
      error
    });

    return {
      candidate: null,
      issues: [
        debug.failureType === 'TIMEOUT'
          ? 'LLM 응답이 제한 시간 안에 완료되지 않았습니다.'
          : debug.failureType === 'PROCESS_KILLED'
            ? 'LLM 하위 프로세스가 비정상 종료되었습니다.'
            : 'LLM 실행 중 오류가 발생했습니다.'
      ],
      debug
    };
  }
}

export async function reviewByLocalCodex(
  input: SajuGenerationInput,
  content: LlmCandidate
): Promise<LocalCodexReviewResult> {
  if (process.env.SAJU_LLM_MODE !== 'local-codex') {
    return {
      review: null,
      issues: ['SAJU_LLM_MODE가 local-codex가 아닙니다.'],
      debug: {
        mode: 'review',
        command: null,
        timeoutMs: resolveLlmTimeoutMs(),
        failureType: 'NOT_ENABLED'
      }
    };
  }

  const command = resolveLocalCodexCommand();
  if (!command) {
    return {
      review: null,
      issues: ['로컬 Codex 실행 커맨드가 설정되어 있지 않습니다.'],
      debug: {
        mode: 'review',
        command: null,
        timeoutMs: resolveLlmTimeoutMs(),
        failureType: 'NOT_CONFIGURED'
      }
    };
  }

  const timeoutMs = resolveLlmTimeoutMs();

  try {
    const { stdout, stderr } = await runLocalCodexCommand({
      command,
      payload: JSON.stringify(
        {
          input,
          content,
          instruction:
            'Return strict JSON only. Review this saju result for production quality. Approve only if the result is warm, easy for a general user to read, uses connected short paragraphs instead of one-line fragments, explains strong or weak elements in everyday meaning when they appear, avoids business wording and heavy saju jargon in the body text, keeps saju-first reasoning with MBTI as a secondary refinement layer, opens major user-facing sections with a brief MBTI-framed first sentence, does not expose internal classifier labels such as 누수관리형 or 긴장성장형 그대로, avoids repeating the same key noun such as 흐름, 기준, 관계, 운 too often inside one paragraph, does not mention missing MBTI information directly, and feels specific to the selected scenario rather than reading like a generic category template. Reject results that feel corporate, repetitive, overly technical, too fragmented, or vague. Schema: {approved:boolean, issues:string[], score:number}.'
        },
        null,
        2
      ),
      timeoutMs
    });

    const stdoutPreview = previewText(stdout);
    const stderrPreview = previewText(stderr);
    if (!stdoutPreview) {
      return {
        review: null,
        issues: ['LLM 리뷰어가 비어 있는 응답을 반환했습니다.'],
        debug: {
          mode: 'review',
          command,
          timeoutMs,
          failureType: 'EMPTY_STDOUT',
          stdoutPreview,
          stderrPreview
        }
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout) as unknown;
    } catch (error) {
      return {
        review: null,
        issues: ['LLM 리뷰 응답을 JSON으로 파싱하지 못했습니다.'],
        debug: {
          mode: 'review',
          command,
          timeoutMs,
          failureType: 'JSON_PARSE_ERROR',
          errorMessage:
            error instanceof Error ? error.message : 'JSON parse error',
          stdoutPreview,
          stderrPreview
        }
      };
    }

    if (!isLlmReviewResult(parsed)) {
      return {
        review: null,
        issues: ['LLM 리뷰 JSON이 기대한 스키마와 맞지 않습니다.'],
        debug: {
          mode: 'review',
          command,
          timeoutMs,
          failureType: 'SCHEMA_MISMATCH',
          stdoutPreview,
          stderrPreview
        }
      };
    }

    return {
      review: parsed
    };
  } catch (error) {
    const debug = buildExecFailureDebug({
      mode: 'review',
      command,
      timeoutMs,
      error
    });

    return {
      review: null,
      issues: [
        debug.failureType === 'TIMEOUT'
          ? 'LLM 리뷰 응답이 제한 시간 안에 완료되지 않았습니다.'
          : debug.failureType === 'PROCESS_KILLED'
            ? 'LLM 리뷰 하위 프로세스가 비정상 종료되었습니다.'
            : 'LLM 리뷰 실행 중 오류가 발생했습니다.'
      ],
      debug
    };
  }
}
