'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ParamField {
  key: string;
  label: string;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  default: number;
  description?: string;
}

interface Props {
  algorithmId: string;
  strategyType: string;
}

const DEFAULT_RISK = {
  stopLossRate: -0.05,
  takeProfitRate: 0.15,
  maxHoldDays: 20,
  maxPositions: 5,
  maxWeight: 0.3
};

export function LabBacktestForm({ algorithmId, strategyType }: Props) {
  const router = useRouter();
  const [paramSchema, setParamSchema] = useState<ParamField[]>([]);
  const [params, setParams] = useState<Record<string, number>>({});
  const [riskParams, setRiskParams] = useState(DEFAULT_RISK);
  const [stockCodes, setStockCodes] = useState('005930,000660,035420');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-01-01');
  const [initialCapital, setInitialCapital] = useState(100_000_000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/lab/strategies')
      .then((r) => r.json())
      .then((strategies: { type: string; paramSchema: ParamField[] }[]) => {
        const s = strategies.find((s) => s.type === strategyType);
        if (s) {
          setParamSchema(s.paramSchema);
          const defaults: Record<string, number> = {};
          for (const f of s.paramSchema) defaults[f.key] = f.default;
          setParams(defaults);
        }
      })
      .catch(() => {});
  }, [strategyType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/lab/algorithms/${algorithmId}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params,
          riskParams,
          stockCodes: stockCodes.split(',').map((c) => c.trim()),
          startDate,
          endDate,
          initialCapital
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? data.error ?? 'Backtest failed');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">백테스트 실행</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 전략 파라미터 */}
          {paramSchema.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                전략 파라미터
              </h4>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {paramSchema.map((f) => (
                  <div key={f.key}>
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type="number"
                      value={params[f.key] ?? f.default}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      onChange={(e) =>
                        setParams((p) => ({
                          ...p,
                          [f.key]: Number(e.target.value)
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 리스크 파라미터 */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              리스크 관리
            </h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div>
                <Label className="text-xs">손절률</Label>
                <Input
                  type="number"
                  step={0.01}
                  value={riskParams.stopLossRate}
                  onChange={(e) =>
                    setRiskParams((p) => ({
                      ...p,
                      stopLossRate: Number(e.target.value)
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">익절률</Label>
                <Input
                  type="number"
                  step={0.01}
                  value={riskParams.takeProfitRate}
                  onChange={(e) =>
                    setRiskParams((p) => ({
                      ...p,
                      takeProfitRate: Number(e.target.value)
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">최대 보유일</Label>
                <Input
                  type="number"
                  step={1}
                  value={riskParams.maxHoldDays}
                  onChange={(e) =>
                    setRiskParams((p) => ({
                      ...p,
                      maxHoldDays: Number(e.target.value)
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">최대 포지션</Label>
                <Input
                  type="number"
                  step={1}
                  value={riskParams.maxPositions}
                  onChange={(e) =>
                    setRiskParams((p) => ({
                      ...p,
                      maxPositions: Number(e.target.value)
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">최대 비중</Label>
                <Input
                  type="number"
                  step={0.05}
                  value={riskParams.maxWeight}
                  onChange={(e) =>
                    setRiskParams((p) => ({
                      ...p,
                      maxWeight: Number(e.target.value)
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* 유니버스 + 기간 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="text-xs">종목코드 (쉼표 구분)</Label>
              <Input
                value={stockCodes}
                onChange={(e) => setStockCodes(e.target.value)}
                placeholder="005930,000660,035420"
              />
            </div>
            <div>
              <Label className="text-xs">시작일</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">종료일</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="w-48">
            <Label className="text-xs">초기 자본금</Label>
            <Input
              type="number"
              step={1000000}
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? '실행 중...' : '백테스트 실행'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
