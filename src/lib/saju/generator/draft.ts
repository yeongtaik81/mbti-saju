import type { ReadingType } from '@prisma/client';
import {
  COMPATIBILITY_RELATION_LABEL,
  SELF_SUBJECT_LABEL,
  type CompatibilityRelationType,
  type SelfSubjectType
} from '@/lib/saju/constants';
import { getScenarioOption } from '@/lib/saju/scenarios';
import { SUBJECT_RULESET_VERSION, TEMPLATE_VERSION } from './config';
import { COMPATIBILITY_SUBJECT_CONTEXT, SELF_SUBJECT_CONTEXT } from './context';
import {
  buildFiveElementSummary,
  buildMbtiAdvice,
  buildMbtiAppliedRules,
  buildTimeFlow,
  hashSeed,
  pickBySeed,
  type FiveElementSummary,
  type TimeFlowSummary
} from './engine';
import { buildScenarioOverlay } from './scenario-overrides';
import type {
  PipelineMode,
  RuleDraft,
  SajuGenerationInput,
  SubjectContext
} from './types';

const ELEMENT_GENERATION_ORDER = ['목', '화', '토', '금', '수'] as const;
const ELEMENT_CONTROLS: Record<string, string> = {
  목: '토',
  화: '금',
  토: '수',
  금: '목',
  수: '화'
};

function hasBatchim(text: string): boolean {
  const lastCharacter = text.trim().at(-1);
  if (!lastCharacter) {
    return false;
  }

  const code = lastCharacter.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return false;
  }

  return (code - 0xac00) % 28 !== 0;
}

function withTopicParticle(text: string): string {
  return `${text}${hasBatchim(text) ? '은' : '는'}`;
}

function withSubjectParticle(text: string): string {
  return `${text}${hasBatchim(text) ? '이' : '가'}`;
}

function withObjectParticle(text: string): string {
  return `${text}${hasBatchim(text) ? '을' : '를'}`;
}

function withCopula(text: string): string {
  return `${text}${hasBatchim(text) ? '이라' : '라'}`;
}

function joinWithAnd(left: string, right: string): string {
  return `${left}${hasBatchim(left) ? '과' : '와'} ${right}`;
}

function extractMeaningOnly(text: string): string {
  const normalized = text.trim();
  const stripped = normalized.replace(/^[^.?!]+[.?!]\s*/, '').trim();
  return stripped.length > 0 ? stripped : normalized;
}

function describeStrongElementMeaning(element: string): string {
  switch (element) {
    case '목':
      return '방향을 세우고 앞으로 뻗어 나가는 힘이 좋다는 뜻입니다';
    case '화':
      return '표현력과 존재감이 자연스럽게 살아난다는 뜻입니다';
    case '토':
      return '쉽게 흔들리지 않고 버티는 힘이 좋다는 뜻입니다';
    case '금':
      return '정리력과 판단 기준이 또렷하다는 뜻입니다';
    case '수':
      return '흐름을 읽고 유연하게 움직이는 감각이 좋다는 뜻입니다';
    default:
      return '타고난 기질에서 이 힘이 먼저 드러난다는 뜻입니다';
  }
}

function describeWeakElementMeaning(element: string): string {
  switch (element) {
    case '목':
      return '새 방향을 빨리 정하거나 판을 넓히는 순간에는 힘이 늦게 붙기 쉽습니다';
    case '화':
      return '마음을 바로 드러내거나 분위기를 빠르게 띄우는 일에는 에너지가 더 들 수 있습니다';
    case '토':
      return '중심을 단단히 잡아야 하는 순간에는 회복에 시간이 조금 더 걸릴 수 있습니다';
    case '금':
      return '정리와 결단이 필요한 순간에는 한 번 더 망설이기 쉽습니다';
    case '수':
      return '상황에 맞춰 유연하게 바꾸는 순간에는 에너지가 빨리 마르기 쉽습니다';
    default:
      return '이 부분은 의식적으로 보완할 때 훨씬 안정됩니다';
  }
}

function buildElementMeaningBridge(
  strongElement: string,
  weakElement: string
): string {
  return `${strongElement} 기운이 강하다는 건 ${describeStrongElementMeaning(strongElement)}. ${weakElement} 기운이 약하다는 건 ${describeWeakElementMeaning(weakElement)}.`;
}

function getUnseongMeaning(stage: string): string {
  switch (stage) {
    case '장생':
      return '기운이 막 피어나며 새 흐름을 열기 쉬운 상태';
    case '목욕':
      return '환경 적응과 감정 기복이 함께 올라오는 상태';
    case '관대':
      return '사회적 역할과 체면이 붙기 시작하는 상태';
    case '건록':
      return '자기 기준과 실행력이 단단하게 서는 상태';
    case '제왕':
      return '기세가 가장 높아 밀어붙이는 힘이 강한 상태';
    case '쇠':
      return '속도를 줄이고 체력과 구조를 관리해야 하는 상태';
    case '병':
      return '부담이 쌓이면 쉽게 지치므로 무리하면 손해가 나는 상태';
    case '사':
      return '한 사이클을 접고 정리해야 다음 판이 열리는 상태';
    case '묘':
      return '겉보다 안을 추슬러야 힘이 생기는 상태';
    case '절':
      return '끊어낼 것과 다시 묶을 것을 구분해야 하는 상태';
    case '태':
      return '아직 보이지 않지만 가능성이 안에서 준비되는 상태';
    case '양':
      return '보호와 보살핌 속에서 힘을 기르는 상태';
    default:
      return '현재 흐름의 성격을 읽는 데 참고할 수 있는 상태';
  }
}

function formatUnseongStage(stage: string): string {
  return stage === '묘' ? '묘(墓)' : stage;
}

function buildUnseongSummary(summary: FiveElementSummary): string {
  const monthLeader = summary.unseongProfile.monthLeader;
  return `${monthLeader.pillarLabel} ${withTopicParticle(monthLeader.branch)} ${formatUnseongStage(monthLeader.stage)}에 놓여 있어, ${getUnseongMeaning(monthLeader.stage)}.`;
}

function buildUnseongFocusText(
  summary: FiveElementSummary,
  targetTones: Array<FiveElementSummary['unseongProfile']['tone']>,
  fallback: string
): string {
  if (!targetTones.includes(summary.unseongProfile.tone)) {
    return fallback;
  }

  return buildUnseongSummary(summary);
}

type SubjectSubtype = {
  code: string;
  label: string;
  description: string;
  advice: string;
  caution: string;
};

function buildWealthSubtype(summary: FiveElementSummary): SubjectSubtype {
  const wealth = summary.roleProfile.wealth.count;
  const companion = summary.roleProfile.companion.count;
  const output = summary.roleProfile.output.count;
  const authority = summary.roleProfile.authority.count;
  const wealthTenGod = summary.tenGodProfile.dominant.find((entry) =>
    ['편재', '정재'].includes(entry.tenGod)
  );
  const leakTenGod = summary.hiddenTenGodProfile.dominant.find((entry) =>
    ['겁재', '상관'].includes(entry.tenGod)
  );

  if (wealth >= 3 && companion <= 1) {
    return {
      code: 'stable_accumulator',
      label: '축재형',
      description: '한 번 크게 벌기보다 차분히 모아 갈수록 복이 오래 붙는 타입',
      advice:
        '지출 기준과 저축 단위를 먼저 정해 두면 마음도 돈도 한결 편안해집니다.',
      caution:
        '좋은 기회가 보여도 속도를 너무 빨리 높이면 관리 리듬이 흐트러질 수 있습니다.'
    };
  }

  if ((wealth >= 2 && output >= 2) || wealthTenGod?.tenGod === '편재') {
    return {
      code: 'opportunity_harvester',
      label: '유동수익형',
      description:
        '한 번의 큰 고정보다 여러 기회를 잘 묶어 수익으로 바꾸는 타입',
      advice:
        '기회를 잡을 때도 회수 기준과 철수 기준을 같이 적어 두면 수익이 더 깔끔하게 남습니다.',
      caution:
        '들어오는 판이 많을수록 정리되지 않은 지출과 분산 투자가 수익을 조금씩 깎아먹기 쉽습니다.'
    };
  }

  if (companion >= 2 || leakTenGod?.tenGod === '겁재') {
    return {
      code: 'leak_management',
      label: '누수관리형',
      description: '버는 힘보다 새는 구멍을 막을 때 재물운이 살아나는 타입',
      advice:
        '인맥·감정·충동 때문에 나가는 돈을 먼저 줄이면 재물의 체감이 금방 달라집니다.',
      caution:
        '사람과의 관계를 돈으로 해결하려 들면 정작 내 몫으로 남는 것이 적어지기 쉽습니다.'
    };
  }

  if (authority >= 2 && summary.balanceProfile.dayMasterStrength !== 'WEAK') {
    return {
      code: 'structured_manager',
      label: '관리확장형',
      description: '기준과 구조를 세워 돈을 굴릴수록 힘이 붙는 타입',
      advice:
        '투자든 일 수익이든 반복 가능한 기준표를 먼저 세우면 재물운이 더 안정적으로 커집니다.',
      caution:
        '안전한 구조에만 머물면 수익 탄력이 둔해질 수 있어 작은 실험은 가볍게 병행하는 편이 좋습니다.'
    };
  }

  return {
    code: 'balanced_builder',
    label: '균형축적형',
    description:
      '큰 변동보다 꾸준한 축적과 생활 균형이 맞을 때 재물운이 붙는 타입',
    advice:
      '수입 확대와 지출 조절을 함께 조금씩 밀어주는 방식이 가장 오래 갑니다.',
    caution:
      '큰 한 방을 노릴수록 본래 강점인 안정 축적의 리듬이 흔들릴 수 있습니다.'
  };
}

