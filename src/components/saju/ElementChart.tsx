import { getElementColor } from '@/lib/saju/element-colors';
import type { SajuPersonDisplay } from '@/lib/saju/generator/metadata-transform';

export function ElementChart({ person }: { person: SajuPersonDisplay }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">오행 분포</h3>
        <p className="text-xs text-muted-foreground">
          강한 기운은 {person.strongElement}, 약한 기운은 {person.weakElement}
          입니다.
        </p>
      </div>
      <div className="space-y-3">
        {person.elementDistribution.map((item) => (
          <div key={item.element} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{item.element}</span>
              <span className="text-muted-foreground">{item.percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: getElementColor(item.element)
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
