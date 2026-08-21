import React, { createContext, useContext } from 'react'
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const tabsListVariants = cva(
  "inline-flex items-center rounded-xl bg-muted p-1 text-muted-foreground",
  {
    variants: {
      variant: {
        default: "",
        pills: "bg-transparent p-0 gap-1",
        underlined: "bg-transparent p-0 border-b border-border rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:elevation-1",
  {
    variants: {
      variant: {
        default: "",
        pills: "rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
        underlined: "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:elevation-0",
      },
      size: {
        default: "",
        sm: "text-xs px-2 py-1",
        lg: "text-base px-4 py-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const TabsContext = createContext<{ value: string; onValueChange: (value: string) => void } | undefined>(undefined)

function Tabs({
  value,
  onValueChange,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: string; onValueChange: (value: string) => void }) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div
        data-slot="tabs"
        className={cn("flex flex-col gap-4", className)}
        {...props}
      />
    </TabsContext.Provider>
  )
}

function TabsList({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof tabsListVariants>) {
  return (
    <div
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant, className }))}
      {...props}
    />
  )
}

function TabsTrigger({ className, variant, size, value, ...props }: React.ComponentProps<"button"> & VariantProps<typeof tabsTriggerVariants> & { value: string }) {
  const ctx = useContext(TabsContext)
  const isActive = ctx?.value === value
  return (
    <button
      data-slot="tabs-trigger"
      data-state={isActive ? "active" : "inactive"}
      className={cn(tabsTriggerVariants({ variant, size, className }), isActive ? "" : "")}
      onClick={() => ctx?.onValueChange(value)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs-content"
      className={cn("mt-2 focus-visible:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
