'use client';

import { Badge } from '@/components/ui/badge';

const STRATEGY_LABELS: Record<string, string> = {
  dual_momentum: '듀얼 모멘텀',
  ma_crossover: 'MA 크로스오버',
  bb_rsi: 'BB + RSI',
  turtle: '터틀',
  volatility_breakout: '변동성 돌파'
};

export function StrategyTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="default" className="bg-blue-500/10 text-blue-700">
      {STRATEGY_LABELS[type] ?? type}
    </Badge>
  );
}
