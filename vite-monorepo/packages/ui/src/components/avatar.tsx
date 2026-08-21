import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        default: "h-10 w-10",
        sm: "h-8 w-8",
        lg: "h-12 w-12",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const avatarFallbackVariants = cva(
  "flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground font-medium",
  {
    variants: {
      size: {
        default: "text-sm",
        sm: "text-xs",
        lg: "text-base",
        icon: "text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Avatar({ className, size, ...props }: React.ComponentProps<"span"> & VariantProps<typeof avatarVariants>) {
  return (
    <span
      data-slot="avatar"
      className={cn(avatarVariants({ size, className }))}
      {...props}
    />
  )
}

function AvatarFallback({ className, size, delayMs, ...props }: React.ComponentProps<"span"> & VariantProps<typeof avatarFallbackVariants> & { delayMs?: number }) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(avatarFallbackVariants({ size, className }))}
      style={{ animationDelay: delayMs ? `${delayMs}ms` : undefined }}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: React.ComponentProps<"img">) {
  return (
    <img
      data-slot="avatar-image"
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback, AvatarImage }
