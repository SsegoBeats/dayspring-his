# Portal Review & Improvement Suggestions

This document summarizes the review of each portal in Dayspring HIS, changes already made, and suggested future improvements.

---

## Summary of Changes Made

### 1. **Patient Registration (Wide Form)**
- **Redesigned** the form with **collapsible sections** so it is no longer overwhelming:
  - Personal Details (default open)
  - Demographics (default open)
  - Identification & Address
  - Employment & Insurance
  - Next of Kin
  - Contact Information
  - Clinical & Department
  - Emergency Contact
- Sections use clear headings and icons (User, MapPin, Briefcase, Users, Phone, FileText, Heart).
- Error styling improved for dark mode (red-950/30).
- Register Patient dialog now uses `size="xl"` and `max-h-[90vh]` for better space when opened from Patient List.

### 2. **App-Level Error Handling**
- **Added `app/error.tsx`**: Client component that shows a friendly error message with "Try again" and "Go to Dashboard" actions.
- **Added `app/not-found.tsx`**: Custom 404 page with a clear message and link back to dashboard.

### 3. **Settings Layout**
- **Updated** settings card title from repeating the page title to **"Account & preferences"** with a short description to avoid redundancy and improve clarity.

### 4. **Direct Routes for All Roles**
- **Added** dedicated pages so every role has a bookmarkable URL:
  - `app/admin/page.tsx` → Hospital Admin dashboard at `/admin`
  - `app/midwife/page.tsx` → Midwife dashboard at `/midwife`
  - `app/radiologist/page.tsx` → Radiologist dashboard at `/radiologist`
- **Updated** `app/dashboard/page.tsx` to redirect Hospital Admin, Midwife, and Radiologist to `/admin`, `/midwife`, and `/radiologist` respectively for consistency.

---

## Portal-by-Portal Review & Suggestions

### Receptionist (`/receptionist`)
- **Features**: Overview (stats, today’s appointments), Patients (list, search, register, view, delete request), Check-In, Queue, Payments, Reports (Reception Register).
- **Status**: Functionally complete; error alerts and refresh work; Patient Registration improved with collapsible sections.
- **Suggestions**:
  - Add a quick “Today’s appointments” count badge on the Check-In tab.
  - Consider keyboard shortcut (e.g. Ctrl+N) for “Register Patient” when on Patients tab.
  - Optionally add breadcrumb or tab indicator when viewing a patient from the list.

### Clinician / Doctor (`/dashboard` for Clinician)
- **Features**: Overview (patients, appointments, records, prescriptions), Patient Queue (with dental filter for dentist view), consultation dialog with tabs (consultation, prescription, history, labs).
- **Status**: Dashboard and queue work; notifications and lab-result opening are wired.
- **Suggestions**:
  - Unify routes: either use `/clinician` as the main URL (with a page that renders DoctorDashboard) or keep `/dashboard` and document it clearly to avoid confusion with `/doctor-schedules` and `/clinician/schedules`.
  - Add a “Recent patients” or “Continue last consultation” shortcut on the overview.

### Midwife (`/midwife`, `/midwife/anc`)
- **Features**: Dashboard (same as clinician-style overview), ANC page for antenatal visits (list, filter by date range).
- **Status**: Dashboard and ANC page are in place; header “ANC” link works.
- **Suggestions**:
  - On `/midwife`, add a prominent card or button linking to “ANC Visits” for faster access.
  - ANC list: consider export (e.g. CSV) for date range.

### Dentist (`/dentist`)
- **Features**: Uses DoctorDashboard with `showDentalQueueFilter` for dental-specific queue.
- **Status**: Works as expected.
- **Suggestions**:
  - Add a short “Dental” branding or subtitle on the dashboard header so the view is clearly dentist-specific.

### Nurse (`/nurse`)
- **Features**: Vitals, nursing notes, patient care list, filters and sorting; critical vitals highlighting.
- **Status**: Dashboards and APIs (vitals, notes) are connected; today’s counts and latest vitals load.
- **Suggestions**:
  - Add a “Quick vitals” compact form on the overview for fast entry without opening the full list.
  - Consider bulk export of nursing notes for a selected date range.

