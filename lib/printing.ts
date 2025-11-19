"use client"

// QZ Tray client-side helper with feature flag
// Requires env:
// - NEXT_PUBLIC_ENABLE_QZ_TRAY=true
// - NEXT_PUBLIC_QZ_DEFAULT_PRINTER (optional, e.g., "RECEPTION RECEIPT")
// Server requires env:
// - QZ_PUBLIC_CERT (PEM)
// - QZ_PRIVATE_KEY (PEM)

declare global {
  interface Window { qz?: any }
}

const QZ_SOURCES = [
  // Official
  "https://qz.io/js/qz-tray.js",
  // Popular CDNs
  "https://cdnjs.cloudflare.com/ajax/libs/qz-tray/2.1.6/qz-tray.js",
  "https://cdn.jsdelivr.net/npm/qz-tray@2.1.6/qz-tray.js",
  // Local fallback (place a copy at public/vendor/qz-tray.js if needed)
  "/vendor/qz-tray.js",
]

export function isQzEnabled() {
  return String(process.env.NEXT_PUBLIC_ENABLE_QZ_TRAY || "").toLowerCase() === "true"
}

export async function loadQz(): Promise<any> {
  if (!isQzEnabled()) throw new Error("QZ Tray disabled")
  if (window.qz) return window.qz
  let lastErr: any = null
  for (const src of QZ_SOURCES) {
    try {
      // Skip duplicate loads
      if ([...document.scripts].some((el) => el.src === src)) {
        if (window.qz) return window.qz
      }
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script")
        s.src = src
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      })
      if (window.qz) return window.qz
    } catch (e) {
      lastErr = e
      // try next source
    }
  }
  throw new Error(`Failed to load qz-tray.js${lastErr ? `: ${lastErr.message || lastErr}` : ''}`)
}

export async function initQz(): Promise<any> {
  const qz = await loadQz()
  // Certificate promise supplies public cert from the server env
  // QZ v2.x uses qz.security.* API
  try {
    qz.security.setCertificatePromise(async () => {
      try {
        const res = await fetch("/api/printing/qz-sign?mode=cert", { method: "GET", credentials: "include" })
        if (!res.ok) throw new Error("Failed to load QZ cert")
        return res.text()
      } catch {
        // Dev fallback: unsigned connection
        return null as any
      }
    })
    // Signature promise asks server to sign the challenge
    qz.security.setSignaturePromise(async (toSign: string) => {
      try {
        const res = await fetch("/api/printing/qz-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ toSign }),
        })
        if (!res.ok) throw new Error("Signature failed")
        const { signature } = await res.json()
        return signature
      } catch {
        // Dev fallback: allow unsigned
        return null as any
      }
    })
  } catch (e) {
    // Fallback: insecure mode (dev only). QZ will prompt and may allow unsigned connections.
    // Do NOT use in production.
    qz.security.setCertificatePromise(() => Promise.resolve(null))
    qz.security.setSignaturePromise(() => Promise.resolve(null as any))
  }
  return qz
}

export async function listPrinters(): Promise<string[]> {
  const qz = await initQz()
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
  }
  return qz.printers.find()
}

export async function getDefaultPrinterName(): Promise<string | undefined> {
  const desired = (process.env.NEXT_PUBLIC_QZ_DEFAULT_PRINTER || "").trim()
  const printers = await listPrinters()
  if (desired) {
    // Exact match first, then contains
    const exact = printers.find((p: string) => p === desired)
    if (exact) return exact
    const contains = printers.find((p: string) => p.toLowerCase().includes(desired.toLowerCase()))
    if (contains) return contains
  }
  // Heuristics: look for receipt-like printers
  const receipt = printers.find((p: string) => /receipt|pos|80mm|thermal/i.test(p))
  return receipt || printers[0]
}

export async function printCurrentPageViaQz(): Promise<void> {
  const qz = await initQz()
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
  }
  const printer = await getDefaultPrinterName()
  if (!printer) throw new Error("No printers found")
  const cfg = qz.configs.create(printer, {
    // Try to encourage 80mm-like width for receipts
    size: { width: 80, units: "mm" },
    rasterize: true,
    colorType: "grayscale",
    copies: 1,
    margins: { top: 5, right: 5, bottom: 5, left: 5 },
  })
  const url = window.location.href
  const data = [{ type: "html", format: "file", data: url }]
  await qz.print(cfg, data)
}
