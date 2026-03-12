import { Badge } from '@/components/ui/badge';
import type { SajuPersonDisplay } from '@/lib/saju/generator/metadata-transform';

function strengthLabel(value: string): string {
  switch (value) {
    case 'STRONG':
      return '신강';
    case 'WEAK':
      return '신약';
    default:
      return '균형';
  }
}

export function BalanceCard({ person }: { person: SajuPersonDisplay }) {
  if (!person.balance) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">균형 해석</h3>
        <p className="text-xs text-muted-foreground">
          신강·신약과 용신, 희신, 기신을 함께 봅니다.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {strengthLabel(person.balance.dayMasterStrength)}
        </Badge>
        <Badge variant="secondary">
          용신 {person.balance.yongsin.label} · {person.balance.yongsin.element}
        </Badge>
        <Badge variant="secondary">
          희신 {person.balance.heesin.label} · {person.balance.heesin.element}
        </Badge>
        <Badge variant="secondary">
          기신 {person.balance.gisin.label} · {person.balance.gisin.element}
        </Badge>
      </div>
    </div>
  );
}
