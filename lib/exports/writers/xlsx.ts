import ExcelJS from "exceljs"
import sharp from "sharp"

function titleCase(s: string) {
  return s
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ")
}

type XlsxMeta = { title?: string; exportedBy?: string; timestamp?: string }

export async function toXLSX(
  rows: any[],
  opts?: {
    meta?: XlsxMeta
    columns?: string[]
    extraInfo?: Record<string, string>
    // Optional branding/header and watermark
    headerTitle?: string
    headerSubtitle?: string
    logoDataUrl?: string
    currencyCode?: string
    sheets?: Array<{ name: string; rows: any[] }>
    headerMap?: Record<string, string>
  },
) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Export")

  const keys = (opts?.columns && opts.columns.length)
    ? opts.columns
    : (rows.length ? Object.keys(rows[0]) : [])

  const lastCol = Math.max(1, keys.length)

  if (keys.length) {
    // Build the table first
    const headerMap = opts?.headerMap || {}
    ws.columns = keys.map((k) => ({
      header: headerMap[k] ?? titleCase(k),
      key: k,
    }))

    // Add rows and zebra striping
    rows.forEach((r, idx) => {
      const row = ws.addRow(r)
      row.alignment = { vertical: "middle", wrapText: true }
      if (idx % 2 === 1) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } } // gray-100
      }
    })

    // Insert branded header rows above the table
    const titleText = opts?.headerTitle || "Dayspring Medical Center"
    const subtitleText = opts?.headerSubtitle || "Dayspring Medical Center - Information System"
    ws.spliceRows(1, 0, [titleText], [subtitleText])

    // Re-style the now-shifted table header row (which moved to row 3)
    const headerRow = ws.getRow(3)
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    headerRow.alignment = { vertical: "middle", horizontal: "left" }
    headerRow.height = 18
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } }

    // Merge title and subtitle across all columns
    ws.mergeCells(1, 1, 1, lastCol)
    ws.mergeCells(2, 1, 2, lastCol)
    const titleRow = ws.getRow(1)
    const titleCell = ws.getCell(1, 1)
    titleRow.height = 24
    titleCell.font = { bold: true, size: 18, color: { argb: "FF0EA5E9" } } // sky-500
    titleCell.alignment = { horizontal: "center", vertical: "middle" }
    titleCell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } }

    const subtitleRow = ws.getRow(2)
    const subtitleCell = ws.getCell(2, 1)
    subtitleRow.height = 18
    subtitleCell.font = { size: 12, italic: true, color: { argb: "FF64748B" } } // slate-500
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" }

    // Freeze just below subtitle (so table header stays visible too)
    ws.views = [{ state: "frozen", ySplit: 3 }]

    // Auto width per column and currency formatting
    ws.columns.forEach((col) => {
      const maxLength = Math.max(
        (col.header ? String(col.header).length : 10),
        ...rows.map((r) => (r[col.key as string] != null ? String(r[col.key as string]).length : 0)),
      )
      col.width = Math.min(Math.max(10, Math.ceil(maxLength * 1.2)), 50)
      // Currency formatting for amount-like columns
      const keyLc = String(col.key || '').toLowerCase()
      const hdrLc = String(col.header || '').toLowerCase()
      if (
        keyLc.includes('amount') ||
        hdrLc.includes('amount') ||
        keyLc.includes('total') ||
        hdrLc.includes('total') ||
        keyLc.includes('price') ||
        hdrLc.includes('price')
      ) {
        const code = opts?.currencyCode || 'UGX'
        const numFmt =
          code === 'UGX' || code === 'KES' ? `[$${code}] #,##0` : `[$${code}] #,##0.00`
        ;(col as any).numFmt = numFmt
      }
    })
  }

  // Meta sheet (export details)
  if (opts?.meta || opts?.extraInfo) {
    const meta = wb.addWorksheet("Info")
    meta.columns = [
      { header: "Field", key: "field", width: 22 },
      { header: "Value", key: "value", width: 60 },
    ]
    const rowsMeta: Array<{ field: string; value: string }> = []
    if (opts?.meta?.title) rowsMeta.push({ field: "Title", value: String(opts.meta.title) })
    if (opts?.meta?.exportedBy) rowsMeta.push({ field: "Exported By", value: String(opts.meta.exportedBy) })
    if (opts?.meta?.timestamp) rowsMeta.push({ field: "Generated", value: new Date(opts.meta.timestamp).toLocaleString() })
    // Add location if present in extraInfo/meta
    if (opts?.meta && (opts.meta as any).Location) rowsMeta.push({ field: "Location", value: String((opts.meta as any).Location) })
    if (opts?.extraInfo) {
      for (const [k, v] of Object.entries(opts.extraInfo)) {
        rowsMeta.push({ field: k, value: String(v) })
      }
    }
    rowsMeta.push({ field: "Row Count", value: String(rows.length) })
    rowsMeta.forEach((m) => meta.addRow(m))
    const header = meta.getRow(1)
    header.font = { bold: true }

    // Highlight KPI-like values when present
    try {
      for (let i = 2; i <= meta.rowCount; i++) {
        const f = String(meta.getCell(i, 1).value || '')
        const vRaw = String(meta.getCell(i, 2).value || '')
        const vNum = Number(vRaw)
        const isAvg = f.includes('Avg Wait') || f.includes('Avg In Service')
        if (isAvg && !isNaN(vNum)) {
          const cell = meta.getCell(i, 2)
          if (vNum > 60) {
            cell.font = { color: { argb: 'FFB91C1C' }, bold: true } // red-700
          } else if (vNum > 30) {
            cell.font = { color: { argb: 'FFB45309' }, bold: true } // amber-700
          } else {
            cell.font = { color: { argb: 'FF64748B' } } // slate-500
          }
        }
        if (f.toLowerCase().includes('total')) {
          meta.getCell(i, 2).font = { bold: true }
        }
      }
    } catch {}
  }

  // Add transparent logo background + faint watermark image to the main sheet if provided
  if (opts?.logoDataUrl) {
    try {
      const base64 = typeof opts.logoDataUrl === 'string' && opts.logoDataUrl.startsWith('data:')
        ? opts.logoDataUrl.split(',')[1]
        : (typeof opts.logoDataUrl === 'string' ? opts.logoDataUrl : undefined)
      const raw = base64 ? Buffer.from(base64, 'base64') : Buffer.from([])
      const inputBuffer = base64 ? raw : Buffer.isBuffer(opts.logoDataUrl) ? (opts.logoDataUrl as any as Buffer) : undefined
      if (inputBuffer && inputBuffer.length > 0) {
        const transparent = await sharp(inputBuffer).removeAlpha().ensureAlpha(0.08).png().toBuffer()
        const imgId = wb.addImage({ buffer: transparent, extension: 'png' })
        // Background image (Excel displays but does not print). We keep this for
        // visual context when editing.
        try { ws.addBackgroundImage(imgId) } catch {}
        // Also add a faint watermark image so it appears in print/export across viewers
        // Position roughly centered below the header, spanning multiple columns/rows.
        try {
          const tlRow = 6 // below the frozen header rows
          const tlCol = 1
          const brRow = 38
          const brCol = Math.max(2, lastCol)
          ws.addImage(imgId, {
            tl: { col: tlCol - 0.5, row: tlRow - 0.5 },
            br: { col: brCol - 0.5, row: brRow - 0.5 },
            editAs: 'oneCell' as any,
          })
        } catch {}
      }
    } catch {}
  }

  // Additional sheets (per-department, etc.)
  if (opts?.sheets && Array.isArray(opts.sheets) && opts.sheets.length) {
    for (const sheet of opts.sheets) {
      const name = (sheet.name || 'Sheet').toString().slice(0, 31)
      const ws2 = wb.addWorksheet(name)
      const keys2 = sheet.rows.length ? Object.keys(sheet.rows[0]) : []
      if (keys2.length) {
        const headerMap2 = opts?.headerMap || {}
        ws2.columns = keys2.map((k) => ({
          header: headerMap2[k] ?? titleCase(k),
          key: k,
        }))
        sheet.rows.forEach((r, idx) => {
          const row = ws2.addRow(r)
          row.alignment = { vertical: 'middle', wrapText: true }
          if (idx % 2 === 1) {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
          }
        })
        // Branded header
        const lastCol2 = Math.max(1, keys2.length)
        ws2.spliceRows(1, 0, [opts?.headerTitle || 'Dayspring Medical Center'], [opts?.headerSubtitle || 'Dayspring Medical Center - Information System'])
        const headerRow2 = ws2.getRow(3)
        headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        headerRow2.alignment = { vertical: 'middle', horizontal: 'left' }
        headerRow2.height = 18
        headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }
        ws2.mergeCells(1, 1, 1, lastCol2)
        ws2.mergeCells(2, 1, 2, lastCol2)
        const titleCell2 = ws2.getCell(1, 1)
        ws2.getRow(1).height = 24
        titleCell2.font = { bold: true, size: 18, color: { argb: 'FF0EA5E9' } }
        titleCell2.alignment = { horizontal: 'center', vertical: 'middle' }
        ws2.views = [{ state: 'frozen', ySplit: 3 }]
        // Auto widths and amount formatting
        ws2.columns.forEach((col) => {
          const maxLength = Math.max(
            (col.header ? String(col.header).length : 10),
            ...sheet.rows.map((r) => (r[col.key as string] != null ? String(r[col.key as string]).length : 0)),
          )
          col.width = Math.min(Math.max(10, Math.ceil(maxLength * 1.2)), 50)
          const keyLc = String(col.key || '').toLowerCase()
          const hdrLc = String(col.header || '').toLowerCase()
          if (
            keyLc.includes('amount') ||
            hdrLc.includes('amount') ||
            keyLc.includes('total') ||
            hdrLc.includes('total') ||
            keyLc.includes('price') ||
            hdrLc.includes('price')
          ) {
            const code = opts?.currencyCode || 'UGX'
            const numFmt =
              code === 'UGX' || code === 'KES' ? `[$${code}] #,##0` : `[$${code}] #,##0.00`
            ;(col as any).numFmt = numFmt
          }
        })
      }
      // Optional logo background on extra sheets
      if (opts?.logoDataUrl) {
        try {
          const base64 = typeof opts.logoDataUrl === 'string' && opts.logoDataUrl.startsWith('data:')
            ? opts.logoDataUrl.split(',')[1]
            : (typeof opts.logoDataUrl === 'string' ? opts.logoDataUrl : undefined)
          const raw = base64 ? Buffer.from(base64, 'base64') : Buffer.from([])
          const inputBuffer = base64 ? raw : Buffer.isBuffer(opts.logoDataUrl) ? (opts.logoDataUrl as any as Buffer) : undefined
          if (inputBuffer && inputBuffer.length > 0) {
            const transparent = await sharp(inputBuffer).removeAlpha().ensureAlpha(0.08).png().toBuffer()
            const imgId = wb.addImage({ buffer: transparent, extension: 'png' })
            try { ws2.addBackgroundImage(imgId) } catch {}
            try {
              const tlRow = 6
              const tlCol = 1
              const brRow = 38
              const brCol = Math.max(2, lastCol2)
              ws2.addImage(imgId, {
                tl: { col: tlCol - 0.5, row: tlRow - 0.5 },
                br: { col: brCol - 0.5, row: brRow - 0.5 },
                editAs: 'oneCell' as any,
              })
            } catch {}
          }
        } catch {}
      }
    }
  }

  return await wb.xlsx.writeBuffer()
}


