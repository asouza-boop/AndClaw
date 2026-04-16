import * as React from "react"
import { cn } from "@/lib/ui"

export function PageContainer({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("max-w-[1400px] mx-auto w-full p-4 md:p-6 lg:p-8 animate-in fade-in duration-700", className)} {...props}>
      {children}
    </div>
  )
}

export function Section({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("space-y-6", className)} {...props}>
      {children}
    </section>
  )
}

export function Grid({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)} {...props}>
      {children}
    </div>
  )
}

export function Stack({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-4", className)} {...props}>
      {children}
    </div>
  )
}