function buildCareerSubtype(summary: FiveElementSummary): SubjectSubtype {
  const authority = summary.roleProfile.authority.count;
  const resource = summary.roleProfile.resource.count;
  const output = summary.roleProfile.output.count;
  const companion = summary.roleProfile.companion.count;
  const monthTenGod = summary.tenGodProfile.monthLeader.tenGod;

  if (authority >= 2 && resource >= 2) {
    return {
      code: 'organization_growth',
      label: '조직성장형',
      description:
        '역할과 책임이 분명한 자리에서 실력이 더 또렷하게 보이는 타입',
      advice:
        '내가 맡을 일과 권한이 선명한 환경을 고를수록 커리어가 더 안정적으로 자랍니다.',
      caution:
        '맞지 않는 틀에 오래 머무르면 성과보다 마음이 먼저 지칠 수 있습니다.'
    };
  }

  if (output >= 2 && companion >= 2) {
    return {
      code: 'independent_pioneer',
      label: '독립개척형',
      description: '내 방식과 추진력으로 판을 열 때 빛나는 타입',
      advice:
        '자율성이 큰 일, 프로젝트형 일, 독립 실행이 가능한 자리에서 강점이 잘 살아납니다.',
      caution:
        '혼자 밀어붙이는 힘이 강한 만큼 협업 기준을 놓치면 성과가 오래 남지 않을 수 있습니다.'
    };
  }

  if (resource >= 3 || ['정인', '편인'].includes(monthTenGod)) {
    return {
      code: 'specialist_research',
      label: '전문축적형',
      description: '깊이 파고드는 공부와 전문성이 결국 큰 자산이 되는 타입',
      advice:
        '자격, 문서, 데이터, 연구, 설계처럼 쌓아 둘수록 강해지는 분야에서 힘이 잘 납니다.',
      caution:
        '준비가 다 될 때까지 미루다 보면 좋은 타이밍을 놓치기 쉬우니 작은 공개를 병행하는 편이 좋습니다.'
    };
  }

  if (output >= 2 || ['상관', '식신'].includes(monthTenGod)) {
    return {
      code: 'practical_creator',
      label: '실전성과형',
      description: '결과물을 빠르게 만들고 보여줄 때 평가가 올라가는 타입',
      advice:
        '생각만 오래 붙들기보다 작게라도 결과를 보여주는 방식이 커리어에 더 유리합니다.',
      caution:
        '속도가 큰 장점이지만 검수 없이 밀어붙이면 신뢰가 흔들릴 수 있어 마감 전 점검 루틴이 필요합니다.'
    };
  }

  return {
    code: 'step_builder',
    label: '단계축적형',
    description: '급격한 도약보다 단계적으로 쌓을수록 강해지는 타입',
    advice:
      '작은 승진, 작은 프로젝트, 작은 포트폴리오를 꾸준히 쌓는 방식이 잘 맞습니다.',
    caution:
      '눈에 띄는 변화가 늦다고 조급해지면 오히려 본래 강점인 페이스가 무너질 수 있습니다.'
  };
}

function buildRelationshipSubtype(
  summary: FiveElementSummary,
  mode: 'ROMANCE' | 'MARRIAGE'
): SubjectSubtype {
  const output = summary.roleProfile.output.count;
  const resource = summary.roleProfile.resource.count;
  const authority = summary.roleProfile.authority.count;
  const wealth = summary.roleProfile.wealth.count;
  const tone = summary.unseongProfile.tone;

  if (mode === 'MARRIAGE' && (authority >= 2 || wealth >= 2)) {
    return {
      code: 'life_structure',
      label: '생활안정형',
      description: '정서만큼 생활 기준이 맞을 때 오래가는 타입',
      advice:
        '결혼운은 감정보다 역할·돈·시간의 기준을 먼저 맞출수록 더 안정적입니다.',
      caution:
        '정리되지 않은 생활 습관을 방치하면 감정보다 생활 피로가 먼저 쌓일 수 있습니다.'
    };
  }

  if (output >= 2) {
    return {
      code: 'clear_expression',
      label: '표현선명형',
      description: '감정과 호감을 드러낼수록 관계가 빨리 살아나는 타입',
      advice:
        '호감이 있다면 애매한 신호보다 짧고 분명한 표현이 훨씬 잘 맞습니다.',
      caution:
        '초반 온도가 높을수록 상대 속도를 고려하지 않으면 금방 오해가 생길 수 있습니다.'
    };
  }

  if (resource >= 2 || tone === 'RESET') {
    return {
      code: 'careful_distance',
      label: '신중거리형',
      description:
        '마음이 열리기까지 시간이 필요하고, 관계 거리 조절이 중요한 타입',
      advice: '속도를 천천히 맞추고 안정감을 먼저 쌓는 관계가 더 오래 갑니다.',
      caution:
        '확신이 들기 전까지 너무 거리를 두면 좋은 인연도 스쳐 지나갈 수 있습니다.'
    };
  }

  if (authority >= 2) {
    return {
      code: 'standard_led',
      label: '기준주도형',
      description: '좋고 싫음보다 관계의 기준이 먼저 서야 편안해지는 타입',
      advice:
        '처음부터 경계와 기대치를 말해 두면 오히려 관계가 더 부드럽게 갑니다.',
      caution:
        '기준만 앞세우면 따뜻함이 부족하게 느껴질 수 있어 말의 온도를 더해야 합니다.'
    };
  }

  return {
    code: 'steady_bond',
    label: '천천히관계형',
    description: '작은 신뢰를 쌓으며 서서히 깊어질 때 가장 편한 타입',
    advice:
      '관계를 급히 정의하기보다 일상적인 반복 접점으로 친밀도를 올리는 편이 잘 맞습니다.',
    caution:
      '관계가 자연히 깊어질 거라 기대만 하면 중요한 고비를 놓칠 수 있습니다.'
  };
}

function buildCompatibilitySubtype(
  userElement: FiveElementSummary,
  partnerElement: FiveElementSummary | null
): SubjectSubtype {
  if (!partnerElement) {
    return {
      code: 'insufficient_profile',
      label: '관계탐색형',
      description:
        '상대 정보가 더 들어와야 궁합의 핵심 패턴을 선명하게 읽을 수 있는 상태',
      advice:
        '출생시각과 생활 리듬 정보가 보강되면 관계 읽기가 훨씬 정확해집니다.',
      caution:
        '지금 단계에서는 단정적인 판단보다 큰 흐름만 참고하는 편이 안전합니다.'
    };
  }

  const sameTone =
    userElement.unseongProfile.tone === partnerElement.unseongProfile.tone;
  const sameDayMasterElement =
    userElement.dayMaster.element === partnerElement.dayMaster.element;
  const complementaryStrong =
    userElement.strongElement !== partnerElement.strongElement &&
    userElement.weakElement !== partnerElement.weakElement;

  if (sameDayMasterElement || sameTone) {
    return {
      code: 'stable_similarity',
      label: '동질안정형',
      description: '함께 있으면 기본 리듬이 비슷해 마음이 빨리 놓이는 타입',
      advice:
        '서로를 이해하는 속도가 빠른 만큼 역할만 잘 나누면 관계 안정감이 크게 살아납니다.',
      caution:
        '편하다는 이유로 중요한 말을 미루면 답답함도 같이 쌓일 수 있어 점검이 필요합니다.'
    };
  }

  if (complementaryStrong) {
    return {
      code: 'complementary_division',
      label: '보완분업형',
      description: '서로 다른 장점이 맞물릴 때 더 크게 빛나는 타입',
      advice:
        '누가 앞에서 열고 누가 뒤에서 다질지 역할을 일찍 나누면 관계의 합이 훨씬 좋아집니다.',
      caution:
        '장점이 또렷한 만큼 기대하는 역할이 엇갈리면 고마움보다 서운함이 먼저 올라올 수 있습니다.'
    };
  }

  if (
    (userElement.unseongProfile.tone === 'PEAK' &&
      partnerElement.unseongProfile.tone === 'RESET') ||
    (userElement.unseongProfile.tone === 'RESET' &&
      partnerElement.unseongProfile.tone === 'PEAK')
  ) {
    return {
      code: 'pace_adjustment',
      label: '속도조율형',
      description: '마음은 잘 맞지만 속도를 맞춰야 훨씬 편해지는 타입',
      advice:
        '결정 속도, 감정 표현 속도, 생활 리듬을 따로 맞추는 접근이 의외로 큰 효과를 냅니다.',
      caution:
        '한쪽이 재촉하고 한쪽이 물러나는 패턴이 굳기 전에 쉬어갈 타이밍을 함께 정해 두면 좋습니다.'
    };
  }

  return {
    code: 'tension_growth',
    label: '긴장성장형',
    description: '강하게 끌리고 또 강하게 배우게 되는 타입',
    advice:
      '서로를 바꾸려 하기보다 각자 잘하는 역할을 인정하면 관계의 매력이 훨씬 커집니다.',
    caution:
      '감정이 뜨거울수록 말의 세기도 세질 수 있어, 감정이 오른 날은 결론을 미루는 편이 안전합니다.'
  };
}

