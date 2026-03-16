import { Suspense } from 'react';
import { db } from '@/lib/db';
import { listAlgorithms } from '@/lib/lab-db';
import { AlgorithmCard } from '@/components/lab/AlgorithmCard';
import { AlgorithmForm } from '@/components/lab/AlgorithmForm';

function AlgorithmList() {
  let algorithms: ReturnType<typeof listAlgorithms> = [];
  try {
    algorithms = listAlgorithms(db);
  } catch {
    // DB not available yet
  }

  if (algorithms.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        아직 등록된 알고리즘이 없습니다. 위에서 새 알고리즘을 만들어보세요.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {algorithms.map((a) => (
        <AlgorithmCard
          key={a.id}
          id={a.id}
          name={a.name}
          strategyType={a.strategy_type}
          status={a.status}
          hypothesis={a.hypothesis}
          runCount={a.run_count}
          bestReturn={a.best_return}
          bestSharpe={a.best_sharpe}
          bestMdd={a.best_mdd}
          lastRunAt={a.last_run_at}
        />
      ))}
    </div>
  );
}

export default function LabPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Research Lab</h1>
        <p className="text-muted-foreground">
          알고리즘 연구 및 백테스트 실험실
        </p>
      </div>

      <AlgorithmForm />

      <Suspense fallback={<p className="text-muted-foreground">로딩 중...</p>}>
        <AlgorithmList />
      </Suspense>
    </div>
  );
}
