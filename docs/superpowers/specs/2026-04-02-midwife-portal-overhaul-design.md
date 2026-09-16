# Midwife Portal Overhaul — Design Spec

**Date:** 2026-04-02
**Status:** Approved
**Approach:** C — Full Clinical Suite with Proper Schema

---

## 1. Design System & Visual Identity

**Primary accent:** Deep rose (`rose-700` / `#BE185D`)
**Backgrounds:** Warm ivory (`rose-50/40`) on cards; white on the portal header strip
**Stat cards:** `bg-gradient-to-br from-rose-50 via-white to-pink-50/30`, `rounded-2xl`, `shadow-sm shadow-rose-100/40`
**Icon containers:** `rounded-xl bg-rose-50 text-rose-600`
**Tab indicators:** `rose-600` underline on active tab
**Badges/pills:** `bg-rose-100 text-rose-800`
**Header border:** `border-rose-100`

The palette is warm, clinical, and unmistakably maternal — distinct from cyan (Dentist), indigo (Doctor), teal (Nurse).

---

## 2. Portal Architecture

### Shell pattern

`MidwifeShell` — single orchestrator component (mirrors `DentistShell`).
`app/midwife/page.tsx` renders `<DashboardLayout><MidwifeShell /></DashboardLayout>`.

### Six tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| Overview | `MidwifeOverview` | 6 stat cards + recent activity + quick-action buttons |
| Patients | `MidwifePatientRecords` | Patient search, per-patient obstetric record sheet |
| ANC Visits | `MidwifeANCVisits` | Full CRUD on `obstetric_assessments` |
| Labor & Delivery | `MidwifeLaborDelivery` | Labor records, delivery outcomes, postnatal visits |
| Clinical | `MidwifeClinicalActions` | Prescriptions, lab orders, referrals |
| Exports | `MidwifeExports` | Date-range exports: obstetrics, labor, postnatal |

`app/midwife/anc/page.tsx` is retired — redirects to `/midwife`.

---

## 3. Database Schema

### New table: `labor_delivery_records`

