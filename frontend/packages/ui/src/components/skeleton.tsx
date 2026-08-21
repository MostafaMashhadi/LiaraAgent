import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const skeletonVariants = cva(
  "animate-pulse rounded-xl bg-muted",
  {
    variants: {
      variant: {
        default: "",
        shimmer: "bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer",
      },
      size: {
        default: "h-4 w-full",
        sm: "h-3 w-3/4",
        lg: "h-6 w-full",
        circle: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Skeleton({ className, variant, size, ...props }: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Skeleton }
