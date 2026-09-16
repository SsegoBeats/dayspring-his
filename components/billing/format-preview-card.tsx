"use client"

import { FileText, FileSpreadsheet, File } from "lucide-react"

interface FormatPreviewCardProps {
  format: "csv" | "xlsx" | "pdf"
  selected: boolean
  onSelect: () => void
}

const FORMAT_META = {
  csv:  { Icon: FileText,        label: "CSV",  description: "Raw data, any tool" },
  xlsx: { Icon: FileSpreadsheet, label: "XLSX", description: "Formatted spreadsheet" },
  pdf:  { Icon: File,            label: "PDF",  description: "Branded report" },
} as const

export function FormatPreviewCard({ format, selected, onSelect }: FormatPreviewCardProps) {
  const { Icon, label, description } = FORMAT_META[format]
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-100 active:scale-95 ${
        selected
          ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <Icon className="h-12 w-12 text-muted-foreground" />
      <span className="font-semibold text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
