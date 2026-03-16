# MBTI Saju Session Handoff

Last updated: 2026-03-13 (KST)

## Current baseline

- Repo: `/Users/lambda256/git/mbti-saju`
- Recent committed baseline:
  - `a3db4e6 feat: build mbti saju service`
- Working tree is intentionally dirty.
- Main changed areas are:
  - theme/page styling
  - loading visuals/artwork
  - saju generator/content differentiation
  - reading detail rendering
  - related tests/snapshots

## What is already done

### Theme / UI

- Runtime user themes are reduced to:
  - `기본`
  - `봄결`
- `먹물`, `한지` are removed from runtime selection.
- Admin routes are forced to `default` theme through `ThemeStyleProvider`.
- Theme switcher is hidden on `/admin*`.
- `기본` theme premium/trust refinement is done enough to use as main reading theme.
- `봄결` page-intensity rebalance is already applied:
  - strong: home / auth / loading
  - medium: dashboard / onboarding
  - subtle: bok / reading detail
- Loading artwork wiring is done:
  - `public/loading/self-basic-reading.png`
  - `public/loading/self-lifetime-flow.png`
- User-facing copy cleanup is applied on main user surfaces:
  - dashboard labels now use user wording like `무엇을 볼까요?`, `궁금한 주제`, `어떤 관계가 궁금한가요?`
  - reading detail default section labels are simplified to user-facing titles like `먼저 읽을 결론`, `타고난 기질`, `이 해석의 근거`
  - dashboard top subtitle and recent-card hint copy were flattened further
  - recent-card preview now strips old quoted/prefixed legacy summaries like `기본: ...` on screen
  - focused self recent-card preview now skips the old MBTI lead sentence when possible and shows the question-specific sentence first
  - reading detail intro card now uses the scenario title as the heading and shows saved summary as body text
  - mobile density pass is now applied on dashboard top / recent cards / reading detail top stack / reading paper spacing
  - dashboard scenario categories now open as an accordion instead of expanding all groups by default
  - dashboard recent readings now show the newest 8 first, with an explicit expand toggle for older items
  - selected dashboard CTA now changes to `복 충전 후 해석하기` when balance is empty
  - dashboard / onboarding / reading detail initial loads now use inline page loading cards instead of full-screen blocking overlays
  - reading detail now has a quick-jump chip row (`결론`, `핵심`, `기질`, `근거`, `관계`, `돈/일`, `타이밍`, `실천`)
  - theme switcher now exposes an explicit aria label like `테마 선택, 현재 기본`
  - legacy stored summaries were cleared from DB (`SajuReadingResult.summary`, cached `resultJson.summary`), so old cards now fall back to scenario description copy instead of historical summary prose
  - fallback summary grammar was fixed so compatibility labels like `부부` render as `부부를 중심으로 ...` instead of broken 조사

### Reading content overhaul

- Focused self readings are no longer generated as near-copies of `기본 해석`.
- Compatibility readings are also split by scenario instead of broad category reuse.
- Compatibility now has a neutral default entry:
  - `COMPAT_BASIC`
  - label: `기본 궁합`
  - compatibility default selection and legacy `BASIC` mapping now point here instead of `썸타는 사이`
- Compatibility romance list now includes baseline relationship states too:
  - `연인`
  - `결혼 상대`
  - `부부`
- Legacy compatibility mapping was corrected:
  - `LOVER -> COMPAT_ROMANCE_LOVER`
  - `MARRIED -> COMPAT_ROMANCE_MARRIED`
- Added per-scenario profile layers:
  - `src/lib/saju/generator/self-scenario-profiles.ts`
  - `src/lib/saju/generator/compatibility-scenario-profiles.ts`
- Generator now differentiates by `scenarioCode` for:
  - `summary`
  - `overview`
  - `narrativeFlow`
  - `subjectLens`
  - `relationshipFlow`
  - `wealthFlow`
  - `coreSignal`
  - `timingHint`
  - `caution`
  - `actions`
  - `reflectionQuestion`
  - `sajuEvidence`
- Latest pass also changed focused self `summary` lead order so recent-reading cards do not open with the same MBTI-style line:
  - focused self summaries now start with the selected 고민's judgment axis first
  - focused self `summary` / `overview` no longer front-load the generic MBTI lead sentence
  - scenario-coded compatibility `summary` / `overview` also now open with the relationship question itself instead of the shared MBTI frame
