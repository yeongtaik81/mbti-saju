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
import { getSelfScenarioContentProfile } from './self-scenario-profiles';
import { getCompatibilityScenarioContentProfile } from './compatibility-scenario-profiles';
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

function describeSubtypeForUser(subtype: SubjectSubtype | null | undefined) {
  return subtype?.description ?? '';
}

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

function buildSelfSubjectOverviewClose(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
  subtype: SubjectSubtype | null;
}): string {
  const subtypeAccent = buildSelfSubjectOverviewAccent(
    input.subjectType,
    input.subtype
  );

  let scenarioAccent = '';

  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      scenarioAccent =
        '재회 가능성은 반가움보다 회복 규칙이 먼저 서야 현실로 붙습니다.';
      break;
    case 'SELF_LOVE_CONTACT_RETURN':
      scenarioAccent =
        '연락운은 연락의 유무보다, 연락 뒤에도 내 기준을 잃지 않는 흐름에서 살아납니다.';
      break;
    case 'SELF_LOVE_CONFESSION_TIMING':
      scenarioAccent =
        '고백은 마음이 큰 날보다, 상대의 속도를 읽고도 서두르지 않을 때 훨씬 자연스럽게 이어집니다.';
      break;
    case 'SELF_CAREER_APTITUDE':
      scenarioAccent =
        '적성은 남의 평가보다, 반복할수록 더 나아지는 방식이 무엇인지에서 훨씬 선명해집니다.';
      break;
    case 'SELF_CAREER_JOB_CHANGE':
      scenarioAccent =
        '이직운은 떠나는 추진력보다, 다음 자리에서 어떤 결과를 낼지를 말할 수 있을 때 더 강하게 붙습니다.';
      break;
    case 'SELF_WEALTH_ACCUMULATION':
      scenarioAccent =
        '돈복은 크게 벌 기회보다, 남기는 구조를 지키는 생활 기준에서 오래 남습니다.';
      break;
    case 'SELF_WEALTH_LEAK':
      scenarioAccent =
        '누수 흐름은 더 버는 힘보다, 피곤할 때 무너지는 소비 장면을 끊을수록 빠르게 달라집니다.';
      break;
    case 'SELF_RELATIONSHIP_CUT_OFF':
      scenarioAccent =
        '관계 정리는 크게 끊는 말보다, 반복되는 소모를 멈추는 기준을 세울 때부터 풀립니다.';
      break;
    case 'SELF_FAMILY_PARENTS':
      scenarioAccent =
        '부모 문제는 효심을 증명하는 것보다, 죄책감 없이 말할 문장을 확보할 때 숨이 트입니다.';
      break;
    default:
      break;
  }

  return [subtypeAccent, scenarioAccent].filter(Boolean).join(' ');
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

function buildSelfNarrativeAnchor(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
  currentTheme: string;
  userName: string;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      return `요즘 ${withTopicParticle(input.currentTheme)} 올라올수록 다시 보고 싶은 마음과 다시 버틸 수 있는 마음을 헷갈리지 않는 일이 중요합니다.`;
    case 'SELF_LOVE_CONTACT_RETURN':
      return `요즘 ${withTopicParticle(input.currentTheme)} 흔들릴수록 연락 유무가 하루 리듬을 좌우하지 않게 만드는 일이 먼저입니다.`;
    case 'SELF_LOVE_CONFESSION_TIMING':
      return `요즘 ${withTopicParticle(input.currentTheme)} 커질수록 마음을 빨리 확인받고 싶은 조급함보다 관계 온도를 읽는 호흡이 더 중요합니다.`;
    case 'SELF_CAREER_APTITUDE':
      return `요즘 ${withObjectParticle(input.currentTheme)} 성과 압박이 아니라 반복 실험으로 바꿔 볼수록 맞는 일의 결이 더 또렷해집니다.`;
    case 'SELF_CAREER_JOB_CHANGE':
      return `요즘 ${withTopicParticle(input.currentTheme)} 답답함을 크게 느끼게 하는 시기라, 떠날 이유보다 다음 자리 문장을 먼저 세우는 편이 안전합니다.`;
    case 'SELF_WEALTH_ACCUMULATION':
      return `요즘 ${withTopicParticle(input.currentTheme)} 수입 크기보다 유지 구조를 먼저 점검하라고 말하는 시기라, 남기는 습관을 붙이는 일이 중요합니다.`;
    case 'SELF_WEALTH_LEAK':
      return `요즘 ${withTopicParticle(input.currentTheme)} 피로와 소비를 한 줄로 묶기 쉬운 때라, 새는 장면을 생활 단위로 끊어 보는 일이 먼저입니다.`;
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return `요즘 ${withTopicParticle(input.currentTheme)} 미안함과 피로를 함께 키울 수 있어, 거리 조절을 감정 대신 기준 문장으로 바꾸는 일이 중요합니다.`;
    case 'SELF_FAMILY_PARENTS':
      return `요즘 ${withTopicParticle(input.currentTheme)} 역할 기대를 더 무겁게 느끼게 할 수 있어, 효심과 요청을 한 문장에 섞지 않는 편이 낫습니다.`;
    default:
      break;
  }

  return `요즘 ${input.userName}님에게 중요한 건 ${withObjectParticle(input.currentTheme)} 생활 안에서 실제 움직임으로 바꾸는 일입니다.`;
}

function buildSelfSubjectNarrativeClose(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
  subtype: SubjectSubtype | null;
}): string {
  const subtypeAccent = buildSelfSubjectNarrativeAccent(
    input.subjectType,
    input.subtype
  );

  let scenarioClose = '';

  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      scenarioClose =
        '재회는 큰 결심보다 예전과 다른 반응 하나를 끝까지 지키는 쪽에서 가능성이 생깁니다.';
      break;
    case 'SELF_LOVE_CONTACT_RETURN':
      scenarioClose =
        '연락 문제는 기다림의 길이보다, 연락이 와도 속도를 늦출 수 있을 때 훨씬 덜 흔들립니다.';
      break;
    case 'SELF_LOVE_CONFESSION_TIMING':
      scenarioClose =
        '고백은 한 번의 용기보다, 말한 뒤에도 어색함을 함께 지나갈 장면이 남아 있을 때 더 잘 붙습니다.';
      break;
    case 'SELF_CAREER_APTITUDE':
      scenarioClose =
        '적성은 멋있어 보이는 선택보다, 끝내고도 다시 해볼 마음이 남는 일을 반복할 때 선명해집니다.';
      break;
    case 'SELF_CAREER_JOB_CHANGE':
      scenarioClose =
        '이직은 퇴사 결심을 키우는 것보다, 다음 자리에서 낼 결과를 먼저 말할 수 있을 때 훨씬 덜 흔들립니다.';
      break;
    case 'SELF_WEALTH_ACCUMULATION':
      scenarioClose =
        '돈은 크게 움직인 날보다, 자동으로 남게 만드는 루틴이 쉬운 날에 더 조용히 쌓입니다.';
      break;
    case 'SELF_WEALTH_LEAK':
      scenarioClose =
        '누수는 의지보다 피곤한 장면의 동선과 결제 습관을 먼저 바꿀 때 더 빨리 멈춥니다.';
      break;
    case 'SELF_RELATIONSHIP_CUT_OFF':
      scenarioClose =
        '거리 조절은 통보 한 번보다 반복되는 불편에 같은 기준을 계속 적용할 때 현실이 됩니다.';
      break;
    case 'SELF_FAMILY_PARENTS':
      scenarioClose =
        '부모와의 관계는 긴 설명보다 같은 경계 문장을 여러 번 흔들림 없이 쓰는 편이 훨씬 효과적입니다.';
      break;
    default:
      scenarioClose =
        '큰 결심 한 번보다 작은 완료를 꾸준히 쌓을 때 운이 더 잘 붙습니다.';
      break;
  }

  return [subtypeAccent, scenarioClose].filter(Boolean).join(' ');
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

function buildSelfOverviewFocus(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      return '이 질문은 다시 보게 될지를 묻는 것 같아도, 실제로는 끊긴 이유가 달라졌는지 확인하는 쪽에 더 가깝습니다.';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '이 질문의 핵심은 연락 자체보다, 연락이 와도 관계가 다시 편안해질 구조가 남아 있는지 보는 일입니다.';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '이 질문은 용기를 낼지보다, 고백 뒤에도 관계가 자연스럽게 이어질 준비가 되어 있는지 확인하는 쪽에 가깝습니다.';
    case 'SELF_CAREER_APTITUDE':
      return '적성 질문은 잘해 보이는 일보다, 반복할수록 강점이 더 또렷해지는 일 구조를 찾는 질문입니다.';
    case 'SELF_CAREER_JOB_CHANGE':
      return '이직 질문은 지금 회사를 버틸 수 있느냐보다, 다음 자리에서 어떤 성과 문장으로 살아날지를 먼저 읽어야 정확합니다.';
    case 'SELF_WEALTH_ACCUMULATION':
      return '돈이 모이는 흐름은 큰 수입 기회보다, 들어온 돈이 머무는 구조를 만들 수 있는지에서 차이가 벌어집니다.';
    case 'SELF_WEALTH_LEAK':
      return '누수 질문은 지출 항목을 세는 문제가 아니라, 피로와 관계와 충동이 어디서 소비로 바뀌는지 읽는 질문입니다.';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '손절 질문은 누가 더 나쁜지를 가르는 일이 아니라, 지금 이 관계를 유지할수록 내가 얼마나 닳는지 확인하는 쪽에 가깝습니다.';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 관계 질문은 효심의 크기보다, 기대와 죄책감이 어디서 내 말을 막는지 읽는 쪽이 더 중요합니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'CAREER':
      return '커리어 질문은 직업명보다 내 강점이 반복 가능한 결과로 이어지는 구조를 찾는 일이 더 중요합니다.';
    case 'WEALTH':
      return '재물 질문은 많이 버는 흐름과 오래 남는 구조를 따로 읽을수록 실제 체감과 맞습니다.';
    case 'ROMANCE':
      return '연애 질문은 감정의 크기만이 아니라, 그 감정을 내가 감당할 리듬이 있는지를 함께 봐야 합니다.';
    case 'RELATIONSHIPS':
      return '관계 질문은 상대 평가보다 이 관계가 내 기운을 살리는지 닳게 하는지를 먼저 읽어야 합니다.';
    case 'FAMILY':
      return '가족 질문은 애정의 유무보다 반복되는 기대 역할과 거리 조절 패턴을 먼저 읽는 편이 맞습니다.';
    case 'LIFETIME_FLOW':
      return '긴 흐름 질문은 한 시기의 성패보다 오래 반복될수록 강해지는 선택과 닳는 선택을 구분하는 데 더 가깝습니다.';
    case 'DAEUN':
      return '대운 질문은 사건보다 지금 10년이 삶의 무게중심을 어디로 옮기는지 읽는 편이 정확합니다.';
    case 'YEAR_MONTH_DAY_FORTUNE':
      return '시기 질문은 좋고 나쁨보다 언제 밀고 언제 줄여야 하는지 실전 기준을 잡는 쪽이 핵심입니다.';
    case 'LUCK_UP':
      return '개운 질문은 특별한 해법보다 내 강한 기운이 생활 습관으로 붙을 자리를 찾는 데 더 가깝습니다.';
    case 'MARRIAGE':
      return '결혼 질문은 감정보다 오래 함께 살 때 맞아야 할 생활 감각을 먼저 읽어야 현실과 맞습니다.';
    case 'BASIC':
    default:
      return '전체 해석은 특정 고민 하나보다 삶 전체의 리듬을 오래 설명해 주는 축이 무엇인지부터 보는 편이 맞습니다.';
  }
}

