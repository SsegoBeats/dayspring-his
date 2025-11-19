"use client"

import type { LabResult } from "@/lib/medical-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Scan } from "lucide-react"

interface RadiologyTestQueueProps {
  tests: LabResult[]
  onSelectTest: (testId: string) => void
  emptyMessage: string
}

export function RadiologyTestQueue({ tests, onSelectTest, emptyMessage }: RadiologyTestQueueProps) {
  const sortedTests = [...tests].sort((a, b) => {
    const aDate = a.orderedDate ? new Date(a.orderedDate).getTime() : 0
    const bDate = b.orderedDate ? new Date(b.orderedDate).getTime() : 0
    return bDate - aDate
  })

  const formatDate = (value?: string) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getAge = (orderedDate?: string) => {
    if (!orderedDate) return { label: "-", severity: "none" as const }
    const orderedAt = new Date(orderedDate)
    if (Number.isNaN(orderedAt.getTime())) {
      return { label: "-", severity: "none" as const }
    }
    const diffMs = Date.now() - orderedAt.getTime()
    const diffMinutes = Math.floor(diffMs / (60 * 1000))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    let label: string
    if (diffDays > 0) {
      label = `${diffDays}d ${diffHours % 24}h`
    } else if (diffHours > 0) {
      label = `${diffHours}h`
    } else {
      label = `${Math.max(diffMinutes, 0)}m`
    }

    let severity: "none" | "warning" | "critical" = "none"
    if (diffHours >= 4 && diffHours < 24) severity = "warning"
    if (diffHours >= 24) severity = "critical"

    return { label, severity }
  }

  const formatAssignee = (test: LabResult) => {
    if (test.assignedToName) return test.assignedToName
    if (test.assignedToId) return "Assigned"
    return "Unassigned"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Radiology Scans</CardTitle>
        <CardDescription>
          High-priority worklist of radiology scan requests with aging, status, and assignment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Scan className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
            <p className="max-w-md text-xs text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Study</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTests.map((test) => {
                const age = getAge(test.orderedDate)
                const isPending = test.status === "pending"
                const ageClass =
                  !isPending || age.severity === "none"
                    ? "text-muted-foreground"
                    : age.severity === "warning"
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-destructive"

                const statusVariant =
                  test.status === "completed"
                    ? "default"
                    : test.status === "pending"
                      ? "secondary"
                      : "destructive"

                const priorityLabel = test.priority ? test.priority.toUpperCase() : "—"
                const priorityVariant =
                  test.priority === "stat"
                    ? "destructive"
                    : test.priority === "urgent"
                      ? "default"
                      : "outline"

                return (
                  <TableRow key={test.id} className={isPending ? "bg-background" : "bg-muted/30"}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{test.patientName || "Unknown patient"}</span>
                        <span className="text-xs text-muted-foreground">ID: {test.patientId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-foreground">{test.testType}</span>
                        <span className="text-xs text-muted-foreground">{test.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant}>{test.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant}>{priorityLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{formatAssignee(test)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{formatDate(test.orderedDate)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${ageClass}`}>{age.label}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => onSelectTest(test.id)}>
                        <FileText className="mr-2 h-4 w-4" />
                        {isPending ? "Start report" : "View report"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

