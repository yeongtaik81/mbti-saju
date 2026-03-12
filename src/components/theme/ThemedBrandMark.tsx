import Image from 'next/image';
import { cn } from '@/lib/utils';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_CLASS = {
  sm: 'size-11',
  md: 'size-14',
  lg: 'size-16'
} as const;

const IMAGE_SIZE = {
  sm: 44,
  md: 56,
  lg: 64
} as const;

export function ThemedBrandMark({ size = 'md', className }: Props) {
  return (
    <span className={cn('theme-brand-mark', SIZE_CLASS[size], className)}>
      <Image
        className="theme-brand-mark__asset theme-brand-mark__asset--default"
        src="/brand/mbti-saju-mark-concept-3.svg"
        alt="MBTI 사주 로고"
        width={IMAGE_SIZE[size]}
        height={IMAGE_SIZE[size]}
        priority
      />
    </span>
  );
}