function buildCompatibilityOverviewFocus(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'COMPAT_ROMANCE_LOVER':
      return '이 궁합은 좋아하느냐보다, 지금 관계가 다툰 뒤에도 다시 편안해질 구조가 있는지를 읽는 질문입니다.';
    case 'COMPAT_ROMANCE_MARRIAGE_PARTNER':
      return '이 궁합은 설렘보다, 오래 함께 살 상대로 생활 기준과 책임감이 실제로 맞는지를 읽는 질문입니다.';
    case 'COMPAT_ROMANCE_MARRIED':
      return '이 궁합은 부부로 살아갈 때 누가 더 사랑하느냐보다, 같이 사는 속도와 다툰 뒤 다시 가까워지는 방식이 자연스럽게 맞는지를 읽는 질문입니다.';
    case 'COMPAT_ROMANCE_EX':
      return '이 궁합은 다시 만날 수 있는지보다, 다시 만나도 같은 지점에서 무너지지 않을 구조가 남아 있는지 읽는 질문입니다.';
    case 'COMPAT_ROMANCE_LEFT_ON_READ':
      return '이 궁합의 핵심은 읽씹 판정이 아니라, 두 사람이 편하다고 느끼는 연락 템포가 얼마나 다른지 확인하는 일입니다.';
    case 'COMPAT_ROMANCE_FRIEND_TO_LOVER':
      return '이 궁합은 친한지보다, 이미 있는 편안함이 설렘으로 한 단계 넘어갈 여지가 있는지를 읽는 쪽이 더 중요합니다.';
    case 'COMPAT_ROMANCE_GHOSTED':
      return '이 궁합은 호감이 있느냐보다, 무엇이 부담이 되어 흐름이 끊겼는지 읽는 질문에 더 가깝습니다.';
    case 'COMPAT_WORK_BOSS':
      return '상사 궁합은 사람 좋고 나쁨보다 보고, 우선순위, 완료 기준이 어떻게 맞물리는지 읽는 일이 먼저입니다.';
    case 'COMPAT_WORK_DIFFICULT_BOSS':
      return '까다로운 상사 궁합은 감정 소모보다 반복 피로를 만드는 기준 차이가 무엇인지 읽는 편이 더 정확합니다.';
    case 'COMPAT_WORK_BUSINESS_PARTNER':
      return '동업 궁합은 친밀감보다 역할, 권한, 손실 기준이 실제 문장으로 합의될 수 있는지를 먼저 읽어야 합니다.';
    case 'COMPAT_FRIEND_CUT_OFF':
      return '손절 고민 궁합은 누가 더 서운했는지보다 이 관계를 유지할수록 내 기운이 남는지부터 확인해야 합니다.';
    case 'COMPAT_FAMILY_PARENT_CHILD':
      return '부모와 자식 궁합은 사랑의 크기보다 보호와 기대가 어디서 상처로 바뀌는지 읽는 쪽이 더 중요합니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'BUSINESS_PARTNER':
      return '함께 일하는 궁합은 아이디어 합보다 책임을 어떻게 나누는지가 훨씬 크게 작동합니다.';
    case 'MANAGER_MEMBER':
    case 'COWORKER':
      return '업무 궁합은 감정보다 공유 시점, 일의 기준, 마감 감각이 얼마나 맞는지에서 차이가 벌어집니다.';
    case 'FRIEND':
      return '우정 궁합은 친밀감보다 경계와 회복력이 함께 살아 있는지를 먼저 읽어야 합니다.';
    case 'LOVER':
    case 'CRUSH':
      return '연애 궁합은 끌림의 크기와 실제로 이어질 수 있는 관계 리듬을 분리해서 읽을수록 정확합니다.';
    case 'MARRIED':
      return '가까운 관계의 궁합은 감정 표현보다 생활 기준과 역할 기대가 얼마나 맞는지에서 더 선명해집니다.';
    case 'BASIC':
    default:
      return '궁합은 누가 더 맞는지보다 어떤 속도와 역할에서 편안함이 만들어지는지 읽는 편이 더 현실적입니다.';
  }
}

function buildSelfSummaryFocus(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      return '재회 가능성은 보고 싶은 마음보다 다시 만나도 덜 다칠 구조가 생겼는지부터 봐야 정확합니다.';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '다시 연락 올까 질문은 연락 횟수보다 연락 뒤 관계가 다시 편안해질 여지가 남았는지가 핵심입니다.';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '고백 타이밍은 용기의 크기보다 고백 뒤의 어색함까지 감당할 관계 온도가 있는지가 더 중요합니다.';
    case 'SELF_CAREER_APTITUDE':
      return '적성 질문은 멋있어 보이는 직함보다 반복할수록 실력이 붙고 체력이 남는 일 구조를 찾는 일입니다.';
    case 'SELF_CAREER_JOB_CHANGE':
      return '이직 타이밍은 당장 떠나고 싶은 마음보다 다음 자리에서 어떤 결과를 낼 사람인지가 먼저 정리돼야 합니다.';
    case 'SELF_WEALTH_ACCUMULATION':
      return '돈이 모이는 흐름은 크게 버는 날보다 들어온 돈이 자동으로 남는 구조를 먼저 세우는 쪽이 더 중요합니다.';
    case 'SELF_WEALTH_LEAK':
      return '돈이 새는 이유는 수입 부족보다 피로와 감정이 어떤 순간 소비 버튼으로 번지는지 읽는 데 있습니다.';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '손절 타이밍은 누가 더 틀렸는지보다 이 관계를 붙잡을수록 내 기운이 얼마나 닳는지부터 봐야 합니다.';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 관계는 효심의 많고 적음보다 기대와 죄책감이 내 말을 어디서 막는지부터 읽어야 풀립니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'CAREER':
      return '일 질문은 직업명보다 내가 오래 반복해도 결과가 쌓이는 구조를 찾는 쪽이 더 중요합니다.';
    case 'WEALTH':
      return '돈 질문은 많이 버는 흐름과 오래 남는 구조를 따로 읽을수록 실제 체감과 맞습니다.';
    case 'ROMANCE':
      return '연애 질문은 끌림의 크기보다 그 감정을 내가 감당할 리듬이 있는지 함께 봐야 정확합니다.';
    case 'RELATIONSHIPS':
      return '관계 질문은 상대 평가보다 이 관계가 내 기운을 살리는지 닳게 하는지를 먼저 읽어야 합니다.';
    case 'FAMILY':
      return '가족 질문은 애정의 유무보다 반복되는 기대 역할과 거리 조절 패턴을 먼저 읽는 편이 맞습니다.';
    case 'MARRIAGE':
      return '결혼 질문은 감정보다 오래 함께 살 때 맞아야 할 생활 감각을 먼저 읽어야 현실과 맞습니다.';
    case 'BASIC':
    case 'LIFETIME_FLOW':
    case 'DAEUN':
    case 'YEAR_MONTH_DAY_FORTUNE':
    case 'LUCK_UP':
    default:
      return '전체 흐름은 특정 고민 하나보다 삶 전체의 리듬을 오래 설명해 주는 축이 무엇인지부터 보는 편이 맞습니다.';
  }
}

function buildFocusedSelfSummaryClose(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      return '지금은 다시 붙는 용기보다 예전과 다른 경계와 말 순서를 만들 수 있는지가 더 중요합니다.';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '기다림 자체보다 연락이 와도 내가 무너지지 않을 반응선을 먼저 세우는 편이 맞습니다.';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '분위기보다 고백 뒤에도 말을 자연스럽게 이어 갈 장면이 있는지부터 확인해야 합니다.';
    case 'SELF_CAREER_APTITUDE':
      return '잘해 보이는 일보다 끝나고도 에너지가 남는 역할을 고를수록 판단이 더 또렷해집니다.';
    case 'SELF_CAREER_JOB_CHANGE':
      return '퇴사 결심보다 다음 자리에서 보여 줄 결과 한 줄을 먼저 세울수록 판단이 빨라집니다.';
    case 'SELF_WEALTH_ACCUMULATION':
      return '큰 수입 기회보다 자동으로 남는 장치를 하나 붙이는 쪽이 체감이 훨씬 빠릅니다.';
    case 'SELF_WEALTH_LEAK':
      return '지금은 수입 확대보다 새는 장면 한두 개를 먼저 막는 쪽이 훨씬 빨리 반응합니다.';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '단호한 결론보다 어디까지는 돕고 어디서부터는 멈출지 선을 문장으로 정하는 편이 맞습니다.';
    case 'SELF_FAMILY_PARENTS':
      return '효심을 증명하기보다 죄책감 없이 끝낼 말 한 문장을 먼저 준비하는 편이 더 중요합니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'CAREER':
      return '지금은 잘하는 일보다 오래 반복해도 기운이 남는 구조를 먼저 고르는 편이 맞습니다.';
    case 'WEALTH':
      return '눈에 띄는 돈보다 오래 남는 돈의 구조를 먼저 세울수록 체감이 훨씬 빠릅니다.';
    case 'ROMANCE':
      return '감정의 크기보다 그 감정을 실제 관계로 감당할 리듬이 있는지부터 봐야 합니다.';
    case 'RELATIONSHIPS':
      return '누가 맞는지보다 이 관계 뒤에도 내가 회복되는지부터 보는 편이 맞습니다.';
    case 'FAMILY':
      return '가족을 지키는 마음과 내 기운을 지키는 말을 같이 세울수록 풀기가 쉬워집니다.';
    default:
      return '지금 질문에 바로 닿는 기준 하나를 먼저 세울수록 풀이가 훨씬 실감 나게 읽힙니다.';
  }
}

function buildCompatibilitySummaryClose(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'COMPAT_ROMANCE_LOVER':
      return '좋아하는 마음만 확인하기보다 다툰 뒤 다시 붙는 속도까지 같이 봐야 합니다.';
    case 'COMPAT_ROMANCE_MARRIAGE_PARTNER':
      return '미래 약속보다 돈, 집, 가족, 쉬는 방식을 실제 문장으로 맞출수록 이 궁합이 선명해집니다.';
    case 'COMPAT_ROMANCE_MARRIED':
      return '지금은 누가 더 맞는지보다 서운함을 풀고 다시 가까워지는 방식이 살아 있는지를 보는 편이 맞습니다.';
    case 'COMPAT_ROMANCE_EX':
      return '반가움보다 다시 만나도 덜 다칠 장면이 있는지부터 봐야 합니다.';
    case 'COMPAT_ROMANCE_LEFT_ON_READ':
      return '답장 유무보다 말이 다시 편안해지는 속도를 보는 쪽이 더 정확합니다.';
    case 'COMPAT_ROMANCE_FRIEND_TO_LOVER':
      return '고백보다 둘만의 시간이 자연스럽게 늘어나는지 먼저 보는 편이 맞습니다.';
    case 'COMPAT_ROMANCE_GHOSTED':
      return '해석보다 부담을 줄인 한 문장이 다시 닿을 수 있는지부터 보는 편이 낫습니다.';
    case 'COMPAT_WORK_BOSS':
      return '일 잘함보다 보고 기준과 피드백 템포를 맞추는 쪽이 체감이 빠릅니다.';
    case 'COMPAT_WORK_DIFFICULT_BOSS':
      return '감정 소모를 줄이려면 되물어야 할 기준을 먼저 정해 두는 편이 낫습니다.';
    case 'COMPAT_WORK_BUSINESS_PARTNER':
      return '신뢰보다 돈과 철수 기준을 미리 나눌수록 오래 갑니다.';
    case 'COMPAT_FRIEND_CUT_OFF':
      return '오래된 의리보다 이 관계 뒤에도 내가 회복되는지부터 봐야 합니다.';
    case 'COMPAT_FAMILY_PARENT_CHILD':
      return '사랑의 크기보다 기대를 어디까지 말로 풀 수 있는지가 더 중요합니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'LOVER':
    case 'CRUSH':
      return '감정 확인보다 두 사람의 속도와 기대를 실제로 맞출 수 있는지가 더 중요합니다.';
    case 'FRIEND':
      return '친한 사이일수록 서운함을 짧게 풀 수 있는지가 오래 가는 기준이 됩니다.';
    case 'MARRIED':
      return '생활 기준만큼 애정 표현과 회복 방식이 함께 편안해야 궁합의 장점이 오래 갑니다.';
    case 'BUSINESS_PARTNER':
      return '함께 벌고 책임지는 기준을 감정에서 떼어 둘수록 이 궁합의 장점이 오래 갑니다.';
    default:
      return '좋은 마음보다 실제 장면에서 편안함이 만들어지는지를 같이 봐야 정확합니다.';
  }
}

