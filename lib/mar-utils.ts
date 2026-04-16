/**
 * Medication Administration Record (MAR) utilities.
 * Handles frequency parsing and due-time calculation for scheduled doses.
 */

export type DoseStatus = "given" | "due" | "delayed" | "missed" | "stat-pending" | "stat-given"

export interface ScheduledDose {
  scheduledAt: Date
  status: DoseStatus
  administrationId?: string
  administeredAt?: Date
  administeredBy?: string
  doseGiven?: string
}

/** Minutes of grace period before a delayed dose becomes "missed" */
const DELAYED_GRACE_MINUTES = 30

/** Maps frequency shorthand to doses per 24 hours */
const FREQUENCY_MAP: Record<string, number> = {
  OD: 1, "1/24": 1, DAILY: 1, QD: 1, QHS: 1,
  BD: 2, "2/24": 2, BID: 2,
  TDS: 3, "3/24": 3, TID: 3,
  QID: 4, "4/24": 4,
  Q6H: 4, "6/24": 4,
  Q8H: 3, "8/24": 3,
  Q12H: 2, "12/24": 2,
}

/** Returns doses per day (0 = stat/one-off). */
export function parseDosesPerDay(frequency: string): number {
  if (!frequency) return 1
  const upper = frequency.toUpperCase().trim()
  if (upper === "STAT" || upper === "IMMEDIATELY" || upper === "ONE-OFF") return 0
  return FREQUENCY_MAP[upper] ?? 1
}

/** Calculate scheduled dose times for a prescription (today's window by default). */
export function calculateScheduledTimes(
  frequency: string,
  startTime: Date,
  daysWindow = 1
): Date[] {
  const dosesPerDay = parseDosesPerDay(frequency)
  if (dosesPerDay === 0) return []

  const intervalHours = 24 / dosesPerDay
  const times: Date[] = []
  const anchor = new Date(startTime)
  anchor.setMinutes(0, 0, 0)

  for (let day = 0; day < daysWindow; day++) {
    for (let dose = 0; dose < dosesPerDay; dose++) {
      const t = new Date(anchor)
      t.setDate(t.getDate() + day)
      t.setHours(t.getHours() + dose * intervalHours)
      times.push(t)
    }
  }
  return times
}

/** Determine the status of a single scheduled dose. */
export function getDoseStatus(
  scheduledAt: Date,
  administrations: Array<{ administered_at: string; id: string }>,
  now = new Date()
): DoseStatus {
  const twoHours = 2 * 60 * 60 * 1000
  const given = administrations.find((a) =>
    Math.abs(new Date(a.administered_at).getTime() - scheduledAt.getTime()) < twoHours
  )
  if (given) return "given"

  const minutesOverdue = (now.getTime() - scheduledAt.getTime()) / 60000
  if (minutesOverdue < 0) return "due"
  if (minutesOverdue < DELAYED_GRACE_MINUTES) return "delayed"
  return "missed"
}
