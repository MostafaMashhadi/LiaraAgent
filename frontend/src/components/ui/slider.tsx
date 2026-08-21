import React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

function Slider({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }: SliderProps) {
  const currentValue = value?.[0] ?? (min + max) / 2;
  const percentage = ((currentValue - min) / (max - min)) * 100;

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center', className)} {...props}>
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-input">
        <div
          className="absolute h-full bg-primary transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          onValueChange?.([val]);
        }}
        className="absolute h-full w-full appearance-none bg-transparent opacity-0 cursor-pointer"
      />
      <div
        className="absolute h-4 w-4 rounded-full border-2 border-primary bg-background shadow-md transition-all duration-150"
        style={{ right: `calc(${percentage}% - 8px)` }}
      />
    </div>
  );
}

export { Slider };