function buildSelfTimingFocus(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      return '재회 타이밍은 보고 싶은 날보다 예전보다 다른 말 순서를 실제로 낼 수 있을 때 잡는 편이 맞습니다.';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '연락 타이밍은 기다림의 길이보다, 연락이 와도 내가 흔들리지 않을 시간대를 고르는 일이 더 중요합니다.';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '고백 타이밍은 불안을 못 견디는 순간보다, 고백 뒤의 어색함까지 감당할 여유가 있을 때가 더 정확합니다.';
    case 'SELF_CAREER_APTITUDE':
      return '적성 확인은 결과 압박이 가장 큰 날보다, 내가 한 일을 차분히 복기할 여유가 있을 때 더 또렷합니다.';
    case 'SELF_CAREER_JOB_CHANGE':
      return '이직 타이밍은 퇴사 충동이 큰 순간보다, 다음 자리에서 보여 줄 결과를 짧게 말할 수 있을 때가 더 정확합니다.';
    case 'SELF_WEALTH_ACCUMULATION':
      return '돈이 모이는 흐름은 큰 결정보다 유지 습관을 붙일 수 있는 시간대를 고를 때 더 잘 살아납니다.';
    case 'SELF_WEALTH_LEAK':
      return '누수 정리는 지출 후 죄책감이 큰 밤보다, 감정이 덜 올라온 낮 시간에 기준을 세울 때 훨씬 잘됩니다.';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '거리 조절은 감정이 폭발한 순간보다, 짧고 분명한 문장으로 선을 말할 수 있을 때가 더 맞습니다.';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 대화는 미안함이 커진 밤보다, 설명을 짧게 끝낼 수 있는 시간대를 고르는 편이 더 낫습니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'CAREER':
      return '일 질문은 조급함보다 내가 보여 줄 결과를 짧게 정리할 수 있는 시점이 더 중요합니다.';
    case 'WEALTH':
      return '돈 질문은 투자 타이밍보다 지출 기준이 흔들리는 시간대를 먼저 구분하는 편이 더 정확합니다.';
    case 'ROMANCE':
      return '연애 질문은 감정이 가장 뜨거운 순간보다 생활 리듬이 덜 흔들리는 구간에서 더 잘 읽힙니다.';
    case 'RELATIONSHIPS':
      return '관계 질문은 덜 지친 상태에서 선을 말할 수 있는 때를 고를수록 실제 변화가 납니다.';
    case 'FAMILY':
      return '가족 질문은 결론을 내는 날보다 짧고 분명한 말을 끝낼 수 있는 타이밍이 더 중요합니다.';
    case 'LIFETIME_FLOW':
      return '긴 흐름 질문은 오늘의 성패보다 앞으로 몇 해에 걸쳐 무엇을 굳힐지 정리할 시점이 중요합니다.';
    case 'DAEUN':
      return '대운 질문은 지금 몇 해를 어떻게 쓸지 문장으로 정리되는 순간부터 체감이 커집니다.';
    case 'YEAR_MONTH_DAY_FORTUNE':
      return '시기 질문은 지금 붙는 시간대와 줄여야 할 시간대를 나눠 볼 때 가장 실전적으로 작동합니다.';
    case 'LUCK_UP':
      return '개운은 결심한 날보다 같은 시간과 같은 순서를 반복할 수 있는 시점에 더 잘 붙습니다.';
    case 'MARRIAGE':
      return '결혼 질문은 감정이 커진 날보다 생활 기준을 차분히 맞춰 볼 수 있는 구간에서 더 또렷합니다.';
    case 'BASIC':
    default:
      return '전체 흐름은 큰 결론보다 생활 리듬을 다시 세울 수 있는 구간에서 더 정확하게 읽힙니다.';
  }
}

function buildCompatibilityTimingFocus(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'COMPAT_ROMANCE_LOVER':
      return '현재 연인 궁합은 감정 확인보다, 서운함 뒤에도 다시 안심되는 대화를 만들 수 있을 때가 더 중요합니다.';
    case 'COMPAT_ROMANCE_MARRIAGE_PARTNER':
      return '결혼 상대 궁합은 결론을 서두르는 날보다, 생활 기준을 구체적인 문장으로 맞춰 볼 수 있을 때 더 또렷합니다.';
    case 'COMPAT_ROMANCE_MARRIED':
      return '부부 궁합은 감정이 오른 날보다, 집안 리듬과 역할 기준을 짧게 다시 맞출 수 있을 때 더 잘 보입니다.';
    case 'COMPAT_ROMANCE_EX':
      return '재회 궁합은 감정이 확 올라온 날보다 예전과 다른 기준을 말할 수 있을 때 실마리가 더 선명합니다.';
    case 'COMPAT_ROMANCE_LEFT_ON_READ':
      return '읽씹 궁합은 왜 늦었는지 따지는 순간보다 편한 시간대와 말 길이를 맞춰 볼 때 흐름이 더 잘 보입니다.';
    case 'COMPAT_ROMANCE_FRIEND_TO_LOVER':
      return '친구에서 연인 타이밍은 갑작스러운 확답보다 둘만의 결이 조금 더 선명해질 때가 더 자연스럽습니다.';
    case 'COMPAT_ROMANCE_GHOSTED':
      return '끊긴 흐름을 다시 열 타이밍은 감정 확인보다 부담 없는 한 문장을 꺼낼 수 있을 때가 더 맞습니다.';
    case 'COMPAT_WORK_BOSS':
      return '상사 궁합은 문제가 터진 뒤보다 중간 공유와 우선순위 확인을 먼저 넣을 수 있을 때 더 편해집니다.';
    case 'COMPAT_WORK_DIFFICULT_BOSS':
      return '까다로운 상사 궁합은 참다가 한 번에 말하기보다 되물을 기준을 짧게 꺼낼 수 있을 때가 더 중요합니다.';
    case 'COMPAT_WORK_BUSINESS_PARTNER':
      return '동업 궁합은 판이 커진 뒤보다 초반에 역할과 돈 기준을 적어 둘 수 있을 때 가장 정확하게 읽힙니다.';
    case 'COMPAT_FRIEND_CUT_OFF':
      return '손절 고민 궁합은 크게 터진 뒤보다 작은 선을 먼저 말할 수 있을 때 방향이 더 또렷해집니다.';
    case 'COMPAT_FAMILY_PARENT_CHILD':
      return '부모와 자식 궁합은 감정이 오른 날보다 걱정과 기대를 분리해 말할 수 있을 때가 더 중요합니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'BUSINESS_PARTNER':
      return '동업과 협업 궁합은 감정보다 기준을 문장으로 남길 수 있는 타이밍을 잡을수록 훨씬 정확합니다.';
    case 'MANAGER_MEMBER':
    case 'COWORKER':
      return '업무 궁합은 문제가 난 뒤 수습보다 시작 전에 기준을 짧게 맞출 때 차이가 크게 납니다.';
    case 'FRIEND':
      return '우정 궁합은 큰 화해보다 작은 서운함을 빨리 꺼낼 수 있는 구간에서 더 잘 드러납니다.';
    case 'LOVER':
    case 'CRUSH':
      return '연애 궁합은 감정이 가장 뜨거운 순간보다 서로의 일상 템포가 맞는 때에 더 정확하게 읽힙니다.';
    case 'MARRIED':
      return '가까운 관계일수록 감정이 오른 날보다 짧고 분명한 말로 끝낼 수 있는 때가 더 중요합니다.';
    case 'BASIC':
    default:
      return '궁합은 결론을 서두르는 순간보다 서로의 리듬을 관찰할 시간이 있을 때 더 또렷하게 드러납니다.';
  }
}

function buildSelfRelationshipFlowFocus(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      return '재회 흐름은 누가 먼저 손을 내미느냐보다, 예전과 다른 경계와 대화 순서를 실제로 지킬 수 있는지에서 갈립니다.';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '다시 연락 흐름은 답장 횟수보다 말이 다시 편안해지는 속도와 온도에서 읽어야 정확합니다.';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '고백 흐름은 마음의 크기보다 상대가 부담 없이 한 걸음 더 들어올 여유가 있는지에서 갈립니다.';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '거리 조절 흐름은 단절 선언보다, 내 에너지가 새는 장면을 먼저 멈추는 쪽에서 풀리기 시작합니다.';
    case 'SELF_FAMILY_PARENTS':
      return '부모와의 관계는 사랑이 없는 문제가 아니라 기대 역할이 자동으로 겹치는 순간 피로가 커지는 구조입니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'ROMANCE':
      return '연애 흐름은 감정의 온도와 기대하는 가까움이 어느 속도로 맞는지에서 읽어야 합니다.';
    case 'MARRIAGE':
      return '배우자 흐름은 애정 표현보다 생활 역할과 안심감이 어디서 맞는지에서 더 선명해집니다.';
    case 'RELATIONSHIPS':
      return '인간관계 흐름은 누가 맞는지보다, 어떤 거리와 빈도에서 내 기운이 살아나는지 읽는 편이 정확합니다.';
    case 'FAMILY':
      return '가족 흐름은 애정보다 반복되는 기대 역할과 설명의 부족이 어디서 상처를 만드는지에서 갈립니다.';
    default:
      return '관계 흐름은 감정의 크기보다 말의 순서와 경계의 밀도에서 더 또렷하게 드러납니다.';
  }
}

function buildSelfRelationshipFlowClose(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      return '다시 붙고 싶다면 반가움보다 달라진 점을 먼저 말할 수 있을 때 관계가 훨씬 안전해집니다.';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '연락이 와도 바로 의미를 키우지 말고, 며칠의 말 흐름이 다시 편안해지는지부터 보는 편이 맞습니다.';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '표현은 짧고 가볍게 시작할수록 상대의 실제 리듬을 읽기 쉬워집니다.';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '선을 그을 때는 미안함을 덜어 주는 말보다 기준을 먼저 밝히는 문장이 더 오래 도움이 됩니다.';
    case 'SELF_FAMILY_PARENTS':
      return '부모와는 설명을 길게 하기보다 요청 1개를 짧게 말하는 편이 흐름을 덜 상하게 합니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'ROMANCE':
      return '감정 확인보다 말의 속도와 편안함을 자주 나눌수록 관계의 좋은 결이 더 오래 남습니다.';
    case 'MARRIAGE':
      return '생활 기준을 짧게 확인하는 대화가 쌓일수록 배우자운의 좋은 결이 살아납니다.';
    case 'RELATIONSHIPS':
      return '좋은 사람이 되는 말보다 일관된 거리 기준을 먼저 세울수록 관계 피로가 줄어듭니다.';
    case 'FAMILY':
      return '가족일수록 짧더라도 맥락을 한 번 더 말하는 태도가 오해를 크게 줄입니다.';
    default:
      return '짧더라도 자주 상태를 나누는 방식이 관계의 좋은 결을 오래 살립니다.';
  }
}

function buildSelfWorkMoneyFlowFocus(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_CAREER_APTITUDE':
      return '적성 흐름은 연봉보다 반복할수록 기운이 남고 결과가 쌓이는 일 방식에서 드러납니다.';
    case 'SELF_CAREER_JOB_CHANGE':
      return '이직 흐름은 떠나는 이유보다 다음 자리에서 보여 줄 결과와 버틸 생활 리듬이 함께 있는지에서 갈립니다.';
    case 'SELF_WEALTH_ACCUMULATION':
      return '축적 흐름은 돈이 들어오는 순간보다 자동으로 남게 만드는 구조를 붙일 때 훨씬 강해집니다.';
    case 'SELF_WEALTH_LEAK':
      return '누수 흐름은 금액보다 어떤 상황과 감정에서 지출 버튼이 눌리는지 읽어야 풀립니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'CAREER':
      return '직업 흐름은 버티는 문제보다 지금 내 방식이 통하는 자리와 성과 문장을 찾는 일에서 갈립니다.';
    case 'WEALTH':
      return '재물 흐름은 버는 힘과 남기는 힘을 따로 읽을수록 실제 체감과 맞아집니다.';
    default:
      return '일과 돈 흐름은 눈앞의 수치보다 유지 구조와 반복 가능한 리듬에서 더 크게 벌어집니다.';
  }
}

