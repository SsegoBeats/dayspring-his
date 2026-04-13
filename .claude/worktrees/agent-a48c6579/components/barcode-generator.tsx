"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

interface BarcodeGeneratorProps {
  value: string
  width?: number
  height?: number
  displayValue?: boolean
}

export function BarcodeGenerator({ value, width = 2, height = 50, displayValue = true }: BarcodeGeneratorProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format: "CODE128",
          width,
          height,
          displayValue,
          fontSize: 14,
          margin: 10,
        })
      } catch (error) {
        console.error("[v0] Barcode generation error:", error)
      }
    }
  }, [value, width, height, displayValue])

  return <svg ref={barcodeRef} />
}
