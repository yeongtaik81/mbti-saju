import { Badge } from '@/components/ui/badge';
import type { SajuPersonDisplay } from '@/lib/saju/generator/metadata-transform';

export function TenGodsGrid({ person }: { person: SajuPersonDisplay }) {
  if (person.tenGods.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">보이는 십성</h3>
        <p className="text-xs text-muted-foreground">
          연간, 월간, 시간에 드러난 십성을 정리했습니다.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {person.tenGods.map((item) => (
          <div
            key={`${item.pillarLabel}-${item.stem}`}
            className="rounded-lg border p-3"
          >
            <p className="text-xs text-muted-foreground">{item.pillarLabel}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {item.stem}
                {item.element}
              </p>
              <Badge variant="secondary">{item.tenGod}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
