import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { KisRestClient } from './rest-client.js';
import { KisAuth } from './auth.js';
import { TokenBucketThrottler } from './throttler.js';
import { KisApiError } from './errors.js';
import type { KisConfig } from './config.js';

function makeConfig(env: 'virtual' | 'production' = 'virtual'): KisConfig {
  return {
    env,
    appKey: 'test-key',
    appSecret: 'test-secret',
    accountNo: '5017235001',
    cano: '50172350',
    acntPrdtCd: '01',
    restBaseUrl: 'https://test.koreainvestment.com',
    wsBaseUrl: 'ws://test.koreainvestment.com:31000',
    approvalUrl: 'https://test.koreainvestment.com'
  };
}

function makeAuth(config?: KisConfig): KisAuth {
  const cfg = config ?? makeConfig();
  const fetchFn = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      access_token: 'mock-token',
      token_type: 'Bearer',
      expires_in: 86400
    })
  })) as unknown as typeof globalThis.fetch;
  return new KisAuth(cfg, fetchFn);
}

function orderResponse(odno: string = '0000012345', ordTmd: string = '100530') {
  return {
    rt_cd: '0',
    msg_cd: 'SMCR114',
    msg1: '주문이 접수되었습니다',
    output: { ODNO: odno, ORD_TMD: ordTmd }
  };
}

