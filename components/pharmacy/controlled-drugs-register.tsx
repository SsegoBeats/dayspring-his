"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { usePharmacy } from "@/lib/pharmacy-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Download } from "lucide-react"

export function ControlledDrugsRegister() {
  const { user } = useAuth()
  const { medications } = usePharmacy()

  const [entries, setEntries] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ from: "", to: "", medication_id: "" })

  const totalPages = Math.max(1, Math.ceil(total / 50))

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.medication_id) params.set("medication_id", filters.medication_id)
      if (filters.from) params.set("from", filters.from)
      if (filters.to) params.set("to", filters.to)
      params.set("page", String(page))

      const res = await fetch(`/api/pharmacy/controlled-drugs?${params.toString()}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setEntries(data.entries ?? [])
      setTotal(Number(data.total ?? 0))
    } catch {
      setEntries([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const clearFilters = () => {
    setFilters({ from: "", to: "", medication_id: "" })
    setPage(1)
  }

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.medication_id) params.set("medication_id", filters.medication_id)
      if (filters.from) params.set("from", filters.from)
      if (filters.to) params.set("to", filters.to)

      const res = await fetch(`/api/pharmacy/controlled-drugs/export?${params.toString()}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Export failed")
      const data = await res.json()
      const rows: string[][] = [
        [
          "Date & Time",
          "Patient",
          "Prescriber",
          "Prescriber Reg #",
          "Medication",
          "Schedule Class",
          "Qty Dispensed",
          "Batch Number",
          "Running Balance",
          "Dispensed By",
          "Witness",
          "Notes",
        ],
        ...(data.entries ?? []).map((e: any) => [
          new Date(e.dispensed_at).toLocaleString(),
          e.patient_name ?? "",
          e.prescriber_name ?? "",
          e.prescriber_registration_number ?? "",
          e.medication_name ?? "",
          e.schedule_class ?? "",
          String(e.quantity_dispensed ?? ""),
          e.batch_number ?? "",
          String(e.running_balance ?? ""),
          e.dispensed_by_name ?? "",
          e.witness_name ?? "",
          e.notes ?? "",
        ]),
      ]

      const csvContent = rows
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `controlled-drugs-register-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch {
      // silently ignore export errors
    }
  }

  const scheduleBadgeVariant = (scheduleClass: string | null | undefined): "destructive" | "secondary" => {
    if (!scheduleClass) return "secondary"
    const upper = scheduleClass.toUpperCase()
    if (upper.includes("I") && !upper.includes("II") && !upper.includes("IV")) return "destructive"
    if (upper.includes("II")) return "destructive"
    return "secondary"
  }

  const controlledMedications = medications.filter((m: any) => m.is_controlled !== false)

  const isAdmin = user?.role === "Hospital Admin"

  return (
    <Card className="print:shadow-none print:border-0 rounded-xl border-border/80 shadow-sm">
      <CardHeader>
        {/* Print-only header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold uppercase tracking-wide">Dayspring Community Health Care</h1>
          <h2 className="text-base font-semibold">Controlled Drugs Register</h2>
          <p className="text-xs text-gray-600">Printed: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <CardTitle>Register Entries</CardTitle>
          </div>
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "entry" : "entries"} total
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="print:hidden flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Date From</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, from: e.target.value }))
                setPage(1)
              }}
              className="h-8 w-36 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Date To</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, to: e.target.value }))
                setPage(1)
              }}
              className="h-8 w-36 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Medication</Label>
            <Select
              value={filters.medication_id || "all"}
              onValueChange={(val) => {
                setFilters((f) => ({ ...f, medication_id: val === "all" ? "" : val }))
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-48 text-sm">
                <SelectValue placeholder="All medications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All medications</SelectItem>
                {controlledMedications.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-sm"
          >
            Clear Filters
          </Button>
          {isAdmin && (
            <Button
              variant="default"
              size="sm"
              onClick={exportCSV}
              className="h-8 gap-1.5 text-sm"
            >
              <Download className="h-4 w-4" />
              Export Register
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border">
          <Table className="print:text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Date &amp; Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Prescriber</TableHead>
                <TableHead>Medication</TableHead>
                <TableHead className="text-right">Qty Dispensed</TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
                <TableHead>Dispensed By</TableHead>
                <TableHead>Witness</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No entries found.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(entry.dispensed_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{entry.patient_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{entry.prescriber_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span>{entry.medication_name ?? "—"}</span>
                        {entry.schedule_class && (
                          <Badge
                            variant={scheduleBadgeVariant(entry.schedule_class)}
                            className="w-fit text-xs"
                          >
                            {entry.schedule_class}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {entry.quantity_dispensed ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${
                        Number(entry.running_balance) < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {entry.running_balance ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{entry.dispensed_by_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{entry.witness_name ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                      {entry.notes ?? ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="print:hidden flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({total} {total === 1 ? "entry" : "entries"})
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
