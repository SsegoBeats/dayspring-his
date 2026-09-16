"use client"

import { CircleHelp } from "lucide-react"
import { Label } from "@/components/ui/label"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

export function InsuranceFieldLabel({
  htmlFor,
  children,
  help,
  required = false,
  className,
}: {
  htmlFor: string
  children: React.ReactNode
  help: string
  required?: boolean
  className?: string
}) {
  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <div className={cn("inline-flex items-center gap-1.5", className)}>
          <Label htmlFor={htmlFor} className="cursor-help">
            {children}
            {required ? " *" : ""}
          </Label>
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
            aria-hidden="true"
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="start" side="top" sideOffset={8} className="w-72 space-y-1.5">
        <div className="text-sm font-semibold text-foreground">
          {typeof children === "string" ? children : "Field help"}
          {required ? " *" : ""}
        </div>
        <div className="text-sm leading-5 text-muted-foreground">{help}</div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function InsuranceHoverNote({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 space-y-1.5">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-sm leading-5 text-muted-foreground">{description}</div>
      </HoverCardContent>
    </HoverCard>
  )
}
