import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KPIData {
  totalReturn: number;
  cagr: number;
  mdd: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function num(value: number): string {
  return value.toFixed(2);
}

export function BacktestKPICards({ data }: { data: KPIData }) {
  const cards = [
    {
      title: '총수익률',
      value: pct(data.totalReturn),
      color: data.totalReturn >= 0 ? 'text-green-600' : 'text-red-500'
    },
    {
      title: 'CAGR',
      value: pct(data.cagr),
      color: data.cagr >= 0 ? 'text-green-600' : 'text-red-500'
    },
    { title: 'MDD', value: pct(data.mdd), color: 'text-red-500' },
    { title: '승률', value: pct(data.winRate), color: '' },
    {
      title: 'Profit Factor',
      value: num(data.profitFactor),
      color: data.profitFactor >= 1 ? 'text-green-600' : 'text-red-500'
    },
    {
      title: 'Sharpe Ratio',
      value: num(data.sharpeRatio),
      color: data.sharpeRatio >= 0 ? 'text-green-600' : 'text-red-500'
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
