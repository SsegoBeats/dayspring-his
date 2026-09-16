/** Parse first integer from a string. Returns null if none found. */
export function numInt(s: string): number | null {
  const m = String(s || "").match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

/** Parse first float from a string (handles comma decimal separator). Returns null if none found. */
export function numFloat(s: string): number | null {
  const m = String(s || "").replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

/** Format blood pressure string to "120/80". Handles separators: /, -, space. */
export function fmtBP(s: string): string {
  const raw = String(s || "")
  const m = raw.match(/(\d+)\D+(\d+)/)
  if (m) return `${m[1]}/${m[2]}`
  const nums = raw.match(/\d+/g)
  if (nums && nums.length >= 2) return `${nums[0]}/${nums[1]}`
  const n = numInt(raw)
  return n == null ? "" : String(n)
}

/** Format temperature. Auto-converts F→C if value > 45. Returns "{n.toFixed(1)} C". */
export function fmtTemp(s: string): string {
  const n = numFloat(s)
  if (n == null) return ""
  const c = n > 45 ? (n - 32) * (5 / 9) : n
  return `${c.toFixed(1)} C`
}

/** Format heart rate. Returns "{n} bpm". */
export function fmtBpm(s: string): string {
  const n = numInt(s)
  return n == null ? "" : `${n} bpm`
}

/** Format respiratory rate. Returns "{n}/min". */
export function fmtRR(s: string): string {
  const n = numInt(s)
  return n == null ? "" : `${n}/min`
}

/** Format oxygen saturation. Returns "{n}%". */
export function fmtSpO2(s: string): string {
  const n = numInt(s)
  return n == null ? "" : `${n}%`
}

/** Format weight. Auto-converts lbs→kg if "lb" in string. Returns "{n.toFixed(1)} kg". */
export function fmtKg(s: string): string {
  const raw = String(s || "").toLowerCase()
  const n = numFloat(raw)
  if (n == null) return ""
  const kg = /lb/.test(raw) ? n * 0.453592 : n
  return `${kg.toFixed(1)} kg`
}

/** Format height. Handles cm, ft'in", and bare numbers. Returns "{n} cm". */
export function fmtCm(s: string): string {
  const raw = String(s || "")
  if (!raw) return ""
  if (/cm/i.test(raw)) {
    const n = numFloat(raw)
    return n == null ? "" : `${n.toFixed(0)} cm`
  }
  const m = raw.match(/(\d+)\s*'\s*(\d+)?/)
  if (m) {
    const ft = parseInt(m[1], 10) || 0
    const inches = parseInt(m[2] || "0", 10) || 0
    const cm = ft * 30.48 + inches * 2.54
    return `${Math.round(cm)} cm`
  }
  const n = numFloat(raw)
  return n == null ? "" : `${n.toFixed(0)} cm`
}
