import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SessionStateMachine, SessionAction } from './session-state-machine.js';
import { SessionState } from '@trading/shared/types';

describe('SessionStateMachine', () => {
  it('starts with IDLE state', () => {
    const sm = new SessionStateMachine();
    assert.equal(sm.state, SessionState.IDLE);
  });

  it('follows full trading day cycle', () => {
    const sm = new SessionStateMachine();

    sm.transition(SessionState.PRE_MARKET);
    assert.equal(sm.state, SessionState.PRE_MARKET);

    sm.transition(SessionState.OPENING_AUCTION);
    assert.equal(sm.state, SessionState.OPENING_AUCTION);

    sm.transition(SessionState.TRADING);
    assert.equal(sm.state, SessionState.TRADING);

    sm.transition(SessionState.CLOSING);
    assert.equal(sm.state, SessionState.CLOSING);

    sm.transition(SessionState.CLOSING_AUCTION);
    assert.equal(sm.state, SessionState.CLOSING_AUCTION);

    sm.transition(SessionState.POST_MARKET);
    assert.equal(sm.state, SessionState.POST_MARKET);

    sm.transition(SessionState.IDLE);
    assert.equal(sm.state, SessionState.IDLE);
  });

  it('allows TRADING → PAUSED → TRADING', () => {
    const sm = new SessionStateMachine(SessionState.TRADING);
    sm.transition(SessionState.PAUSED);
    assert.equal(sm.state, SessionState.PAUSED);

    sm.transition(SessionState.TRADING);
    assert.equal(sm.state, SessionState.TRADING);
  });

  it('allows PAUSED → CLOSING', () => {
    const sm = new SessionStateMachine(SessionState.PAUSED);
    sm.transition(SessionState.CLOSING);
    assert.equal(sm.state, SessionState.CLOSING);
  });

  it('allows PRE_MARKET → IDLE (holiday abort)', () => {
    const sm = new SessionStateMachine(SessionState.PRE_MARKET);
    sm.transition(SessionState.IDLE);
    assert.equal(sm.state, SessionState.IDLE);
  });

  it('throws on invalid transition', () => {
    const sm = new SessionStateMachine();
    assert.throws(
      () => sm.transition(SessionState.TRADING),
      /Invalid session state transition: IDLE → TRADING/
    );
  });

  it('canBuy only in TRADING state', () => {
    const sm = new SessionStateMachine(SessionState.TRADING);
    assert.equal(sm.canBuy(), true);

    sm.transition(SessionState.PAUSED);
    assert.equal(sm.canBuy(), false);

    sm.transition(SessionState.CLOSING);
    assert.equal(sm.canBuy(), false);
  });

  it('canSell in TRADING, PAUSED, CLOSING', () => {
    const trading = new SessionStateMachine(SessionState.TRADING);
    assert.equal(trading.canSell(), true);

    const paused = new SessionStateMachine(SessionState.PAUSED);
    assert.equal(paused.canSell(), true);

    const closing = new SessionStateMachine(SessionState.CLOSING);
    assert.equal(closing.canSell(), true);

    const idle = new SessionStateMachine(SessionState.IDLE);
    assert.equal(idle.canSell(), false);
  });

  it('isActionAllowed checks per-state actions', () => {
    const sm = new SessionStateMachine(SessionState.PRE_MARKET);
    assert.equal(sm.isActionAllowed(SessionAction.SCREENING), true);
    assert.equal(sm.isActionAllowed(SessionAction.BUY), false);

    sm.transition(SessionState.OPENING_AUCTION);
    assert.equal(sm.isActionAllowed(SessionAction.SCREENING), false);
    assert.equal(sm.isActionAllowed(SessionAction.WAIT_OPEN), true);
  });

  it('allowedTransitions returns valid next states for each state', () => {
    const idle = new SessionStateMachine(SessionState.IDLE);
    assert.deepEqual(idle.allowedTransitions(), [SessionState.PRE_MARKET]);

    const trading = new SessionStateMachine(SessionState.TRADING);
    assert.deepEqual(trading.allowedTransitions(), [
      SessionState.PAUSED,
      SessionState.CLOSING
    ]);

    const postMarket = new SessionStateMachine(SessionState.POST_MARKET);
    assert.deepEqual(postMarket.allowedTransitions(), [SessionState.IDLE]);
  });

  it('calls onTransition callback on state change', () => {
    const transitions: [string, string][] = [];
    const sm = new SessionStateMachine(SessionState.IDLE, (from, to) => {
      transitions.push([from, to]);
    });

    sm.transition(SessionState.PRE_MARKET);
    assert.deepEqual(transitions, [
      [SessionState.IDLE, SessionState.PRE_MARKET]
    ]);
  });
});
