/** 실시간 체결 이벤트 (Data Feed → Strategy) */
export interface CandleEvent {
  stockCode: string;
  price: number;
  volume: number;
  timestamp: string;
}

/** 스크리닝 후보 종목 */
export interface Candidate {
  stockCode: string;
  stockName: string;
  rank: number;
  marketCap: number;
  volumeAmount: number;
  atr: number;
}

/** 스크리닝 결과 */
export interface CandidateList {
  date: string;
  candidates: Candidate[];
}
