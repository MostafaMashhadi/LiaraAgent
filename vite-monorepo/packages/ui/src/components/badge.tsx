import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-xl border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        destructive: "bg-destructive/10 text-destructive border-destructive/20",
        outline: "border-border text-foreground",
        teal: "bg-teal-500 text-white border-transparent shadow-sm",
        mint: "bg-mint text-mint-foreground border-transparent",
        gold: "bg-gold text-gold-foreground border-transparent",
      },
      size: {
        default: "",
        sm: "text-[10px] px-2 py-0.5",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({ className, variant, size, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