```sql
CREATE TABLE labor_delivery_records (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id             UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  midwife_id             UUID NOT NULL REFERENCES users(id),
  admission_date         TIMESTAMP NOT NULL,
  onset_of_labor         VARCHAR(20) CHECK (onset_of_labor IN ('spontaneous','induced','augmented')),
  delivery_date          TIMESTAMP,
  delivery_type          VARCHAR(20) CHECK (delivery_type IN ('SVD','C-Section','Forceps','Vacuum','Other')),
  duration_of_labor_hours NUMERIC(5,2),
  presentation           VARCHAR(30),
  rupture_of_membranes   TIMESTAMP,
  placenta_delivery      TIMESTAMP,
  blood_loss_ml          INTEGER,
  complications          TEXT,
  notes                  TEXT,
  -- Baby sub-record
  baby_sex               VARCHAR(10) CHECK (baby_sex IN ('Male','Female','Indeterminate')),
  baby_birth_weight_g    INTEGER,
  baby_apgar_1min        SMALLINT CHECK (baby_apgar_1min BETWEEN 0 AND 10),
  baby_apgar_5min        SMALLINT CHECK (baby_apgar_5min BETWEEN 0 AND 10),
  baby_condition         VARCHAR(20) CHECK (baby_condition IN ('Alive','Stillbirth','Neonatal Death')),
  baby_notes             TEXT,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New table: `postnatal_visits`

```sql
CREATE TABLE postnatal_visits (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  labor_delivery_id     UUID REFERENCES labor_delivery_records(id) ON DELETE SET NULL,
  midwife_id            UUID NOT NULL REFERENCES users(id),
  visit_date            TIMESTAMP NOT NULL,
  days_postpartum       INTEGER,
  bp_systolic           INTEGER,
  bp_diastolic          INTEGER,
  temperature_c         NUMERIC(4,1),
  lochia                VARCHAR(10) CHECK (lochia IN ('rubra','serosa','alba','abnormal')),
  wound_healing         TEXT,
  breastfeeding_status  VARCHAR(30),
  baby_weight_g         INTEGER,
  baby_condition        TEXT,
  notes                 TEXT,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### RLS policies

Both tables follow the same pattern as `obstetric_assessments`:
- SELECT: Hospital Admin, Doctor, Midwife, Nurse
- INSERT: Hospital Admin, Doctor, Midwife
- UPDATE: Hospital Admin, Doctor, Midwife (own records only, or admin overrides)
- DELETE: Hospital Admin, Midwife (own records only)

---

## 4. API Surface

### New routes

```
GET    /api/labor                        list labor records (patientId?, from?, to?)
POST   /api/labor                        create labor record
PATCH  /api/labor/[id]                   update labor record
DELETE /api/labor/[id]                   delete labor record (own or admin)

GET    /api/postnatal                    list postnatal visits (patientId?, laborId?)
POST   /api/postnatal                    create postnatal visit
PATCH  /api/postnatal/[id]               update postnatal visit
DELETE /api/postnatal/[id]              delete postnatal visit (own or admin)
```

### Existing routes to fix/extend

```
DELETE /api/obstetrics/assessments/[id]  ADD — currently missing
GET    /api/obstetrics/visits            ADD patientId filter param
GET    /api/obstetrics/summary           EXTEND — add activePregnancies, upcomingDeliveries counts
```

### Cross-portal routes (used as-is)

- `GET/POST /api/medical/prescriptions` — midwife prescribing
- `GET/POST /api/lab-tests` — lab orders
- `GET /api/appointments/list` — schedule view
- `GET /api/notifications` + `/api/notifications/stream` — notification bell

---

## 5. Component Inventory

### New files under `components/midwife/`

| File | Responsibility |
|------|---------------|
| `midwife-shell.tsx` | Tab orchestrator, portal header, notification bell, settings link |
| `midwife-notification-bell.tsx` | SSE + polling bell, midwife keyword filter |
| `midwife-overview.tsx` | 6 stat cards, recent activity feed, quick-action buttons |
| `midwife-patient-records.tsx` | Patient search, slide-over obstetric history |
| `midwife-anc-visits.tsx` | Date filter + table + create/edit slide-over + delete dialog |
| `midwife-labor-delivery.tsx` | Labor records list, create/edit form, postnatal nested timeline |
| `midwife-clinical-actions.tsx` | Prescriptions, lab orders, referrals accordions |
| `midwife-exports.tsx` | Date range picker, dataset selector, export buttons |

### Modified files

| File | Change |
|------|--------|
| `app/midwife/page.tsx` | Render `MidwifeShell` instead of `MidwifeDashboard` |
| `app/midwife/anc/page.tsx` | Replace with redirect to `/midwife` |
| `app/midwife/settings/page.tsx` | Add `MidwifePreferences` section |
| `components/dashboards/midwife-dashboard.tsx` | Remove embedded `DoctorDashboard`; file becomes vestigial (kept for potential reuse but DoctorDashboard import removed) |
| `app/api/obstetrics/assessments/[id]/route.ts` | Add DELETE handler |
| `app/api/obstetrics/visits/route.ts` | Add patientId filter |
| `app/api/obstetrics/summary/route.ts` | Extend response with activePregnancies, upcomingDeliveries |

---

## 6. Confirmed Bug Fixes

1. `midwife-dashboard.tsx:193` — Remove `<DoctorDashboard />` embed
2. `app/midwife/anc/page.tsx:107` — Wrong back-link `/dashboard` → redirect to `/midwife`
3. Missing DELETE on `/api/obstetrics/assessments/[id]`
4. Missing `patientId` filter on `/api/obstetrics/visits`
5. ANC page is read-only — no create/edit/delete in existing UI

---

## 7. Settings Extension

New `MidwifePreferences` component added to `/midwife/settings`:
- Default EDD calculation method (LMP / Ultrasound)
- EDD alert threshold (weeks before EDD to show "upcoming delivery" flag)
- Default presentation options shown in ANC form
- Notification preferences for upcoming EDDs
