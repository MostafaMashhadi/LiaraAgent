import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm ring-offset-background transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        filled: "bg-muted border-transparent focus-visible:bg-background focus-visible:border-input",
        underlined: "border-0 border-b border-input rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary",
      },
      size: {
        default: "h-10",
        sm: "h-8 text-xs px-3",
        lg: "h-12 text-base px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Input({ className, type, variant, size, ...props }: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
