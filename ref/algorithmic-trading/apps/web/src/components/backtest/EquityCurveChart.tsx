'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">에쿼티 커브</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    equityM: Math.round(d.equity / 10000) / 100, // 만원 → 백만원
    ddPct: -(d.drawdown * 100)
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">에쿼티 커브</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
            />
            <Tooltip />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="equityM"
              stroke="#2563eb"
              dot={false}
              name="자산(백만원)"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="ddPct"
              fill="#ef444480"
              stroke="#ef4444"
              name="낙폭(%)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