function buildSelfSubjectOverviewAccent(
  subjectType: SelfSubjectType,
  subtype: SubjectSubtype | null
): string {
  if (subjectType === 'CAREER') {
    switch (subtype?.code) {
      case 'organization_growth':
        return '억지로 튀기보다 믿고 맡길 수 있는 사람이라는 인상이 더 큰 자산이 됩니다.';
      case 'independent_pioneer':
        return '남이 정한 판보다 내 방식이 살아나는 자리에서 기세가 붙습니다.';
      case 'specialist_research':
        return '빨리 보여주기보다 깊이를 쌓은 결과가 결국 더 멀리 갑니다.';
      case 'practical_creator':
        return '생각을 오래 붙잡기보다 결과를 보여줄 때 운이 움직입니다.';
      default:
        return '눈에 띄는 한 번보다 작은 이력들이 차곡히 쌓이며 힘이 됩니다.';
    }
  }

  if (subjectType === 'WEALTH') {
    switch (subtype?.code) {
      case 'stable_accumulator':
        return '크게 흔들지 않아도 차분히 모은 것이 생각보다 크게 남는 흐름입니다.';
      case 'opportunity_harvester':
        return '크게 한 번보다 여러 기회를 가볍게 잘 묶는 감각이 중요합니다.';
      case 'leak_management':
        return '새는 구멍만 줄여도 복이 남는 속도가 눈에 띄게 달라집니다.';
      case 'structured_manager':
        return '정리된 기준과 반복 가능한 구조가 곧 돈을 지키는 힘이 됩니다.';
      default:
        return '생활 균형을 지키는 방식이 오히려 오래 남는 수익으로 이어집니다.';
    }
  }

  return '';
}

function buildSelfSubjectNarrativeAccent(
  subjectType: SelfSubjectType,
  subtype: SubjectSubtype | null
): string {
  if (subjectType === 'CAREER') {
    switch (subtype?.code) {
      case 'organization_growth':
        return '지금은 자리를 넓히기보다 나를 가장 잘 드러내는 자리를 고를 때입니다.';
      case 'independent_pioneer':
        return '판을 새로 여는 힘이 좋은 시기라, 움직임이 빠른 자리일수록 장점이 선명해집니다.';
      case 'specialist_research':
        return '남보다 늦어 보여도 깊이를 쌓은 결과가 결국 가장 오래 갑니다.';
      case 'practical_creator':
        return '완벽을 기다리기보다 먼저 보여주고 다듬는 편이 기회를 더 잘 붙잡습니다.';
      default:
        return '급격한 도약보다 작은 성취를 이어 붙일수록 결과가 더 또렷해집니다.';
    }
  }

  if (subjectType === 'WEALTH') {
    switch (subtype?.code) {
      case 'stable_accumulator':
        return '지금은 크게 벌기보다 차분히 남기는 방식이 오히려 더 큰 복으로 돌아옵니다.';
      case 'opportunity_harvester':
        return '기회는 여러 번 들어올 수 있으니, 다 잡기보다 남길 것만 고르는 감각이 중요합니다.';
      case 'leak_management':
        return '더 벌기 전에 새는 구멍을 줄이면 돈이 머무는 속도가 훨씬 빨라집니다.';
      case 'structured_manager':
        return '돈은 감보다 구조에서 더 오래 남는 시기라 기준표 하나가 큰 차이를 만듭니다.';
      default:
        return '생활 리듬이 정돈될수록 돈의 흐름도 같이 차분해집니다.';
    }
  }

  return '';
}

function buildCompatibilityOverviewAccent(
  subtype: SubjectSubtype | null
): string {
  switch (subtype?.code) {
    case 'stable_similarity':
      return '함께 있을 때 공기가 비슷해 자연히 마음이 놓이는 쪽입니다.';
    case 'complementary_division':
      return '서로 다른 장점이 맞물릴 때 이 관계의 매력이 더 크게 드러납니다.';
    case 'pace_adjustment':
      return '좋은 마음은 충분하니 속도만 맞추면 체감이 크게 달라질 수 있습니다.';
    case 'tension_growth':
      return '강하게 끌리는 만큼 서로에게 배우게 되는 힘도 큰 관계입니다.';
    default:
      return '지금은 큰 결을 보고 천천히 읽는 편이 가장 안전합니다.';
  }
}

function buildCompatibilityNarrativeAccent(
  subtype: SubjectSubtype | null
): string {
  switch (subtype?.code) {
    case 'stable_similarity':
      return '편안함이 큰 궁합이라 일상의 리듬을 함께 쌓을수록 사이가 더 단단해집니다.';
    case 'complementary_division':
      return '한 사람이 앞을 열고 한 사람이 뒤를 받칠 때 유난히 좋은 합이 납니다.';
    case 'pace_adjustment':
      return '정답을 빨리 정하기보다 호흡을 맞추는 과정 자체가 관계를 살립니다.';
    case 'tension_growth':
      return '잘 맞는 날의 힘을 생활 규칙으로 옮겨 놓으면 뜨거움이 오래 갑니다.';
    default:
      return '조금 더 정보를 보태면 지금 느끼는 끌림과 불편의 이유를 훨씬 또렷하게 읽을 수 있습니다.';
  }
}

function buildSelfMbtiLead(
  userName: string,
  mbtiLabel: string,
  mbtiAdvice: {
    strength: string;
    blindSpot: string;
    timingStyle: string;
    cautionStyle: string;
    relationshipStyle: string;
    moneyStyle: string;
  },
  channel:
    | 'overview'
    | 'summary'
    | 'narrative'
    | 'relationship'
    | 'wealth'
    | 'timing'
    | 'caution'
): string {
  const prefix =
    mbtiLabel === '미설정'
      ? `${userName}님은 기질상`
      : `${mbtiLabel} 성향인 ${userName}님은`;

  switch (channel) {
    case 'overview':
      return `${prefix} ${mbtiAdvice.strength}이 먼저 드러나는 편입니다.`;
    case 'summary':
      return `${prefix} ${mbtiAdvice.strength}을 실제 행동으로 옮길 때 힘이 가장 잘 붙습니다.`;
    case 'narrative':
      return `${prefix} ${mbtiAdvice.timingStyle}.`;
    case 'relationship':
      return `${prefix} 관계에서는 ${mbtiAdvice.relationshipStyle}.`;
    case 'wealth':
      return `${prefix} 돈과 일에서는 ${mbtiAdvice.moneyStyle}.`;
    case 'timing':
      return `${prefix} ${mbtiAdvice.timingStyle}.`;
    case 'caution':
      return `${prefix} ${mbtiAdvice.blindSpot}.`;
    default:
      return `${prefix} ${mbtiAdvice.strength}이 잘 살아납니다.`;
  }
}

function buildCompatibilityMbtiLead(
  input: {
    userName: string;
    partnerName: string;
    userAdvice: {
      strength: string;
      timingStyle: string;
      relationshipStyle: string;
      blindSpot: string;
    };
    partnerAdvice: {
      strength: string;
      timingStyle: string;
      relationshipStyle: string;
      blindSpot: string;
    } | null;
  },
  channel:
    | 'overview'
    | 'summary'
    | 'narrative'
    | 'relationship'
    | 'timing'
    | 'caution'
): string {
  if (!input.partnerAdvice) {
    return `${input.userName} 쪽 MBTI만 보면 ${input.userAdvice.strength}이 먼저 드러나는 편입니다.`;
  }

  switch (channel) {
    case 'overview':
      return `MBTI로 보면 ${input.userName}은 ${input.userAdvice.strength}으로 흐름을 열고, ${input.partnerName}은 ${input.partnerAdvice.strength}으로 반응하는 편입니다.`;
    case 'summary':
      return `MBTI로 보면 ${input.userName}은 ${input.userAdvice.strength}을 앞세우고, ${input.partnerName}은 ${input.partnerAdvice.strength}으로 균형을 맞추는 쪽입니다.`;
    case 'narrative':
      return `MBTI로 보면 ${input.userName}은 ${input.userAdvice.timingStyle}, ${input.partnerName}은 ${input.partnerAdvice.timingStyle}.`;
    case 'relationship':
      return `MBTI로 보면 관계에서는 ${input.userName}은 ${input.userAdvice.relationshipStyle}, ${input.partnerName}은 ${input.partnerAdvice.relationshipStyle}.`;
    case 'timing':
      return `MBTI로 보면 ${input.userName}은 ${input.userAdvice.timingStyle}, ${input.partnerName}은 ${input.partnerAdvice.timingStyle}.`;
    case 'caution':
      return `MBTI로 보면 ${input.userName}은 ${input.userAdvice.blindSpot}, ${input.partnerName}은 ${input.partnerAdvice.blindSpot}.`;
    default:
      return `MBTI로 보면 ${input.userName}은 ${input.userAdvice.strength}, ${input.partnerName}은 ${input.partnerAdvice.strength} 쪽이 먼저 드러납니다.`;
  }
}

function buildsDayMasterRelationText(
  firstElement: string,
  secondElement: string
): string {
  if (firstElement === secondElement) {
    return `두 사람의 일간은 같은 ${firstElement} 기운이라 기본 결이 비슷한 편입니다.`;
  }

  const firstIndex = ELEMENT_GENERATION_ORDER.findIndex(
    (candidate) => candidate === firstElement
  );
  const secondIndex = ELEMENT_GENERATION_ORDER.findIndex(
    (candidate) => candidate === secondElement
  );

  if (firstIndex >= 0 && secondIndex >= 0) {
    if (
      ELEMENT_GENERATION_ORDER[
        (firstIndex + 1) % ELEMENT_GENERATION_ORDER.length
      ] === secondElement
    ) {
      return `${firstElement} 일간이 ${secondElement} 일간을 생하는 상생 관계라, 한쪽이 흐름을 열면 다른 쪽이 자연스럽게 반응하는 편입니다.`;
    }

    if (
      ELEMENT_GENERATION_ORDER[
        (secondIndex + 1) % ELEMENT_GENERATION_ORDER.length
      ] === firstElement
    ) {
      return `${secondElement} 일간이 ${firstElement} 일간을 생하는 상생 관계라, 서로에게 힘을 보태는 흐름이 비교적 자연스럽습니다.`;
    }
  }

  if (ELEMENT_CONTROLS[firstElement] === secondElement) {
    return `${firstElement} 일간이 ${secondElement} 일간을 누르는 상극 관계라, 기준과 속도 차이가 장점이 되기도 하지만 힘겨루기로 번지지 않게 조심해야 합니다.`;
  }

  if (ELEMENT_CONTROLS[secondElement] === firstElement) {
    return `${secondElement} 일간이 ${firstElement} 일간을 누르는 상극 관계라, 배려보다 기준이 먼저 나오면 관계 피로가 빨리 쌓일 수 있습니다.`;
  }

  return `두 사람의 일간은 직접적인 상생·상극보다 리듬 차이로 영향을 주고받는 편입니다.`;
}

