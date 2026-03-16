'use client';

import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  researching: { label: '연구중', variant: 'default' as const },
  promising: { label: '유망', variant: 'success' as const },
  adopted: { label: '채택', variant: 'success' as const },
  abandoned: { label: '중단', variant: 'destructive' as const }
} as const;

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    label: status,
    variant: 'default' as const
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
