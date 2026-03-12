import {
  Prisma,
  type Gender,
  type MbtiType,
  type ReadingType
} from '@prisma/client';
import type {
  CompatibilityRelationType,
  SelfSubjectType
} from '@/lib/saju/constants';
import type { ReadingPeriodContext } from '@/lib/saju/cache-key';
import type { ScenarioCode } from '@/lib/saju/scenarios';

export type PipelineMode =
  | 'rule-only'
  | 'verified-llm-optional'
  | 'verified-llm-required';

export type GenerationFailureStage =
  | 'RULE_DRAFT'
  | 'LLM_RENDER'
  | 'CODE_VALIDATE'
  | 'LLM_REVIEW'
  | 'FINAL_GUARD';

export class SajuGenerationFailureError extends Error {
  readonly stage: GenerationFailureStage;
  readonly reasonCode: string;
  readonly detail: Prisma.JsonValue | undefined;

  constructor(params: {
    stage: GenerationFailureStage;
    reasonCode: string;
    message: string;
    detail?: Prisma.JsonValue;
  }) {
    super(params.message);
    this.name = 'SajuGenerationFailureError';
    this.stage = params.stage;
    this.reasonCode = params.reasonCode;
    this.detail = params.detail;
  }
}

export type BirthInfo = {
  birthDate: string;
  birthTime: string | null;
  birthTimeUnknown: boolean;
  birthCalendarType: 'SOLAR' | 'LUNAR';
  isLeapMonth: boolean;
  gender: Gender;
};

export type SajuGenerationInput = {
  cacheKey: string;
  periodContext: ReadingPeriodContext;
  readingType: ReadingType;
  subjectType: SelfSubjectType | CompatibilityRelationType;
  scenarioCode?: ScenarioCode | null;
  userName: string;
  userMbtiType: MbtiType | null;
  userBirthInfo: BirthInfo;
  partnerName?: string;
  partnerMbtiType?: MbtiType | null;
  partnerBirthInfo?: BirthInfo;
};

export type SajuSections = {
  overview: string;
  coreSignal: string;
  caution: string;
  actions: string[];
  reflectionQuestion: string;
  storyTitle?: string;
  sajuEvidence?: string[];
  sajuBasis?: string;
  subjectLens?: string;
  narrativeFlow?: string;
  tenYearFlow?: string;
  currentDaewoon?: string;
  yearlyFlow?: string;
  wealthFlow?: string;
  relationshipFlow?: string;
  pairDynamic?: string;
  attractionPoint?: string;
  conflictTrigger?: string;
  communicationTip?: string;
  relationshipLens?: string;
  careerMoneyLens?: string;
  timingHint?: string;
};

export type LlmCandidate = {
  summary: string;
  sectionsJson: SajuSections;
};

export type LlmReviewResult = {
  approved: boolean;
  issues: string[];
  score: number;
};

export type LocalCodexFailureType =
  | 'NOT_ENABLED'
  | 'NOT_CONFIGURED'
  | 'EMPTY_STDOUT'
  | 'JSON_PARSE_ERROR'
  | 'SCHEMA_MISMATCH'
  | 'EXEC_ERROR'
  | 'PROCESS_KILLED'
  | 'TIMEOUT';

export type LocalCodexDebugInfo = {
  mode: 'render' | 'review';
  command: string | null;
  timeoutMs: number;
  failureType: LocalCodexFailureType;
  errorMessage?: string;
  stdoutPreview?: string | null;
  stderrPreview?: string | null;
  exitCode?: number | null;
  signal?: string | null;
  killed?: boolean;
};

export type LocalCodexRenderResult = {
  candidate: LlmCandidate | null;
  debug?: LocalCodexDebugInfo;
  issues?: string[];
};

export type LocalCodexReviewResult = {
  review: LlmReviewResult | null;
  debug?: LocalCodexDebugInfo;
  issues?: string[];
};