function buildSelfSubjectCurrentSignal(input: {
  subjectType: SelfSubjectType;
  userElement: FiveElementSummary;
  userTimeFlow: TimeFlowSummary;
}): string {
  switch (input.subjectType) {
    case 'CAREER':
      return `직업운은 ${input.userElement.strongElement} 기운이 살아날 때 힘이 붙는 흐름입니다. 지금은 ${withCopula(input.userTimeFlow.currentTheme)}, 이것저것 넓히기보다 강점이 가장 잘 보이는 자리를 고를수록 일이 잘 풀립니다.`;
    case 'WEALTH':
      return `재물운은 ${input.userElement.strongElement} 쪽에서 벌고 ${input.userElement.weakElement} 쪽에서 새기 쉬운 흐름입니다. 지금은 ${withCopula(input.userTimeFlow.currentTheme)}, 무작정 늘리기보다 돈의 흐름을 정리하고 기준을 세우는 편이 먼저입니다.`;
    case 'ROMANCE':
      return `연애운은 끌림보다 관계의 속도 조절이 중요한 흐름입니다. 마음은 빨리 움직여도, 지금은 ${withObjectParticle(input.userTimeFlow.currentTheme)} 따라 관계 온도를 맞춰 갈 때 훨씬 편안합니다.`;
    case 'MARRIAGE':
      return `배우자운은 마음만큼이나 함께 사는 방식에서 또렷하게 드러납니다. 지금은 ${withCopula(input.userTimeFlow.currentTheme)}, 역할과 돈, 시간의 기준을 먼저 맞출수록 관계가 더 편안해집니다.`;
    case 'LIFETIME_FLOW':
      return `긴 흐름은 ${input.userElement.strongElement} 기운을 살리고 ${input.userElement.weakElement} 기운을 다독이는 방식에 따라 달라집니다. 지금은 ${withCopula(input.userTimeFlow.currentTheme)}, 방향을 다시 고르고 생활 구조를 다듬는 일이 장기운을 살립니다.`;
    case 'YEAR_MONTH_DAY_FORTUNE':
      return `단기운은 기분보다 리듬에 더 민감하게 반응합니다. ${input.userElement.strongElement} 쪽 행동 하나를 먼저 고정하면 ${input.userElement.weakElement} 축의 흔들림을 줄일 수 있습니다.`;
    case 'DAEUN':
      return `지금 지나고 있는 대운은 ${input.userTimeFlow.currentTheme}의 결이 짙습니다. ${input.userElement.strongElement} 기운은 키우고 ${input.userElement.weakElement} 축은 무리하지 않게 다듬는 식으로 생활 구조를 바꾸는 것이 핵심입니다.`;
    case 'LUCK_UP':
      return `개운 포인트는 없는 기운을 억지로 만들기보다 ${input.userElement.strongElement} 축을 생활 습관으로 붙이는 데 있습니다. 지금 들어온 ${withObjectParticle(input.userTimeFlow.currentTheme)} 일상에 심는 것이 가장 빠른 길입니다.`;
    case 'RELATIONSHIPS':
      return `인간관계 운은 강한 기운이 사람을 끌어오고, 약한 기운이 경계를 흐리기 쉬운 구조입니다. 지금은 관계를 정리하는 일이 곧 운을 정리하는 일로 이어집니다.`;
    case 'FAMILY':
      return `가족운은 가까울수록 약한 기운이 먼저 흔들리기 쉬운 구조입니다. 지금은 ${withSubjectParticle(input.userTimeFlow.currentTheme)} 들어와, 당연함 대신 설명을 더하는 태도가 집안의 흐름을 살립니다.`;
    default:
      return `전반 흐름은 ${input.userElement.strongElement} 기운은 선명하고 ${input.userElement.weakElement} 기운은 비기 쉬운 구조로 읽힙니다. 지금은 ${withSubjectParticle(input.userTimeFlow.currentTheme)} 강하게 들어와, 선명한 기운은 살리고 약한 축은 생활 루틴으로 보완하는 편이 좋습니다.`;
  }
}

function buildCompatibilityCurrentSignal(input: {
  subjectType: CompatibilityRelationType;
  userName: string;
  partnerName: string;
  userElement: FiveElementSummary;
  partnerElement: FiveElementSummary | null;
}): string {
  const userDayMaster = `${input.userElement.dayMaster.stem}${input.userElement.dayMaster.element}`;
  const partnerDayMaster = input.partnerElement
    ? `${input.partnerElement.dayMaster.stem}${input.partnerElement.dayMaster.element}`
    : '상대 일간';
  const dayMasterRelation = input.partnerElement
    ? buildsDayMasterRelationText(
        input.userElement.dayMaster.element,
        input.partnerElement.dayMaster.element
      )
    : '두 사람의 일간 관계를 읽으려면 상대 생시 정보가 더 정확해야 합니다.';
  const strongAxis = `${input.userName}의 ${input.userElement.strongElement} 기운과 ${input.partnerName}의 ${input.partnerElement?.strongElement ?? '균형'} 기운`;
  const weakAxis = `${input.userElement.weakElement}·${input.partnerElement?.weakElement ?? '수'} 축`;

  switch (input.subjectType) {
    case 'BUSINESS_PARTNER':
      return `${userDayMaster}인 ${input.userName}과 ${partnerDayMaster}인 ${input.partnerName}의 동업운은 ${strongAxis}이 역할 나눔으로 이어질 때 강합니다. ${dayMasterRelation} 다만 ${weakAxis}에서는 판단 기준이 흐려지기 쉬워, 초반 기준을 먼저 맞춰 두는 편이 좋습니다.`;
    case 'LOVER':
    case 'CRUSH':
      return `${joinWithAnd(userDayMaster, partnerDayMaster)}의 애정 흐름은 ${strongAxis}에서 끌림이 자연스럽게 커지고 ${weakAxis}에서 말의 온도가 어긋나기 쉬운 형태입니다. ${dayMasterRelation} 감정의 속도만 잘 맞춰도 이 궁합의 좋은 결이 훨씬 오래 살아납니다.`;
    case 'MARRIED':
      return `${joinWithAnd(userDayMaster, partnerDayMaster)}의 부부운은 강한 기운이 생활의 호흡으로 이어질 때 더 편안하게 안정됩니다. ${dayMasterRelation} ${weakAxis}에서 역할과 돈 기준이 흐려지면 마음보다 생활 피로가 먼저 쌓이기 쉬우니, 함께 지킬 기준을 먼저 나누어 두는 편이 좋습니다.`;
    default:
      return `${userDayMaster}인 ${input.userName}과 ${partnerDayMaster}인 ${input.partnerName}의 궁합은 ${strongAxis}에서 서로의 장점을 살리고 ${weakAxis}에서 조율을 배우는 구조입니다. ${dayMasterRelation} 차이를 고치려 하기보다 역할을 나누는 쪽이 관계를 더 길고 편안하게 만듭니다.`;
  }
}

function buildSelfSubjectLens(
  subjectType: SelfSubjectType,
  context: SubjectContext,
  strongElement: string,
  weakElement: string
): string {
  const defaultLens = `${context.focus} 관점에서 핵심은 ${strongElement} 기운을 실행으로 연결하고, ${weakElement} 축의 흔들림을 루틴으로 보완하는 것입니다.`;

  switch (subjectType) {
    case 'CAREER':
      return `직업운을 보면 ${strongElement} 기운이 살아날 때 강점이 또렷하게 드러납니다. ${weakElement} 축은 방향이 조금 퍼지기 쉬우니, 맡을 일과 보여줄 결과를 먼저 정해 두면 힘이 더 곧게 모입니다.`;
    case 'ROMANCE':
      return `연애운 렌즈: ${strongElement} 기운은 표현력과 끌림을 키우고, ${weakElement} 축은 오해를 키우기 쉽습니다. 감정 표현은 부드럽게, 기대치는 구체적으로 말하는 방식이 유리합니다.`;
    case 'WEALTH':
      return `재물운을 보면 ${strongElement} 구간은 수입을 키우는 감각이 잘 살아나는 편입니다. ${weakElement} 구간은 지출과 투자 기준을 조금 더 섬세하게 볼수록 좋습니다. 수익을 늘리는 일과 돈을 지키는 일을 함께 가져가면 들어온 복이 더 오래 남습니다.`;
    case 'DAEUN':
      return `대운을 보면 지금은 기존 방식을 다시 정리하라는 신호가 강합니다. ${strongElement}는 키우고 ${weakElement}는 무리하지 않게 다듬는 식으로 습관을 바꾸면 전환기의 부담을 줄일 수 있습니다.`;
    case 'YEAR_MONTH_DAY_FORTUNE':
      return `단기운을 보면 하루와 월별 변동 폭이 큰 시기입니다. ${strongElement} 기반 행동 1개를 고정하고, ${weakElement} 영역의 즉흥 결정을 줄이는 것이 결과를 지켜줍니다.`;
    default:
      return defaultLens;
  }
}

