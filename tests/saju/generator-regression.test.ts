import { describe, expect, it } from 'vitest';
import { buildRuleBasedDraft } from '@/lib/saju/generator/draft';
import {
  createCompatibilityGenerationInput,
  createSelfGenerationInput
} from './fixtures';

function pickRegressionView(draft: ReturnType<typeof buildRuleBasedDraft>) {
  return {
    summary: draft.summary,
    storyTitle: draft.sectionsJson.storyTitle,
    overview: draft.sectionsJson.overview,
    coreSignal: draft.sectionsJson.coreSignal,
    sajuBasis: draft.sectionsJson.sajuBasis,
    subjectLens: draft.sectionsJson.subjectLens,
    narrativeFlow: draft.sectionsJson.narrativeFlow,
    tenYearFlow: draft.sectionsJson.tenYearFlow,
    currentDaewoon: draft.sectionsJson.currentDaewoon,
    yearlyFlow: draft.sectionsJson.yearlyFlow,
    wealthFlow: draft.sectionsJson.wealthFlow,
    relationshipFlow: draft.sectionsJson.relationshipFlow,
    pairDynamic: draft.sectionsJson.pairDynamic,
    attractionPoint: draft.sectionsJson.attractionPoint,
    conflictTrigger: draft.sectionsJson.conflictTrigger,
    communicationTip: draft.sectionsJson.communicationTip,
    timingHint: draft.sectionsJson.timingHint,
    caution: draft.sectionsJson.caution,
    actions: draft.sectionsJson.actions,
    reflectionQuestion: draft.sectionsJson.reflectionQuestion,
    sajuEvidence: draft.sectionsJson.sajuEvidence?.slice(0, 4),
    subjectArchetypes: draft.internalMetadata.subjectArchetypes
  };
}

describe('saju generator regression snapshots', () => {
  it('keeps the self basic narrative stable', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('BASIC'),
      'rule-only'
    );

    expect(pickRegressionView(draft)).toMatchSnapshot();
  });

  it('keeps the self wealth narrative stable', () => {
    const draft = buildRuleBasedDraft(
      createSelfGenerationInput('WEALTH'),
      'rule-only'
    );

    expect(pickRegressionView(draft)).toMatchSnapshot();
  });

  it('keeps the lover compatibility narrative stable', () => {
    const draft = buildRuleBasedDraft(
      createCompatibilityGenerationInput('LOVER'),
      'rule-only'
    );

    expect(pickRegressionView(draft)).toMatchSnapshot();
  });
});
