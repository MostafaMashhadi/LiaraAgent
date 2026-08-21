import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const sliderVariants = cva(
  "relative flex w-full touch-none select-none items-center",
  {
    variants: {
      size: {
        default: "h-5",
        sm: "h-4",
        lg: "h-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Slider({ className, size, ...props }: React.ComponentProps<"input"> & VariantProps<typeof sliderVariants>) {
  return (
    <div
      data-slot="slider"
      className={cn(sliderVariants({ size, className }))}
    >
      <input
        type="range"
        className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer accent-primary"
        {...props}
      />
    </div>
  )
}

export { Slider }