- Latest editorial tuning pass also split focused self `overview` / `narrativeFlow` second-paragraph anchors and closers by scenario:
  - `재회 가능성`, `다시 연락 올까`, `고백 타이밍`
  - `적성`, `이직 타이밍`
  - `돈이 모이는 흐름`, `돈이 새는 이유`
  - `손절 타이밍`, `부모와의 관계`
  - these no longer end on the same generic closing sentence
- Focused self and compatibility validation bars were raised in:
  - `src/lib/saju/generator/validate.ts`
- LLM prompt rules were tightened in:
  - `src/lib/saju/generator/llm.ts`
- Latest content pass also reduced summary/detail duplication and widened `부부` compatibility:
  - focused self top `summary` now acts as a short judgment line instead of repeating the full `overview`
  - `돈이 새는 이유` and other focused self topics now open with the question-specific decision frame instead of the shared constitution explanation
  - `부부` compatibility now includes affection temperature / recovery style / rest-time language, not just living-rhythm / role / money framing
  - `COMPAT_ROMANCE_MARRIED` scenario override copy was updated to remove planner-ish phrases like `기준 문장`
- Actual LLM output path was corrected too, not just the rule draft:
  - `src/lib/saju/generator/llm.ts` no longer instructs focused self / non-basic compatibility `summary` and `overview` to always open with an MBTI sentence
  - `src/lib/saju/generator/validate.ts` no longer force-prepends MBTI openings to focused self / non-basic compatibility `summary` and `overview`
  - focused scenarios now fail validation if `summary` or `overview` still open with MBTI labels / `성향` / `기질`
  - focused scenarios now also fail validation if `summary` and `overview` start with the same opening claim
  - compatibility MBTI lead strings now use proper Korean particles for names, fixing outputs like `관리자은`

### Reading detail page

- Focused self section order is expanded to basic-reading density.
- Compatibility detail order/title overrides are expanded.
- Compatibility detail pages now expose the trust/explanation layers too:
  - `overview`
  - `sajuBasis`
  - `sajuEvidence`
  - `coreSignal`
- Scenario-specific detail titles are wired through:
  - `src/app/saju/readings/[readingId]/page.tsx`
- Important recent fix:
  - focused self detail pages now actually render
    - `overview`
    - `sajuBasis`
    - `sajuEvidence`
  - these were previously hidden by `!showFocusedSelfLayout`

## Latest verification

### Static checks

Passed after the latest code changes:

- `pnpm -s lint`
- `pnpm -s typecheck`
- `pnpm exec vitest run tests/saju/draft.test.ts`
- `pnpm exec vitest run tests/saju/generator-regression.test.ts tests/saju/validate.test.ts -u`
- `pnpm exec vitest run tests/saju/draft.test.ts tests/saju/validate.test.ts`
- `pnpm exec vitest run tests/saju/scenarios.test.ts tests/saju/draft.test.ts tests/saju/validate.test.ts`
- `pnpm exec vitest run tests/saju/draft.test.ts tests/saju/generator-regression.test.ts -u`
- latest editorial tuning pass also re-passed:
  - `pnpm exec vitest run tests/saju/draft.test.ts tests/saju/generator-regression.test.ts -u`
  - `pnpm -s typecheck`
  - `pnpm -s lint`
- saju regression/unit tests had already been passing earlier in this workstream:
  - `tests/saju/draft.test.ts`
  - `tests/saju/validate.test.ts`
  - `tests/saju/generator-regression.test.ts`

### Browser QA completed on 2026-03-13

Using the local app on `http://127.0.0.1:4000`:

- Dashboard session was valid for user `변영택`
- Focused self detail rendering was checked with actual generated samples
- Latest IA/copy pass was also checked in browser:
  - dashboard shows `무엇을 볼까요?`, `궁금한 주제`, `어떤 관계가 궁금한가요?`
  - compatibility tab now opens on `기본 궁합`
  - category order starts with `기본 궁합`, then `연애/결혼`, `친구`, `일/직장`, `가족`, `팬심`
  - compatibility detail top now shows user-facing headings like `풀이 보기`, `먼저 읽을 결론`, `타고난 기질`, `이 해석의 근거`
  - mobile dashboard top stack and reading detail top stack were rechecked after the density pass
  - focused self recent cards now show the subject-specific sentence first when old summaries start with a generic MBTI sentence
  - dashboard now opens with only the selected category expanded in both self and compatibility mode
  - dashboard / onboarding / reading detail initial loads now render as inline cards rather than full-screen overlays
  - reading detail quick-jump chips were verified to render and move to the correct anchor
  - theme switcher button is now exposed in the accessibility tree as `테마 선택, 현재 기본`

