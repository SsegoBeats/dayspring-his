"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

export type ToothState = "normal" | "caries" | "filled" | "crown" | "missing" | "extracted"

export type ToothEntry = { state: ToothState; notes?: string }

/**
 * Per-tooth FDI data keyed by tooth number string (e.g. "11", "48").
 * The special key "notes" may hold a global chart-note string (legacy).
 * All other keys hold ToothEntry objects or undefined.
 */
export type ToothChartData = {
  [toothId: string]: ToothEntry | string | undefined
}

export interface FdiToothChartProps {
  value: ToothChartData
  onChange: (data: ToothChartData) => void
  readOnly?: boolean
}

const STATE_CYCLE: ToothState[] = ["normal", "caries", "filled", "crown", "missing", "extracted"]

const STATE_STYLES: Record<ToothState, string> = {
  normal:    "bg-white border-cyan-200 text-transparent",
  caries:    "bg-amber-100 border-amber-400 text-amber-700",
  filled:    "bg-blue-100 border-blue-400 text-blue-700",
  crown:     "bg-purple-100 border-purple-400 text-purple-700",
  missing:   "bg-slate-100 border-slate-400 text-slate-500",
  extracted: "bg-rose-100 border-rose-400 text-rose-600",
}

const STATE_CODES: Record<ToothState, string> = {
  normal: "·", caries: "C", filled: "F", crown: "Cr", missing: "M", extracted: "X",
}

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]

const LEGEND = Object.entries(STATE_CODES).filter(([k]) => k !== "normal") as [ToothState, string][]

/** Safely extract a ToothEntry from a chart value (skips legacy string notes). */
function getEntry(chart: ToothChartData, id: string): ToothEntry | undefined {
  const v = chart[id]
  return typeof v === "object" && v !== null ? v : undefined
}

function normaliseChart(raw: ToothChartData | null | undefined): ToothChartData {
  if (!raw) return {}
  return raw
}

interface ToothBtnProps {
  id: number
  state: ToothState
  isSelected: boolean
  readOnly: boolean
  onToothClick: (id: number, e: React.MouseEvent) => void
}

function ToothBtn({ id, state, isSelected, readOnly, onToothClick }: ToothBtnProps) {
  return (
    <button
      type="button"
      title={readOnly ? `Tooth ${id}` : `Tooth ${id} — click to cycle, shift+click to reset`}
      onClick={(e) => onToothClick(id, e)}
      className={cn(
        "w-8 h-8 rounded border text-[10px] font-bold flex items-center justify-center transition-all select-none",
        STATE_STYLES[state],
        isSelected && "ring-2 ring-cyan-500 ring-offset-1",
        readOnly ? "cursor-default" : "cursor-pointer hover:opacity-80",
      )}
    >
      {STATE_CODES[state]}
    </button>
  )
}

interface ToothRowProps {
  teeth: number[]
  getState: (id: number) => ToothState
  selectedTooth: string | null
  readOnly: boolean
  onToothClick: (id: number, e: React.MouseEvent) => void
}

function ToothRow({ teeth, getState, selectedTooth, readOnly, onToothClick }: ToothRowProps) {
  return (
    <div className="flex gap-0.5">
      {teeth.map((id) => (
        <ToothBtn
          key={id}
          id={id}
          state={getState(id)}
          isSelected={selectedTooth === String(id)}
          readOnly={readOnly}
          onToothClick={onToothClick}
        />
      ))}
    </div>
  )
}

export function FdiToothChart({ value, onChange, readOnly = false }: FdiToothChartProps) {
  const chart = normaliseChart(value)
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)

  function getState(id: number): ToothState {
    return getEntry(chart, String(id))?.state ?? "normal"
  }

  function cycleState(id: number, e: React.MouseEvent) {
    if (readOnly) return
    const key = String(id)
    const current = getState(id)
    const next = e.shiftKey
      ? "normal"
      : STATE_CYCLE[(STATE_CYCLE.indexOf(current) + 1) % STATE_CYCLE.length]
    const updated: ToothChartData = { ...chart }
    if (next === "normal") {
      delete updated[key]
    } else {
      const existing = getEntry(chart, key)
      updated[key] = { ...existing, state: next }
    }
    onChange(updated)
  }

  function handleToothClick(id: number, e: React.MouseEvent) {
    if (readOnly) return
    cycleState(id, e)
    setSelectedTooth(selectedTooth === String(id) ? null : String(id))
  }

  function updateToothNote(id: string, notes: string) {
    const updated: ToothChartData = { ...chart }
    const existing = getEntry(chart, id)
    updated[id] = { state: existing?.state ?? "normal", notes }
    onChange(updated)
  }

  const rowProps = { getState, selectedTooth, readOnly, onToothClick: handleToothClick }

  return (
    <div className="space-y-2">
      {/* Upper arch */}
      <div className="flex gap-1 justify-center">
        <ToothRow teeth={UPPER_RIGHT} {...rowProps} />
        <div className="w-px bg-cyan-200 mx-1" />
        <ToothRow teeth={UPPER_LEFT} {...rowProps} />
      </div>
      {/* Arch labels */}
      <div className="flex justify-center gap-1">
        <span className="text-[9px] text-slate-400 w-[136px] text-right">Upper R</span>
        <span className="w-3" />
        <span className="text-[9px] text-slate-400 w-[136px]">Upper L</span>
      </div>
      {/* Lower arch */}
      <div className="flex gap-1 justify-center">
        <ToothRow teeth={LOWER_RIGHT} {...rowProps} />
        <div className="w-px bg-cyan-200 mx-1" />
        <ToothRow teeth={LOWER_LEFT} {...rowProps} />
      </div>
      <div className="flex justify-center gap-1">
        <span className="text-[9px] text-slate-400 w-[136px] text-right">Lower R</span>
        <span className="w-3" />
        <span className="text-[9px] text-slate-400 w-[136px]">Lower L</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center pt-1">
        {LEGEND.map(([state, code]) => (
          <span key={state} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border", STATE_STYLES[state])}>
            <span className="font-bold">{code}</span>
            <span className="capitalize opacity-70">{state}</span>
          </span>
        ))}
      </div>

      {/* Per-tooth notes panel (only when a tooth is selected and not read-only) */}
      {!readOnly && selectedTooth && (
        <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500">
            Tooth {selectedTooth} notes
          </p>
          <Textarea
            value={getEntry(chart, selectedTooth)?.notes ?? ""}
            onChange={(e) => updateToothNote(selectedTooth, e.target.value)}
            placeholder={`Notes for tooth ${selectedTooth}…`}
            className="min-h-[56px] text-sm focus-visible:ring-cyan-400"
          />
        </div>
      )}
    </div>
  )
}
