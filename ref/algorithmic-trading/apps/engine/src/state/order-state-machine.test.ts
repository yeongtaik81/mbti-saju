import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OrderStateMachine } from './order-state-machine.js';
import { OrderStatus } from '@trading/shared/types';

describe('OrderStateMachine', () => {
  it('starts with CREATED status', () => {
    const sm = new OrderStateMachine();
    assert.equal(sm.status, OrderStatus.CREATED);
  });

  it('transitions CREATED → SUBMITTED → PENDING → FILLED', () => {
    const sm = new OrderStateMachine();
    sm.transition(OrderStatus.SUBMITTED);
    assert.equal(sm.status, OrderStatus.SUBMITTED);

    sm.transition(OrderStatus.PENDING);
    assert.equal(sm.status, OrderStatus.PENDING);

    sm.transition(OrderStatus.FILLED);
    assert.equal(sm.status, OrderStatus.FILLED);
    assert.equal(sm.isTerminal, true);
  });

  it('transitions PENDING → PARTIAL_FILLED → FILLED', () => {
    const sm = new OrderStateMachine(OrderStatus.PENDING);
    sm.transition(OrderStatus.PARTIAL_FILLED);
    assert.equal(sm.status, OrderStatus.PARTIAL_FILLED);

    sm.transition(OrderStatus.FILLED);
    assert.equal(sm.status, OrderStatus.FILLED);
    assert.equal(sm.isTerminal, true);
  });

  it('transitions PENDING → CANCEL_REQUESTED → CANCELLED', () => {
    const sm = new OrderStateMachine(OrderStatus.PENDING);
    sm.transition(OrderStatus.CANCEL_REQUESTED);
    sm.transition(OrderStatus.CANCELLED);
    assert.equal(sm.status, OrderStatus.CANCELLED);
    assert.equal(sm.isTerminal, true);
  });

  it('transitions SUBMITTED → REJECTED', () => {
    const sm = new OrderStateMachine(OrderStatus.SUBMITTED);
    sm.transition(OrderStatus.REJECTED);
    assert.equal(sm.status, OrderStatus.REJECTED);
    assert.equal(sm.isTerminal, true);
  });

  it('allows CANCEL_REQUESTED → FILLED (race condition)', () => {
    const sm = new OrderStateMachine(OrderStatus.CANCEL_REQUESTED);
    sm.transition(OrderStatus.FILLED);
    assert.equal(sm.status, OrderStatus.FILLED);
  });

  it('throws on invalid transition', () => {
    const sm = new OrderStateMachine();
    assert.throws(
      () => sm.transition(OrderStatus.FILLED),
      /Invalid order state transition: CREATED → FILLED/
    );
  });

  it('throws on transition from terminal state', () => {
    const sm = new OrderStateMachine(OrderStatus.FILLED);
    assert.throws(
      () => sm.transition(OrderStatus.CANCELLED),
      /Invalid order state transition/
    );
  });

  it('canTransition returns correct boolean', () => {
    const sm = new OrderStateMachine();
    assert.equal(sm.canTransition(OrderStatus.SUBMITTED), true);
    assert.equal(sm.canTransition(OrderStatus.FILLED), false);
  });

  it('allowedTransitions returns valid next states', () => {
    const sm = new OrderStateMachine(OrderStatus.PENDING);
    const allowed = sm.allowedTransitions();
    assert.deepEqual(allowed, [
      OrderStatus.FILLED,
      OrderStatus.PARTIAL_FILLED,
      OrderStatus.REJECTED,
      OrderStatus.CANCEL_REQUESTED
    ]);
  });

  it('transitions PARTIAL_FILLED → CANCEL_REQUESTED → CANCELLED', () => {
    const sm = new OrderStateMachine(OrderStatus.PARTIAL_FILLED);
    sm.transition(OrderStatus.CANCEL_REQUESTED);
    assert.equal(sm.status, OrderStatus.CANCEL_REQUESTED);

    sm.transition(OrderStatus.CANCELLED);
    assert.equal(sm.status, OrderStatus.CANCELLED);
    assert.equal(sm.isTerminal, true);
  });

  it('calls onTransition callback on state change', () => {
    const transitions: [string, string][] = [];
    const sm = new OrderStateMachine(OrderStatus.CREATED, (from, to) => {
      transitions.push([from, to]);
    });

    sm.transition(OrderStatus.SUBMITTED);
    sm.transition(OrderStatus.PENDING);

    assert.deepEqual(transitions, [
      [OrderStatus.CREATED, OrderStatus.SUBMITTED],
      [OrderStatus.SUBMITTED, OrderStatus.PENDING]
    ]);
  });
});