function buildCompatibilitySubjectLens(
  subjectType: CompatibilityRelationType,
  userName: string,
  partnerName: string,
  strongElement: string,
  weakElement: string
): string {
  switch (subjectType) {
    case 'LOVER':
      return `${userName}와 ${partnerName}의 궁합은 감정의 크기보다 표현 속도와 관계 기대치를 어떻게 맞추느냐가 더 중요합니다. ${strongElement} 기운의 장점은 신뢰와 끌림을 오래 붙드는 데 있고, ${weakElement} 축은 작은 오해가 길어지기 쉬우니 마음의 온도와 말의 순서를 같이 맞추는 편이 좋습니다.`;
    case 'CRUSH':
      return `${userName}와 ${partnerName}의 궁합은 설렘 자체보다, 실제 대화와 생활 리듬이 이어질 수 있는지 보는 편이 더 정확합니다. ${strongElement} 기운의 장점은 끌림을 오래 가져가는 데 있고, ${weakElement} 축은 기대가 커질수록 혼자 해석이 길어지기 쉬우니 신호를 가볍게 확인하는 태도가 필요합니다.`;
    case 'FRIEND':
      return `${userName}와 ${partnerName}의 궁합은 친한지 아닌지보다, 서로의 경계와 생활 리듬을 존중할 수 있는지가 핵심입니다. ${strongElement} 기운이 만나면 오래 가는 편안함이 생기고, ${weakElement} 축은 사소한 서운함을 오래 끌기 쉬우니 짧게라도 먼저 말하는 편이 좋습니다.`;
    case 'COWORKER':
    case 'MANAGER_MEMBER':
      return `${userName}와 ${partnerName}의 궁합은 감정보다 역할, 기준, 기한을 얼마나 선명하게 맞추는지가 중요합니다. ${strongElement} 기운의 장점은 책임을 오래 끌고 가는 데 있고, ${weakElement} 축은 설명이 빠질수록 피로가 커지기 쉬우니 일의 언어를 먼저 맞추는 편이 좋습니다.`;
    case 'BUSINESS_PARTNER':
      return `${userName}와 ${partnerName}의 궁합은 친분보다 역할 분담과 결정 기준이 맞을 때 훨씬 강해집니다. ${strongElement} 기운은 성과를 밀어 주지만, ${weakElement} 축은 권한과 돈의 경계가 흐려질 때 부담이 커지기 쉬우니 초반 문장 합의가 중요합니다.`;
    default:
      return `${userName}와 ${partnerName}의 궁합은 누가 더 맞는지보다, 서로의 강점이 어디서 살아나고 약한 축이 어디서 흔들리는지 보는 편이 더 정확합니다. ${strongElement} 기운은 관계의 든든함을 만들고, ${weakElement} 축은 기대가 흐려질 때 피로를 키우기 쉬우니 기준을 먼저 맞추는 편이 좋습니다.`;
  }
}

function buildCompatibilityHighlights(input: {
  subjectType: CompatibilityRelationType;
  userName: string;
  partnerName: string;
  userStrongElement: string;
  userWeakElement: string;
  partnerStrongElement: string;
  partnerWeakElement: string;
}): {
  pairDynamic: string;
  attractionPoint: string;
  conflictTrigger: string;
  communicationTip: string;
} {
  const common = {
    pairDynamic: `${input.userName}의 ${input.userStrongElement} 기운과 ${input.partnerName}의 ${input.partnerStrongElement} 기운은 역할 분담이 또렷할수록 서로의 장점을 편안하게 살려 주는 조합입니다.`,
    attractionPoint: `서로의 강점 축(${input.userStrongElement}/${input.partnerStrongElement})이 다르면 보완 관계로 작동해 끌림과 신뢰가 함께 높아집니다.`,
    conflictTrigger: `약한 축(${input.userWeakElement}/${input.partnerWeakElement})에서 기대치가 흐려지면 서운함이 조용히 쌓일 수 있습니다.`,
    communicationTip:
      '갈등 시 옳고 그름보다 역할·기한·기준 3가지를 먼저 맞춰 두면 관계 안정성이 훨씬 빨리 회복됩니다.'
  };

  switch (input.subjectType) {
    case 'LOVER':
    case 'CRUSH':
      return {
        pairDynamic: `감정의 온도차를 잘 맞추기만 하면 관계의 매력이 더 선명하게 살아나는 조합입니다. ${common.pairDynamic}`,
        attractionPoint: `서로에게 없는 관점을 보완해 주는 데서 매력이 커집니다. ${common.attractionPoint}`,
        conflictTrigger: `확신을 서두를 때 약한 축이 먼저 흔들릴 수 있습니다. ${common.conflictTrigger}`,
        communicationTip:
          '감정 표현은 솔직하게 하되, 관계 정의는 한 걸음씩 진행하면 서로 안심할 시간을 확보할 수 있습니다.'
      };
    case 'BUSINESS_PARTNER':
      return {
        pairDynamic: `앞에서 열 사람과 옆에서 살필 사람이 나뉘면 힘이 크게 살아나는 조합입니다. ${common.pairDynamic}`,
        attractionPoint: `의사결정과 실행의 속도 차이가 보완 자산이 됩니다. ${common.attractionPoint}`,
        conflictTrigger: `권한과 책임 경계가 흐려질 때 갈등 부담이 커지기 쉬우니 초반 합의가 중요합니다. ${common.conflictTrigger}`,
        communicationTip:
          '주요 의사결정은 구두 합의 대신 기준 문서(권한·배분·철수 조건)로 남겨 두면 관계와 사업을 함께 지키기 쉽습니다.'
      };
    default:
      return common;
  }
}

function buildSajuEvidence(input: {
  readingType: ReadingType;
  userName: string;
  userElement: FiveElementSummary;
  userTimeFlow: Pick<
    TimeFlowSummary,
    'currentDaewoon' | 'yearlyFlow' | 'currentTheme'
  >;
  userSubtype?: SubjectSubtype | null;
  partnerName?: string;
  partnerElement?: FiveElementSummary | null;
  partnerTimeFlow?: Pick<TimeFlowSummary, 'currentDaewoon'> | null;
  compatibilitySubtype?: SubjectSubtype | null;
}): string[] {
  if (input.readingType === 'SELF') {
    return [
      `기본 바탕은 ${input.userElement.strongElement} 기운이 강해 ${describeStrongElementMeaning(input.userElement.strongElement)}. 반대로 ${input.userElement.weakElement} 기운은 비기 쉬워 ${describeWeakElementMeaning(input.userElement.weakElement)}.`,
      input.userSubtype
        ? `지금 이 고민으로 보면 흐름은 ${input.userSubtype.label}에 가깝습니다. 즉, ${input.userSubtype.description}.`
        : '지금은 타고난 기질과 현재 운이 함께 맞물리며 방향을 또렷하게 잡아 주는 시기입니다.',
      `겉으로 드러난 기운에는 기준을 세우는 힘, 만들어 내는 힘, 책임을 지는 힘이 함께 보입니다. 그래서 밀어붙이기보다 기준을 세우고 쌓아 갈 때 결과가 더 안정적으로 남습니다.`,
      `${buildUnseongSummary(input.userElement)} 지금은 ${input.userTimeFlow.currentTheme}이 크게 깔려 있고, 올해는 ${extractMeaningOnly(input.userTimeFlow.yearlyFlow)} 그래서 무리한 변화보다 생활 리듬을 정리하면서 가는 방식이 더 잘 맞습니다.`
    ];
  }

  return [
    `${input.userName}은 ${input.userElement.strongElement} 기운이 강해 ${describeStrongElementMeaning(input.userElement.strongElement)}. ${input.partnerName ?? '상대'}는 ${input.partnerElement ? `${input.partnerElement.strongElement} 기운이 강해 ${describeStrongElementMeaning(input.partnerElement.strongElement)}` : '아직 상대 흐름을 충분히 읽을 정보가 더 필요합니다'}.`,
    `${input.userName}은 ${input.userElement.weakElement} 축에서 ${describeWeakElementMeaning(input.userElement.weakElement)}. ${input.partnerName ?? '상대'}는 ${input.partnerElement ? `${describeWeakElementMeaning(input.partnerElement.weakElement)}` : '세부 조율 포인트는 상대 정보가 더 있어야 선명해집니다'}.`,
    input.compatibilitySubtype
      ? `이 궁합은 ${input.compatibilitySubtype.label}에 가깝습니다. 즉, ${input.compatibilitySubtype.description}.`
      : '궁합은 두 사람의 타고난 기질과 지금 들어온 운을 함께 읽을 때 더 정확해집니다.',
    `${input.userName} 쪽은 ${buildUnseongSummary(input.userElement)}${input.partnerElement ? ` ${input.partnerName ?? '상대'} 쪽은 ${buildUnseongSummary(input.partnerElement)}` : ''} 그래서 두 사람 모두 서두르기보다 각자 편한 리듬을 먼저 맞출수록 관계의 장점이 더 잘 살아납니다.`,
    `지금은 두 사람 모두 큰 운의 방향이 분명한 시기입니다. ${input.userName} 쪽은 ${extractMeaningOnly(input.userTimeFlow.currentDaewoon)}${input.partnerElement ? ` ${input.partnerName ?? '상대'} 쪽은 ${extractMeaningOnly(input.partnerTimeFlow?.currentDaewoon ?? '현재 큰 운이 천천히 펼쳐지는 편입니다.')}` : ''} 그래서 말의 순서와 기대치를 먼저 맞춰 두는 방식이 가장 잘 맞습니다.`
  ];
}

