'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STRATEGY_OPTIONS = [
  { value: 'dual_momentum', label: '듀얼 모멘텀' },
  { value: 'ma_crossover', label: 'MA 크로스오버' },
  { value: 'bb_rsi', label: 'BB + RSI' },
  { value: 'turtle', label: '터틀 트레이딩' },
  { value: 'volatility_breakout', label: '변동성 돌파' }
];

export function AlgorithmForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    strategyType: 'dual_momentum',
    description: '',
    hypothesis: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/lab/algorithms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create algorithm');
      }

      const { id } = await res.json();
      router.push(`/lab/${id}`);
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
        <CardTitle className="text-lg">새 알고리즘</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>이름</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. 코스닥 소형주 모멘텀"
                required
              />
            </div>
            <div>
              <Label>전략 타입</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.strategyType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, strategyType: e.target.value }))
                }
              >
                {STRATEGY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>설명</Label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="전략 설명 (선택)"
            />
          </div>
          <div>
            <Label>가설</Label>
            <Input
              value={form.hypothesis}
              onChange={(e) =>
                setForm((p) => ({ ...p, hypothesis: e.target.value }))
              }
              placeholder="e.g. KOSDAQ 소형주에서 듀얼 모멘텀이 코스피보다 유효한가?"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={loading || !form.name}>
            {loading ? '생성 중...' : '알고리즘 생성'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