function buildSelfWorkMoneyFlowClose(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_CAREER_APTITUDE':
      return '잘하는 일보다 끝나고도 에너지가 남는 일을 기준으로 볼수록 적성이 선명해집니다.';
    case 'SELF_CAREER_JOB_CHANGE':
      return '지금은 다음 자리 조건과 버틸 생활 리듬을 같이 적어 둘수록 판단이 덜 흔들립니다.';
    case 'SELF_WEALTH_ACCUMULATION':
      return '들어온 돈을 바로 남기는 고정 루틴이 붙어야 복이 오래 갑니다.';
    case 'SELF_WEALTH_LEAK':
      return '새는 돈은 의지보다 상황 패턴을 먼저 바꿀 때 훨씬 빨리 잡힙니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'CAREER':
      return '일은 잘하는 것보다 반복 가능한 구조를 만들 때 운이 더 안정적으로 붙습니다.';
    case 'WEALTH':
      return '돈은 한 번의 기회보다 작은 기준을 오래 지킬 때 훨씬 오래 남습니다.';
    default:
      return '작은 기준 하나를 반복 가능한 구조로 만드는 편이 결과를 더 오래 붙잡습니다.';
  }
}

function buildCompatibilityRelationshipFlowFocus(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'COMPAT_ROMANCE_LOVER':
      return '현재 연인 궁합은 사랑의 크기보다 다툰 뒤에도 관계가 다시 안심으로 돌아오는지에서 갈립니다.';
    case 'COMPAT_ROMANCE_MARRIAGE_PARTNER':
      return '결혼 상대 궁합은 감정보다 오래 함께 살 때 생활 감각과 책임 기준이 자연스럽게 맞는지에서 갈립니다.';
    case 'COMPAT_ROMANCE_MARRIED':
      return '부부 궁합은 집안일과 돈만이 아니라, 서운할 때 어떤 말로 다시 가까워지고 각자 지친 몸을 어떻게 쉬게 하는지에서 갈립니다.';
    case 'COMPAT_ROMANCE_EX':
      return '전연인 궁합은 다시 끌리는지보다, 다시 이어졌을 때 예전과 다른 회복 순서를 만들 수 있는지에서 갈립니다.';
    case 'COMPAT_ROMANCE_LEFT_ON_READ':
      return '읽씹 궁합은 답장 빈도보다 두 사람이 편하다고 느끼는 연락 템포와 압박감의 차이에서 읽어야 합니다.';
    case 'COMPAT_ROMANCE_FRIEND_TO_LOVER':
      return '친구에서 연인 궁합은 편안함이 이미 설렘의 긴장으로 조금 넘어가고 있는지에서 갈립니다.';
    case 'COMPAT_ROMANCE_GHOSTED':
      return '흐름이 끊긴 궁합은 호감 유무보다 무엇이 부담이 되어 연결이 멈췄는지에서 읽어야 정확합니다.';
    case 'COMPAT_ROMANCE_FLIRTING':
      return '썸 궁합은 좋아 보이는 장면보다 관계를 너무 빨리 정하지 않아도 연결이 이어지는지에서 갈립니다.';
    case 'COMPAT_ROMANCE_BLIND_DATE':
      return '소개팅 궁합은 첫 장면보다 두 번째 대화가 자연스럽게 이어질 수 있는지에서 더 선명해집니다.';
    case 'COMPAT_ROMANCE_CRUSH':
      return '짝사랑 궁합은 끌림 자체보다 실제 접점과 대화가 자연스럽게 늘어날 여지가 있는지에서 읽어야 합니다.';
    case 'COMPAT_FRIEND_BEST':
      return '베프 궁합은 익숙함 속에서도 서운함을 회복할 힘이 남아 있는지에서 갈립니다.';
    case 'COMPAT_FRIEND_CUT_OFF':
      return '손절 고민 궁합은 단절 선언보다, 지금 거리에서 서로가 얼마나 닳고 있는지에서 먼저 갈립니다.';
    case 'COMPAT_FRIEND_TRAVEL':
      return '여행 궁합은 취향보다 체력, 속도, 혼자 쉬는 시간을 어떻게 다루는지에서 차이가 납니다.';
    case 'COMPAT_FRIEND_ROOMMATE':
      return '룸메이트 궁합은 친분보다 생활선과 회복 시간을 서로 얼마나 존중할 수 있는지에서 갈립니다.';
    case 'COMPAT_FAMILY_MOTHER_DAUGHTER':
      return '엄마와 딸 궁합은 사랑과 간섭이 같은 문장 안에 섞이는 순간부터 피로가 커지는 구조입니다.';
    case 'COMPAT_FAMILY_PARENT_CHILD':
      return '부모와 자식 궁합은 보호와 기대가 어디서 평가와 죄책감으로 바뀌는지에서 갈립니다.';
    case 'COMPAT_FAMILY_MOTHER_IN_LAW':
      return '시어머니와의 궁합은 예의를 지키려는 마음과 필요한 거리감이 어디서 충돌하는지에서 갈립니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'LOVER':
    case 'CRUSH':
      return '연애 궁합은 감정의 크기보다 말의 속도와 가까워지는 템포가 실제로 이어질 수 있는지에서 읽어야 합니다.';
    case 'FRIEND':
      return '우정 궁합은 친밀감보다 회복력과 경계 존중이 함께 살아 있는지에서 더 선명해집니다.';
    case 'MARRIED':
      return '가까운 관계일수록 애정보다 생활 리듬과 기대 역할이 어디서 맞는지에서 궁합이 갈립니다.';
    default:
      return '관계 궁합은 좋아 보이는 장면보다 말의 순서와 거리감이 실제로 편안한지에서 더 정확하게 읽힙니다.';
  }
}

function buildCompatibilityRelationshipFlowClose(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'COMPAT_ROMANCE_LOVER':
      return '애정을 확인하는 말보다 생활 속 서운함을 짧게 맞추는 대화가 쌓일수록 관계 안정감이 더 커집니다.';
    case 'COMPAT_ROMANCE_MARRIAGE_PARTNER':
      return '미래를 크게 약속하기보다 돈, 시간, 가족 기준을 짧게라도 맞춰 볼수록 이 궁합의 실제 결이 드러납니다.';
    case 'COMPAT_ROMANCE_MARRIED':
      return '집안일과 돈 기준만큼 애정 표현 방식과 혼자 숨 돌릴 시간도 자주 맞출수록 부부 궁합의 좋은 결이 오래 살아납니다.';
    case 'COMPAT_ROMANCE_EX':
      return '반가움보다 달라진 점을 먼저 말할 수 있을 때 이 관계는 훨씬 안전해집니다.';
    case 'COMPAT_ROMANCE_LEFT_ON_READ':
      return '답장 하나보다 며칠의 말 흐름이 다시 편안해지는지부터 보는 편이 맞습니다.';
    case 'COMPAT_ROMANCE_FRIEND_TO_LOVER':
      return '둘만의 시간을 조금 더 의식해서 쌓을수록 친구 선과 연인 선의 차이가 또렷해집니다.';
    case 'COMPAT_ROMANCE_GHOSTED':
      return '감정 확인보다 부담 없는 안부 한 문장이 먼저 통할 때 관계의 실마리가 살아납니다.';
    case 'COMPAT_FRIEND_CUT_OFF':
      return '의리보다 회복되는지 여부를 먼저 봐야 필요한 거리선이 더 선명해집니다.';
    case 'COMPAT_FRIEND_TRAVEL':
      return '같이 움직이는 날일수록 휴식 시간과 속도 기준을 미리 정해 둘수록 훨씬 덜 지칩니다.';
    case 'COMPAT_FRIEND_ROOMMATE':
      return '생활선은 서운해진 뒤 말하기보다 괜찮을 때 짧게 맞춰 둘수록 오래 갑니다.';
    case 'COMPAT_FAMILY_MOTHER_DAUGHTER':
      return '걱정의 마음보다 어떤 말이 간섭처럼 들리는지 먼저 확인할수록 상처가 덜 남습니다.';
    case 'COMPAT_FAMILY_PARENT_CHILD':
      return '돌봄과 통제의 선을 짧게라도 자주 확인할수록 관계가 훨씬 덜 무거워집니다.';
    case 'COMPAT_FAMILY_MOTHER_IN_LAW':
      return '예의를 지키는 말과 지켜야 할 선을 함께 말할수록 관계의 피로가 줄어듭니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'LOVER':
    case 'CRUSH':
      return '감정 확인보다 대화 템포와 기대하는 가까움을 자주 맞출수록 이 궁합의 좋은 결이 오래 남습니다.';
    case 'FRIEND':
      return '작은 서운함을 미루지 않고 짧게 나눌수록 우정의 장점이 더 오래 살아납니다.';
    case 'MARRIED':
      return '생활 기준을 짧게 확인하는 대화가 쌓일수록 관계 안정감도 함께 커집니다.';
    default:
      return '좋은 마음을 확인하는 말 한마디와 기대치 정렬이 함께 갈 때 궁합의 장점이 더 선명해집니다.';
  }
}

function buildCompatibilityWealthFlowFocus(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'COMPAT_WORK_BOSS':
      return '상사 궁합의 성과 흐름은 감정보다 보고 타이밍, 우선순위, 완료 기준이 얼마나 분명한지에서 갈립니다.';
    case 'COMPAT_WORK_DIFFICULT_BOSS':
      return '까다로운 상사 궁합은 애매한 요청이 어디서부터 반복 소모로 바뀌는지 읽어야 실제 도움이 됩니다.';
    case 'COMPAT_WORK_BUSINESS_PARTNER':
      return '동업 궁합의 돈 흐름은 친밀감보다 권한, 수익 배분, 손실 통제 기준이 실제 문장으로 남는지에서 갈립니다.';
    case 'COMPAT_WORK_COWORKER':
      return '직장 동료 궁합은 친한지보다 중간 공유와 마감 기준이 얼마나 자연스럽게 맞는지에서 성과 차이가 납니다.';
    case 'COMPAT_WORK_WORK_DUMPER':
      return '일 떠넘김 궁합은 부탁이 책임처럼 굳는 지점과 선을 되돌릴 문장이 있는지에서 갈립니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'BUSINESS_PARTNER':
      return '동업 궁합은 누가 더 유능한지보다 역할과 돈 기준을 얼마나 분명히 남길 수 있는지에서 갈립니다.';
    case 'MANAGER_MEMBER':
    case 'COWORKER':
      return '업무 궁합은 감정보다 기준 공유와 완료 정의가 먼저 맞을 때 성과도 함께 살아납니다.';
    default:
      return '협업과 돈 흐름은 좋은 의도보다 역할과 기준이 얼마나 또렷한지에서 더 분명하게 드러납니다.';
  }
}

