import { z } from "zod"

export const FamilyPlanningEventType = z.enum([
  "initiation",
  "continuation",
  "method_change",
  "discontinuation",
  "method_removal",
  "follow_up",
  "adverse_event",
])

export type FamilyPlanningEventTypeValue = z.infer<typeof FamilyPlanningEventType>

export const FamilyPlanningCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterDate: z.string().datetime().optional(),
  eventType: FamilyPlanningEventType,
  method: z.string().trim().min(1).max(80).optional().nullable(),
  status: z.enum(["active", "discontinued", "completed"]).optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
  removalReason: z.string().trim().max(1000).optional().nullable(),
  replacementMethod: z.string().trim().max(80).optional().nullable(),
  nextReviewDate: z.string().datetime().optional().nullable(),
  isPostpartum: z.boolean().default(false),
  postpartumWeeks: z.number().int().min(0).max(52).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  supersedesEventId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
})

export function isMethodRequired(eventType: FamilyPlanningEventTypeValue): boolean {
  return eventType === "initiation" || eventType === "continuation" || eventType === "method_change" || eventType === "method_removal"
}

export function isRemovalEvent(eventType: FamilyPlanningEventTypeValue): boolean {
  return eventType === "method_removal"
}

export function validateRemovalPayload(eventType: FamilyPlanningEventTypeValue, removalReason: string | null | undefined): string | null {
  if (!isRemovalEvent(eventType)) return null
  if (!String(removalReason || "").trim()) return "removalReason is required for method removal"
  return null
}

export function resolveEventStatus(
  eventType: FamilyPlanningEventTypeValue,
  status: "active" | "discontinued" | "completed" | null | undefined,
): "active" | "discontinued" | "completed" | null {
  if (eventType === "method_removal") return "discontinued"
  return status ?? null
}
