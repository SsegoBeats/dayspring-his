"use client"

import { useEffect, useState } from "react"
import { isQzEnabled, loadQz, initQz, listPrinters, getDefaultPrinterName, printCurrentPageViaQz } from "@/lib/printing"

export default function QzTestPage() {
  const [status, setStatus] = useState<string>("")
  const [printers, setPrinters] = useState<string[]>([])
  const [selected, setSelected] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [enabled] = useState(isQzEnabled())

  useEffect(() => {
    setStatus(enabled ? "QZ feature flag is ON" : "QZ feature flag is OFF (using browser print)")
  }, [enabled])

  const connect = async () => {
    try {
      setBusy(true)
      setStatus("Loading QZ...")
      await loadQz()
      await initQz()
      setStatus("QZ initialized. Use the buttons below.")
    } catch (e: any) {
      setStatus(`Error: ${e?.message || e}`)
    } finally { setBusy(false) }
  }

  const discover = async () => {
    try {
      setBusy(true)
      setStatus("Listing printers...")
      const list = await listPrinters()
      setPrinters(list)
      const def = await getDefaultPrinterName()
      if (def) setSelected(def)
      setStatus(`Found ${list.length} printer(s).`)
    } catch (e: any) {
      setStatus(`Error: ${e?.message || e}`)
    } finally { setBusy(false) }
  }

  const testPrint = async () => {
    try {
      setBusy(true)
      setStatus("Printing test...")
      await printCurrentPageViaQz()
      setStatus("Print requested via QZ")
    } catch (e: any) {
      setStatus(`Error: ${e?.message || e}`)
    } finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <h1>QZ Tray - Test Page</h1>
      <p style={{ color: "#6b7280" }}>{status}</p>

      {!enabled && (
        <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", padding: 12, borderRadius: 6, marginTop: 12 }}>
          QZ is disabled. Set NEXT_PUBLIC_ENABLE_QZ_TRAY=true to enable integration. You can still use browser printing.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button disabled={busy} onClick={connect} style={{ border: "1px solid #e5e7eb", padding: "6px 10px", borderRadius: 6 }}>Connect</button>
        <button disabled={busy} onClick={discover} style={{ border: "1px solid #e5e7eb", padding: "6px 10px", borderRadius: 6 }}>List Printers</button>
        <button disabled={busy} onClick={testPrint} style={{ border: "1px solid #e5e7eb", padding: "6px 10px", borderRadius: 6 }}>Test Print</button>
      </div>

      {printers.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, color: "#6b7280" }}>Detected Printers</div>
          <ul>
            {printers.map((p) => (
              <li key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <input type="radio" name="printer" checked={selected === p} onChange={() => setSelected(p)} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            To set a default, define NEXT_PUBLIC_QZ_DEFAULT_PRINTER in your env. The code will match exact or partial names.
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
        <div style={{ fontWeight: 600 }}>Sample Receipt Preview</div>
        <div style={{ maxWidth: 520, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginTop: 8 }}>
          <div style={{ fontWeight: 600 }}>Dayspring Medical Center - Information System</div>
          <div style={{ color: "#6b7280", fontSize: 12 }}>Receipt Test</div>
          <div style={{ marginTop: 8 }}>
            <div><strong>Name:</strong> John Doe</div>
            <div><strong>Phone:</strong> +256700000000</div>
            <div><strong>P.ID:</strong> 000123</div>
          </div>
        </div>
      </div>
    </div>
  )}


