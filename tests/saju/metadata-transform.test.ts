import { describe, expect, it } from 'vitest';
import { buildRuleBasedDraft } from '@/lib/saju/generator/draft';
import { toFrontendMetadata } from '@/lib/saju/generator/metadata-transform';
import {
  createCompatibilityGenerationInput,
  createSelfGenerationInput
} from './fixtures';

describe('saju metadata transform', () => {
  it('transforms structured self metadata for frontend rendering', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH'),
      'rule-only'
    );

    const result = toFrontendMetadata(draft.internalMetadata);

    expect(result).not.toBeNull();
    expect(result?.user.pillars.yearString).toBeTruthy();
    expect(result?.user.dayMaster.element).toBeTruthy();
    expect(result?.user.elementDistribution).toHaveLength(5);
    expect(result?.user.roles.length).toBeGreaterThan(0);
    expect(result?.partner).toBeUndefined();
  });

  it('transforms partner metadata when compatibility data exists', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput('LOVER'),
      'rule-only'
    );

    const result = toFrontendMetadata(draft.internalMetadata);

    expect(result?.partner).toBeDefined();
    expect(result?.partner?.tenGods.length).toBeGreaterThan(0);
    expect(result?.partner?.unseong.length).toBeGreaterThan(0);
  });

  it('returns null for older metadata missing required structured fields', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('BASIC'),
      'rule-only'
    );

    const legacyMetadata = {
      ...draft.internalMetadata,
      basisFeatures: {
        ...draft.internalMetadata.basisFeatures,
        user: {
          ...draft.internalMetadata.basisFeatures.user,
          pillars: undefined,
          dayMaster: undefined,
          elementCount: undefined
        }
      }
    };

    expect(toFrontendMetadata(legacyMetadata)).toBeNull();
  });
});