export function buildRuleBasedDraft(
  input: SajuGenerationInput,
  pipelineMode: PipelineMode
): RuleDraft {
  const seed = hashSeed(input.cacheKey);
  const partnerDisplayName = input.partnerName ?? '상대';
  const mbtiLabel = input.userMbtiType ?? '미설정';
  const mbtiAdvice = buildMbtiAdvice(input.userMbtiType);
  const partnerMbtiAdvice = input.partnerMbtiType
    ? buildMbtiAdvice(input.partnerMbtiType)
    : null;
  const mbtiAppliedRules = [
    ...buildMbtiAppliedRules(input.userMbtiType, input.userName),
    ...(input.partnerMbtiType
      ? buildMbtiAppliedRules(input.partnerMbtiType, partnerDisplayName)
      : [])
  ];
  const subjectLabel =
    input.readingType === 'SELF'
      ? SELF_SUBJECT_LABEL[input.subjectType as SelfSubjectType]
      : COMPATIBILITY_RELATION_LABEL[
          input.subjectType as CompatibilityRelationType
        ];
  const scenarioOption = input.scenarioCode
    ? getScenarioOption(input.scenarioCode)
    : null;
  const scenarioOverlay = buildScenarioOverlay(scenarioOption);
  const displaySubjectLabel =
    scenarioOverlay?.titleLabel ?? scenarioOption?.label ?? subjectLabel;

  const subjectContext =
    input.readingType === 'SELF'
      ? SELF_SUBJECT_CONTEXT[input.subjectType as SelfSubjectType]
      : COMPATIBILITY_SUBJECT_CONTEXT[
          input.subjectType as CompatibilityRelationType
        ];
  const userElement = buildFiveElementSummary(
    input.userBirthInfo,
    `${input.cacheKey}|user-element`
  );
  const userTimeFlow = buildTimeFlow(
    input.userBirthInfo,
    `${input.cacheKey}|user-flow`,
    input.periodContext.referenceDate
  );
  const partnerElement =
    input.readingType === 'COMPATIBILITY' && input.partnerBirthInfo
      ? buildFiveElementSummary(
          input.partnerBirthInfo,
          `${input.cacheKey}|partner-element`
        )
      : null;
  const partnerTimeFlow =
    input.readingType === 'COMPATIBILITY' && input.partnerBirthInfo
      ? buildTimeFlow(
          input.partnerBirthInfo,
          `${input.cacheKey}|partner-flow`,
          input.periodContext.referenceDate
        )
      : null;
  const wealthSubtype = buildWealthSubtype(userElement);
  const careerSubtype = buildCareerSubtype(userElement);
  const romanceSubtype = buildRelationshipSubtype(userElement, 'ROMANCE');
  const marriageSubtype = buildRelationshipSubtype(userElement, 'MARRIAGE');
  const compatibilitySubtype =
    input.readingType === 'COMPATIBILITY'
      ? buildCompatibilitySubtype(userElement, partnerElement)
      : null;

  const atmospherePool = [
    '새벽 안개가 걷히며 길이 또렷해지는 장면',
    '조용한 호수 위에 파문이 넓게 퍼지는 장면',
    '봄비 뒤 흙냄새가 올라오며 땅이 힘을 받는 장면',
    '등대 불빛이 방향을 다시 잡아주는 장면',
    '따뜻한 햇살이 얼어 있던 길을 녹이는 장면',
    '바람이 잦아든 뒤 돛이 다시 모양을 잡는 장면',
    '긴 겨울 끝에 창문을 열어 공기를 바꾸는 장면',
    '마른 가지 끝에 새순이 붙으며 결이 살아나는 장면',
    '흩어진 책장을 한 권씩 다시 꽂아 방이 정돈되는 장면'
  ];
  const energySignals = [
    '안정-확장',
    '몰입-정리',
    '관계-성과',
    '도전-회복',
    '탐색-확정'
  ];
  const positiveSpotlights = [
    '지금의 강점은 상황을 읽고 타이밍을 맞추는 감각',
    '작게 시작해도 꾸준히 쌓아 결과를 만드는 체력',
    '사람의 마음과 목표를 함께 보는 균형감',
    '복잡한 문제를 단순한 실행으로 바꾸는 정리력',
    '흔들리는 순간에도 중심을 다시 세우는 회복력',
    '조용하지만 오래 가는 집중력',
    '서두르지 않아도 결국 방향을 맞추는 힘',
    '작은 변화에서 흐름의 단서를 찾는 감각'
  ];
  const softCautionPool = [
    '속도를 내기 전에 기준을 한 번만 더 확인하면 흔들림이 크게 줄어듭니다',
    '완벽하게 하려는 마음이 클수록 시작 단위를 더 작게 잡으면 훨씬 유리합니다',
    '좋은 관계를 지키려다 내 기준이 흐려질 수 있어 우선순위를 짧게 메모해 두면 좋습니다',
    '정답을 빨리 찾고 싶을 때일수록 질문 하나를 더 던지면 결과가 안정됩니다',
    '마음이 지친 날엔 결정보다 회복을 먼저 챙기면 다음 선택이 훨씬 선명해집니다'
  ];
  const actionPool = [
    '오늘 해야 할 일을 3개만 남기고, 가장 작은 1개를 15분 안에 먼저 끝내기',
    '중요한 대화 1건은 사실-느낌-요청 순서로 짧게 정리해 전달하기',
    '이번 주 소비/시간 로그를 7일만 기록해 반복 패턴을 확인하기',
    '에너지가 빠지는 일정 1개를 줄이고 회복 시간 30분을 먼저 확보하기',
    '결정 전 체크리스트 3문항(목적/주의점/다음 행동)으로 판단 속도 높이기',
    '하루 종료 전 “잘한 점 1개 + 내일의 첫 행동 1개”를 적고 잠들기',
    '관계 이슈가 있으면 결론보다 기대치 정렬(무엇을, 언제까지)을 먼저 합의하기'
  ];

  const coreSignal = pickBySeed(seed, energySignals, 1);
  const highlight = pickBySeed(seed, positiveSpotlights, 2);
  const atmosphere = pickBySeed(seed, atmospherePool, 3);
  const softCaution = pickBySeed(seed, softCautionPool, 4);
  const actions = Array.from(
    new Set([
      scenarioOverlay?.actionOverride ?? subjectContext.firstAction,
      pickBySeed(seed, actionPool, 5),
      pickBySeed(seed, actionPool, 6),
      mbtiAdvice.bestAction,
      pickBySeed(seed, actionPool, 7)
    ])
  ).slice(0, 3);

  let actionCursor = 0;
  while (actions.length < 3 && actionCursor < actionPool.length) {
    const candidate = pickBySeed(seed, actionPool, actionCursor + 11);
    if (!actions.includes(candidate)) {
      actions.push(candidate);
    }
    actionCursor += 1;
  }

  const compatibilityTarget =
    input.readingType === 'COMPATIBILITY'
      ? `${input.userName} - ${partnerDisplayName}`
      : input.userName;

  const storyTitle =
    input.readingType === 'SELF'
      ? `${input.userName}님의 ${displaySubjectLabel} 풀이`
      : `${compatibilityTarget}의 ${displaySubjectLabel} 궁합 풀이`;
  const sajuCurrentSignal =
    input.readingType === 'SELF'
      ? buildSelfSubjectCurrentSignal({
          subjectType: input.subjectType as SelfSubjectType,
          userElement,
          userTimeFlow
        })
      : buildCompatibilityCurrentSignal({
          subjectType: input.subjectType as CompatibilityRelationType,
          userName: input.userName,
          partnerName: partnerDisplayName,
          userElement,
          partnerElement
        });
  const activeSelfSubtype =
    input.readingType === 'SELF'
      ? (() => {
          switch (input.subjectType as SelfSubjectType) {
            case 'CAREER':
              return careerSubtype;
            case 'WEALTH':
              return wealthSubtype;
            case 'ROMANCE':
              return romanceSubtype;
            case 'MARRIAGE':
              return marriageSubtype;
            default:
              return null;
          }
        })()
      : null;
  const selfMbtiOverviewLead = buildSelfMbtiLead(
    input.userName,
    mbtiLabel,
    mbtiAdvice,
    'overview'
  );
  const selfMbtiSummaryLead = buildSelfMbtiLead(
    input.userName,
    mbtiLabel,
    mbtiAdvice,
    'summary'
  );
  const selfMbtiNarrativeLead = buildSelfMbtiLead(
    input.userName,
    mbtiLabel,
    mbtiAdvice,
    'narrative'
  );
  const selfMbtiRelationshipLead = buildSelfMbtiLead(
    input.userName,
    mbtiLabel,
    mbtiAdvice,
    'relationship'
  );
  const selfMbtiWealthLead = buildSelfMbtiLead(
    input.userName,
    mbtiLabel,
    mbtiAdvice,
    'wealth'
  );
  const selfMbtiTimingLead = buildSelfMbtiLead(
    input.userName,
    mbtiLabel,
    mbtiAdvice,
    'timing'
  );
  const selfMbtiCautionLead = buildSelfMbtiLead(
    input.userName,
    mbtiLabel,
    mbtiAdvice,
    'caution'
  );
  const compatibilityMbtiOverviewLead = buildCompatibilityMbtiLead(
    {
      userName: input.userName,
      partnerName: partnerDisplayName,
      userAdvice: mbtiAdvice,
      partnerAdvice: partnerMbtiAdvice
    },
    'overview'
  );
  const compatibilityMbtiSummaryLead = buildCompatibilityMbtiLead(
    {
      userName: input.userName,
      partnerName: partnerDisplayName,
      userAdvice: mbtiAdvice,
      partnerAdvice: partnerMbtiAdvice
    },
    'summary'
  );
  const compatibilityMbtiNarrativeLead = buildCompatibilityMbtiLead(
    {
      userName: input.userName,
      partnerName: partnerDisplayName,
      userAdvice: mbtiAdvice,
      partnerAdvice: partnerMbtiAdvice
    },
    'narrative'
  );
  const compatibilityMbtiRelationshipLead = buildCompatibilityMbtiLead(
    {
      userName: input.userName,
      partnerName: partnerDisplayName,
      userAdvice: mbtiAdvice,
      partnerAdvice: partnerMbtiAdvice
    },
    'relationship'
  );
  const compatibilityMbtiTimingLead = buildCompatibilityMbtiLead(
    {
      userName: input.userName,
      partnerName: partnerDisplayName,
      userAdvice: mbtiAdvice,
      partnerAdvice: partnerMbtiAdvice
    },
    'timing'
  );
  const compatibilityMbtiCautionLead = buildCompatibilityMbtiLead(
    {
      userName: input.userName,
      partnerName: partnerDisplayName,
      userAdvice: mbtiAdvice,
      partnerAdvice: partnerMbtiAdvice
    },
    'caution'
  );

  const overview =
    input.readingType === 'SELF'
      ? `${selfMbtiOverviewLead} 이런 성향은 사주에서 ${userElement.strongElement} 기운이 강하게 잡힌 구조와도 닿아 있습니다. ${buildElementMeaningBridge(userElement.strongElement, userElement.weakElement)}\n\n${scenarioOverlay?.narrativeAddon ? `${scenarioOverlay.narrativeAddon} ` : ''}지금은 '${coreSignal}'이 핵심으로 들어오는 시기입니다. ${sajuCurrentSignal} ${activeSelfSubtype ? `이번 주제를 읽으면 ${activeSelfSubtype.label}에 가까워 ${activeSelfSubtype.description}. ` : ''}${highlight}은 이번 시기에서 분명한 강점으로 살아납니다. ${buildSelfSubjectOverviewAccent(input.subjectType as SelfSubjectType, activeSelfSubtype)}`
      : `${compatibilityMbtiOverviewLead} 두 사람의 궁합은 '${atmosphere}'처럼 호흡이 맞을 때 훨씬 편안하게 이어집니다. ${scenarioOverlay?.narrativeAddon ? `${scenarioOverlay.narrativeAddon} ` : ''}${sajuCurrentSignal}\n\n${compatibilitySubtype ? `지금 두 사람은 ${compatibilitySubtype.label} 궁합에 가까워 ${compatibilitySubtype.description}. ` : ''}${buildCompatibilityOverviewAccent(compatibilitySubtype)} 서로를 바꾸려 하기보다 각자 강한 부분을 살리고 약한 부분을 보완할 때 관계의 장점이 더 크게 드러납니다.`;

  const narrativeFlow =
    input.readingType === 'SELF'
      ? `${selfMbtiNarrativeLead} ${subjectContext.storyline} ${scenarioOverlay?.narrativeAddon ? `${scenarioOverlay.narrativeAddon} ` : ''}요즘 ${input.userName}님에게 중요한 건 ${withObjectParticle(userTimeFlow.currentTheme)} 생활 안에서 실제 움직임으로 바꾸는 일입니다.\n\n${buildElementMeaningBridge(userElement.strongElement, userElement.weakElement)} ${activeSelfSubtype ? `이번 흐름은 ${activeSelfSubtype.label}에 가까워 ${activeSelfSubtype.advice}` : ''} ${buildSelfSubjectNarrativeAccent(input.subjectType as SelfSubjectType, activeSelfSubtype)} 큰 결심 한 번보다 작은 완료를 꾸준히 쌓을 때 운이 더 잘 붙습니다.`
      : `${compatibilityMbtiNarrativeLead} ${subjectContext.storyline} ${scenarioOverlay?.narrativeAddon ? `${scenarioOverlay.narrativeAddon} ` : ''}${compatibilityTarget}는 차이를 지우는 관계가 아니라, 역할을 잘 나눌 때 더 편안하고 단단해지는 관계입니다.\n\n${compatibilitySubtype ? `지금은 ${compatibilitySubtype.label} 궁합에 가까워 ${compatibilitySubtype.advice}` : ''} ${buildCompatibilityNarrativeAccent(compatibilitySubtype)}${input.partnerMbtiType ? ' 서로의 성향 차이를 억지로 줄이기보다 각자의 리듬을 인정할수록 궁합이 훨씬 부드럽게 이어집니다.' : ''}`;

  const summary =
    input.readingType === 'SELF'
      ? `${displaySubjectLabel}: ${selfMbtiSummaryLead} '${subjectContext.focus}' 관점에서 '${coreSignal}' 결이 또렷한 시기입니다.${scenarioOverlay?.subjectLensAddon ? ` ${scenarioOverlay.subjectLensAddon}` : ''}${activeSelfSubtype ? ` 기본 결은 ${activeSelfSubtype.label}이라 ${activeSelfSubtype.description}.` : ''} ${userElement.dayMaster.stem}${userElement.dayMaster.element} 일간 위로 ${withSubjectParticle(userTimeFlow.currentTheme)} 겹쳐 들어와, 강점을 실제 행동으로 연결할수록 운이 더 곧게 이어집니다.`
      : `${displaySubjectLabel}: ${compatibilityMbtiSummaryLead} '${subjectContext.focus}' 관점에서 '${coreSignal}' 리듬을 맞출수록 관계 안정감이 함께 올라갑니다.${scenarioOverlay?.subjectLensAddon ? ` ${scenarioOverlay.subjectLensAddon}` : ''}${compatibilitySubtype ? ` 두 사람은 ${compatibilitySubtype.label} 궁합에 가까워 ${compatibilitySubtype.description}.` : ''} 두 사람의 일간 결을 억지로 맞추기보다 역할로 나눌수록 합이 살아납니다.`;

  const sajuBasis =
    input.readingType === 'SELF'
      ? `위 분석표를 먼저 보면 ${input.userName}님의 사주 바탕이 한눈에 들어옵니다. 일간은 ${userElement.dayMaster.stem}${userElement.dayMaster.element}이고, 기본 바탕은 ${userElement.strongElement} 기운이 앞서고 ${userElement.weakElement} 기운이 비기 쉬운 구조입니다.\n\n${buildElementMeaningBridge(userElement.strongElement, userElement.weakElement)} 그래서 이 사주는 강한 부분은 믿고 밀어도 좋지만, 비기 쉬운 부분은 생활 습관으로 채워 줄수록 훨씬 안정됩니다.\n\n이 타고난 바탕 위에 현재 대운과 올해 운이 겹치며 지금의 운이 만들어집니다.`
      : `위 분석표를 먼저 보면 두 사람의 사주 바탕이 한눈에 들어옵니다. ${input.userName}은 ${userElement.dayMaster.stem}${userElement.dayMaster.element} 일간이고, ${partnerDisplayName}은 ${partnerElement ? `${partnerElement.dayMaster.stem}${partnerElement.dayMaster.element} 일간입니다` : '아직 상대 원국이 충분히 계산되지 않았습니다'}.\n\n${input.userName}은 ${describeStrongElementMeaning(userElement.strongElement)} ${partnerElement ? `${partnerDisplayName}은 ${describeStrongElementMeaning(partnerElement.strongElement)}.` : ''} 궁합은 이렇게 다른 타고난 결이 지금 들어온 운과 만나며 어떤 분위기를 만드는지 함께 읽어야 정확해집니다.`;

  const tenYearFlow =
    input.readingType === 'SELF'
      ? `${userTimeFlow.tenYearFlow}${scenarioOverlay?.tenYearFlowAddon ? ` ${scenarioOverlay.tenYearFlowAddon}` : ''}`
      : `${input.userName}: ${userTimeFlow.tenYearFlow}${scenarioOverlay?.tenYearFlowAddon ? ` ${scenarioOverlay.tenYearFlowAddon}` : ''} ${partnerDisplayName}: ${partnerTimeFlow?.tenYearFlow ?? '10년 흐름 계산 정보가 충분하지 않습니다.'}`;

  const currentDaewoon =
    input.readingType === 'SELF'
      ? `${userTimeFlow.currentDaewoon}${scenarioOverlay?.currentDaewoonAddon ? ` ${scenarioOverlay.currentDaewoonAddon}` : ''}`
      : `${input.userName}: ${userTimeFlow.currentDaewoon}${scenarioOverlay?.currentDaewoonAddon ? ` ${scenarioOverlay.currentDaewoonAddon}` : ''} ${partnerDisplayName}: ${partnerTimeFlow?.currentDaewoon ?? '현재 대운 계산 정보가 충분하지 않습니다.'}`;

  const yearlyFlow =
    input.readingType === 'SELF'
      ? `${userTimeFlow.yearlyFlow}${scenarioOverlay?.yearlyFlowAddon ? ` ${scenarioOverlay.yearlyFlowAddon}` : ''}`
      : `${userTimeFlow.yearlyFlow}${scenarioOverlay?.yearlyFlowAddon ? ` ${scenarioOverlay.yearlyFlowAddon}` : ''}`;

  const relationshipFlow =
    input.readingType === 'SELF'
      ? `${selfMbtiRelationshipLead} ${subjectContext.relationHint} ${scenarioOverlay?.relationshipFlowAddon ? `${scenarioOverlay.relationshipFlowAddon} ` : ''}${userElement.strongElement} 기운이 강한 사람은 마음을 열면 관계를 든든하게 끌고 가는 힘이 있습니다. 다만 ${userElement.weakElement} 기운이 비기 쉬워, 서운함이 생겼을 때 혼자 오래 안고 가기 쉽습니다.\n\n${input.subjectType === 'ROMANCE' ? romanceSubtype.advice : input.subjectType === 'MARRIAGE' ? marriageSubtype.advice : '좋은 관계일수록 기준을 부드럽게 말해 주는 태도가 중요합니다.'} 짧더라도 자주 상태를 나누면 관계의 좋은 결을 더 오래 살릴 수 있습니다.`
      : `${compatibilityMbtiRelationshipLead} ${subjectContext.relationHint} ${scenarioOverlay?.relationshipFlowAddon ? `${scenarioOverlay.relationshipFlowAddon} ` : ''}관계를 보면 ${input.userName}의 ${userElement.strongElement} 기운과 ${partnerDisplayName}의 ${partnerElement?.strongElement ?? '균형'} 기운이 만날 때 시너지가 분명합니다. 서로 잘하는 부분이 다르기 때문에 역할만 잘 나뉘어도 관계가 훨씬 편안해집니다.\n\n다만 ${userElement.weakElement}·${partnerElement?.weakElement ?? '수'} 축에서는 오해가 잠깐 붙기 쉽습니다. 기대치를 먼저 맞춰 두고, 좋은 마음을 확인하는 말 한마디를 자주 건네면 궁합의 장점이 더 선명하게 살아납니다.`;

  const wealthFlow =
    input.readingType === 'SELF'
      ? `${selfMbtiWealthLead} ${subjectContext.workMoneyHint} ${scenarioOverlay?.wealthFlowAddon ? `${scenarioOverlay.wealthFlowAddon} ` : ''}재물운을 보면 지금은 ${wealthSubtype.label}에 가깝습니다. ${wealthSubtype.description}. ${userElement.strongElement} 기운이 강하다는 건 돈을 다루는 감각에서 이 장점이 먼저 드러난다는 뜻입니다.\n\n반대로 ${userElement.weakElement} 기운이 약한 구간에서는 돈이 새는 이유를 늦게 알아차리기 쉽습니다. 그래서 ${wealthSubtype.advice} 작은 기준 하나만 세워도 들어온 복이 훨씬 오래 남습니다.`
      : `${subjectContext.workMoneyHint}\n\n두 사람의 재물 흐름은 역할 분담이 선명할수록 훨씬 안정적으로 굴러갑니다.\n\n${withTopicParticle(input.userName)} 앞에서 열고, ${withTopicParticle(partnerDisplayName)} 옆에서 살피는 식으로 나누면 변동성을 줄이면서 성과를 오래 가져갈 수 있습니다. 돈 이야기를 감정에서 떼어 기준으로 정리해 두면 관계도 함께 편해집니다.`;

  const timingHint =
    input.readingType === 'SELF'
      ? `${selfMbtiTimingLead} ${subjectContext.timingHint} ${scenarioOverlay?.timingAddon ? `${scenarioOverlay.timingAddon} ` : ''}현재 큰 운은 ${extractMeaningOnly(currentDaewoon)} 올해는 ${extractMeaningOnly(yearlyFlow)} ${buildUnseongSummary(userElement)} 그래서 서두르기보다 흐름이 붙는 시간대를 골라 움직일수록 결과가 더 매끈하게 이어집니다.`
      : `${compatibilityMbtiTimingLead}\n\n${subjectContext.timingHint}\n\n${scenarioOverlay?.timingAddon ? `${scenarioOverlay.timingAddon}\n\n` : ''}지금은 ${extractMeaningOnly(currentDaewoon)}\n\n올해는 ${extractMeaningOnly(yearlyFlow)}\n\n급히 결론내기보다 두 사람의 호흡이 맞는 타이밍을 골라 이야기할수록 결과가 훨씬 부드럽습니다. 중요한 이야기는 피곤할 때보다 마음이 조금 느슨해진 시간에 꺼내는 편이 좋습니다.`;
  const subjectLens =
    input.readingType === 'SELF'
      ? `${buildSelfSubjectLens(
          input.subjectType as SelfSubjectType,
          subjectContext,
          userElement.strongElement,
          userElement.weakElement
        )} ${
          scenarioOverlay?.subjectLensAddon
            ? `${scenarioOverlay.subjectLensAddon} `
            : ''
        }${
          activeSelfSubtype
            ? `현재는 ${activeSelfSubtype.label}에 가까워 ${activeSelfSubtype.advice}`
            : ''
        }`
      : `${buildCompatibilitySubjectLens(
          input.subjectType as CompatibilityRelationType,
          input.userName,
          partnerDisplayName,
          userElement.strongElement,
          userElement.weakElement
        )} ${
          scenarioOverlay?.compatibilityLensAddon
            ? scenarioOverlay.compatibilityLensAddon
            : (scenarioOverlay?.subjectLensAddon ?? '')
        }`.trim();
  const compatibilityHighlights =
    input.readingType === 'COMPATIBILITY'
      ? buildCompatibilityHighlights({
          subjectType: input.subjectType as CompatibilityRelationType,
          userName: input.userName,
          partnerName: partnerDisplayName,
          userStrongElement: userElement.strongElement,
          userWeakElement: userElement.weakElement,
          partnerStrongElement: partnerElement?.strongElement ?? '토',
          partnerWeakElement: partnerElement?.weakElement ?? '수'
        })
      : null;
  const sajuEvidence = buildSajuEvidence({
    readingType: input.readingType,
    userName: input.userName,
    userElement,
    userTimeFlow,
    userSubtype: activeSelfSubtype,
    partnerName: partnerDisplayName,
    partnerElement,
    partnerTimeFlow,
    compatibilitySubtype
  });

  return {
    summary,
    sectionsJson: {
      storyTitle,
      sajuEvidence,
      sajuBasis,
      overview,
      narrativeFlow,
      subjectLens,
      tenYearFlow,
      currentDaewoon,
      yearlyFlow,
      relationshipFlow,
      wealthFlow,
      pairDynamic:
        scenarioOverlay?.pairDynamicText ??
        compatibilityHighlights?.pairDynamic,
      attractionPoint:
        scenarioOverlay?.attractionPointText ??
        compatibilityHighlights?.attractionPoint,
      conflictTrigger:
        scenarioOverlay?.conflictTriggerText ??
        compatibilityHighlights?.conflictTrigger,
      communicationTip:
        (
          scenarioOverlay?.communicationText ??
          `${compatibilityHighlights?.communicationTip ?? ''}${
            scenarioOverlay?.communicationAddon
              ? ` ${scenarioOverlay.communicationAddon}`
              : ''
          }`
        ).trim() || undefined,
      relationshipLens: relationshipFlow,
      careerMoneyLens: wealthFlow,
      timingHint,
      coreSignal: `이번 풀이의 핵심은 '${coreSignal}'입니다. ${userElement.strongElement} 기운이 강하다는 건 ${describeStrongElementMeaning(userElement.strongElement)}. 반대로 ${userElement.weakElement} 기운이 약하다는 건 ${describeWeakElementMeaning(userElement.weakElement)}.\n\n그래서 지금 들어온 ${userTimeFlow.currentTheme}의 운은 강점을 밀어 주는 동시에, 약한 부분은 생활 습관으로 다듬으라고 말하고 있습니다.`,
      caution: `${input.readingType === 'SELF' ? selfMbtiCautionLead : compatibilityMbtiCautionLead} 마음 써둘 대목을 차분히 짚어 보면 ${subjectContext.softRisk}. ${activeSelfSubtype ? activeSelfSubtype.caution : (compatibilitySubtype?.caution ?? '')}${scenarioOverlay?.cautionAddon ? ` ${scenarioOverlay.cautionAddon}` : ''}\n\n특히 ${userElement.balanceProfile.gisin.element} 기운이 지나치게 앞서면 판단이 잠깐 급해질 수 있습니다. ${softCaution}. ${buildUnseongFocusText(userElement, ['DECLINE', 'RESET'], '월지의 기세가 높아 보여도 속을 먼저 다지면 흐름이 덜 흔들립니다.')} 큰 수정보다 작은 정리 하나만 해도 흐름의 거친 면은 한결 부드러워집니다. ${mbtiAdvice.cautionStyle}.`,
      actions,
      reflectionQuestion: `${subjectContext.reflectionQuestion} ${mbtiAdvice.reflectionStyle}.`
    },
    internalMetadata: {
      scenario: scenarioOption
        ? {
            code: scenarioOption.code,
            label: scenarioOption.label,
            description: scenarioOption.description
          }
        : undefined,
      basisFeatures: {
        user: {
          strongElement: userElement.strongElement,
          weakElement: userElement.weakElement,
          ratioText: userElement.ratioText,
          currentDaewoonTheme: userTimeFlow.currentTheme,
          birthTimeUnknown: input.userBirthInfo.birthTimeUnknown,
          elementCount: userElement.elementCount,
          pillars: userElement.pillars,
          dayMaster: userElement.dayMaster,
          roleProfile: userElement.roleProfile,
          balanceProfile: userElement.balanceProfile,
          tenGodProfile: userElement.tenGodProfile,
          hiddenTenGodProfile: userElement.hiddenTenGodProfile,
          unseongProfile: userElement.unseongProfile
        },
        partner: partnerElement
          ? {
              strongElement: partnerElement.strongElement,
              weakElement: partnerElement.weakElement,
              ratioText: partnerElement.ratioText,
              currentDaewoonTheme: partnerTimeFlow?.currentTheme ?? 'unknown',
              birthTimeUnknown:
                input.partnerBirthInfo?.birthTimeUnknown ?? false,
              elementCount: partnerElement.elementCount,
              pillars: partnerElement.pillars,
              dayMaster: partnerElement.dayMaster,
              roleProfile: partnerElement.roleProfile,
              balanceProfile: partnerElement.balanceProfile,
              tenGodProfile: partnerElement.tenGodProfile,
              hiddenTenGodProfile: partnerElement.hiddenTenGodProfile,
              unseongProfile: partnerElement.unseongProfile
            }
          : undefined
      },
      subjectArchetypes: {
        user: activeSelfSubtype
          ? {
              code: activeSelfSubtype.code,
              label: activeSelfSubtype.label,
              description: activeSelfSubtype.description
            }
          : undefined,
        compatibility: compatibilitySubtype
          ? {
              code: compatibilitySubtype.code,
              label: compatibilitySubtype.label,
              description: compatibilitySubtype.description
            }
          : undefined
      },
      mbtiAppliedRules,
      templateVersion: TEMPLATE_VERSION,
      subjectRuleSetVersion: SUBJECT_RULESET_VERSION,
      weighting: {
        saju: 0.75,
        mbti: 0.25
      },
      periodContext: input.periodContext,
      pipeline: {
        mode: pipelineMode,
        llmRendered: false,
        llmReviewed: false
      }
    }
  };
}
