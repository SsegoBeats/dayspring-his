import { stringify } from "csv-stringify/sync"

function formatHeader(key: string) {
  return key
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ")
}

export function toCSV(
  rows: any[],
  header = true,
  opts?: { columns?: string[]; headerMap?: Record<string, string> },
) {
  const keys = (opts?.columns && opts.columns.length)
    ? opts.columns
    : (rows && rows.length ? Object.keys(rows[0]) : [])
  const columns = keys.map((k) => ({ key: k, header: opts?.headerMap?.[k] || formatHeader(k) }))
  return stringify(rows || [], { header, columns })
}


