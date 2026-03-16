/**
 * KRX에서 KOSPI/KOSDAQ 전체 종목 코드 목록 가져오기
 */

async function getOTP(mktId: string): Promise<string> {
  const params = new URLSearchParams({
    locale: 'ko_KR',
    mktId,
    share: '1',
    csvxls_is498No: 'false',
    name: 'fileDown',
    url: 'dbms/MDC/STAT/standard/MDCSTAT01901'
  });

  const res = await fetch(
    'https://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Referer: 'https://data.krx.co.kr/'
      },
      body: params.toString()
    }
  );

  const text = await res.text();
  console.log(`OTP response (first 100): "${text.slice(0, 100)}"`);
  return text;
}

async function downloadCSV(otp: string): Promise<string> {
  const res = await fetch(
    'https://data.krx.co.kr/comm/fileDn/download_csv/download.cmd',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Referer: 'https://data.krx.co.kr/'
      },
      body: new URLSearchParams({ code: otp }).toString()
    }
  );

  console.log(
    `CSV status: ${res.status}, content-type: ${res.headers.get('content-type')}`
  );
  const buffer = await res.arrayBuffer();
  // Try UTF-8 first, then EUC-KR
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('\ufffd')) {
    text = new TextDecoder('euc-kr').decode(buffer);
  }
  console.log(`CSV response (first 300):\n${text.slice(0, 300)}`);
  return text;
}

async function main() {
  console.log('=== KRX 디버그 ===\n');
  const otp = await getOTP('STK');
  if (otp && !otp.startsWith('<')) {
    await downloadCSV(otp);
  }
}

main().catch((err) => {
  console.error('실패:', (err as Error).message);
});
