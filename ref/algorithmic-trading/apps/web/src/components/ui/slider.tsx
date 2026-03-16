'use client';

import { cn } from '@/lib/utils';

interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  min,
  max,
  step,
  value,
  onValueChange,
  className,
  disabled
}: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn(
        'w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    />
  );
}
