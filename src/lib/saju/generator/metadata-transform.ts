import type { SajuInternalMetadata } from './types';

type SajuPillarsDisplay = {
  yearString: string;
  monthString: string;
  dayString: string;
  hourString: string;
};

type SajuDayMasterDisplay = {
  stem: string;
  element: string;
  yinYang: string;
};

type SajuElementDistribution = {
  element: string;
  percentage: number;
};

type SajuRoleDisplay = {
  key: string;
  label: string;
  element: string;
  count: number;
};

type SajuTenGodDisplay = {
  pillarLabel: string;
  stem: string;
  element: string;
  tenGod: string;
};

type SajuBalanceDisplay = {
  dayMasterStrength: string;
  yongsin: {
    element: string;
    label: string;
  };
  heesin: {
    element: string;
    label: string;
  };
  gisin: {
    element: string;
    label: string;
  };
};

type SajuUnseongDisplay = {
  pillarLabel: string;
  branch: string;
  stage: string;
};

export type SajuPersonDisplay = {
  pillars: SajuPillarsDisplay;
  dayMaster: SajuDayMasterDisplay;
  elementDistribution: SajuElementDistribution[];
  strongElement: string;
  weakElement: string;
  roles: SajuRoleDisplay[];
  tenGods: SajuTenGodDisplay[];
  balance: SajuBalanceDisplay | null;
  unseong: SajuUnseongDisplay[];
  birthTimeUnknown: boolean;
};

export type SajuFrontendMetadata = {
  user: SajuPersonDisplay;
  partner?: SajuPersonDisplay;
};

type BasisFeaturePerson = SajuInternalMetadata['basisFeatures']['user'];

const ELEMENT_ORDER = ['목', '화', '토', '금', '수'];
const ROLE_ORDER = ['companion', 'resource', 'output', 'wealth', 'authority'];

function normalizeUnseongStage(stage: string): string {
  if (stage === '묘') {
    return '묘(墓)';
  }

  return stage;
}

function toElementDistribution(
  elementCount?: Record<string, number>
): SajuElementDistribution[] {
  if (!elementCount) {
    return [];
  }

  const total = Object.values(elementCount).reduce(
    (sum, value) => sum + value,
    0
  );
  if (total <= 0) {
    return [];
  }

  return ELEMENT_ORDER.map((element) => {
    const count = elementCount[element] ?? 0;
    return {
      element,
      percentage: Math.round((count / total) * 100)
    };
  });
}

function toRoles(
  roleProfile?: BasisFeaturePerson['roleProfile']
): SajuRoleDisplay[] {
  if (!roleProfile) {
    return [];
  }

  return ROLE_ORDER.map((key) => {
    const role = roleProfile[key];
    if (!role) {
      return null;
    }

    return {
      key,
      label: role.label,
      element: role.element,
      count: role.count
    };
  }).filter((value): value is SajuRoleDisplay => value !== null);
}

function toTenGods(
  tenGodProfile?: BasisFeaturePerson['tenGodProfile']
): SajuTenGodDisplay[] {
  if (!tenGodProfile) {
    return [];
  }

  return tenGodProfile.visible.map((entry) => ({
    pillarLabel: entry.pillarLabel,
    stem: entry.stem,
    element: entry.element,
    tenGod: entry.tenGod
  }));
}

function toBalance(
  balanceProfile?: BasisFeaturePerson['balanceProfile']
): SajuBalanceDisplay | null {
  if (!balanceProfile) {
    return null;
  }

  return {
    dayMasterStrength: balanceProfile.dayMasterStrength,
    yongsin: {
      element: balanceProfile.yongsin.element,
      label: balanceProfile.yongsin.label
    },
    heesin: {
      element: balanceProfile.heesin.element,
      label: balanceProfile.heesin.label
    },
    gisin: {
      element: balanceProfile.gisin.element,
      label: balanceProfile.gisin.label
    }
  };
}

function toUnseong(
  unseongProfile?: BasisFeaturePerson['unseongProfile']
): SajuUnseongDisplay[] {
  if (!unseongProfile) {
    return [];
  }

  return unseongProfile.visible.map((entry) => ({
    pillarLabel: entry.pillarLabel,
    branch: entry.branch,
    stage: normalizeUnseongStage(entry.stage)
  }));
}

function toPersonDisplay(
  person?: BasisFeaturePerson
): SajuPersonDisplay | null {
  if (!person?.pillars || !person.dayMaster || !person.elementCount) {
    return null;
  }

  return {
    pillars: person.pillars,
    dayMaster: person.dayMaster,
    elementDistribution: toElementDistribution(person.elementCount),
    strongElement: person.strongElement,
    weakElement: person.weakElement,
    roles: toRoles(person.roleProfile),
    tenGods: toTenGods(person.tenGodProfile),
    balance: toBalance(person.balanceProfile),
    unseong: toUnseong(person.unseongProfile),
    birthTimeUnknown: person.birthTimeUnknown ?? false
  };
}

export function toFrontendMetadata(
  metadata: SajuInternalMetadata | null | undefined
): SajuFrontendMetadata | null {
  if (!metadata?.basisFeatures?.user) {
    return null;
  }

  const user = toPersonDisplay(metadata.basisFeatures.user);
  if (!user) {
    return null;
  }

  const partner = metadata.basisFeatures.partner
    ? toPersonDisplay(metadata.basisFeatures.partner)
    : null;

  return {
    user,
    partner: partner ?? undefined
  };
}
