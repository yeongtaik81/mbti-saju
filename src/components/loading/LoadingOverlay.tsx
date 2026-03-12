'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SajuLoadingVisual } from '@/components/loading/SajuLoadingVisual';
import { cn } from '@/lib/utils';
import type {
  ScenarioLoadingIllustration,
  ReadingMode,
  ScenarioLoadingIcon,
  ScenarioLoadingMotion,
  ScenarioLoadingTheme
} from '@/lib/saju/scenarios';

type SpringFolkScene = 'swing' | 'couple' | 'scholar' | 'family';

function getSpringFolkScene(
  theme: ScenarioLoadingTheme,
  mode: ReadingMode
): SpringFolkScene {
  if (mode === 'COMPATIBILITY') {
    if (theme === 'work') {
      return 'scholar';
    }
    if (theme === 'family') {
      return 'family';
    }
    return 'couple';
  }

  if (theme === 'career' || theme === 'wealth') {
    return 'scholar';
  }
  if (theme === 'relationship' || theme === 'family' || theme === 'friend') {
    return 'family';
  }
  return 'swing';
}

function getSpringFolkMessage(theme: ScenarioLoadingTheme, mode: ReadingMode) {
  const scene = getSpringFolkScene(theme, mode);

  switch (scene) {
    case 'couple':
      return '봄빛을 얹어, 두 사람 사이의 온도를 더 부드럽게 읽고 있어요.';
    case 'scholar':
      return '봄빛을 얹어, 일과 재물의 결을 차분히 맞춰 보고 있어요.';
    case 'family':
      return '봄빛을 얹어, 사람 사이의 마음결을 더 살피고 있어요.';
    case 'swing':
    default:
      return '봄바람을 얹어, 지금의 운이 향하는 쪽을 보고 있어요.';
  }
}

type Props = {
  open: boolean;
  mode: ReadingMode;
  theme: ScenarioLoadingTheme;
  icon: ScenarioLoadingIcon;
  motion?: ScenarioLoadingMotion;
  illustration?: ScenarioLoadingIllustration;
  variant?: 'simple' | 'folk';
  title: string;
  messages: string[];
  badgeLabel?: string;
  description?: string;
};

export function LoadingOverlay({
  open,
  mode,
  theme,
  icon,
  motion,
  illustration,
  variant = 'simple',
  title,
  messages,
  badgeLabel,
  description
}: Props) {
  const normalizedMessages = useMemo(
    () => messages.filter((message) => message.trim().length > 0),
    [messages]
  );
  const { resolvedTheme } = useTheme();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!open || normalizedMessages.length <= 1) {
      setMessageIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % normalizedMessages.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [normalizedMessages, open]);

  if (!open) {
    return null;
  }

  const activeMessage = normalizedMessages[messageIndex] ?? '';
  const isSpringFolk = resolvedTheme === 'spring' && variant === 'folk';
  const springFolkMessage = isSpringFolk
    ? getSpringFolkMessage(theme, mode)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-10">
      <Card
        className={cn(
          'w-full border-border/70 bg-card/90 shadow-2xl backdrop-blur-md',
          variant === 'folk' ? 'max-w-2xl overflow-hidden' : 'max-w-lg'
        )}
      >
        <CardContent
          className={cn(
            'flex flex-col items-center gap-5 text-center',
            variant === 'folk'
              ? 'px-4 py-5 sm:px-6 sm:py-6'
              : 'px-4 py-6 sm:px-8 sm:py-8'
          )}
        >
          {badgeLabel ? <Badge variant="secondary">{badgeLabel}</Badge> : null}

          <SajuLoadingVisual
            theme={theme}
            icon={icon}
            mode={mode}
            motion={motion}
            illustration={illustration}
            variant={variant}
          />

          <div className="space-y-2">
            <p className="text-lg font-semibold leading-tight">{title}</p>
            {description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
            {springFolkMessage ? (
              <p className="text-xs leading-relaxed text-muted-foreground/90">
                {springFolkMessage}
              </p>
            ) : null}
          </div>

          <div
            key={`${messageIndex}-${activeMessage}`}
            aria-live="polite"
            className="min-h-[3rem] max-w-md animate-rise-in text-sm leading-relaxed text-muted-foreground"
          >
            {activeMessage}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
