/** 보유 포지션 */
export interface Position {
  id: number;
  stockCode: string;
  stockName: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlRate: number;
  boughtAt: string;
  updatedAt: string;
}

/** 포트폴리오 스냅샷 (일별) */
export interface PortfolioSnapshot {
  id: number;
  date: string;
  totalValue: number;
  cash: number;
  stockValue: number;
  dailyPnl: number;
  dailyPnlRate: number;
  cumulativePnlRate: number;
  createdAt: string;
}
