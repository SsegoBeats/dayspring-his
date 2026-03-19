"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useFormatDate } from "@/lib/date-utils"
import { useAuth } from "@/lib/auth-context"
import { FormatPreviewCard } from "./format-preview-card"

interface ExportTransactionsProps {
  onBack?: () => void
}

export function ExportTransactions({ onBack }: ExportTransactionsProps) {
  const { formatDate } = useFormatDate()
  const { user } = useAuth()
  const [dataset, setDataset] = useState<"billing" | "payments">("billing")
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("csv")
  const [dateRange, setDateRange] = useState<"7days" | "30days" | "90days" | "custom">("30days")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [status, setStatus] = useState<string>("all")
  const [method, setMethod] = useState<string>("all")
  const [exporting, setExporting] = useState(false)

  // Recent exports
  const RECENT_KEY = `cashier_recent_exports_${user?.id ?? "guest"}`
  type RecentExport = { dataset: string; format: string; dateRange: string; timestamp: string }
  const [recentExports, setRecentExports] = useState<RecentExport[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") } catch { return [] }
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      let fromDate: string
      let toDate: string = new Date().toISOString()

      if (dateRange === "custom") {
        if (!startDate || !endDate) {
          toast.error("Please select both start and end dates")
          setExporting(false)
          return
        }
        fromDate = new Date(startDate).toISOString()
        toDate = new Date(endDate).toISOString()
      } else {
        const days = dateRange === "7days" ? 7 : dateRange === "30days" ? 30 : 90
        fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      }

      const filters: any = {
        from: fromDate,
        to: toDate,
      }

      if (dataset === "billing" && status !== "all") {
        // Billing dataset expects capitalized status: Pending, Paid, Partially Paid, Cancelled
        filters.status =
          status === "pending"
            ? "Pending"
            : status === "paid"
              ? "Paid"
              : status === "partially paid"
                ? "Partially Paid"
                : "Cancelled"
      }

      if (dataset === "payments" && method !== "all") {
        filters.method = method
      }

      const response = await fetch("/api/exports/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          dataset,
          format,
          filters,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Export failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      const dateStr = formatDate(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' })
      a.download = `${dataset === "billing" ? "billing-ledger" : "payment-ledger"}-${dateRange}-${dateStr}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`${dataset === "billing" ? "Billing ledger" : "Payment ledger"} exported successfully as ${format.toUpperCase()}`)

      const newEntry: RecentExport = {
        dataset: dataset === "billing" ? "Billing Ledger" : "Payment Ledger",
        format: format.toUpperCase(),
        dateRange: dateRange === "7days" ? "Last 7 days" : dateRange === "30days" ? "Last 30 days" : dateRange === "90days" ? "Last 90 days" : `${startDate} – ${endDate}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
      const updated = [newEntry, ...recentExports].slice(0, 5)
      setRecentExports(updated)
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
    } catch (err: any) {
      toast.error(err.message || "Failed to export transactions")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Export Transactions</CardTitle>
          <CardDescription>Export invoices or captured payments in branded CSV, XLSX, or PDF formats.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Export Data</label>
            <div className="inline-flex rounded-full bg-muted/60 p-1">
              {(["billing", "payments"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDataset(d)}
                  className={
                    dataset === d
                      ? "rounded-full bg-white px-4 py-1 text-sm font-medium text-foreground shadow-sm"
                      : "px-4 py-1 text-sm text-muted-foreground"
                  }
                >
                  {d === "billing" ? "Billing Ledger" : "Payment Ledger"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Export Format</label>
            <div className="grid grid-cols-3 gap-3">
              {(["csv", "xlsx", "pdf"] as const).map((f) => (
                <FormatPreviewCard key={f} format={f} selected={format === f} onSelect={() => setFormat(f)} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateRange">Date Range</Label>
            <Select value={dateRange} onValueChange={(v: "7days" | "30days" | "90days" | "custom") => setDateRange(v)}>
              <SelectTrigger id="dateRange">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateRange === "custom" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
          )}

          {dataset === "billing" ? (
            <div className="space-y-2">
              <Label htmlFor="status">Bill Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially paid">Partially Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleExport} className="w-full" disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {dataset === "billing" ? "Billing Ledger" : "Payment Ledger"}
              </>
            )}
          </Button>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Recent exports</p>
            {recentExports.length === 0 ? (
              <p className="text-xs text-muted-foreground">No exports yet</p>
            ) : (
              <div className="space-y-1">
                {recentExports.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{e.dataset} · {e.format} · {e.dateRange} · Today {e.timestamp}</span>
                    <Download className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
