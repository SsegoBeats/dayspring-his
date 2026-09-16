/**
 * Centralized export + download with error handling and user feedback.
 * Used by Reception Register and Queue Board to ensure consistent behavior
 * and proper error reporting when exports fail.
 */

export type ExportPayload = {
  dataset: string
  format: "csv" | "xlsx" | "pdf" | "ndjson"
  filters: Record<string, unknown>
  columns?: string[]
}

export interface ExportResult {
  ok: boolean
  errorMessage?: string
  status?: number
}

/**
 * Runs a single export: POST to /api/exports/direct, then triggers download on success.
 * Does not throw; returns result and triggers toast via optional callback.
 */
export async function runExport(
  payload: ExportPayload,
  filename: string,
  options?: {
    onError?: (message: string, status?: number) => void
    onSuccess?: (filename: string) => void
  }
): Promise<ExportResult> {
  try {
    const res = await fetch("/api/exports/direct", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      let errorMessage = `Export failed (${res.status})`
      const contentType = res.headers.get("content-type") ?? ""
      if (contentType.includes("application/json")) {
        try {
          const body = await res.json()
          errorMessage = (body as { error?: string }).error ?? errorMessage
          const details = (body as { details?: unknown }).details
          if (details && typeof details === "object" && Array.isArray((details as { message?: string }[]) as unknown[])) {
            const first = (details as { message?: string }[])[0]
            if (first?.message) errorMessage = first.message
          }
        } catch {
          // keep default errorMessage
        }
      }
      options?.onError?.(errorMessage, res.status)
      return { ok: false, errorMessage, status: res.status }
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    options?.onSuccess?.(filename)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed"
    options?.onError?.(message)
    return { ok: false, errorMessage: message }
  }
}

/**
 * Runs multiple exports in sequence, reporting each failure and a final summary.
 * Returns counts { success, failed } and list of failed labels.
 */
export async function runBatchExport(
  tasks: { payload: ExportPayload; filename: string; label: string }[],
  options?: {
    onError?: (label: string, message: string) => void
    onSuccess?: () => void
    onComplete?: (success: number, failed: number, failedLabels: string[]) => void
  }
): Promise<{ success: number; failed: number; failedLabels: string[] }> {
  let success = 0
  const failedLabels: string[] = []

  for (const t of tasks) {
    const result = await runExport(t.payload, t.filename, {
      onError: (msg) => {
        failedLabels.push(t.label)
        options?.onError?.(t.label, msg)
      },
      onSuccess: () => {
        success++
        options?.onSuccess?.()
      },
    })
    if (!result.ok && !failedLabels.includes(t.label)) failedLabels.push(t.label)
  }

  options?.onComplete?.(success, failedLabels.length, failedLabels)
  return { success, failed: failedLabels.length, failedLabels }
}
