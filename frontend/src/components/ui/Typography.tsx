import * as React from "react"
import { cn } from "@/lib/ui"

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
}

export function Title({ as: Component = "h1", className, ...props }: TypographyProps) {
  return (
    <Component
      className={cn("text-2xl md:text-3xl font-black text-white tracking-tighter", className)}
      {...props}
    />
  )
}

export function Subtitle({ as: Component = "h2", className, ...props }: TypographyProps) {
  return (
    <Component
      className={cn("text-lg font-semibold text-foreground tracking-tight", className)}
      {...props}
    />
  )
}

export function Body({ as: Component = "p", className, ...props }: TypographyProps) {
  return (
    <Component
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  )
}

export function Caption({ as: Component = "span", className, ...props }: TypographyProps) {
  return (
    <Component
      className={cn("text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground", className)}
      {...props}
    />
  )
}

export function Label({ as: Component = "span", className, ...props }: TypographyProps) {
  return (
    <Component
      className={cn("text-[11px] font-black uppercase tracking-widest", className)}
      {...props}
    />
  )
}
