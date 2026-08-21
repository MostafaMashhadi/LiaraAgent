import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const dialogVariants = cva(
  "fixed inset-0 z-50 flex items-center justify-center",
  {
    variants: {
      size: {
        default: "",
        sm: "items-start p-4",
        lg: "items-center p-8",
        full: "items-center p-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const dialogContentVariants = cva(
  "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-card p-6 shadow-lg elevation-5 duration-200 rounded-2xl",
  {
    variants: {
      size: {
        default: "max-w-lg",
        sm: "max-w-sm",
        lg: "max-w-2xl",
        full: "max-w-5xl",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Dialog({ open, onOpenChange, children, size, ...props }: { open: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode; size?: "default" | "sm" | "lg" | "full" } & React.ComponentProps<"div">) {
  if (!open) return null
  return (
    <div className={cn(dialogVariants({ size }))} {...props}>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {children}
    </div>
  )
}

function DialogContent({ className, size, children, ...props }: React.ComponentProps<"div"> & VariantProps<typeof dialogContentVariants>) {
  return (
    <div className={cn(dialogContentVariants({ size, className }))} {...props}>
      {children}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("font-bold text-foreground text-lg", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex items-center justify-end gap-2 pt-4 border-t border-border", className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
