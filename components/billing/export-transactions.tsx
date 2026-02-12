"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2, FileText, FileSpreadsheet, File, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useFormatDate } from "@/lib/date-utils"

interface ExportTransactionsProps {
  onBack?: () => void
}

export function ExportTransactions({ onBack }: ExportTransactionsProps) {
  const { formatDate } = useFormatDate()
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("csv")
  const [dateRange, setDateRange] = useState<"7days" | "30days" | "90days" | "custom">("30days")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [status, setStatus] = useState<string>("all")
  const [exporting, setExporting] = useState(false)

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

      if (status !== "all") {
        filters.status = status
      }

      const response = await fetch("/api/exports/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          dataset: "billing",
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
      a.download = `transactions-${dateRange}-${dateStr}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Transactions exported successfully as ${format.toUpperCase()}`)
      if (onBack) {
        onBack()
      }
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
          <CardDescription>Export billing transactions in various formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={(v: "csv" | "xlsx" | "pdf") => setFormat(v)}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV (Comma Separated Values)
                  </div>
                </SelectItem>
                <SelectItem value="xlsx">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel (XLSX)
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4" />
                    PDF Document
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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

          <Button onClick={handleExport} className="w-full" disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Transactions
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
