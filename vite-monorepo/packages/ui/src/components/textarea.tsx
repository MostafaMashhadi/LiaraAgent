import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const textareaVariants = cva(
  "flex w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        filled: "bg-muted border-transparent focus-visible:bg-background focus-visible:border-input",
      },
      size: {
        default: "min-h-[80px]",
        sm: "min-h-[60px] text-xs px-3",
        lg: "min-h-[120px] text-base px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Textarea({ className, variant, size, ...props }: React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
