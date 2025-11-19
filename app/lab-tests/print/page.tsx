import { Suspense } from "react"
import BatchPrintClient from "./BatchPrintClient"

export default function BatchPrintPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <BatchPrintClient />
    </Suspense>
  )
}