describe('KisRestClient - 주문 메서드', () => {
  it('매수 주문을 실행한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    let capturedBody: Record<string, unknown> | undefined;
    let capturedTrId: string | undefined;
    const fetchFn = mock.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      capturedTrId = (init.headers as Record<string, string>).tr_id;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => orderResponse('0000012345', '100530')
      };
    }) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    const result = await client.placeOrder({
      side: 'buy',
      stockCode: '005930',
      orderType: 'LIMIT',
      quantity: 10,
      price: 72000
    });

    assert.equal(result.kisOrderNo, '0000012345');
    assert.equal(result.orderTime, '100530');
    assert.equal(capturedTrId, 'VTTC0802U'); // 가상 매수
    assert.equal(capturedBody!.PDNO, '005930');
    assert.equal(capturedBody!.ORD_QTY, '10');
    assert.equal(capturedBody!.ORD_UNPR, '72000');
    assert.equal(capturedBody!.ORD_DVSN, '00'); // 지정가
    auth.destroy();
  });

  it('매도 주문을 실행한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    let capturedTrId: string | undefined;
    const fetchFn = mock.fn(async (_url: string, init: RequestInit) => {
      capturedTrId = (init.headers as Record<string, string>).tr_id;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => orderResponse()
      };
    }) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    await client.placeOrder({
      side: 'sell',
      stockCode: '005930',
      orderType: 'MARKET',
      quantity: 5,
      price: 0
    });

    assert.equal(capturedTrId, 'VTTC0801U'); // 가상 매도
    auth.destroy();
  });

  it('실전 환경에서 올바른 TR_ID를 사용한다', async () => {
    const config = makeConfig('production');
    const auth = makeAuth(config);
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    let capturedTrId: string | undefined;
    const fetchFn = mock.fn(async (_url: string, init: RequestInit) => {
      capturedTrId = (init.headers as Record<string, string>).tr_id;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => orderResponse()
      };
    }) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(config, auth, throttler, fetchFn);
    await client.placeOrder({
      side: 'buy',
      stockCode: '005930',
      orderType: 'LIMIT',
      quantity: 10,
      price: 72000
    });

    assert.equal(capturedTrId, 'TTTC0802U'); // 실전 매수
    auth.destroy();
  });

  it('주문 취소를 실행한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    let capturedBody: Record<string, unknown> | undefined;
    const fetchFn = mock.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => orderResponse('0000099999')
      };
    }) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    const result = await client.cancelOrder({
      orgOrderNo: '0000012345',
      stockCode: '005930',
      quantity: 10
    });

    assert.equal(result.kisOrderNo, '0000099999');
    assert.equal(capturedBody!.ORGN_ODNO, '0000012345');
    assert.equal(capturedBody!.RVSE_CNCL_DVSN_CD, '02'); // 취소
    auth.destroy();
  });

  it('주문 정정을 실행한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    let capturedBody: Record<string, unknown> | undefined;
    const fetchFn = mock.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => orderResponse('0000088888')
      };
    }) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    const result = await client.modifyOrder({
      orgOrderNo: '0000012345',
      stockCode: '005930',
      quantity: 10,
      price: 73000
    });

    assert.equal(result.kisOrderNo, '0000088888');
    assert.equal(capturedBody!.RVSE_CNCL_DVSN_CD, '01'); // 정정
    assert.equal(capturedBody!.ORD_UNPR, '73000');
    auth.destroy();
  });

  it('체결 내역을 조회한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    const fetchFn = mock.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        rt_cd: '0',
        msg_cd: 'MCA00000',
        msg1: '정상',
        output1: [
          {
            odno: '0000012345',
            orgn_odno: '',
            pdno: '005930',
            sll_buy_dvsn_cd: '02',
            ord_qty: '10',
            tot_ccld_qty: '10',
            tot_ccld_amt: '720000',
            pchs_avg_pric: '72000',
            ord_unpr: '72000',
            ord_tmd: '100530'
          }
        ]
      })
    })) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    const executions = await client.getExecutions();

    assert.equal(executions.length, 1);
    assert.equal(executions[0]!.pdno, '005930');
    assert.equal(executions[0]!.tot_ccld_qty, '10');
    auth.destroy();
  });

  it('체결 내역 페이지네이션을 처리한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    let callCount = 0;
    const fetchFn = mock.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            rt_cd: '0',
            msg_cd: 'MCA00000',
            msg1: '정상',
            output1: [
              {
                odno: '0000012345',
                orgn_odno: '',
                pdno: '005930',
                sll_buy_dvsn_cd: '02',
                ord_qty: '10',
                tot_ccld_qty: '10',
                tot_ccld_amt: '720000',
                pchs_avg_pric: '72000',
                ord_unpr: '72000',
                ord_tmd: '100530'
              }
            ],
            ctx_area_fk100: 'NEXT_KEY',
            ctx_area_nk100: 'NEXT_NK'
          })
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          rt_cd: '0',
          msg_cd: 'MCA00000',
          msg1: '정상',
          output1: [
            {
              odno: '0000012346',
              orgn_odno: '',
              pdno: '000660',
              sll_buy_dvsn_cd: '01',
              ord_qty: '5',
              tot_ccld_qty: '5',
              tot_ccld_amt: '800000',
              pchs_avg_pric: '160000',
              ord_unpr: '160000',
              ord_tmd: '110000'
            }
          ]
        })
      };
    }) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    const executions = await client.getExecutions();

    assert.equal(executions.length, 2);
    assert.equal(executions[0]!.pdno, '005930');
    assert.equal(executions[1]!.pdno, '000660');
    auth.destroy();
  });

  it('미체결 주문을 조회한다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    const fetchFn = mock.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        rt_cd: '0',
        msg_cd: 'MCA00000',
        msg1: '정상',
        output: [
          {
            odno: '0000012345',
            pdno: '005930',
            prdt_name: '삼성전자',
            sll_buy_dvsn_cd: '02',
            ord_qty: '10',
            ord_unpr: '72000',
            tot_ccld_qty: '5',
            rmn_qty: '5',
            ord_tmd: '100530',
            ord_dvsn_cd: '00'
          }
        ]
      })
    })) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    const orders = await client.getOpenOrders();

    assert.equal(orders.length, 1);
    assert.equal(orders[0]!.pdno, '005930');
    assert.equal(orders[0]!.rmn_qty, '5');
    auth.destroy();
  });

  it('주문 에러 시 KisApiError를 던진다', async () => {
    const auth = makeAuth();
    await auth.issueToken();
    const throttler = new TokenBucketThrottler(20);

    const fetchFn = mock.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        rt_cd: '1',
        msg_cd: 'EGW00423',
        msg1: '주문수량이 부족합니다'
      })
    })) as unknown as typeof globalThis.fetch;

    const client = new KisRestClient(makeConfig(), auth, throttler, fetchFn);
    await assert.rejects(
      () =>
        client.placeOrder({
          side: 'buy',
          stockCode: '005930',
          orderType: 'LIMIT',
          quantity: 10,
          price: 72000
        }),
      (err: unknown) => {
        assert.ok(err instanceof KisApiError);
        assert.equal(err.msgCd, 'EGW00423');
        return true;
      }
    );
    auth.destroy();
  });
});
