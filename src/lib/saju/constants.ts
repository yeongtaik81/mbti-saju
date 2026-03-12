export const SELF_SUBJECT_TYPES = [
  'BASIC',
  'LIFETIME_FLOW',
  'ROMANCE',
  'MARRIAGE',
  'CAREER',
  'WEALTH',
  'RELATIONSHIPS',
  'FAMILY',
  'YEAR_MONTH_DAY_FORTUNE',
  'DAEUN',
  'LUCK_UP'
] as const;

export const COMPATIBILITY_RELATION_TYPES = [
  'BASIC',
  'LOVER',
  'MARRIED',
  'CRUSH',
  'FRIEND',
  'COWORKER',
  'MANAGER_MEMBER',
  'BUSINESS_PARTNER'
] as const;

export type SelfSubjectType = (typeof SELF_SUBJECT_TYPES)[number];
export type CompatibilityRelationType =
  (typeof COMPATIBILITY_RELATION_TYPES)[number];

export const SELF_SUBJECT_LABEL: Record<SelfSubjectType, string> = {
  BASIC: '기본',
  LIFETIME_FLOW: '평생 총운',
  ROMANCE: '연애운',
  MARRIAGE: '결혼운/배우자운',
  CAREER: '직업운/적성',
  WEALTH: '재물운',
  RELATIONSHIPS: '인간관계운',
  FAMILY: '가족운',
  YEAR_MONTH_DAY_FORTUNE: '올해운/월운/오늘운',
  DAEUN: '대운해석',
  LUCK_UP: '개운법'
};

export const COMPATIBILITY_RELATION_LABEL: Record<
  CompatibilityRelationType,
  string
> = {
  BASIC: '기본',
  LOVER: '연인',
  MARRIED: '부부',
  CRUSH: '썸/짝사랑',
  FRIEND: '친구',
  COWORKER: '직장동료',
  MANAGER_MEMBER: '상사/부하',
  BUSINESS_PARTNER: '동업'
};

export const DEFAULT_BIRTH_PLACE = '대한민국';
