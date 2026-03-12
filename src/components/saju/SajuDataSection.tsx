'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  SajuFrontendMetadata,
  SajuPersonDisplay
} from '@/lib/saju/generator/metadata-transform';
import { BalanceCard } from './BalanceCard';
import { ElementChart } from './ElementChart';
import { SajuPillarsCard } from './SajuPillarsCard';
import { TenGodsGrid } from './TenGodsGrid';
import { UnseongRow } from './UnseongRow';

function strengthLabel(value: string | null | undefined): string {
  switch (value) {
    case 'STRONG':
      return '신강';
    case 'WEAK':
      return '신약';
    default:
      return '균형';
  }
}

function formatPillars(person: SajuPersonDisplay): string {
  return [
    person.pillars.yearString,
    person.pillars.monthString,
    person.pillars.dayString,
    person.pillars.hourString
  ].join(' · ');
}

function SajuSummaryPanel({
  title,
  person
}: {
  title: string;
  person: SajuPersonDisplay;
}) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card/90 p-3.5 sm:p-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            4주
          </span>
        </div>
        <p className="text-lg font-semibold tracking-[0.06em] sm:text-xl">
          {formatPillars(person)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          일간 {person.dayMaster.stem}
          {person.dayMaster.element}
        </Badge>
        <Badge variant="secondary">{person.strongElement} 강</Badge>
        <Badge variant="secondary">{person.weakElement} 약</Badge>
        <Badge variant="outline">
          {strengthLabel(person.balance?.dayMasterStrength)}
        </Badge>
      </div>
      {person.birthTimeUnknown ? (
        <p className="text-xs text-muted-foreground">
          출생시각을 몰라 시주는 참고용으로만 보세요.
        </p>
      ) : null}
    </div>
  );
}

function SajuPersonPanel({
  title,
  person
}: {
  title: string;
  person: SajuPersonDisplay;
}) {
  return (
    <div className="space-y-4">
      <SajuPillarsCard title={title} person={person} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ElementChart person={person} />
        <BalanceCard person={person} />
      </div>
      <TenGodsGrid person={person} />
      <UnseongRow person={person} />
    </div>
  );
}

export function SajuDataSection({
  sajuData
}: {
  sajuData: SajuFrontendMetadata | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!sajuData) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>사주 원국</CardTitle>
            <p className="hidden text-sm text-muted-foreground sm:block">
              원국은 핵심만 먼저 보고, 자세한 구조는 펼쳐서 확인하세요.
            </p>
            <p className="text-xs text-muted-foreground sm:hidden">
              핵심만 먼저 보고 펼쳐서 확인하세요.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? '간단히 보기' : '원국 자세히 보기'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <SajuSummaryPanel title="내 사주 원국" person={sajuData.user} />
          {sajuData.partner ? (
            <SajuSummaryPanel
              title="상대 사주 원국"
              person={sajuData.partner}
            />
          ) : null}
        </div>

        {expanded ? (
          <div className="grid gap-6 border-t pt-6 xl:grid-cols-2">
            <SajuPersonPanel
              title="내 사주 원국 자세히"
              person={sajuData.user}
            />
            {sajuData.partner ? (
              <SajuPersonPanel
                title="상대 사주 원국 자세히"
                person={sajuData.partner}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