function buildCompatibilityWealthFlowClose(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'COMPAT_WORK_BOSS':
      return '중간 공유 한 줄만 빨라져도 이 관계의 피로와 성과 체감이 함께 달라질 수 있습니다.';
    case 'COMPAT_WORK_DIFFICULT_BOSS':
      return '되물어야 할 기준 문장을 미리 정해 둘수록 소모를 훨씬 줄일 수 있습니다.';
    case 'COMPAT_WORK_BUSINESS_PARTNER':
      return '돈과 철수 기준을 감정에서 떼어 둘수록 관계와 성과를 함께 지키기 쉬워집니다.';
    case 'COMPAT_WORK_COWORKER':
      return '시작 전에 완료 기준을 맞추는 습관이 붙을수록 협업의 장점이 더 크게 살아납니다.';
    case 'COMPAT_WORK_WORK_DUMPER':
      return '애매한 부탁이 들어오는 순간 짧게 선을 그을수록 반복 패턴이 빠르게 끊깁니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'BUSINESS_PARTNER':
      return '좋은 합은 믿음만으로 오래가지 않으니, 돈과 권한 기준을 먼저 문장으로 남길수록 훨씬 안정적입니다.';
    case 'MANAGER_MEMBER':
    case 'COWORKER':
      return '같이 일하는 궁합은 서로를 이해하는 말보다 같은 결과를 상상하는 문장이 먼저일 때 훨씬 편해집니다.';
    default:
      return '돈과 역할을 감정에서 떼어 기준으로 정리해 둘수록 관계도 함께 편해집니다.';
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
      return `MBTI로 보면 ${withTopicParticle(input.userName)} ${input.userAdvice.strength}으로 흐름을 열고, ${withTopicParticle(input.partnerName)} ${input.partnerAdvice.strength}으로 반응하는 편입니다.`;
    case 'summary':
      return `MBTI로 보면 ${withTopicParticle(input.userName)} ${input.userAdvice.strength}을 앞세우고, ${withTopicParticle(input.partnerName)} ${input.partnerAdvice.strength}으로 균형을 맞추는 쪽입니다.`;
    case 'narrative':
      return `MBTI로 보면 ${withTopicParticle(input.userName)} ${input.userAdvice.timingStyle}, ${withTopicParticle(input.partnerName)} ${input.partnerAdvice.timingStyle}.`;
    case 'relationship':
      return `MBTI로 보면 관계에서는 ${withTopicParticle(input.userName)} ${input.userAdvice.relationshipStyle}, ${withTopicParticle(input.partnerName)} ${input.partnerAdvice.relationshipStyle}.`;
    case 'timing':
      return `MBTI로 보면 ${withTopicParticle(input.userName)} ${input.userAdvice.timingStyle}, ${withTopicParticle(input.partnerName)} ${input.partnerAdvice.timingStyle}.`;
    case 'caution':
      return `MBTI로 보면 ${withTopicParticle(input.userName)} ${input.userAdvice.blindSpot}, ${withTopicParticle(input.partnerName)} ${input.partnerAdvice.blindSpot}.`;
    default:
      return `MBTI로 보면 ${withTopicParticle(input.userName)} ${input.userAdvice.strength}, ${withTopicParticle(input.partnerName)} ${input.partnerAdvice.strength} 쪽이 먼저 드러납니다.`;
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

function buildSelfCoreSignalFocus(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'SELF_LOVE_RECONCILIATION':
      return '이 결은 다시 만나느냐 자체보다, 다시 만나도 괜찮을 조건을 가려낼 때 가장 또렷하게 드러납니다. 지금은 반가움보다 달라져야 할 기준을 먼저 세워야 흐름을 놓치지 않습니다.';
    case 'SELF_LOVE_CONTACT_RETURN':
      return '이 결은 답장 하나의 의미를 키우기보다, 연락이 와도 흔들리지 않을 반응선을 세울 때 살아납니다. 지금은 기다림의 길이보다 연락 뒤의 흐름을 읽는 쪽이 맞습니다.';
    case 'SELF_LOVE_CONFESSION_TIMING':
      return '이 결은 고백 용기만 밀어주는 신호가 아니라, 관계가 감당할 수 있는 속도를 가르는 기준에 가깝습니다. 지금은 마음의 크기보다 고백 후에도 편안히 이어질 장면이 있는지 봐야 합니다.';
    case 'SELF_CAREER_APTITUDE':
      return '이 결은 직업 이름보다 반복할수록 기운이 붙는 일 방식을 드러냅니다. 지금은 잘해 보이는 일보다 오래 해도 체력이 남는 구조를 찾는 편이 맞습니다.';
    case 'SELF_CAREER_JOB_CHANGE':
      return '이 결은 벗어나고 싶은 마음과 실제로 옮겨도 되는 조건을 가르는 기준입니다. 지금은 탈출보다 다음 자리에서 보여 줄 문장을 먼저 세우는 편이 맞습니다.';
    case 'SELF_WEALTH_ACCUMULATION':
      return '이 결은 큰 수입보다 오래 남는 구조를 붙이는 데서 더 선명해집니다. 지금은 들어오는 돈의 크기보다 남는 방식과 유지 습관을 먼저 세우는 편이 맞습니다.';
    case 'SELF_WEALTH_LEAK':
      return '이 결은 더 벌 방법보다 왜 돈이 자꾸 새는지의 패턴을 드러냅니다. 지금은 지출 항목보다 감정과 관계가 소비로 번지는 순간을 먼저 끊어야 합니다.';
    case 'SELF_RELATIONSHIP_CUT_OFF':
      return '이 결은 누가 옳으냐보다 어떤 관계가 지금의 나를 닳게 하는지 가르는 기준입니다. 지금은 완전한 단절보다 거리와 빈도의 선을 먼저 읽어야 합니다.';
    case 'SELF_FAMILY_PARENTS':
      return '이 결은 부모를 이해하는 문제보다 기대와 죄책감이 어디서 얽히는지 드러냅니다. 지금은 효심보다 말 순서와 거리 기준을 다시 세우는 편이 맞습니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'CAREER':
      return '이 결은 지금 일의 이름보다 어떤 방식으로 일할 때 실력과 체력이 함께 남는지를 가리킵니다. 결과를 반복해서 만들 수 있는 구조인지 먼저 보는 편이 좋습니다.';
    case 'WEALTH':
      return '이 결은 돈을 더 모으는 문제와 새는 구멍을 막는 문제를 동시에 보여 줍니다. 수입보다 유지 구조를 먼저 점검할수록 흐름이 선명해집니다.';
    case 'ROMANCE':
      return '이 결은 감정의 크기보다 관계가 실제로 이어질 리듬을 가리킵니다. 설렘과 안정 가능성을 분리해서 읽는 편이 맞습니다.';
    case 'RELATIONSHIPS':
      return '이 결은 사람을 더 붙잡으라는 뜻보다, 어떤 관계가 내 기운을 살리고 어떤 관계가 닳게 하는지 가르는 쪽에 가깝습니다.';
    case 'FAMILY':
      return '이 결은 가족을 더 이해해야 한다는 뜻보다, 가까운 사이일수록 더 필요한 말과 거리 기준을 보여 줍니다.';
    case 'LIFETIME_FLOW':
      return '이 결은 당장 눈앞의 사건보다 오래 반복될수록 강해지는 선택과 닳는 선택을 구분하라는 신호에 가깝습니다.';
    case 'DAEUN':
      return '이 결은 지금 10년이 어디에 힘을 몰아 주는지와 무엇을 줄이라고 말하는지를 보여 줍니다. 생활 구조를 바꿀 축을 먼저 읽는 편이 맞습니다.';
    case 'YEAR_MONTH_DAY_FORTUNE':
      return '이 결은 운세를 기다리라는 뜻보다, 지금 시기에 먼저 끝내야 할 일과 줄여야 할 충동을 가르라는 신호에 가깝습니다.';
    case 'LUCK_UP':
      return '이 결은 특별한 비법보다 생활 안에서 바로 붙일 수 있는 습관을 고르라는 쪽에 가깝습니다. 반복 가능한 기준을 만들수록 체감이 빨라집니다.';
    case 'MARRIAGE':
      return '이 결은 애정 표현보다 오래 함께 살 때 맞아야 할 생활 기준을 보여 줍니다. 마음과 생활의 리듬을 같이 보는 편이 맞습니다.';
    case 'BASIC':
    default:
      return '이 결은 삶 전체에서 지금 무엇을 살리고 무엇을 다듬어야 하는지 가리키는 중심축입니다. 한 부분보다 전체 리듬을 먼저 읽을수록 해석이 정확해집니다.';
  }
}

function buildCompatibilityCoreSignalFocus(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
}): string {
  switch (input.scenarioCode) {
    case 'COMPAT_ROMANCE_LOVER':
      return '이 리듬은 지금의 애정이 실제 안정감과 회복력으로 이어지는지를 보여 줍니다. 지금은 사랑의 크기보다 서운함 뒤에 다시 편안해질 구조가 있는지부터 읽어야 합니다.';
    case 'COMPAT_ROMANCE_MARRIAGE_PARTNER':
      return '이 리듬은 설렘보다 오래 함께 살 기준이 맞는지를 보여 줍니다. 지금은 조건보다 생활 감각과 책임 문장이 자연스럽게 맞는지부터 봐야 합니다.';
    case 'COMPAT_ROMANCE_MARRIED':
      return '이 리듬은 애정보다 부부로 살아가는 생활 기준이 맞는지에서 먼저 드러납니다. 지금은 감정보다 역할과 회복 리듬을 함께 읽는 편이 맞습니다.';
    case 'COMPAT_ROMANCE_EX':
      return '이 리듬은 보고 싶은 마음보다 다시 이어져도 괜찮을 구조가 남아 있는지를 보여 줍니다. 지금은 반가움보다 예전과 달라진 기준이 있는지부터 읽어야 합니다.';
    case 'COMPAT_ROMANCE_LEFT_ON_READ':
      return '이 리듬은 답장 속도 하나가 아니라 두 사람이 편하다고 느끼는 연락 템포 차이를 보여 줍니다. 지금은 침묵의 의미를 단정하기보다 말 길이와 반응선이 맞는지부터 봐야 합니다.';
    case 'COMPAT_ROMANCE_FRIEND_TO_LOVER':
      return '이 리듬은 친구의 편안함이 설렘으로 자랄 여지가 있는지 보여 줍니다. 지금은 고백 자체보다 둘만의 결이 이미 달라지고 있는지 읽는 편이 맞습니다.';
    case 'COMPAT_ROMANCE_GHOSTED':
      return '이 리듬은 왜 흐름이 끊겼는지와, 다시 이어진다면 어디서부터 부담이 줄어드는지를 보여 줍니다. 지금은 답을 캐묻기보다 멈춘 이유를 읽는 편이 맞습니다.';
    case 'COMPAT_WORK_BUSINESS_PARTNER':
      return '이 리듬은 친밀감보다 역할과 책임 경계가 실제 문장으로 세워질 수 있는지를 보여 줍니다. 지금은 아이디어보다 권한과 손실 기준을 먼저 맞추는 편이 맞습니다.';
    case 'COMPAT_WORK_BOSS':
      return '이 리듬은 호감보다 보고 주기와 기대 문장이 맞는지에서 먼저 드러납니다. 지금은 감정보다 우선순위와 완료 기준을 읽는 편이 맞습니다.';
    case 'COMPAT_WORK_DIFFICULT_BOSS':
      return '이 리듬은 까다로움의 성격보다 어떤 기준 차이가 반복 피로를 만드는지를 보여 줍니다. 지금은 참는 것보다 확인할 문장을 먼저 세우는 편이 맞습니다.';
    case 'COMPAT_FRIEND_CUT_OFF':
      return '이 리듬은 누가 더 나쁘냐보다 이 관계가 내 기운을 얼마나 소모시키는지 보여 줍니다. 지금은 단절 선언보다 먼저 필요한 거리선을 읽는 편이 맞습니다.';
    case 'COMPAT_FAMILY_PARENT_CHILD':
      return '이 리듬은 사랑의 크기보다 보호와 기대가 어디서 상처로 바뀌는지를 보여 줍니다. 지금은 옳고 그름보다 말 순서와 거리 기준을 먼저 읽어야 합니다.';
    default:
      break;
  }

  switch (input.subjectType) {
    case 'BUSINESS_PARTNER':
      return '이 리듬은 같이 벌 수 있는지보다 같이 책임질 수 있는 구조가 있는지를 가리킵니다. 돈과 권한 기준을 먼저 읽을수록 궁합이 정확해집니다.';
    case 'MANAGER_MEMBER':
    case 'COWORKER':
      return '이 리듬은 일의 감정보다 보고, 공유, 마감 기준이 어떻게 맞물리는지를 보여 줍니다. 기준 차이를 읽는 편이 관계 피로를 줄입니다.';
    case 'FRIEND':
      return '이 리듬은 친한지 아닌지보다 편안함과 경계 존중이 함께 살아 있는지를 보여 줍니다. 오래 갈 우정은 작은 선을 어떻게 지키는지에서 드러납니다.';
    case 'LOVER':
    case 'CRUSH':
      return '이 리듬은 마음의 크기보다 감정 속도와 연락 템포가 실제로 이어질 수 있는지를 보여 줍니다. 설렘과 안정 가능성을 분리해서 읽는 편이 맞습니다.';
    case 'MARRIED':
      return '이 리듬은 애정보다 생활 기준이 맞는지에서 먼저 드러납니다. 역할과 시간과 돈의 선을 함께 읽을수록 궁합이 선명해집니다.';
    case 'BASIC':
    default:
      return '이 리듬은 누가 더 맞는지보다 어떤 역할과 말의 순서에서 관계가 편안해지는지를 가리킵니다. 차이를 없애기보다 다르게 맞물리는 방식을 보는 편이 맞습니다.';
  }
}

