'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Run {
  run_id: string;
  params: string;
  start_date: string;
  end_date: string;
  total_return: number;
  cagr: number;
  mdd: number;
  win_rate: number;
  sharpe_ratio: number;
  profit_factor: number;
  total_trades: number;
  created_at: string;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

export function BacktestRunsTable({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          아직 백테스트 결과가 없습니다. 위에서 백테스트를 실행해주세요.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          백테스트 결과 ({runs.length}건)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">실행일</th>
                <th className="pb-2 pr-4">기간</th>
                <th className="pb-2 pr-4 text-right">수익률</th>
                <th className="pb-2 pr-4 text-right">CAGR</th>
                <th className="pb-2 pr-4 text-right">MDD</th>
                <th className="pb-2 pr-4 text-right">승률</th>
                <th className="pb-2 pr-4 text-right">Sharpe</th>
                <th className="pb-2 pr-4 text-right">PF</th>
                <th className="pb-2 text-right">거래수</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.run_id} className="border-b hover:bg-muted/50">
                  <td className="py-2 pr-4">{run.created_at?.slice(0, 10)}</td>
                  <td className="py-2 pr-4 text-xs">
                    {run.start_date} ~ {run.end_date}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${run.total_return > 0 ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {pct(run.total_return)}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right ${run.cagr > 0 ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {pct(run.cagr)}
                  </td>
                  <td className="py-2 pr-4 text-right text-red-500">
                    {pct(run.mdd)}
                  </td>
                  <td className="py-2 pr-4 text-right">{pct(run.win_rate)}</td>
                  <td className="py-2 pr-4 text-right">
                    {run.sharpe_ratio.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {run.profit_factor.toFixed(2)}
                  </td>
                  <td className="py-2 text-right">{run.total_trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
