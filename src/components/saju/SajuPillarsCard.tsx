import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getBranchElement,
  getElementColor,
  getStemElement
} from '@/lib/saju/element-colors';
import type { SajuPersonDisplay } from '@/lib/saju/generator/metadata-transform';

function splitPillar(value: string): {
  stem: string;
  branch: string;
  hourUnknown: boolean;
} {
  if (value === '시주 미정') {
    return { stem: '시주', branch: '미정', hourUnknown: true };
  }

  const [stem = value, branch = ''] = Array.from(value);
  return {
    stem,
    branch,
    hourUnknown: false
  };
}

function PillarCell({ label, value }: { label: string; value: string }) {
  const { stem, branch, hourUnknown } = splitPillar(value);
  const stemElement = getStemElement(stem);
  const branchElement = getBranchElement(branch);

  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {hourUnknown ? (
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline">{stem}</Badge>
          <Badge variant="secondary">{branch}</Badge>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border px-3 py-2 text-center"
            style={{
              borderColor: stemElement
                ? getElementColor(stemElement)
                : undefined,
              backgroundColor: stemElement
                ? `${getElementColor(stemElement)}18`
                : undefined
            }}
          >
            <p className="text-lg font-semibold leading-none">{stem}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">천간</p>
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-center"
            style={{
              borderColor: branchElement
                ? getElementColor(branchElement)
                : undefined,
              backgroundColor: branchElement
                ? `${getElementColor(branchElement)}18`
                : undefined
            }}
          >
            <p className="text-lg font-semibold leading-none">{branch}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">지지</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SajuPillarsCard({
  title,
  person
}: {
  title: string;
  person: SajuPersonDisplay;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">
            일간 {person.dayMaster.stem}
            {person.dayMaster.element} · {person.dayMaster.yinYang}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PillarCell label="연주" value={person.pillars.yearString} />
          <PillarCell label="월주" value={person.pillars.monthString} />
          <PillarCell label="일주" value={person.pillars.dayString} />
          <PillarCell label="시주" value={person.pillars.hourString} />
        </div>
      </CardContent>
    </Card>
  );
}