Verified samples:

- `SELF_LOVE_RECONCILIATION`
  - route: `/saju/readings/cmmns3pxu0005g2ylzgxasjgj`
  - confirmed visible:
    - `재회 질문에서 먼저 읽을 결`
    - `재회에 깔린 사주 바탕`
    - `재회를 읽는 사주 근거`
- `SELF_WEALTH_LEAK`
  - older route: `/saju/readings/cmmns8glo0007g2yl3mwxpdc1`
  - confirmed visible:
    - `돈 누수 질문에서 먼저 읽을 결`
    - `새는 돈에 깔린 사주 바탕`
    - `돈이 새는 패턴을 읽는 사주 근거`
- Latest real regenerated QA after the LLM-path fix:
  - `SELF_WEALTH_LEAK`
    - route: `/saju/readings/cmmp068r8000tg2t2pbnvgwtt`
    - actual summary now opens with the money-leak judgment itself, not MBTI
    - actual `overview` now opens with `돈이 새는 이유를 묻는 지금 질문에서는...`
  - `SELF_LOVE_CONTACT_RETURN`
    - route: `/saju/readings/cmmp09pnq000zg2t2alp7v98d`
    - actual summary now opens with `연락이 오느냐`보다 `연락이 온 뒤에도 내가 흔들리지 않느냐`
    - actual `overview` now opens with the contact-return judgment itself and keeps MBTI as a later nuance
  - `COMPAT_ROMANCE_MARRIED`
    - route: `/saju/readings/cmmp0is7f0015g2t22q7hwz1q`
    - actual summary now opens with the marriage-life judgment itself, not MBTI
    - actual `overview` now opens with `부부 사이에서는 감정보다 먼저 일상 리듬이 맞는지가...`
    - actual compatibility MBTI lines now use correct particles (`관리자는`, `변영택은`) instead of broken forms
  - `SELF_CAREER_JOB_CHANGE`
    - route: `/saju/readings/cmmp5np2i001fg2t2ov88sxr8`
    - actual summary/overview now open with the move decision itself and keep MBTI behind the decision point
  - `COMPAT_WORK_BUSINESS_PARTNER`
    - route: `/saju/readings/cmmp5o26f001hg2t29zxz6tvi`
    - old real sample proved summary/overview quality, but deeper sections still showed `MBTI로 보면 ...` leads before the later compatibility lead-order fix
  - `COMPAT_WORK_BOSS`
    - route: `/saju/readings/cmmp61yke001pg2t2t2n32fwo`
    - actual summary/overview open with reporting fit and expectation language, not MBTI
    - actual `narrativeFlow` / `relationshipFlow` / `timingHint` / `caution` also now open with work-situation judgment first, confirming the compatibility deep-section lead-order fix
  - `COMPAT_BASIC`
    - old cache-backed sample route: `/saju/readings/cmmp606he001ng2t2ac58kdnm`
    - this old sample showed that `COMPAT_BASIC` was still exempt from the MBTI-first summary/overview rule and could be replayed from `SajuResultCache`
    - follow-up fix was applied so `COMPAT_BASIC` now uses the same question-first summary/overview rule as other compatibility readings
    - cache + old reading were explicitly purged before re-test
    - fresh regenerated route: `/saju/readings/cmmp68hpu001vg2t22arl5031`
    - fresh actual summary now opens with `기본 궁합으로 보면 두 분은...`
    - fresh actual `overview` now opens with `기본 궁합의 핵심은...` and no longer starts with MBTI
  - generic self lead-order follow-up
    - earlier stale samples showed `SELF_LIFETIME_FLOW`, `SELF_DAEUN`, `SELF_YEARLY_FORTUNE`, `SELF_LUCK_UP` could still open summary/overview/narrative/timing/caution with MBTI-first prose
    - follow-up fix expanded the non-MBTI opening rule from focused self only to all self scenarios except `SELF_BASIC`
    - finalizer fallback was also expanded so non-basic self sections fall back to draft when LLM reintroduces MBTI-first openings in `summary`, `overview`, `narrativeFlow`, `timingHint`, `caution` and self-only `relationshipFlow` / `wealthFlow`
    - fresh regenerated QA confirmed the fix:
      - `SELF_LIFETIME_FLOW`
        - route: `/saju/readings/cmmp7f91q002dg2t2sm75vyno`
        - fresh actual summary now opens with `평생 총운은...`
        - fresh actual `overview` / `narrativeFlow` / `timingHint` / `caution` no longer start with MBTI
      - `SELF_DAEUN`
        - route: `/saju/readings/cmmp7gkcj002hg2t23e1bbe2d`
        - fresh actual summary now opens with `현재 대운 질문의 핵심은...`
        - fresh actual `overview` / `narrativeFlow` / `timingHint` / `caution` no longer start with MBTI
      - `SELF_YEARLY_FORTUNE`
        - old cache-backed sample route: `/saju/readings/cmmp771zu0023g2t29wffzect`
        - fresh regenerated route after cache purge: `/saju/readings/cmmp7jvj4002ng2t2ghwacba6`
        - fresh actual summary now opens with `올해 운은...`
      - `SELF_LOVE_GENERAL`
        - route: `/saju/readings/cmmp7c5t50029g2t2a6p9uz2w`
      - `SELF_CAREER_GENERAL`
        - route: `/saju/readings/cmmp7hbfo002jg2t2pwjnk2a3`
      - `SELF_CAREER_APTITUDE`
        - route: `/saju/readings/cmmp7iox4002lg2t2thyfg8td`
      - `SELF_WEALTH_GENERAL`
        - route: `/saju/readings/cmmp7kdw3002pg2t2xyfbn0c1`
      - `SELF_WEALTH_ACCUMULATION`
        - route: `/saju/readings/cmmp7lr1j002rg2t2t20eohzb`
      - `SELF_RELATIONSHIP_GENERAL`
        - route: `/saju/readings/cmmp7neux002tg2t2cqu1ae2d`
      - `SELF_RELATIONSHIP_CUT_OFF`
        - route: `/saju/readings/cmmp7oxwc002xg2t22y6cgeab`
    - `SELF_LUCK_UP` old cache-backed sample route: `/saju/readings/cmmp7a27s0027g2t2zys95ve6`
    - its cache was purged, but fresh regeneration QA did not complete in this pass because the test wallet was consumed mid-run; this one remains the notable self-side fresh-QA gap

