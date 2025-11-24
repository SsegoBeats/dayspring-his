import { jsPDF } from 'jspdf'

type PDFColors = { headerBg: [number, number, number]; headerText: [number, number, number]; rowAltBg: [number, number, number]; text: [number, number, number] }

type PDFChart = { title: string; labels: string[]; values: number[]; max?: number }

export async function toPDF(
  title: string,
  rows: any[],
  watermark?: { userId?: string; timestamp?: string },
  landscape: boolean = false,
  options?: { colors?: Partial<PDFColors>; logoDataUrl?: string; meta?: Record<string, string>; subtitle?: string; groupByKey?: string; subGroupKey?: string; charts?: PDFChart[]; watermarkOpacity?: number }
) {
  try {
    const orientation = landscape ? 'landscape' : 'portrait'
    const doc = new jsPDF(orientation)

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const maxY = pageHeight - 20

    const defaultColors: PDFColors = {
      headerBg: [59, 130, 246],
      headerText: [255, 255, 255],
      rowAltBg: [243, 244, 246],
      text: [17, 24, 39],
    }
    const colors: PDFColors = { ...defaultColors, ...(options?.colors as any) }

    // Optional watermark logo (very light)
    try {
      if ((options as any)?.logoDataUrl) {
        // Use a balanced size: fit to ~50% of page with aspect-safe scaling
        // Base dimensions (pt) derived from 15.66cm x 20.93cm portrait
        const baseW = landscape ? 593 : 445
        const baseH = landscape ? 445 : 593
        const maxW = pageWidth * 0.55
        const maxH = pageHeight * 0.55
        const scale = Math.min(maxW / baseW, maxH / baseH, 1)
        const w = Math.max(220, baseW * scale)
        const h = Math.max(220, baseH * scale)
        const x = (pageWidth - w) / 2
        const y = (pageHeight - h) / 2
        const GStateCtor = (doc as any).GState
        if (GStateCtor) {
          // Use a slightly stronger opacity unless overridden
          const wmOpacity = Math.max(0, Math.min(1, (options as any)?.watermarkOpacity ?? 0.07))
          const gs = new GStateCtor({ opacity: wmOpacity })
          ;(doc as any).setGState(gs)
          doc.addImage((options as any).logoDataUrl, 'PNG', x, y, w, h, undefined, 'FAST')
          const gs1 = new GStateCtor({ opacity: 1 })
          ;(doc as any).setGState(gs1)
        }
      }
    } catch {}

    // Header: logo + title + optional subtitle + meta (right column)
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(16)
    let titleX = 20
    let headerBottomY = 26
    try {
      if ((options as any)?.logoDataUrl) {
        // Slightly larger logo (28x28)
        doc.addImage((options as any).logoDataUrl, 'PNG', 18, 8, 28, 28, undefined, 'FAST')
        titleX = 52
        headerBottomY = 30
      }
    } catch {}
    // Brand color + bold for title
    doc.setTextColor(14, 165, 233)
    try { doc.setFont(undefined as any, 'bold' as any) } catch {}
    // Reserve right column for meta (fixed width) and split the main title into
    // organization (first line) and report title (second line) when an en dash is present.
    // Keep the meta column reasonably narrow so it doesn't
    // overlap the left-side title/subtitle area. Use a dynamic
    // width capped by page size.
    const metaWidth = Math.min(100, Math.floor(pageWidth * 0.4))
    const rightMargin = 20
    const titleMaxWidth = Math.max(80, pageWidth - titleX - metaWidth - rightMargin)
    const dashIdx = title.indexOf(' — ')
    if (dashIdx > -1) {
      const orgTitle = title.slice(0, dashIdx).trim()
      const reportTitle = title.slice(dashIdx + 3).trim()
      const orgLines = doc.splitTextToSize(orgTitle, titleMaxWidth)
      doc.text(orgLines as any, titleX, 16)
      // Second line: report name below, also in brand color, normal weight for contrast
      try { doc.setFont(undefined as any, 'normal' as any) } catch {}
      const reportLines = doc.splitTextToSize(reportTitle, titleMaxWidth)
      const secondY = 16 + (Array.isArray(orgLines) ? (orgLines.length) * 6 : 6)
      doc.text(reportLines as any, titleX, secondY)
      try { doc.setFont(undefined as any, 'normal' as any) } catch {}
      headerBottomY = Math.max(headerBottomY, secondY + (Array.isArray(reportLines) ? (reportLines.length - 1) * 6 : 0))
    } else {
      const titleLines = doc.splitTextToSize(title, Math.max(120, titleMaxWidth))
      doc.text(titleLines as any, titleX, 18)
      headerBottomY = Math.max(headerBottomY, 18 + (Array.isArray(titleLines) ? (titleLines.length - 1) * 6 : 0))
    }
    try { doc.setFont(undefined as any, 'normal' as any) } catch {}
    if (options?.subtitle) {
      doc.setFontSize(10)
      doc.setTextColor(100)
      const subMaxWidth = Math.max(120, pageWidth - titleX - metaWidth - rightMargin)
      const subLines = doc.splitTextToSize(options.subtitle, Math.max(120, subMaxWidth))
      // Pull subtitle closer to the title (from +6 to +3)
      doc.text(subLines as any, titleX, headerBottomY + 3)
      headerBottomY = headerBottomY + 3 + (Array.isArray(subLines) ? (subLines.length - 1) * 5 : 0)
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2])
    }
    // Reset text color for rest of content
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2])
    // Right meta column including Generated timestamp
    if (watermark?.timestamp || (options?.meta && Object.keys(options.meta).length)) {
      // Start the right-side meta block slightly lower and use
      // taller line height for better readability and separation
      // from the left subtitle/title.
      let y = 24
      doc.setFontSize(9)
      doc.setTextColor(90)
      if (watermark?.timestamp) {
        doc.text(`Generated: ${new Date(watermark.timestamp).toLocaleString()}`, pageWidth - rightMargin, y, { align: 'right' as any })
        y += 6
      }
      if (options?.meta && Object.keys(options.meta).length) {
        for (const [k, v] of Object.entries(options.meta)) {
          const metaLine = `${k}: ${v}`
          const split = doc.splitTextToSize(metaLine, metaWidth)
          const lineHeight = 6
          for (let i = 0; i < split.length; i++) {
            doc.text(String(split[i]), pageWidth - rightMargin, y, { align: 'right' as any })
            y += lineHeight
          }
        }
      }
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2])
      // Add a tiny buffer below meta block
      headerBottomY = Math.max(headerBottomY, y + 2)
    }

    // Draw subtle separator below header and add breathing room before content
    doc.setDrawColor(230)
    doc.line(20, headerBottomY + 4, pageWidth - 20, headerBottomY + 4)
    const contentTopY = headerBottomY + 10

    // Optional inline bar charts (compact), stacked vertically
    try {
      const charts = (options as any)?.charts as PDFChart[] | undefined
      if (charts && charts.length) {
        const marginLeft = 20
        const marginRight = 20
        const areaHeight = 40
        const areaWidth = pageWidth - marginLeft - marginRight
        let yTop = contentTopY
        for (const chart of charts) {
          if (!chart || !Array.isArray(chart.labels) || !Array.isArray(chart.values) || !chart.labels.length || !chart.values.length) continue
          // New page if needed
          if (yTop + areaHeight + 14 > pageHeight - 40) { doc.addPage(orientation); yTop = 30 }
          doc.setFontSize(10)
          doc.setTextColor(60)
          doc.text(chart.title, marginLeft, yTop - 2)
          const n = Math.min(chart.values.length, 24)
          const values = chart.values.slice(-n)
          const labels = chart.labels.slice(-n)
          const maxVal = Math.max(1, chart.max || Math.max(...values))
          const barGap = 2
          const barWidth = Math.max(2, Math.floor((areaWidth - barGap * (n - 1)) / n))
          let x = marginLeft
          for (let i = 0; i < n; i++) {
            const v = values[i]
            const h = Math.max(1, Math.floor((v / maxVal) * areaHeight))
            const y = yTop + areaHeight - h
            doc.setFillColor(14,165,233)
            doc.rect(x, y, barWidth, h, 'F')
            x += barWidth + barGap
          }
          // X-axis and labels
          doc.setDrawColor(200)
          doc.line(marginLeft, yTop + areaHeight + 0.5, marginLeft + areaWidth, yTop + areaHeight + 0.5)
          doc.setFontSize(7)
          doc.setTextColor(120)
          const step = Math.max(1, Math.floor(n / 6))
          for (let i = 0; i < n; i += step) {
            const lx = marginLeft + i * (barWidth + barGap)
            const lblFull = String(labels[i])
            const lbl = /\d{2}:\d{2}/.test(lblFull.slice(-5)) ? lblFull.slice(-5) : lblFull
            doc.text(lbl, lx + 1, yTop + areaHeight + 6)
          }
          yTop += areaHeight + 14
          doc.setTextColor(colors.text[0], colors.text[1], colors.text[2])
        }
      }
    } catch {}

    // Table
    if (rows.length > 0) {
      const allKeys = Object.keys(rows[0])
      const groupKey = options?.groupByKey && allKeys.includes(options.groupByKey) ? options.groupByKey : undefined
      const subGroupKey = options?.subGroupKey && allKeys.includes(options.subGroupKey) ? options.subGroupKey : undefined
      const headers = allKeys.filter((k) => k !== groupKey && k !== subGroupKey)
      // Vertical offsets for table content on non-first pages.
      // Keep this tight but safe so headers/first rows aren't clipped.
      const pageTopMargin = 32
      const baseRowHeight = 11
      let yPosition = contentTopY
      const marginLeft = 20
      const marginRight = 20
      const availableWidth = pageWidth - marginLeft - marginRight
      // Compact but readable table font size
      const fontSize = 8

      // Auto-fit columns based on header + value lengths.
      const minColWidth = 40
      const maxColWidth = 200
      const colLengths = headers.map((h) => {
        let maxLen = String(h).length
        for (const row of rows) {
          const raw = (row as any)[h]
          const len = String(raw ?? "").length
          if (len > maxLen) maxLen = len
        }
        return maxLen
      })
      const totalLen = colLengths.reduce((a, b) => a + b, 0) || headers.length
      const rawWidths = colLengths.map((len) => {
        const fraction = len / totalLen
        const w = fraction * availableWidth
        return Math.max(minColWidth, Math.min(maxColWidth, w))
      })
      const sumRaw = rawWidths.reduce((a, b) => a + b, 0) || availableWidth
      const scale = availableWidth / sumRaw
      const colWidths = rawWidths.map((w) => w * scale)

      const drawHeaderRow = () => {
        // Compact header height
        const headerHeight = Math.max(10, fontSize + 3)
        doc.setFillColor(colors.headerBg[0], colors.headerBg[1], colors.headerBg[2])
        doc.rect(marginLeft, yPosition, availableWidth, headerHeight, 'F')
        doc.setFontSize(fontSize)
        doc.setTextColor(colors.headerText[0], colors.headerText[1], colors.headerText[2])
        let xPosition = marginLeft + 2
        headers.forEach((header, idx) => {
          const formattedHeader = header
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
          // Vertically center-ish text within the header band
          const baseline = yPosition + Math.min(8, Math.floor(headerHeight * 0.65))
          doc.text(formattedHeader.substring(0, 28), xPosition, baseline)
          xPosition += colWidths[idx]
        })
        // Minimal gap below header before first data row
        yPosition += headerHeight
        doc.setTextColor(colors.text[0], colors.text[1], colors.text[2])
      }

      const drawSectionBanner = (label: string) => {
        if (yPosition > maxY - 14) { doc.addPage(orientation); yPosition = pageTopMargin }
        // Section banner
        doc.setFillColor(229, 231, 235) // slate-200
        doc.rect(marginLeft, yPosition, availableWidth, 10, 'F')
        doc.setTextColor(31, 41, 55)
        try { doc.setFont(undefined as any, 'bold' as any) } catch {}
        doc.text(String(label), marginLeft + 4, yPosition + 7)
        try { doc.setFont(undefined as any, 'normal' as any) } catch {}
        yPosition += 12
        drawHeaderRow()
      }

      const drawSubHeader = (label: string) => {
        const rowHeight = baseRowHeight
        if (yPosition > maxY - (rowHeight + 2)) { doc.addPage(orientation); yPosition = pageTopMargin; drawHeaderRow() }
        doc.setTextColor(100)
        doc.setFontSize(fontSize)
        doc.text(String(label), marginLeft + 2, yPosition)
        yPosition += Math.min(12, rowHeight)
        doc.setTextColor(colors.text[0], colors.text[1], colors.text[2])
      }

      // Start with first header (or first section banner if grouping)
      let currentGroup: string | undefined = undefined
      let currentSub: string | undefined = undefined
      if (groupKey) {
        currentGroup = String(rows[0][groupKey] ?? '')
        drawSectionBanner(currentGroup)
        if (subGroupKey && rows[0][subGroupKey]) {
          currentSub = String(rows[0][subGroupKey])
          drawSubHeader(currentSub)
        }
      } else {
        drawHeaderRow()
      }

      rows.forEach((row, rowIndex) => {
        const rowHeight = baseRowHeight
        // New section?
        if (groupKey) {
          const gval = String(row[groupKey] ?? '')
          if (gval !== currentGroup) {
            currentGroup = gval
            currentSub = undefined
            drawSectionBanner(currentGroup)
          }
          if (subGroupKey) {
            const sval = String(row[subGroupKey] ?? '')
            if (sval && sval !== currentSub) {
              currentSub = sval
              drawSubHeader(currentSub)
            }
          }
        }
        if (yPosition > maxY - (rowHeight + 2)) {
          doc.addPage(orientation)
          yPosition = pageTopMargin
          drawHeaderRow()
        }

        // Alternate row shading
        if (!groupKey && rowIndex % 2 === 1) {
          doc.setFillColor(colors.rowAltBg[0], colors.rowAltBg[1], colors.rowAltBg[2])
          doc.rect(marginLeft, yPosition, availableWidth, rowHeight, 'F')
        }

        const baseline = yPosition + rowHeight - 3
        let xPosition = marginLeft + 2
        const values = headers.map((h) => String((row as any)[h] ?? ''))
        values.forEach((value, idx) => {
          const maxChars = Math.floor(colWidths[idx] / 3) * 3
          doc.text(value.substring(0, Math.max(10, maxChars)), xPosition, baseline)
          xPosition += colWidths[idx]
        })
        yPosition += rowHeight
      })
    } else {
      doc.setFontSize(12)
      doc.text('No data available for export', 20, 40)
    }

    // Footer with page numbers
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(`Page ${i} of ${pageCount}` , pageWidth - 20, pageHeight - 10, { align: 'right' as any })
    }

    const pdfOutput = doc.output('arraybuffer')
    return Buffer.from(pdfOutput)
  } catch (error) {
    console.error('PDF generation error:', error)
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

