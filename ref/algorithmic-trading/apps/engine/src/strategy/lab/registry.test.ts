import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getStrategy, getAllStrategies } from './registry.js';
import { STRATEGY_TYPE } from './types.js';

describe('Lab Registry', () => {
  it('등록된 전략 수 = 7', () => {
    const all = getAllStrategies();
    assert.strictEqual(all.length, 7);
  });

  it('모든 전략 타입 조회 가능', () => {
    for (const type of Object.values(STRATEGY_TYPE)) {
      const s = getStrategy(type);
      assert.ok(s, `Strategy ${type} should be registered`);
      assert.strictEqual(s!.type, type);
    }
  });

  it('미등록 전략은 undefined', () => {
    const s = getStrategy('non_existent' as any);
    assert.strictEqual(s, undefined);
  });

  it('각 전략에 paramSchema가 있음', () => {
    for (const s of getAllStrategies()) {
      assert.ok(
        Array.isArray(s.paramSchema),
        `${s.type} should have paramSchema`
      );
    }
  });

  it('비벤치마크 전략은 paramSchema가 비어있지 않음', () => {
    const benchmarks: Set<string> = new Set([
      STRATEGY_TYPE.BUY_AND_HOLD,
      STRATEGY_TYPE.EQUAL_WEIGHT
    ]);
    for (const s of getAllStrategies()) {
      if (benchmarks.has(s.type)) continue;
      assert.ok(
        s.paramSchema.length > 0,
        `${s.type} paramSchema should not be empty`
      );
    }
  });

  it('paramSchema에 key, label, default 필수', () => {
    for (const s of getAllStrategies()) {
      for (const field of s.paramSchema) {
        assert.ok(field.key, `${s.type}: field should have key`);
        assert.ok(field.label, `${s.type}: field should have label`);
        assert.ok(
          typeof field.default === 'number',
          `${s.type}.${field.key}: default should be number`
        );
      }
    }
  });

  it('모든 전략에 minLookback이 있고 0 이상 반환', () => {
    const benchmarks: Set<string> = new Set([
      STRATEGY_TYPE.BUY_AND_HOLD,
      STRATEGY_TYPE.EQUAL_WEIGHT
    ]);
    for (const s of getAllStrategies()) {
      assert.strictEqual(
        typeof s.minLookback,
        'function',
        `${s.type} should have minLookback()`
      );
      const defaults = Object.fromEntries(
        s.paramSchema.map((f) => [f.key, f.default])
      );
      const lookback = s.minLookback(defaults);
      assert.ok(
        lookback >= 0,
        `${s.type} minLookback should be non-negative, got ${lookback}`
      );
      if (!benchmarks.has(s.type)) {
        assert.ok(
          lookback > 0,
          `${s.type} minLookback should be positive, got ${lookback}`
        );
      }
    }
  });
});
