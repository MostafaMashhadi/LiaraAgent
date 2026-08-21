import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const switchVariants = cva(
  "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-input data-[state=checked]:bg-primary",
        teal: "bg-input data-[state=checked]:bg-teal-500",
        mint: "bg-input data-[state=checked]:bg-mint",
      },
      size: {
        default: "h-6 w-11",
        sm: "h-5 w-9",
        lg: "h-7 w-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const switchThumbVariants = cva(
  "pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
  {
    variants: {
      size: {
        default: "h-5 w-5 translate-x-0 data-[state=checked]:translate-x-5",
        sm: "h-4 w-4 translate-x-0 data-[state=checked]:translate-x-4",
        lg: "h-6 w-6 translate-x-0 data-[state=checked]:translate-x-7",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Switch({ className, variant, size, checked, ...props }: React.ComponentProps<"button"> & VariantProps<typeof switchVariants> & { checked?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(switchVariants({ variant, size, className }))}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        className={cn(switchThumbVariants({ size }))}
      />
    </button>
  )
}

export { Switch }
