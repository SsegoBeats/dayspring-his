import { z } from "zod"
import { query } from "@/lib/db"

export type ExportContext = { userId: string; role: string }
export type ExportResultRow = Record<string, any>

export interface Dataset {
  name: string
  defaultColumns: string[]
  validateFilters(input: any): any
  queryPage(
    ctx: ExportContext,
    filters: any,
    cursor?: any,
    pageSize?: number,
  ): Promise<{ rows: ExportResultRow[]; nextCursor?: any }>
}

// Appointments dataset
const Filter = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).optional(),
})

export class AppointmentsDataset implements Dataset {
  name = "appointments"
  defaultColumns = [
    "appointment_id",
    "scheduled_date",
    "scheduled_time",
    "status",
    "patient_name",
    "patient_phone",
    "department",
    "doctor_name",
  ]

  validateFilters(input: any) {
    return Filter.parse(input)
  }

  async queryPage(ctx: ExportContext, f: z.infer<typeof Filter>, cursor?: { after?: string }, pageSize = 5000) {
    const after = cursor?.after ?? null
    const { rows } = await query(
      `
      SELECT a.id AS appointment_id,
             a.appointment_date AS scheduled_date,
             a.appointment_time AS scheduled_time,
             a.status,
             CONCAT(p.first_name,' ',p.last_name) AS patient_name,
             p.phone AS patient_phone,
             a.department,
             u.name AS doctor_name
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      LEFT JOIN users u ON u.id = a.doctor_id
      WHERE (a.appointment_date || ' ' || a.appointment_time)::timestamp >= $1
        AND (a.appointment_date || ' ' || a.appointment_time)::timestamp <= $2
        AND ($3::text IS NULL OR a.status = $3)
        AND ($4::timestamp IS NULL OR (a.appointment_date || ' ' || a.appointment_time)::timestamp > $4)
      ORDER BY a.appointment_date ASC, a.appointment_time ASC
      LIMIT $5
      `,
      [f.from, f.to, f.status ?? null, after, pageSize],
    )
    const nextCursor = rows.length === pageSize ? { after: `${rows[rows.length - 1].scheduled_date} ${rows[rows.length - 1].scheduled_time}` } : undefined
    return { rows, nextCursor }
  }
}

import { LabsDataset } from "@/lib/exports/datasets/labs"
import { BillingDataset } from "@/lib/exports/datasets/billing"
import { RadiologyDataset } from "@/lib/exports/datasets/radiology"
import { PatientsDataset } from "@/lib/exports/datasets/patients"
import { PharmacyDataset } from "@/lib/exports/datasets/pharmacy"
import { BedAssignmentsDataset } from "@/lib/exports/datasets/bed-assignments"
import { PaymentsDataset } from "@/lib/exports/datasets/payments"
import { ReceptionRegisterDataset } from "@/lib/exports/datasets/reception-register"
import { ReceptionRegisterDetailedDataset } from "@/lib/exports/datasets/reception-register-detailed"
import { QueueEventsDataset } from "@/lib/exports/datasets/queue-events"
import { ReceptionDashboardDataset } from "@/lib/exports/datasets/reception-dashboard"
import { ReceptionDailyDataset } from "@/lib/exports/datasets/reception-daily"
import { ObstetricsDataset } from "@/lib/exports/datasets/obstetrics"
import { DentalDataset } from "@/lib/exports/datasets/dental"

export const Datasets: Record<string, Dataset> = {
  appointments: new AppointmentsDataset(),
  labs: new LabsDataset(),
  billing: new BillingDataset(),
  radiology: new RadiologyDataset(),
  patients: new PatientsDataset(),
  pharmacy: new PharmacyDataset(),
  bed_assignments: new BedAssignmentsDataset(),
  payments: new PaymentsDataset(),
  reception_register: new ReceptionRegisterDataset(),
  reception_register_detailed: new ReceptionRegisterDetailedDataset(),
  queue_events: new QueueEventsDataset(),
  reception_dashboard: new ReceptionDashboardDataset(),
  reception_daily: new ReceptionDailyDataset(),
  obstetrics: new ObstetricsDataset(),
  dental: new DentalDataset(),
}


