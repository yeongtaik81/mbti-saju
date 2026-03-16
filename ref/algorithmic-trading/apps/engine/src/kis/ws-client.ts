import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { KisWsError } from './errors.js';
import { parseRealtimeTick, type KisRealtimeTick } from './types.js';

/** WebSocket 이벤트 */
export interface KisWsEvents {
  tick: [KisRealtimeTick];
  connected: [];
  disconnected: [];
  error: [Error];
}

/** 구독 상한 */
const MAX_SUBSCRIPTIONS = 40;

/** 재연결 최대 시도 */
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * KIS WebSocket 실시간 시세 클라이언트
 * - ws://만 지원 (KIS 사양)
 * - H0STCNT0 체결 데이터 구독
 * - PINGPONG keepalive
 * - 자동 재연결 (지수 백오프)
 */
export class KisWsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly wsUrl: string;
  private approvalKey: string;
  private readonly subscriptions = new Set<string>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(wsUrl: string, approvalKey: string) {
    super();
    this.wsUrl = wsUrl;
    this.approvalKey = approvalKey;
  }

  /** WebSocket 연결 */
  connect(): void {
    if (this.destroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
      // 기존 구독 복원
      for (const code of this.subscriptions) {
        this.sendSubscribe(code, '1');
      }
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      const msg = data.toString();
      this.handleMessage(msg);
    });

    this.ws.on('close', () => {
      this.emit('disconnected');
      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', new KisWsError(err.message));
    });
  }

  /** 종목 구독 추가 */
  subscribe(stockCode: string): void {
    if (
      this.subscriptions.size >= MAX_SUBSCRIPTIONS &&
      !this.subscriptions.has(stockCode)
    ) {
      throw new KisWsError(`Max subscriptions (${MAX_SUBSCRIPTIONS}) exceeded`);
    }
    this.subscriptions.add(stockCode);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(stockCode, '1');
    }
  }

  /** 종목 구독 해제 */
  unsubscribe(stockCode: string): void {
    this.subscriptions.delete(stockCode);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(stockCode, '2');
    }
  }

  /** diff 기반 구독 교체 */
  replaceSubscriptions(newCodes: string[]): void {
    const newSet = new Set(newCodes.slice(0, MAX_SUBSCRIPTIONS));
    const toRemove = [...this.subscriptions].filter((c) => !newSet.has(c));
    const toAdd = [...newSet].filter((c) => !this.subscriptions.has(c));

    for (const code of toRemove) {
      this.unsubscribe(code);
    }
    for (const code of toAdd) {
      this.subscribe(code);
    }
  }

  /** 현재 구독 목록 */
  getSubscriptions(): string[] {
    return [...this.subscriptions];
  }

  /** 연결 해제 */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** 완전 정리 */
  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.disconnect();
    this.subscriptions.clear();
    this.removeAllListeners();
  }

  /** approval key 업데이트 */
  updateApprovalKey(key: string): void {
    this.approvalKey = key;
  }

  /** 메시지 처리 */
  private handleMessage(msg: string): void {
    // PINGPONG 처리
    if (msg.includes('PINGPONG')) {
      this.ws?.send(msg);
      return;
    }

    // 실시간 체결 데이터
    const tick = parseRealtimeTick(msg);
    if (tick) {
      this.emit('tick', tick);
    }
  }

  /** 구독/해제 메시지 전송 */
  private sendSubscribe(stockCode: string, trType: '1' | '2'): void {
    const msg = JSON.stringify({
      header: {
        approval_key: this.approvalKey,
        custtype: 'P',
        tr_type: trType,
        'content-type': 'utf-8'
      },
      body: {
        input: {
          tr_id: 'H0STCNT0',
          tr_key: stockCode
        }
      }
    });
    this.ws?.send(msg);
  }

  /** 재연결 스케줄링 (지수 백오프) */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit('error', new KisWsError('Max reconnection attempts exceeded'));
      return;
    }

    const delay = 1000 * Math.pow(2, this.reconnectAttempts); // 1s, 2s, 4s, 8s, 16s
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
