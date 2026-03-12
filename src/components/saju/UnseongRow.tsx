import { Badge } from '@/components/ui/badge';
import type { SajuPersonDisplay } from '@/lib/saju/generator/metadata-transform';

export function UnseongRow({ person }: { person: SajuPersonDisplay }) {
  if (person.unseong.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">12운성</h3>
        <p className="text-xs text-muted-foreground">
          연지, 월지, 일지, 시지 기준 단계입니다.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {person.unseong.map((item) => (
          <Badge key={`${item.pillarLabel}-${item.branch}`} variant="outline">
            {item.pillarLabel} {item.branch} · {item.stage}
          </Badge>
        ))}
      </div>
    </div>
  );
}
