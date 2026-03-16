import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TradeRecord {
  stockCode: string;
  buyDatetime: string;
  sellDatetime: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  pnl: number;
  pnlRate: number;
  fee: number;
  tax: number;
  reason: string;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function currency(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function TradesTable({ trades }: { trades: TradeRecord[] }) {
  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">거래 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">거래 내역이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">거래 내역 ({trades.length}건)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">종목</th>
                <th className="p-2">매수일시</th>
                <th className="p-2">매도일시</th>
                <th className="p-2 text-right">매수가</th>
                <th className="p-2 text-right">매도가</th>
                <th className="p-2 text-right">수량</th>
                <th className="p-2 text-right">손익</th>
                <th className="p-2 text-right">수익률</th>
                <th className="p-2 text-right">수수료+세금</th>
                <th className="p-2">사유</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-mono">{t.stockCode}</td>
                  <td className="p-2 text-muted-foreground">{t.buyDatetime}</td>
                  <td className="p-2 text-muted-foreground">
                    {t.sellDatetime}
                  </td>
                  <td className="p-2 text-right">{currency(t.buyPrice)}</td>
                  <td className="p-2 text-right">{currency(t.sellPrice)}</td>
                  <td className="p-2 text-right">{t.quantity}</td>
                  <td
                    className={`p-2 text-right font-medium ${t.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {currency(Math.round(t.pnl))}
                  </td>
                  <td
                    className={`p-2 text-right ${t.pnlRate >= 0 ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {pct(t.pnlRate)}
                  </td>
                  <td className="p-2 text-right text-muted-foreground">
                    {currency(Math.round(t.fee + t.tax))}
                  </td>
                  <td className="p-2 text-muted-foreground">{t.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