type SajuBasisFeaturePerson = {
  strongElement: string;
  weakElement: string;
  ratioText: string;
  currentDaewoonTheme: string;
  birthTimeUnknown?: boolean;
  elementCount?: Record<string, number>;
  pillars?: {
    yearString: string;
    monthString: string;
    dayString: string;
    hourString: string;
  };
  dayMaster?: {
    stem: string;
    element: string;
    yinYang: string;
  };
  roleProfile?: Record<
    string,
    {
      element: string;
      count: number;
      label: string;
    }
  >;
  balanceProfile?: {
    dayMasterStrength: string;
    scores?: {
      support: number;
      drain: number;
      net: number;
    };
    seasonSupport?: {
      monthBranch: string;
      monthElement: string;
      roleKey: string;
      label: string;
    };
    rootProfile?: {
      supportRoots: number;
      drainRoots: number;
      rootedBranches: string[];
    };
    yongsin: { element: string; roleKey: string; label: string };
    heesin: { element: string; roleKey: string; label: string };
    gisin: { element: string; roleKey: string; label: string };
  };
  tenGodProfile?: {
    visible: Array<{
      pillarKey: string;
      pillarLabel: string;
      stem: string;
      element: string;
      yinYang: string;
      tenGod: string;
    }>;
    dominant: Array<{
      tenGod: string;
      count: number;
      pillarLabels: string[];
    }>;
    monthLeader: {
      pillarKey: string;
      pillarLabel: string;
      stem: string;
      element: string;
      yinYang: string;
      tenGod: string;
    };
  };
  hiddenTenGodProfile?: {
    visible: Array<{
      pillarKey: string;
      pillarLabel: string;
      branch: string;
      hiddenStems: Array<{
        stem: string;
        element: string;
        yinYang: string;
        tenGod: string;
      }>;
    }>;
    dominant: Array<{
      tenGod: string;
      count: number;
      pillarLabels: string[];
    }>;
    monthBranch: {
      pillarKey: string;
      pillarLabel: string;
      branch: string;
      hiddenStems: Array<{
        stem: string;
        element: string;
        yinYang: string;
        tenGod: string;
      }>;
    };
  };
  unseongProfile?: {
    visible: Array<{
      pillarKey: string;
      pillarLabel: string;
      branch: string;
      stage: string;
    }>;
    monthLeader: {
      pillarKey: string;
      pillarLabel: string;
      branch: string;
      stage: string;
    };
    tone: string;
  };
};

export type SajuInternalMetadata = {
  basisFeatures: {
    user: SajuBasisFeaturePerson;
    partner?: SajuBasisFeaturePerson;
  };
  scenario?: {
    code: string;
    label: string;
    description: string;
  };
  subjectArchetypes?: {
    user?: {
      code: string;
      label: string;
      description: string;
    };
    partner?: {
      code: string;
      label: string;
      description: string;
    };
    compatibility?: {
      code: string;
      label: string;
      description: string;
    };
  };
  mbtiAppliedRules: string[];
  templateVersion: string;
  subjectRuleSetVersion: string;
  weighting: {
    saju: number;
    mbti: number;
  };
  periodContext: ReadingPeriodContext;
  pipeline: {
    mode: PipelineMode;
    llmRendered: boolean;
    llmReviewed: boolean;
  };
};

export type RuleDraft = LlmCandidate & {
  internalMetadata: SajuInternalMetadata;
};

export type GeneratedSajuContent = {
  summary: string;
  sectionsJson: SajuSections;
  resultJson: Prisma.InputJsonValue;
  metadata: SajuInternalMetadata;
  versions: {
    ruleVersion: string;
    templateVersion: string;
    promptVersion: string;
    modelVersion: string;
  };
};

export type SubjectContext = {
  focus: string;
  storyline: string;
  softRisk: string;
  firstAction: string;
  relationHint: string;
  workMoneyHint: string;
  timingHint: string;
  reflectionQuestion: string;
};
