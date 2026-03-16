'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { StrategyTypeBadge } from './StrategyTypeBadge';

interface AlgorithmCardProps {
  id: string;
  name: string;
  strategyType: string;
  status: string;
  hypothesis: string;
  runCount: number;
  bestReturn: number | null;
  bestSharpe: number | null;
  bestMdd: number | null;
  lastRunAt: string | null;
}

function pct(v: number | null): string {
  if (v == null) return '-';
  return `${(v * 100).toFixed(2)}%`;
}

function num(v: number | null, digits = 2): string {
  if (v == null) return '-';
  return v.toFixed(digits);
}

export function AlgorithmCard(props: AlgorithmCardProps) {
  return (
    <Link href={`/lab/${props.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <StrategyTypeBadge type={props.strategyType} />
            <StatusBadge status={props.status} />
          </div>
          <CardTitle className="text-lg">{props.name}</CardTitle>
          {props.hypothesis && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {props.hypothesis}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">수익률</span>
              <p
                className={
                  props.bestReturn != null && props.bestReturn > 0
                    ? 'text-green-600 font-medium'
                    : 'text-red-500 font-medium'
                }
              >
                {pct(props.bestReturn)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Sharpe</span>
              <p className="font-medium">{num(props.bestSharpe)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">MDD</span>
              <p className="text-red-500 font-medium">{pct(props.bestMdd)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">런 수</span>
              <p className="font-medium">{props.runCount}</p>
            </div>
          </div>
          {props.lastRunAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              마지막 실행: {props.lastRunAt.slice(0, 10)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
