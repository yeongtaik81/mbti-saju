import { describe, expect, it } from 'vitest';
import {
  getScenarioCategories,
  getScenarioFallbackSummary,
  getScenarioLoadingMeta,
  getScenarioResultTitle
} from '@/lib/saju/scenarios';

describe('scenario registry', () => {
  it('returns category descriptions for self scenarios', () => {
    const categories = getScenarioCategories('SELF');
    const loveCategory = categories.find(
      (category) => category.code === 'SELF_LOVE'
    );

    expect(loveCategory?.description).toContain('다시 이어질 여지');
    expect(loveCategory?.options.length).toBeGreaterThan(0);
  });

  it('returns a custom loading meta for left-on-read readings', () => {
    const loading = getScenarioLoadingMeta('COMPAT_ROMANCE_LEFT_ON_READ');

    expect(loading?.icon).toBe('clock');
    expect(loading?.motion).toBe('drift');
    expect(loading?.illustration).toBe('romance-left-on-read');
    expect(loading?.title).toContain('답이 늦어진 관계');
    expect(loading?.messages[0]).toContain('침묵');
  });

  it('returns romance illustration metadata for compatibility romance scenarios', () => {
    expect(
      getScenarioLoadingMeta('COMPAT_ROMANCE_BLIND_DATE')?.illustration
    ).toBe('romance-blind-date');
    expect(
      getScenarioLoadingMeta('COMPAT_ROMANCE_FRIEND_TO_LOVER')?.illustration
    ).toBe('romance-friends-to-lovers');
  });

  it('falls back to category loading meta for generic best-friend readings', () => {
    const loading = getScenarioLoadingMeta('COMPAT_FRIEND_BEST');

    expect(loading?.theme).toBe('friend');
    expect(loading?.motion).toBe('gentle');
    expect(loading?.title).toContain('편안함과 거리감');
    expect(loading?.messages.length).toBeGreaterThanOrEqual(3);
  });

  it('returns scenario-based fallback summaries', () => {
    expect(getScenarioFallbackSummary('SELF', 'SELF_WEALTH_LEAK')).toContain(
      '모르는 사이 빠져나가는 돈의 패턴'
    );
    expect(
      getScenarioFallbackSummary('COMPATIBILITY', 'COMPAT_WORK_BOSS')
    ).toContain('지시와 보고의 결이 잘 맞는지');
  });

  it('returns readable result titles when summary is missing', () => {
    expect(getScenarioResultTitle('SELF', 'SELF_CAREER_JOB_CHANGE')).toBe(
      '이직 타이밍 풀이'
    );
    expect(
      getScenarioResultTitle('COMPATIBILITY', 'COMPAT_ROMANCE_LEFT_ON_READ')
    ).toBe('읽씹하는 그 사람 궁합');
  });
});