function buildSelfCautionFocus(input: {
  subjectType: SelfSubjectType;
  scenarioCode?: string | null;
  softRisk: string;
  subtypeCaution?: string | null;
  scenarioCautionAddon?: string;
}): string {
  const lead = (() => {
    switch (input.scenarioCode) {
      case 'SELF_LOVE_RECONCILIATION':
        return '재회 판단에서는 반가움이 기준을 대신하기 쉽습니다.';
      case 'SELF_LOVE_CONTACT_RETURN':
        return '연락 기다림은 침묵에 의미를 과하게 싣는 순간부터 흐려지기 쉽습니다.';
      case 'SELF_LOVE_CONFESSION_TIMING':
        return '고백 고민은 불안을 빨리 끝내고 싶은 마음이 타이밍 판단을 밀어붙이기 쉽습니다.';
      case 'SELF_CAREER_APTITUDE':
        return '적성 고민은 남들이 보기 좋은 일에 맞추며 내 체력 신호를 놓치기 쉽습니다.';
      case 'SELF_CAREER_JOB_CHANGE':
        return '이직 판단은 현재 피로가 다음 자리의 현실 조건을 가리는 순간이 가장 위험합니다.';
      case 'SELF_WEALTH_ACCUMULATION':
        return '돈을 모으는 질문은 크게 벌 기회에만 시선이 쏠리면 유지 구조를 놓치기 쉽습니다.';
      case 'SELF_WEALTH_LEAK':
        return '누수 문제는 필요한 지출과 불안을 달래는 소비가 섞일 때 가장 헷갈립니다.';
      case 'SELF_RELATIONSHIP_CUT_OFF':
        return '손절 고민은 죄책감과 책임감이 섞이면서 필요한 거리선이 늦어지기 쉽습니다.';
      case 'SELF_FAMILY_PARENTS':
        return '부모와의 관계는 효심과 죄책감이 섞이면 필요한 말도 더 늦어지기 쉽습니다.';
      default:
        break;
    }

    switch (input.subjectType) {
      case 'CAREER':
        return '일 고민은 실력보다 구조 문제인 피로를 전부 내 탓으로 돌리기 쉽습니다.';
      case 'WEALTH':
        return '돈 고민은 숫자보다 감정과 관계가 먼저 지갑을 여는 장면을 놓치기 쉽습니다.';
      case 'ROMANCE':
        return '연애 고민은 기대와 사실이 섞이는 순간 관계 판단이 금방 흐려집니다.';
      case 'RELATIONSHIPS':
        return '관계 고민은 좋은 사람이 되려는 마음이 경계 판단을 늦추기 쉽습니다.';
      case 'FAMILY':
        return '가족 고민은 익숙함 때문에 필요한 설명을 생략하며 상처가 오래 남기 쉽습니다.';
      case 'LIFETIME_FLOW':
        return '긴 흐름을 보는 질문은 장기 해석을 핑계로 현재 조정을 미루기 쉽습니다.';
      case 'YEAR_MONTH_DAY_FORTUNE':
        return '시기 해석은 오늘의 리듬보다 기분으로 결정을 밀어붙이는 순간 더 흔들립니다.';
      case 'DAEUN':
        return '대운 해석은 큰 흐름만 믿고 작은 생활 기준을 놓치기 쉬운 질문입니다.';
      case 'LUCK_UP':
        return '개운 질문은 특별한 방법을 찾느라 반복 가능한 생활 기준을 놓치기 쉽습니다.';
      case 'MARRIAGE':
        return '결혼 고민은 외로움이나 주변 속도가 생활 기준 판단을 앞지르기 쉽습니다.';
      case 'BASIC':
      default:
        return '전체 흐름을 볼 때일수록 한 가지 해석으로 삶 전체를 단정하기 쉽습니다.';
    }
  })();

  return [
    lead,
    `${input.softRisk}.`,
    input.subtypeCaution,
    input.scenarioCautionAddon
  ]
    .filter(Boolean)
    .join(' ');
}

function buildCompatibilityCautionFocus(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
  softRisk: string;
  subtypeCaution?: string | null;
  scenarioCautionAddon?: string;
}): string {
  const lead = (() => {
    switch (input.scenarioCode) {
      case 'COMPAT_ROMANCE_LOVER':
        return '현재 연인 궁합은 사랑한다는 확신이 반복되는 서운함을 가볍게 보게 만들기 쉽습니다.';
      case 'COMPAT_ROMANCE_MARRIAGE_PARTNER':
        return '결혼 상대 궁합은 관계를 지키고 싶은 마음이 중요한 생활 기준 점검을 뒤로 미루게 만들기 쉽습니다.';
      case 'COMPAT_ROMANCE_MARRIED':
        return '부부 궁합은 익숙함이 커질수록 꼭 말해야 할 생활 피로를 눈치로 넘기기 쉽습니다.';
      case 'COMPAT_ROMANCE_EX':
        return '재회 궁합은 추억이 현실 판단을 덮는 순간 가장 흐려지기 쉽습니다.';
      case 'COMPAT_ROMANCE_LEFT_ON_READ':
        return '읽씹 궁합은 답장 속도 하나가 관계 전체의 의미를 대신하기 쉽습니다.';
      case 'COMPAT_ROMANCE_FRIEND_TO_LOVER':
        return '친구에서 연인 흐름은 편안함을 잃고 싶지 않은 마음이 확인을 너무 늦추기 쉽습니다.';
      case 'COMPAT_ROMANCE_GHOSTED':
        return '끊긴 흐름 궁합은 침묵의 이유를 하나로 단정하는 순간 해석이 급격히 좁아집니다.';
      case 'COMPAT_WORK_BUSINESS_PARTNER':
        return '동업 궁합은 신뢰감이 클수록 돈과 철수 기준을 뒤로 미루기 쉽습니다.';
      case 'COMPAT_WORK_BOSS':
        return '상사 궁합은 눈치로 맞추려는 습관이 억울함을 오래 쌓이게 만들기 쉽습니다.';
      case 'COMPAT_WORK_DIFFICULT_BOSS':
        return '까다로운 상사 궁합은 감정 소모를 참는 일로만 버티면 기준 확인이 더 늦어지기 쉽습니다.';
      case 'COMPAT_FRIEND_CUT_OFF':
        return '손절 고민 궁합은 오래된 의리와 미안함이 필요한 거리 조절을 늦추기 쉽습니다.';
      case 'COMPAT_FAMILY_PARENT_CHILD':
        return '부모와 자식 궁합은 걱정이 사랑의 이름으로 통제를 정당화하기 쉽습니다.';
      default:
        break;
    }

    switch (input.subjectType) {
      case 'BUSINESS_PARTNER':
        return '함께 일하는 관계는 친밀감이 클수록 기준 문장을 생략하기 쉽습니다.';
      case 'MANAGER_MEMBER':
      case 'COWORKER':
        return '업무 궁합은 방식 차이를 성격 문제로 해석하는 순간 더 오래 꼬이기 쉽습니다.';
      case 'FRIEND':
        return '우정 궁합은 편하다는 이유로 설명을 줄이며 작은 서운함을 오래 남기기 쉽습니다.';
      case 'LOVER':
      case 'CRUSH':
        return '연애 궁합은 좋은 신호 하나와 나쁜 신호 하나에 의미를 과하게 싣기 쉽습니다.';
      case 'MARRIED':
        return '가까운 관계일수록 이해해 줄 거라는 기대가 필요한 설명을 더 늦추기 쉽습니다.';
      case 'BASIC':
      default:
        return '궁합 해석은 한 장면으로 관계 전체를 단정하는 순간 가장 빨리 흐려집니다.';
    }
  })();

  return [
    lead,
    `${input.softRisk}.`,
    input.subtypeCaution,
    input.scenarioCautionAddon
  ]
    .filter(Boolean)
    .join(' ');
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
    case 'MARRIED':
      return `${userName}와 ${partnerName}의 부부 궁합은 누가 더 맞는지보다 같이 사는 속도, 집안일과 돈, 서운함을 푸는 방식을 얼마나 편안하게 맞추는지가 핵심입니다. ${strongElement} 기운은 관계를 오래 버티는 힘이 되지만, ${weakElement} 축은 피로가 쌓일수록 마음보다 말이 먼저 거칠어지기 쉬우니 애정 표현과 휴식 시간을 같이 맞추는 편이 좋습니다.`;
    default:
      return `${userName}와 ${partnerName}의 궁합은 누가 더 맞는지보다, 서로의 강점이 어디서 살아나고 약한 축이 어디서 흔들리는지 보는 편이 더 정확합니다. ${strongElement} 기운은 관계의 든든함을 만들고, ${weakElement} 축은 기대가 흐려질 때 피로를 키우기 쉬우니 기준을 먼저 맞추는 편이 좋습니다.`;
  }
}

