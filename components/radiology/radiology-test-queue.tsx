"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { FileText, Scan, CheckSquare, Square } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatPatientNumber } from "@/lib/patients"
import { type RadiologyStudy, formatStudyPriority, formatStudyStatus } from "@/lib/radiology"

interface RadiologyTestQueueProps {
  tests: RadiologyStudy[]
  onSelectTest: (testId: string) => void
  emptyMessage: string
  sortBy?: string
  selectedTests?: Set<string>
  onToggleTest?: (testId: string) => void
  onSelectAll?: () => void
  onDeselectAll?: () => void
  showBulkActions?: boolean
  onBulkAssign?: (testIds: string[]) => void
  onBulkUpdateStatus?: (testIds: string[]) => void
}

function getOrderedTime(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getAgeMeta(orderedAt?: string | null) {
  const date = getOrderedTime(orderedAt)
  if (!date) return { label: "-", severity: "none" as const }

  const diffHours = (Date.now() - date.getTime()) / (60 * 60 * 1000)
  const label = formatDistanceToNowStrict(date, { addSuffix: false })
  if (diffHours >= 24) return { label, severity: "critical" as const }
  if (diffHours >= 4) return { label, severity: "warning" as const }
  return { label, severity: "none" as const }
}

export function RadiologyTestQueue({
  tests,
  onSelectTest,
  emptyMessage,
  sortBy = "ordered-desc",
  selectedTests = new Set(),
  onToggleTest,
  onSelectAll,
  onDeselectAll,
  showBulkActions = false,
  onBulkAssign,
  onBulkUpdateStatus,
}: RadiologyTestQueueProps) {
  const sortedTests = [...tests].sort((a, b) => {
    const orderedA = getOrderedTime(a.orderedAt)?.getTime() || 0
    const orderedB = getOrderedTime(b.orderedAt)?.getTime() || 0

    switch (sortBy) {
      case "ordered-asc":
        return orderedA - orderedB
      case "priority": {
        const rank = { stat: 3, urgent: 2, routine: 1 }
        const diff = rank[b.priority] - rank[a.priority]
        return diff !== 0 ? diff : orderedB - orderedA
      }
      case "age":
        return orderedA - orderedB
      case "patient":
        return `${a.patientName}`.localeCompare(`${b.patientName}`) || orderedB - orderedA
      case "ordered-desc":
      default:
        return orderedB - orderedA
    }
  })

  const allVisibleSelected = tests.length > 0 && tests.every((test) => selectedTests.has(test.id))
  const someSelected = tests.some((test) => selectedTests.has(test.id))

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Radiology Worklist</CardTitle>
            <CardDescription>
              Review active studies, assignment ownership, and turnaround pressure in one table.
            </CardDescription>
          </div>
          {showBulkActions && someSelected ? (
            <div className="flex flex-wrap gap-2">
              {onBulkAssign ? (
                <Button variant="outline" size="sm" onClick={() => onBulkAssign(Array.from(selectedTests))}>
                  Assign Selected ({selectedTests.size})
                </Button>
              ) : null}
              {onBulkUpdateStatus ? (
                <Button variant="outline" size="sm" onClick={() => onBulkUpdateStatus(Array.from(selectedTests))}>
                  Update Status ({selectedTests.size})
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sortedTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <Scan className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No studies in this view</p>
              <p className="max-w-md text-xs text-muted-foreground">{emptyMessage}</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {showBulkActions ? (
                  <TableHead className="w-12">
                    <button
                      type="button"
                      onClick={() => {
                        if (allVisibleSelected) {
                          onDeselectAll?.()
                          return
                        }
                        onSelectAll?.()
                      }}
                      className="rounded p-1 hover:bg-muted"
                      aria-label={allVisibleSelected ? "Deselect all studies" : "Select all studies"}
                    >
                      {allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  </TableHead>
                ) : null}
                <TableHead>Patient</TableHead>
                <TableHead>Study</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="w-[140px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTests.map((test) => {
                const age = getAgeMeta(test.orderedAt)
                const ageClass =
                  age.severity === "critical"
                    ? "text-red-600"
                    : age.severity === "warning"
                      ? "text-amber-600"
                      : "text-muted-foreground"
                const statusVariant =
                  test.status === "completed"
                    ? "default"
                    : test.status === "cancelled"
                      ? "destructive"
                      : "secondary"
                const priorityVariant =
                  test.priority === "stat"
                    ? "destructive"
                    : test.priority === "urgent"
                      ? "default"
                      : "outline"

                const isStatRow = test.priority === "stat"
                const isOverdue = getAgeMeta(test.orderedAt).severity === "critical"

                return (
                  <TableRow
                    key={test.id}
                    className={`cursor-pointer transition-colors ${
                      isStatRow
                        ? "border-l-2 border-l-red-500 bg-red-50/40 hover:bg-red-50/60 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                        : isOverdue
                          ? "border-l-2 border-l-amber-400 bg-amber-50/30 hover:bg-amber-50/50 dark:bg-amber-950/10 dark:hover:bg-amber-950/20"
                          : "hover:bg-muted/30"
                    }`}
                    onClick={() => onSelectTest(test.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onSelectTest(test.id)
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Open radiology study ${test.testName} for ${test.patientName}`}
                  >
                    {showBulkActions ? (
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedTests.has(test.id)}
                          onCheckedChange={() => onToggleTest?.(test.id)}
                          aria-label={`Select ${test.testName} for ${test.patientName}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{test.patientName || "Unknown patient"}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatPatientNumber(test.patientNumber)} {test.patientId ? `- ${test.patientId.slice(0, 8)}` : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{test.testName}</span>
                        <span className="text-xs text-muted-foreground">
                          {test.accessionNumber || test.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant}>{formatStudyStatus(test.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant}>{formatStudyPriority(test.priority)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{test.assignedToName || "Unassigned"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">
                        {getOrderedTime(test.orderedAt)?.toLocaleString() || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${ageClass}`}>{age.label}</span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => onSelectTest(test.id)}>
                        <FileText className="mr-2 h-4 w-4" />
                        {test.status === "completed" ? "View Report" : "Open Study"}
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