Conclusion:

- Focused self pages now show the intended extra density in real browser rendering.
- Scenario-specific headings are visibly different on the actual detail page.
- Compatibility actual-generation QA now also confirms the newer deep-section lead-order fix and the `COMPAT_BASIC` cache/exception cleanup.
- Non-basic self actual-generation QA now also confirms the expanded non-MBTI opening rule on generic/timeflow/career/wealth/relationship scenarios, with `SELF_LUCK_UP` as the remaining fresh-QA gap from this pass.

## Current working tree notes

Do not revert unrelated edits.

Current modified/untracked files include:

- `src/app/(auth)/sign-up/page.tsx`
- `src/app/bok/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`
- `src/app/mbti/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/page.tsx`
- `src/app/saju/readings/[readingId]/page.tsx`
- `src/components/loading/LoadingOverlay.tsx`
- `src/components/loading/SajuLoadingVisual.tsx`
- `src/components/theme/ThemeStyleProvider.tsx`
- `src/components/theme/ThemeStyleSwitcher.tsx`
- `src/lib/saju/generator/draft.ts`
- `src/lib/saju/generator/llm.ts`
- `src/lib/saju/generator/scenario-overrides.ts`
- `src/lib/saju/generator/validate.ts`
- `src/lib/saju/scenarios.ts`
- `tests/saju/__snapshots__/generator-regression.test.ts.snap`
- `tests/saju/draft.test.ts`
- `tests/saju/generator-regression.test.ts`
- `tests/saju/validate.test.ts`
- `public/loading/`
- `src/lib/saju/generator/compatibility-scenario-profiles.ts`
- `src/lib/saju/generator/self-scenario-profiles.ts`
- `SESSION_HANDOFF.md`

## What is left

No blocking product fixes are currently open in this workstream.

Optional follow-ups only:

### 1. Additional browser QA

- open a few newly generated focused self results back-to-back
- sanity check dashboard recent cards against the newly generated summaries
- verify the copy still feels distinct in real browser reading, not just tests

### 2. Future editorial passes

- if more variation is wanted later, the next sections to tune are:
  - `subjectLens`
  - `relationshipFlow`
  - `wealthFlow`
- current `overview` / `narrativeFlow` sibling overlap has already been reduced in the latest pass

### 3. Handoff upkeep

- keep this file in sync with actual progress

## Recommended next action

If continuing immediately, the most useful next step is:

`브라우저에서 새로 생성한 focused self 결과 몇 개를 다시 열어 보고, 아직도 비슷하게 읽히는 섹션이 있으면 subjectLens / relationshipFlow / wealthFlow 쪽만 추가 튜닝해줘.`