function buildCompatibilityHighlights(input: {
  subjectType: CompatibilityRelationType;
  scenarioCode?: string | null;
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

  switch (input.scenarioCode) {
    case 'COMPAT_BASIC':
      return {
        pairDynamic:
          '기본 궁합에서 가장 먼저 보이는 건 둘이 함께 있을 때 누가 먼저 분위기를 열고 누가 흐트러진 부분을 정리하는지가 자연스럽게 나뉜다는 점입니다. 서로를 똑같이 만들기보다 말의 속도와 쉬는 방식을 조금만 맞추면 편안함이 훨씬 크게 살아나는 조합입니다.',
        attractionPoint:
          '이 궁합의 장점은 강한 부분이 달라 서로에게 없는 감각을 채워 준다는 점입니다. 한 사람은 시작을 돕고 다른 사람은 흐름을 붙잡아 주는 식이라, 같이 있을수록 마음이 놓이는 장면이 생각보다 자주 생기기 쉽습니다.',
        conflictTrigger:
          '답답한 순간을 푸는 방식이 달라 한쪽은 바로 말하고 싶고 다른 한쪽은 조금 정리한 뒤 말하고 싶어질 수 있습니다. 이 차이를 무관심이나 간섭으로 오해하면 작은 서운함이 반복해서 남아 관계 피로로 이어질 수 있습니다.',
        communicationTip:
          '잘 맞는 궁합일수록 막연히 통하겠지 하고 넘기지 않는 편이 좋습니다. 서운한 점 하나, 편했던 점 하나, 앞으로 바라는 방식 하나를 같은 순서로 짧게 나누면 두 사람의 합이 훨씬 안정적으로 드러납니다.'
      };
    case 'COMPAT_ROMANCE_MARRIAGE_PARTNER':
      return {
        pairDynamic: `미래를 같이 그릴 때 생활 기준과 책임 분담을 분명히 맞추면 장점이 크게 살아나는 조합입니다. ${common.pairDynamic}`,
        attractionPoint: `편안함과 신뢰가 함께 자라기 쉬워 오래 갈 상대인지 판단할 재료가 많은 조합입니다. ${common.attractionPoint}`,
        conflictTrigger: `좋은 마음만 믿고 돈, 가족, 생활 기준을 늦게 맞추면 현실 피로가 빨리 커질 수 있습니다. ${common.conflictTrigger}`,
        communicationTip:
          '미래 이야기는 막연한 약속보다 돈, 시간, 가족, 쉬는 방식 1개씩을 실제 문장으로 맞춰 볼 때 훨씬 정확해집니다.'
      };
    case 'COMPAT_ROMANCE_MARRIED':
      return {
        pairDynamic: `같이 사는 속도와 회복 방식만 맞으면 애정과 현실을 오래 같이 끌고 갈 수 있는 조합입니다. ${common.pairDynamic}`,
        attractionPoint: `익숙한 일상 속에서도 서로를 편하게 쉬게 하고 믿게 만드는 힘이 큰 편입니다. ${common.attractionPoint}`,
        conflictTrigger: `피곤한 날의 말투나 집안일·돈의 서운함을 성격 문제로 번역하는 순간 감정 상처가 커지기 쉽습니다. ${common.conflictTrigger}`,
        communicationTip:
          '서운한 지점 1개와 바라는 방식 1개를 짧게 나누고, 집안일·돈·휴식 기준을 가볍게 다시 맞추면 회복이 훨씬 빨라집니다.'
      };
    default:
      break;
  }

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
          '주요 의사결정은 말로만 넘기지 말고 권한·배분·철수 조건을 글로 남겨 두는 편이 좋습니다. 그래야 관계와 사업을 같이 지키기가 훨씬 쉽습니다.'
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
  scenarioEvidenceAngle?: string;
  partnerName?: string;
  partnerElement?: FiveElementSummary | null;
  partnerTimeFlow?: Pick<TimeFlowSummary, 'currentDaewoon'> | null;
  compatibilitySubtype?: SubjectSubtype | null;
}): string[] {
  if (input.readingType === 'SELF') {
    return [
      `기본 바탕은 ${input.userElement.strongElement} 기운이 강해 ${describeStrongElementMeaning(input.userElement.strongElement)}. 반대로 ${input.userElement.weakElement} 기운은 비기 쉬워 ${describeWeakElementMeaning(input.userElement.weakElement)}.`,
      input.userSubtype
        ? `지금 이 고민에서는 ${input.userSubtype.description}.`
        : '지금은 타고난 기질과 현재 운이 함께 맞물리며 방향을 또렷하게 잡아 주는 시기입니다.',
      input.scenarioEvidenceAngle ??
        '이번 질문은 선택한 고민의 핵심 판단 포인트를 따로 떼어 읽어야 훨씬 정확하게 보입니다.',
      `겉으로 드러난 기운에는 기준을 세우는 힘, 만들어 내는 힘, 책임을 지는 힘이 함께 보입니다. 그래서 밀어붙이기보다 기준을 세우고 쌓아 갈 때 결과가 더 안정적으로 남습니다.`,
      `${buildUnseongSummary(input.userElement)} 지금은 ${input.userTimeFlow.currentTheme}이 크게 깔려 있고, 올해는 ${extractMeaningOnly(input.userTimeFlow.yearlyFlow)} 그래서 무리한 변화보다 생활 리듬을 정리하면서 가는 방식이 더 잘 맞습니다.`
    ];
  }

  return [
    `${input.userName}은 ${input.userElement.strongElement} 기운이 강해 ${describeStrongElementMeaning(input.userElement.strongElement)}. ${input.partnerName ?? '상대'}는 ${input.partnerElement ? `${input.partnerElement.strongElement} 기운이 강해 ${describeStrongElementMeaning(input.partnerElement.strongElement)}` : '아직 상대 흐름을 충분히 읽을 정보가 더 필요합니다'}.`,
    `${input.userName}은 ${input.userElement.weakElement} 축에서 ${describeWeakElementMeaning(input.userElement.weakElement)}. ${input.partnerName ?? '상대'}는 ${input.partnerElement ? `${describeWeakElementMeaning(input.partnerElement.weakElement)}` : '세부 조율 포인트는 상대 정보가 더 있어야 선명해집니다'}.`,
    input.scenarioEvidenceAngle ??
      (input.compatibilitySubtype
        ? `이 궁합은 ${input.compatibilitySubtype.description}.`
        : '궁합은 두 사람의 타고난 기질과 지금 들어온 운을 함께 읽을 때 더 정확해집니다.'),
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
  const selfScenarioProfile =
    input.readingType === 'SELF'
      ? getSelfScenarioContentProfile(
          input.scenarioCode,
          input.subjectType as SelfSubjectType
        )
      : null;
  const compatibilityScenarioProfile =
    input.readingType === 'COMPATIBILITY'
      ? getCompatibilityScenarioContentProfile(
          input.scenarioCode,
          input.subjectType as CompatibilityRelationType
        )
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
  const useSelfScenarioLeadOrder =
    input.readingType === 'SELF' &&
    Boolean(input.scenarioCode) &&
    input.scenarioCode !== 'SELF_BASIC';
  const useCompatibilityScenarioLeadOrder =
    input.readingType === 'COMPATIBILITY' && Boolean(input.scenarioCode);
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
      ? `${
          useSelfScenarioLeadOrder
            ? `${
                selfScenarioProfile?.overviewAngle ??
                buildSelfOverviewFocus({
                  subjectType: input.subjectType as SelfSubjectType,
                  scenarioCode: input.scenarioCode
                })
              }`
            : `${selfMbtiOverviewLead} ${selfScenarioProfile?.overviewAngle ?? ''} ${buildSelfOverviewFocus(
                {
                  subjectType: input.subjectType as SelfSubjectType,
                  scenarioCode: input.scenarioCode
                }
              )}`
        } 사주상 ${userElement.strongElement} 기운이 강하게 잡힌 구조라 ${buildElementMeaningBridge(userElement.strongElement, userElement.weakElement)}\n\n${scenarioOverlay?.narrativeAddon ? `${scenarioOverlay.narrativeAddon} ` : ''}지금은 '${coreSignal}'이 핵심으로 들어오는 시기입니다. ${sajuCurrentSignal} ${activeSelfSubtype ? `이번 질문에서는 ${describeSubtypeForUser(activeSelfSubtype)} ` : ''}${highlight}은 이번 시기에서 분명한 강점으로 살아납니다. ${buildSelfSubjectOverviewClose(
          {
            subjectType: input.subjectType as SelfSubjectType,
            scenarioCode: input.scenarioCode,
            subtype: activeSelfSubtype
          }
        )}`
      : `${
          useCompatibilityScenarioLeadOrder
            ? (compatibilityScenarioProfile?.overviewAngle ??
              buildCompatibilityOverviewFocus({
                subjectType: input.subjectType as CompatibilityRelationType,
                scenarioCode: input.scenarioCode
              }))
            : `${compatibilityMbtiOverviewLead} ${compatibilityScenarioProfile?.overviewAngle ?? ''} ${buildCompatibilityOverviewFocus(
                {
                  subjectType: input.subjectType as CompatibilityRelationType,
                  scenarioCode: input.scenarioCode
                }
              )}`
        } 두 사람의 궁합은 '${atmosphere}'처럼 호흡이 맞을 때 훨씬 편안하게 이어집니다. ${scenarioOverlay?.narrativeAddon ? `${scenarioOverlay.narrativeAddon} ` : ''}${sajuCurrentSignal}\n\n${compatibilitySubtype ? `지금 두 사람은 ${compatibilitySubtype.description}. ` : ''}${buildCompatibilityOverviewAccent(compatibilitySubtype)} 서로를 바꾸려 하기보다 각자 강한 부분을 살리고 약한 부분을 보완할 때 관계의 장점이 더 크게 드러납니다.`;

  const narrativeFlow =
    input.readingType === 'SELF'
      ? `${
          useSelfScenarioLeadOrder
            ? `${selfScenarioProfile?.narrativeAngle ?? ''} ${subjectContext.storyline} ${selfMbtiNarrativeLead}`
            : `${selfMbtiNarrativeLead} ${selfScenarioProfile?.narrativeAngle ?? ''} ${subjectContext.storyline}`
        } ${scenarioOverlay?.narrativeAddon ? `${scenarioOverlay.narrativeAddon} ` : ''}${buildSelfNarrativeAnchor(
          {
            subjectType: input.subjectType as SelfSubjectType,
            scenarioCode: input.scenarioCode,
            currentTheme: userTimeFlow.currentTheme,
            userName: input.userName
          }
        )}\n\n${buildElementMeaningBridge(userElement.strongElement, userElement.weakElement)} ${activeSelfSubtype ? `${describeSubtypeForUser(activeSelfSubtype)} ${activeSelfSubtype.advice}` : ''} ${buildSelfSubjectNarrativeClose(
          {
            subjectType: input.subjectType as SelfSubjectType,
            scenarioCode: input.scenarioCode,
            subtype: activeSelfSubtype
          }
        )}`
      : `${
          useCompatibilityScenarioLeadOrder
            ? `${compatibilityScenarioProfile?.narrativeAngle ?? ''} ${subjectContext.storyline} ${compatibilityMbtiNarrativeLead}`
            : `${compatibilityMbtiNarrativeLead} ${compatibilityScenarioProfile?.narrativeAngle ?? ''} ${subjectContext.storyline}`
        } ${scenarioOverlay?.narrativeAddon ? `${scenarioOverlay.narrativeAddon} ` : ''}${compatibilityTarget}는 차이를 지우는 관계가 아니라, 역할을 잘 나눌 때 더 편안하고 단단해지는 관계입니다.\n\n${compatibilitySubtype ? `지금은 ${compatibilitySubtype.description} ${compatibilitySubtype.advice}` : ''} ${buildCompatibilityNarrativeAccent(compatibilitySubtype)}${input.partnerMbtiType ? ' 서로의 성향 차이를 억지로 줄이기보다 각자의 리듬을 인정할수록 궁합이 훨씬 부드럽게 이어집니다.' : ''}`;

  const summary =
    input.readingType === 'SELF'
      ? `${displaySubjectLabel}: ${
          useSelfScenarioLeadOrder
            ? `${buildSelfSummaryFocus({
                subjectType: input.subjectType as SelfSubjectType,
                scenarioCode: input.scenarioCode
              })} ${buildFocusedSelfSummaryClose({
                subjectType: input.subjectType as SelfSubjectType,
                scenarioCode: input.scenarioCode
              })}`
            : `${selfMbtiSummaryLead} ${selfScenarioProfile?.summaryAngle ?? ''}`
        }${
          useSelfScenarioLeadOrder
            ? ''
            : ` '${subjectContext.focus}' 관점에서 '${coreSignal}' 결이 또렷한 시기입니다.${scenarioOverlay?.subjectLensAddon ? ` ${scenarioOverlay.subjectLensAddon}` : ''}${activeSelfSubtype ? ` 지금 질문에서는 ${describeSubtypeForUser(activeSelfSubtype)}.` : ''} ${userElement.dayMaster.stem}${userElement.dayMaster.element} 일간 위로 ${withSubjectParticle(userTimeFlow.currentTheme)} 겹쳐 들어와, 강점을 실제 행동으로 연결할수록 운이 더 곧게 이어집니다.`
        }`
      : `${displaySubjectLabel}: ${
          useCompatibilityScenarioLeadOrder
            ? `${compatibilityScenarioProfile?.summaryAngle ?? ''} ${buildCompatibilitySummaryClose(
                {
                  subjectType: input.subjectType as CompatibilityRelationType,
                  scenarioCode: input.scenarioCode
                }
              )}`
            : `${compatibilityMbtiSummaryLead} ${compatibilityScenarioProfile?.summaryAngle ?? ''}`
        }${
          useCompatibilityScenarioLeadOrder
            ? ''
            : ` '${subjectContext.focus}' 관점에서 '${coreSignal}' 리듬을 맞출수록 관계 안정감이 함께 올라갑니다.${scenarioOverlay?.subjectLensAddon ? ` ${scenarioOverlay.subjectLensAddon}` : ''}${compatibilitySubtype ? ` 두 사람은 ${compatibilitySubtype.description}.` : ''} 두 사람의 일간 결을 억지로 맞추기보다 역할로 나눌수록 합이 살아납니다.`
        }`;

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
      ? `${
          useSelfScenarioLeadOrder
            ? `${buildSelfRelationshipFlowFocus({
                subjectType: input.subjectType as SelfSubjectType,
                scenarioCode: input.scenarioCode
              })} ${selfScenarioProfile?.relationshipAngle ?? subjectContext.relationHint} ${selfMbtiRelationshipLead}`
            : `${selfMbtiRelationshipLead} ${selfScenarioProfile?.relationshipAngle ?? subjectContext.relationHint} ${buildSelfRelationshipFlowFocus(
                {
                  subjectType: input.subjectType as SelfSubjectType,
                  scenarioCode: input.scenarioCode
                }
              )}`
        } ${scenarioOverlay?.relationshipFlowAddon ? `${scenarioOverlay.relationshipFlowAddon} ` : ''}${userElement.strongElement} 기운이 강하다는 건 마음이 붙은 관계를 오래 끌고 가는 힘이 있다는 뜻입니다. 반대로 ${userElement.weakElement} 기운이 약한 구간에서는 서운함을 바로 끊어 말하기보다 속으로 오래 정리하게 되기 쉽습니다.\n\n${input.subjectType === 'ROMANCE' ? `${romanceSubtype.description}. ${romanceSubtype.advice}` : input.subjectType === 'MARRIAGE' ? `${marriageSubtype.description}. ${marriageSubtype.advice}` : '좋은 관계일수록 기준을 부드럽게 말해 주는 태도가 중요합니다.'} ${buildSelfRelationshipFlowClose(
          {
            subjectType: input.subjectType as SelfSubjectType,
            scenarioCode: input.scenarioCode
          }
        )}`
      : `${
          useCompatibilityScenarioLeadOrder
            ? `${buildCompatibilityRelationshipFlowFocus({
                subjectType: input.subjectType as CompatibilityRelationType,
                scenarioCode: input.scenarioCode
              })} ${compatibilityScenarioProfile?.relationshipAngle ?? subjectContext.relationHint} ${compatibilityMbtiRelationshipLead}`
            : `${compatibilityMbtiRelationshipLead} ${compatibilityScenarioProfile?.relationshipAngle ?? subjectContext.relationHint} ${buildCompatibilityRelationshipFlowFocus(
                {
                  subjectType: input.subjectType as CompatibilityRelationType,
                  scenarioCode: input.scenarioCode
                }
              )}`
        } ${scenarioOverlay?.relationshipFlowAddon ? `${scenarioOverlay.relationshipFlowAddon} ` : ''}관계를 보면 ${input.userName}의 ${userElement.strongElement} 기운과 ${partnerDisplayName}의 ${partnerElement?.strongElement ?? '균형'} 기운이 만날 때 시너지가 분명합니다. ${compatibilitySubtype ? `지금 두 사람은 ${compatibilitySubtype.description}. ${compatibilitySubtype.advice}` : '서로 잘하는 부분이 다르기 때문에 역할만 잘 나뉘어도 관계가 훨씬 편안해집니다.'}\n\n다만 ${userElement.weakElement}·${partnerElement?.weakElement ?? '수'} 축에서는 오해가 잠깐 붙기 쉽습니다. ${buildCompatibilityRelationshipFlowClose(
          {
            subjectType: input.subjectType as CompatibilityRelationType,
            scenarioCode: input.scenarioCode
          }
        )}`;

  const wealthFlow =
    input.readingType === 'SELF'
      ? `${
          useSelfScenarioLeadOrder
            ? `${buildSelfWorkMoneyFlowFocus({
                subjectType: input.subjectType as SelfSubjectType,
                scenarioCode: input.scenarioCode
              })} ${selfScenarioProfile?.wealthAngle ?? subjectContext.workMoneyHint} ${selfMbtiWealthLead}`
            : `${selfMbtiWealthLead} ${selfScenarioProfile?.wealthAngle ?? subjectContext.workMoneyHint} ${buildSelfWorkMoneyFlowFocus(
                {
                  subjectType: input.subjectType as SelfSubjectType,
                  scenarioCode: input.scenarioCode
                }
              )}`
        } ${scenarioOverlay?.wealthFlowAddon ? `${scenarioOverlay.wealthFlowAddon} ` : ''}${input.subjectType === 'CAREER' ? `일의 결을 보면 ${careerSubtype.description}. ${userElement.strongElement} 기운이 강하다는 건 일의 방식에서 이 장점이 먼저 드러난다는 뜻입니다.` : `재물운을 보면 ${wealthSubtype.description}. ${userElement.strongElement} 기운이 강하다는 건 돈을 다루는 감각에서 이 장점이 먼저 드러난다는 뜻입니다.`}\n\n${input.subjectType === 'CAREER' ? `반대로 ${userElement.weakElement} 기운이 약한 구간에서는 역할을 잘라내거나 기준을 다시 세우는 일이 늦어지기 쉽습니다. 그래서 ${careerSubtype.advice}` : `반대로 ${userElement.weakElement} 기운이 약한 구간에서는 돈이 새는 이유를 늦게 알아차리기 쉽습니다. 그래서 ${wealthSubtype.advice}`} ${buildSelfWorkMoneyFlowClose(
          {
            subjectType: input.subjectType as SelfSubjectType,
            scenarioCode: input.scenarioCode
          }
        )}`
      : `${compatibilityScenarioProfile?.wealthAngle ?? subjectContext.workMoneyHint} ${buildCompatibilityWealthFlowFocus(
          {
            subjectType: input.subjectType as CompatibilityRelationType,
            scenarioCode: input.scenarioCode
          }
        )}\n\n${compatibilitySubtype ? `지금 두 사람은 ${compatibilitySubtype.description}. ${compatibilitySubtype.advice}` : '두 사람의 성과 흐름은 역할 분담이 선명할수록 훨씬 안정적으로 굴러갑니다.'}\n\n${withTopicParticle(input.userName)} 앞에서 열고, ${withTopicParticle(partnerDisplayName)} 옆에서 살피는 식으로 나누면 변동성을 줄이면서 성과를 오래 가져갈 수 있습니다. ${buildCompatibilityWealthFlowClose(
          {
            subjectType: input.subjectType as CompatibilityRelationType,
            scenarioCode: input.scenarioCode
          }
        )}`;

  const timingHint =
    input.readingType === 'SELF'
      ? `${
          useSelfScenarioLeadOrder
            ? `${buildSelfTimingFocus({
                subjectType: input.subjectType as SelfSubjectType,
                scenarioCode: input.scenarioCode
              })} ${selfScenarioProfile?.timingAngle ?? ''} ${selfMbtiTimingLead}`
            : `${selfMbtiTimingLead} ${selfScenarioProfile?.timingAngle ?? ''} ${buildSelfTimingFocus(
                {
                  subjectType: input.subjectType as SelfSubjectType,
                  scenarioCode: input.scenarioCode
                }
              )}`
        } ${subjectContext.timingHint} ${scenarioOverlay?.timingAddon ? `${scenarioOverlay.timingAddon} ` : ''}현재 큰 운은 ${extractMeaningOnly(currentDaewoon)} 올해는 ${extractMeaningOnly(yearlyFlow)} ${buildUnseongSummary(userElement)} 그래서 서두르기보다 흐름이 붙는 시간대를 골라 움직일수록 결과가 더 매끈하게 이어집니다.`
      : `${
          useCompatibilityScenarioLeadOrder
            ? `${buildCompatibilityTimingFocus({
                subjectType: input.subjectType as CompatibilityRelationType,
                scenarioCode: input.scenarioCode
              })} ${compatibilityScenarioProfile?.timingAngle ?? ''} ${compatibilityMbtiTimingLead}`
            : `${compatibilityMbtiTimingLead}\n\n${compatibilityScenarioProfile?.timingAngle ?? ''} ${buildCompatibilityTimingFocus(
                {
                  subjectType: input.subjectType as CompatibilityRelationType,
                  scenarioCode: input.scenarioCode
                }
              )}`
        } ${subjectContext.timingHint}\n\n${scenarioOverlay?.timingAddon ? `${scenarioOverlay.timingAddon}\n\n` : ''}지금은 ${extractMeaningOnly(currentDaewoon)}\n\n올해는 ${extractMeaningOnly(yearlyFlow)}\n\n급히 결론내기보다 두 사람의 호흡이 맞는 타이밍을 골라 이야기할수록 결과가 훨씬 부드럽습니다. 중요한 이야기는 피곤할 때보다 마음이 조금 느슨해진 시간에 꺼내는 편이 좋습니다.`;
  const subjectLens =
    input.readingType === 'SELF'
      ? `${selfScenarioProfile?.lensAngle ?? ''} ${buildSelfSubjectLens(
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
            ? `현재는 ${describeSubtypeForUser(activeSelfSubtype)} ${activeSelfSubtype.advice}`
            : ''
        }`
      : `${buildCompatibilitySubjectLens(
          input.subjectType as CompatibilityRelationType,
          input.userName,
          partnerDisplayName,
          userElement.strongElement,
          userElement.weakElement
        )} ${
          compatibilityScenarioProfile?.lensAngle
            ? `${compatibilityScenarioProfile.lensAngle} `
            : ''
        }${
          scenarioOverlay?.compatibilityLensAddon
            ? scenarioOverlay.compatibilityLensAddon
            : (scenarioOverlay?.subjectLensAddon ?? '')
        }`.trim();
  const compatibilityHighlights =
    input.readingType === 'COMPATIBILITY'
      ? buildCompatibilityHighlights({
          subjectType: input.subjectType as CompatibilityRelationType,
          scenarioCode: input.scenarioCode,
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
    scenarioEvidenceAngle:
      input.readingType === 'SELF'
        ? selfScenarioProfile?.evidenceAngle
        : compatibilityScenarioProfile?.evidenceAngle,
    partnerName: partnerDisplayName,
    partnerElement,
    partnerTimeFlow,
    compatibilitySubtype
  });
  const selfCautionFocus = buildSelfCautionFocus({
    subjectType: input.subjectType as SelfSubjectType,
    scenarioCode: input.scenarioCode,
    softRisk: selfScenarioProfile?.softRiskAngle ?? subjectContext.softRisk,
    subtypeCaution: activeSelfSubtype?.caution,
    scenarioCautionAddon: scenarioOverlay?.cautionAddon
  });
  const compatibilityCautionFocus = buildCompatibilityCautionFocus({
    subjectType: input.subjectType as CompatibilityRelationType,
    scenarioCode: input.scenarioCode,
    softRisk:
      compatibilityScenarioProfile?.softRiskAngle ?? subjectContext.softRisk,
    subtypeCaution: compatibilitySubtype?.caution,
    scenarioCautionAddon: scenarioOverlay?.cautionAddon
  });
  const cautionIntro =
    input.readingType === 'SELF'
      ? useSelfScenarioLeadOrder
        ? `${selfCautionFocus} ${selfScenarioProfile?.cautionAngle ?? ''} ${selfMbtiCautionLead}`
        : `${selfMbtiCautionLead} ${selfScenarioProfile?.cautionAngle ?? ''} ${selfCautionFocus}`
      : useCompatibilityScenarioLeadOrder
        ? `${compatibilityCautionFocus} ${compatibilityScenarioProfile?.cautionAngle ?? ''} ${compatibilityMbtiCautionLead}`
        : `${compatibilityMbtiCautionLead} ${compatibilityScenarioProfile?.cautionAngle ?? ''} ${compatibilityCautionFocus}`;

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
      coreSignal:
        input.readingType === 'SELF'
          ? `이번 ${displaySubjectLabel} 풀이에서 핵심은 '${coreSignal}' 결을 어디에 써야 하는지 가르는 일입니다. ${buildSelfCoreSignalFocus(
              {
                subjectType: input.subjectType as SelfSubjectType,
                scenarioCode: input.scenarioCode
              }
            )}\n\n${buildElementMeaningBridge(userElement.strongElement, userElement.weakElement)} ${sajuCurrentSignal}`
          : `이번 ${displaySubjectLabel} 궁합에서 핵심은 '${coreSignal}' 리듬이 실제 관계 기준으로 이어질 수 있는지 읽는 일입니다. ${buildCompatibilityCoreSignalFocus(
              {
                subjectType: input.subjectType as CompatibilityRelationType,
                scenarioCode: input.scenarioCode
              }
            )}\n\n${sajuCurrentSignal}`,
      caution: `${cautionIntro}\n\n특히 ${userElement.balanceProfile.gisin.element} 기운이 지나치게 앞서면 판단이 잠깐 급해질 수 있습니다. ${softCaution}. ${buildUnseongFocusText(userElement, ['DECLINE', 'RESET'], '월지의 기세가 높아 보여도 속을 먼저 다지면 흐름이 덜 흔들립니다.')} 큰 수정보다 작은 정리 하나만 해도 흐름의 거친 면은 한결 부드러워집니다. ${mbtiAdvice.cautionStyle}.`,
      actions,
      reflectionQuestion: `${input.readingType === 'SELF' ? (selfScenarioProfile?.reflectionQuestion ?? subjectContext.reflectionQuestion) : (compatibilityScenarioProfile?.reflectionQuestion ?? subjectContext.reflectionQuestion)} ${mbtiAdvice.reflectionStyle}.`
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
