import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, EngineEventType } from './event-bus.js';
import type { EngineEvent } from './event-bus.js';

function makeEvent(
  type: EngineEvent['type'],
  data: Record<string, unknown> = {}
): EngineEvent {
  return { type, timestamp: new Date().toISOString(), data };
}

describe('EventBus', () => {
  it('이벤트 타입별 구독이 동작한다', () => {
    const bus = new EventBus();
    const received: EngineEvent[] = [];

    bus.subscribe(EngineEventType.ORDER_CREATED, (event) =>
      received.push(event)
    );

    bus.publish(makeEvent(EngineEventType.ORDER_CREATED, { orderId: 'O1' }));
    bus.publish(makeEvent(EngineEventType.ORDER_FILLED, { orderId: 'O2' }));

    assert.equal(received.length, 1);
    assert.equal(received[0]!.data.orderId, 'O1');
  });

  it('와일드카드 구독으로 전체 이벤트를 수신한다', () => {
    const bus = new EventBus();
    const received: EngineEvent[] = [];

    bus.subscribe('*', (event) => received.push(event));

    bus.publish(makeEvent(EngineEventType.ORDER_CREATED));
    bus.publish(makeEvent(EngineEventType.RISK_APPROVED));
    bus.publish(makeEvent(EngineEventType.SIGNAL_BUY));

    assert.equal(received.length, 3);
  });

  it('구독 해제 후 이벤트를 수신하지 않는다', () => {
    const bus = new EventBus();
    const received: EngineEvent[] = [];

    const handler = (event: EngineEvent) => received.push(event);
    bus.subscribe(EngineEventType.ORDER_CREATED, handler);

    bus.publish(makeEvent(EngineEventType.ORDER_CREATED));
    assert.equal(received.length, 1);

    bus.unsubscribe(EngineEventType.ORDER_CREATED, handler);
    bus.publish(makeEvent(EngineEventType.ORDER_CREATED));
    assert.equal(received.length, 1);
  });

  it('다수 구독자에게 이벤트를 전달한다', () => {
    const bus = new EventBus();
    let count1 = 0;
    let count2 = 0;

    bus.subscribe(EngineEventType.ORDER_FILLED, () => {
      count1++;
    });
    bus.subscribe(EngineEventType.ORDER_FILLED, () => {
      count2++;
    });

    bus.publish(makeEvent(EngineEventType.ORDER_FILLED));

    assert.equal(count1, 1);
    assert.equal(count2, 1);
  });
});
