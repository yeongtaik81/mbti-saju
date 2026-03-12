export const ELEMENT_COLORS: Record<string, string> = {
  목: '#22c55e',
  화: '#ef4444',
  토: '#f59e0b',
  금: '#9ca3af',
  수: '#3b82f6'
};

const HEAVENLY_STEM_ELEMENTS: Record<string, string> = {
  갑: '목',
  을: '목',
  병: '화',
  정: '화',
  무: '토',
  기: '토',
  경: '금',
  신: '금',
  임: '수',
  계: '수'
};

const EARTHLY_BRANCH_ELEMENTS: Record<string, string> = {
  자: '수',
  축: '토',
  인: '목',
  묘: '목',
  진: '토',
  사: '화',
  오: '화',
  미: '토',
  신: '금',
  유: '금',
  술: '토',
  해: '수'
};

export function getElementColor(element: string): string {
  return ELEMENT_COLORS[element] ?? '#64748b';
}

export function getStemElement(stem: string): string | null {
  return HEAVENLY_STEM_ELEMENTS[stem] ?? null;
}

export function getBranchElement(branch: string): string | null {
  return EARTHLY_BRANCH_ELEMENTS[branch] ?? null;
}
