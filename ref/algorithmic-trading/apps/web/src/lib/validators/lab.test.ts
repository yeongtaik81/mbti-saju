import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateStrategyParams } from './lab.js';
import type { ParamFieldDef } from '@trading/engine/strategy/lab';

const schema: ParamFieldDef[] = [
  {
    key: 'shortPeriod',
    label: '단기',
    type: 'number',
    min: 2,
    max: 100,
    step: 1,
    default: 5
  },
  {
    key: 'longPeriod',
    label: '장기',
    type: 'number',
    min: 5,
    max: 200,
    step: 1,
    default: 20
  },
  {
    key: 'threshold',
    label: '임계값',
    type: 'number',
    min: 0.0,
    max: 1.0,
    step: 0.01,
    default: 0.5
  }
];

describe('validateStrategyParams', () => {
  it('유효한 파라미터 → 에러 없음', () => {
    const errors = validateStrategyParams(
      { shortPeriod: 5, longPeriod: 20, threshold: 0.5 },
      schema
    );
    assert.deepStrictEqual(errors, []);
  });

  it('필수 키 누락 → 에러', () => {
    const errors = validateStrategyParams({ shortPeriod: 5 }, schema);
    assert.ok(errors.some((e) => e.includes('longPeriod')));
    assert.ok(errors.some((e) => e.includes('threshold')));
  });

  it('불필요한 키 → 에러', () => {
    const errors = validateStrategyParams(
      { shortPeriod: 5, longPeriod: 20, threshold: 0.5, unknown: 99 },
      schema
    );
    assert.ok(errors.some((e) => e.includes('unknown')));
  });

  it('최소값 미만 → 에러', () => {
    const errors = validateStrategyParams(
      { shortPeriod: 1, longPeriod: 20, threshold: 0.5 },
      schema
    );
    assert.ok(
      errors.some((e) => e.includes('shortPeriod') && e.includes('minimum'))
    );
  });

  it('최대값 초과 → 에러', () => {
    const errors = validateStrategyParams(
      { shortPeriod: 5, longPeriod: 201, threshold: 0.5 },
      schema
    );
    assert.ok(
      errors.some((e) => e.includes('longPeriod') && e.includes('maximum'))
    );
  });

  it('step=1인 필드에 소수 → 에러', () => {
    const errors = validateStrategyParams(
      { shortPeriod: 5.5, longPeriod: 20, threshold: 0.5 },
      schema
    );
    assert.ok(
      errors.some((e) => e.includes('shortPeriod') && e.includes('integer'))
    );
  });

  it('step이 소수인 필드에 소수 → 에러 없음', () => {
    const errors = validateStrategyParams(
      { shortPeriod: 5, longPeriod: 20, threshold: 0.33 },
      schema
    );
    assert.deepStrictEqual(errors, []);
  });

  it('빈 params + 빈 schema → 에러 없음', () => {
    const errors = validateStrategyParams({}, []);
    assert.deepStrictEqual(errors, []);
  });

  it('경계값(min, max) 정확히 → 에러 없음', () => {
    const errors = validateStrategyParams(
      { shortPeriod: 2, longPeriod: 200, threshold: 0.0 },
      schema
    );
    assert.deepStrictEqual(errors, []);
  });

  it('여러 에러 동시 발생', () => {
    const errors = validateStrategyParams(
      { shortPeriod: 0.5, extra: 1 },
      schema
    );
    // shortPeriod: below min + not integer, longPeriod: missing, threshold: missing, extra: unknown
    assert.ok(
      errors.length >= 4,
      `Expected at least 4 errors, got ${errors.length}: ${errors.join('; ')}`
    );
  });
});
