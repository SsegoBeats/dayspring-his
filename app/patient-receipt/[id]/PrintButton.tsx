"use client"

import { useEffect, useState } from "react"
import { isQzEnabled, printCurrentPageViaQz } from "@/lib/printing"

export function PrintButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>("")
  const enabled = isQzEnabled()

  // Auto-print if opened with ?auto=1 (only once, use browser print to avoid QZ permission dialogs)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const auto = params.get("auto") === "1"
    if (!auto) return
    
    // Check if we've already attempted auto-print (prevent multiple triggers)
    const autoPrintKey = `auto-print-${window.location.pathname}`
    if (sessionStorage.getItem(autoPrintKey)) return
    
    // Mark that we've attempted auto-print
    sessionStorage.setItem(autoPrintKey, 'true')
    
    // Add a small delay to ensure page is fully loaded and rendered
    const timeoutId = setTimeout(() => {
      try {
        // Use browser print for auto-print to avoid QZ Tray permission dialogs
        window.print()
      } catch (e: any) {
        console.error('Auto-print failed:', e)
      }
    }, 800) // 800ms delay to ensure page is fully rendered
    
    return () => clearTimeout(timeoutId)
  }, []) // Empty deps - only run once on mount

  const handleClick = async () => {
    try {
      setBusy(true)
      setError("")
      if (enabled) {
        await printCurrentPageViaQz()
      } else {
        window.print()
      }
    } catch (e: any) {
      setError(e?.message || "Print failed")
    } finally { setBusy(false) }
  }

  return (
    <div className="no-print">
      <button
        onClick={handleClick}
        disabled={busy}
        className="mt-4 rounded border px-3 py-1 text-sm disabled:opacity-60"
        title={enabled ? "Print via QZ Tray" : "Browser Print"}
      >
        {busy ? "Printing..." : enabled ? "Print (QZ Tray)" : "Print"}
      </button>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  )
}