### Lab Tech (`/lab-tech`)
- **Features**: Lab tests queue, order/result entry, print routes for lab slips.
- **Status**: Routes and print pages exist.
- **Suggestions**:
  - Ensure print layout is consistent and works across browsers; add “Print” button label if only icon is shown.
  - Consider a “Pending results” count or badge on the dashboard.

### Hospital Admin (`/admin`)
- **Features**: System Overview, User Management, Bed Management, Patient Management, Financial Reports, Audit Trail, Non-Medication Inventory; Settings at `/admin/settings`.
- **Status**: Tabs and links are clear; new `/admin` page gives a direct entry.
- **Suggestions**:
  - In User Management, add role filter and search by name/email for large teams.
  - Audit Trail: optional date range and action-type filters for easier investigation.

### Cashier (`/cashier`)
- **Features**: Pending/partially paid bills, process payment, create bill, edit bill, overdue bills, financial reports, export transactions.
- **Status**: Billing context and components are wired; Create Bill form is structured.
- **Suggestions**:
  - **Create Bill**: If the list of line items grows long, consider grouping by category or a sticky “Summary” (subtotal, tax, total) at the top or side so users don’t have to scroll to see totals.
  - Add a “Daily summary” card on the main tab (e.g. today’s collected amount and transaction count).

### Pharmacist (`/pharmacist`)
- **Features**: Dispensing, prescriptions, inventory (including non-medication in admin).
- **Status**: Portal and dashboard are present.
- **Suggestions**:
  - Add low-stock or expiring-soon alerts on the main view.
  - Search prescriptions by patient name or P.ID for faster dispensing.

### Radiologist (`/radiologist`)
- **Features**: Radiologist dashboard (e.g. imaging queue/results); Settings at `/radiologist/settings`.
- **Status**: New `/radiologist` page provides direct access; dashboard renders correctly.
- **Suggestions**:
  - If there is an imaging order list or report view, add a direct link from the dashboard header or a first-tab summary.

---

## Wide Forms – General Recommendations

- **Patient Registration**: Done with collapsible sections; optional next step: a true multi-step wizard (Step 1 → 2 → 3) with “Next” / “Back” and progress indicator for first-time users.
- **Create Bill**: Already in cards per item; consider:
  - Sticky summary (subtotal, tax, discount, total) visible while scrolling.
  - Optional “Duplicate last bill” for repeat visits.
- **Other long forms** (e.g. org settings, user management): Use the same pattern: group fields in collapsible sections or tabs by category.

---

## Functionality & Connectivity

- **Login → Dashboard**: Redirects by role work; all roles now have a direct URL.
- **Settings**: `/settings` redirects to role-specific settings; all role-specific settings pages use `SettingsLayout`.
- **Notifications**: Header bell and SSE stream are connected; lab result notifications open the clinician consult dialog.
- **Patient deletion**: Request flow and admin approval dialog are wired.
- **Error handling**: App-level `error.tsx` and `not-found.tsx` are in place; dashboard layout wraps content in `ErrorBoundary`.

---

## Optional Follow-Ups

1. **Consolidate Doctor/Clinician routes**: Prefer either `/clinician` or `/dashboard` and redirect the other; align “Schedules” link to one path.
2. **Accessibility**: Add `aria-label` to icon-only buttons (e.g. notification bell, print); ensure focus order in modals and collapsible sections.
3. **Loading states**: Replace generic “Loading...” on auth redirect with a small spinner or skeleton for consistency.
4. **Empty states**: Where lists or queues are empty, use a short message and primary action (e.g. “No pending bills — Create bill” or “No appointments today — Open calendar”).

If you want to prioritize, the highest impact items are: **Create Bill summary stickiness**, **Receptionist quick actions**, **Admin audit filters**, and **Pharmacist low-stock alerts**.
