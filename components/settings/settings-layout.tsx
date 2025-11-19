"use client"

import { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"

interface SettingsLayoutProps {
  children: ReactNode
  title: string
  description: string
  icon: ReactNode
}

export function SettingsLayout({ children, title, description, icon }: SettingsLayoutProps) {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-blue-600 border-blue-200">
          {user?.role}
        </Badge>
      </div>

      {/* Content */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
        </CardContent>
      </Card>
    </div>
  )
}
