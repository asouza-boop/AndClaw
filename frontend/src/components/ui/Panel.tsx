import * as React from "react"
import { cn } from "@/lib/ui"

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "sidebar"
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "glass", ...props }, ref) => {
    const variantClasses = {
      default: "bg-surface border border-white/5",
      glass: "glass-panel",
      sidebar: "glass-sidebar h-full"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "transition-all duration-300",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Panel.displayName = "Panel"
