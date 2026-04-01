"use client"
import { useCallback, useEffect, useState } from "react"
import { Search, Eye } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth-context"
import { DentalVisitSummary, type DentalRecord } from "@/components/dentist/dental-visit-summary"

export function DentistPatientRecords() {
  const { user } = useAuth()
  const [records, setRecords] = useState<DentalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<DentalRecord | null>(null)

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadRecords = useCallback(async (s: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ mode: "mine", page: String(p) })
      if (s) params.set("search", s)
      const res = await fetch(`/api/dental/records?${params}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json().catch(() => ({}))
      setRecords(Array.isArray(data.records) ? data.records : [])
    } catch {
      toast.error("Failed to load dental records")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecords(debouncedSearch, page)
  }, [debouncedSearch, page, loadRecords])

  const canEdit = user?.role === "Dentist" || user?.role === "Hospital Admin"

  function handleUpdated(updated: DentalRecord) {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
    setSelectedRecord((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
  }

  function handleDeleted(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setSelectedRecord(null)
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by patient name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 focus-visible:ring-cyan-400"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-cyan-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cyan-50 bg-slate-50/60">
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Date</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Patient No.</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Patient</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 hidden md:table-cell">Diagnosis</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Procedure</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  {debouncedSearch ? `No records found for "${debouncedSearch}"` : "No dental records on file."}
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const patientName = [r.first_name, r.last_name].filter(Boolean).join(" ").trim()
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-cyan-50/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedRecord(r)}
                  >
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {r.visit_date ? String(r.visit_date).slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {r.patient_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{patientName || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell max-w-[200px] truncate">
                      {r.diagnosis ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell max-w-[200px] truncate">
                      {r.procedure_performed ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost"
                        className="text-cyan-600 hover:bg-cyan-50"
                        onClick={(e) => { e.stopPropagation(); setSelectedRecord(r) }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && records.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1}
              className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button size="sm" variant="outline"
              disabled={records.length < 20}
              className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Slide-over */}
      <Sheet open={!!selectedRecord} onOpenChange={(o) => { if (!o) setSelectedRecord(null) }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-slate-800">
              Dental Record
              {selectedRecord?.visit_date && (
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {String(selectedRecord.visit_date).slice(0, 10)}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedRecord && (
            <div className="mt-4">
              <DentalVisitSummary
                record={selectedRecord}
                canEdit={canEdit}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
