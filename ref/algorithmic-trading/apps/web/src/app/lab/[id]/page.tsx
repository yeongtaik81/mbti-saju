import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getAlgorithm, listLabResults } from '@/lib/lab-db';
import { StatusBadge } from '@/components/lab/StatusBadge';
import { StrategyTypeBadge } from '@/components/lab/StrategyTypeBadge';
import { LabBacktestForm } from '@/components/lab/LabBacktestForm';
import { BacktestRunsTable } from '@/components/lab/BacktestRunsTable';
import { BacktestKPICards } from '@/components/backtest/BacktestKPICards';

export default async function AlgorithmDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const algorithm = getAlgorithm(db, id);
  if (!algorithm) return notFound();

  const runs = listLabResults(db, id);

  // 베스트 런 (수익률 기준)
  const bestRun =
    runs.length > 0
      ? runs.reduce(
          (best, r) => (r.total_return > best.total_return ? r : best),
          runs[0]!
        )
      : null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <Link
          href="/lab"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; 연구실로 돌아가기
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{algorithm.name}</h1>
          <StrategyTypeBadge type={algorithm.strategy_type} />
          <StatusBadge status={algorithm.status} />
        </div>
        {algorithm.hypothesis && (
          <p className="mt-1 text-muted-foreground">{algorithm.hypothesis}</p>
        )}
        {algorithm.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {algorithm.description}
          </p>
        )}
      </div>

      {/* 베스트 런 KPI */}
      {bestRun && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            베스트 런 메트릭
          </h3>
          <BacktestKPICards
            data={{
              totalReturn: bestRun.total_return,
              cagr: bestRun.cagr,
              mdd: bestRun.mdd,
              winRate: bestRun.win_rate,
              profitFactor: bestRun.profit_factor,
              sharpeRatio: bestRun.sharpe_ratio
            }}
          />
        </div>
      )}

      {/* 백테스트 실행 폼 */}
      <LabBacktestForm
        algorithmId={id}
        strategyType={algorithm.strategy_type}
      />

      {/* 런 테이블 */}
      <BacktestRunsTable runs={runs} />
    </div>
  );
}
