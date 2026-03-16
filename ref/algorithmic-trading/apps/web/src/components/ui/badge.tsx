import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-primary/10 text-primary border-primary/20',
  success:
    'bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400',
  warning:
    'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400',
  destructive: 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400'
} as const;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
