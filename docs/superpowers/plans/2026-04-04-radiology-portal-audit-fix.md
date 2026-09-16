# Radiology Portal — Full Audit & Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all confirmed and discovered bugs in the Radiology Portal, wire the newly-added workflow preferences into actual component behaviour, and commit every change from this and the previous session atomically.

**Architecture:** Layered audit (API → exports → components → cross-portal → settings). Three confirmed bugs are fixed with exact code. All remaining files are verified against a per-file checklist. One atomic commit lands everything.

**Tech Stack:** Next.js 14 App Router, TypeScript, PostgreSQL (parameterized queries), shadcn/ui, Recharts, Zod, `date-fns`, `sonner` toasts.

---

## Confirmed Bugs (fix these first)

| # | File | Bug |
|---|---|---|
| B1 | `lib/exports/datasets/radiology.ts:63` | Status SQL uses `REPLACE(…, ' ', '-')` → `'in-progress'` but params sends `'in progress'` → never matches |
| B2 | `app/api/users/radiologists/route.ts:10` | Returns HTTP 401 for an *authenticated* user without permission — should be 403 |
| B3 | `components/radiology/radiology-test-details.tsx:185` | `enforceStructuredSections` hardcoded to CT/MRI/Mammography; ignores `enforceStructuredReports` workflow setting |
| B4 | `components/radiology/radiology-test-details.tsx` | `showPreviousStudies` always initialises to `false`; ignores `showPreviousStudiesDefault` workflow setting |
| B5 | `app/api/lab-tests/[id]/route.ts:74` | GET catch block swallows the error silently — missing `console.error` |

---

## Task 1 — Fix `RadiologyDataset` status filter (B1)

**Files:**
- Modify: `lib/exports/datasets/radiology.ts:36-44`

- [ ] **Step 1: Read current params array**

  Open `lib/exports/datasets/radiology.ts`. Lines 36-44 currently read:
  ```typescript
  const params: any[] = [
    f.from,
    f.to,
    f.status ? f.status.toLowerCase() : null,   // "in progress"
    ...
  ]
  ```
  The SQL at line 63 is:
  ```sql
  AND ($3::text IS NULL OR LOWER(REPLACE(lt.status, ' ', '-')) = $3)
  ```
  `LOWER(REPLACE('In Progress', ' ', '-'))` = `'in-progress'` but `$3` = `'in progress'` → never matches.

- [ ] **Step 2: Fix the SQL comparison to use simple LOWER (no REPLACE)**

  Replace line 63 in the SQL string:
  ```sql
  AND ($3::text IS NULL OR LOWER(REPLACE(lt.status, ' ', '-')) = $3)
  ```
  with:
  ```sql
  AND ($3::text IS NULL OR LOWER(lt.status) = $3)
  ```
  Now `LOWER('In Progress')` = `'in progress'` = `$3` ✅

  The full edited `queryPage` params array stays unchanged — `f.status.toLowerCase()` already produces `'in progress'`.

- [ ] **Step 3: Verify the fix is self-consistent**

  Mental check:
  - DB stores `'In Progress'` (titlecase + space)
  - `LOWER('In Progress')` = `'in progress'`
  - `f.status` from enum is `"In Progress"` → `f.status.toLowerCase()` = `"in progress"`
  - `'in progress' = 'in progress'` → ✅

- [ ] **Step 4: Commit**
  ```bash
  cd dayspring-his
  git add lib/exports/datasets/radiology.ts
  git commit -m "fix(exports): correct RadiologyDataset status filter SQL normalisation"
  ```

---

## Task 2 — Fix `users/radiologists` HTTP status code (B2)

**Files:**
- Modify: `app/api/users/radiologists/route.ts:6-22`

- [ ] **Step 1: Read current auth guard**

  Lines 9-11 currently:
  ```typescript
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "medical", "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  ```
  This returns 401 for both no-token AND wrong-role. An authenticated user with wrong role should get 403.

- [ ] **Step 2: Split the guard into two checks**

  Replace lines 9-11 with:
  ```typescript
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "medical", "read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add app/api/users/radiologists/route.ts
  git commit -m "fix(api): return 403 Forbidden (not 401) for authenticated users without medical read permission"
  ```

---

## Task 3 — Wire workflow preferences into `RadiologyTestDetails` (B3 + B4)

**Files:**
- Modify: `components/radiology/radiology-test-details.tsx`

- [ ] **Step 1: Check if `useSettings` is already imported**

  Open `radiology-test-details.tsx`. Look at the import list. If `useSettings` is NOT imported, add it:
  ```typescript
  import { useSettings } from "@/lib/settings-context"
  ```

- [ ] **Step 2: Destructure workflow preferences inside the component**

  Inside `RadiologyTestDetails`, after the existing hooks (`useAuth`, `useLab`, `usePatients`), add:
  ```typescript
  const { settings } = useSettings()
  const workflowPrefs = (settings as any)?.radiologistWorkflow as {
    enforceStructuredReports?: boolean
    showPreviousStudiesDefault?: boolean
  } | undefined
  ```

- [ ] **Step 3: Find and replace `enforceStructuredSections` (B3)**

  Find this line (approximately line 185):
  ```typescript
  const enforceStructuredSections = Boolean(
    structuredTemplate && ["CT Scan", "MRI", "Mammography"].includes(structuredTemplate.modality),
  )
  ```
  Replace with:
  ```typescript
  const enforceStructuredSections = Boolean(
    structuredTemplate &&
      (workflowPrefs?.enforceStructuredReports === true ||
        ["CT Scan", "MRI", "Mammography"].includes(structuredTemplate.modality)),
  )
  ```
  This preserves the existing default behaviour (always enforce for CT/MRI/Mammography) while also enforcing when the user explicitly enables the toggle for all modalities.

- [ ] **Step 4: Wire `showPreviousStudiesDefault` (B4)**

  Find the `showPreviousStudies` state declaration. It will look like:
  ```typescript
  const [showPreviousStudies, setShowPreviousStudies] = useState(false)
  ```
  Add a `useEffect` immediately after all the state declarations (before the `loadStudy` callback) to apply the preference when a study loads:
  ```typescript
  useEffect(() => {
    if (workflowPrefs?.showPreviousStudiesDefault && study?.id) {
      setShowPreviousStudies(true)
    }
  }, [study?.id, workflowPrefs?.showPreviousStudiesDefault])
  ```

- [ ] **Step 5: Verify no type errors**

  The `settings` type from `useSettings` is likely `Record<string, any>` or a typed interface. If the cast `(settings as any)?.radiologistWorkflow` causes a lint error, check `lib/settings-context.tsx` for the actual return type and use it instead.

- [ ] **Step 6: Commit**
  ```bash
  git add components/radiology/radiology-test-details.tsx
  git commit -m "feat(radiology): wire enforceStructuredReports and showPreviousStudiesDefault workflow prefs into RadiologyTestDetails"
  ```

---

## Task 4 — Fix missing error logging in GET handler (B5)

**Files:**
- Modify: `app/api/lab-tests/[id]/route.ts:74`

- [ ] **Step 1: Find the GET catch block**

  Line 74 currently reads:
  ```typescript
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load test' }, { status: 500 })
  }
  ```

- [ ] **Step 2: Add console.error**
  ```typescript
  } catch (e) {
    console.error('GET /api/lab-tests/[id] failed:', e)
    return NextResponse.json({ error: 'Failed to load test' }, { status: 500 })
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add app/api/lab-tests/[id]/route.ts
  git commit -m "fix(api): add missing console.error to GET /api/lab-tests/[id] catch block"
  ```

---

## Task 5 — Audit and verify `lib/radiology.ts`

**Files:**
- Read: `lib/radiology.ts`

- [ ] **Step 1: Verify RADIOLOGY_MODALITIES completeness**

  Confirm the array contains all 12 entries (lowercase):
  ```
  "x-ray", "ct scan", "ct", "mri", "ultrasound", "mammography",
  "fluoroscopy", "nuclear medicine", "pet scan", "pet-ct", "dexa", "angiography"
  ```

- [ ] **Step 2: Verify `resolveRadiologyModality` covers all 9 display names**

  Confirm:
  - `"x-ray"` / `"xray"` → `"X-Ray"` ✅
  - `"ct scan"` / `"ct"` → `"CT Scan"` ✅
  - `"mri"` → `"MRI"` ✅
  - `"ultrasound"` → `"Ultrasound"` ✅
  - `"mammography"` → `"Mammography"` ✅
  - `"fluoroscopy"` → `"Fluoroscopy"` ✅
  - `"nuclear medicine"` → `"Nuclear Medicine"` ✅
  - `"pet scan"` / `"pet"` / `"pet-ct"` → `"PET Scan"` ✅
  - `"angiography"` / `"dsa"` → `"Angiography"` ✅

- [ ] **Step 3: Verify structured templates exist for all 9 modalities**

  Confirm `STRUCTURED_REPORT_TEMPLATES` has keys: `"X-Ray"`, `"CT Scan"`, `"MRI"`, `"Ultrasound"`, `"Mammography"`, `"Fluoroscopy"`, `"Nuclear Medicine"`, `"PET Scan"`, `"Angiography"`.

- [ ] **Step 4: If any issue found, fix it and commit**
  ```bash
  git add lib/radiology.ts
  git commit -m "fix(lib): correct radiology modality resolver or template"
  ```
  If no issues found, no commit needed for this task.

---

## Task 6 — Audit `GET /api/lab-tests` route

**Files:**
- Read: `app/api/lab-tests/route.ts`

- [ ] **Step 1: Verify auth guard**

  Check that `verifyToken` is called and 401 is returned if no token or invalid token.

- [ ] **Step 2: Verify search filter SQL safety**

  Confirm all search params (status, q, patientId, from, to) are passed as `$N` params — no string interpolation.

- [ ] **Step 3: Verify `q` search includes accession number**

  The `q` filter should search `test_name`, `test_type`, and `accession_number`. Confirm it does.

- [ ] **Step 4: Verify response shape includes `assignedToId`, `assignedToName`, `assignedAt`**

  These fields are needed by `normalizeRadiologyStudy()` on the client. Confirm they are in the SELECT and the returned object.

- [ ] **Step 5: Verify POST radiology notification routing includes all 9 modalities**

  Find the `radiologyTests` filter. It should include:
  ```
  "X-Ray", "CT Scan", "MRI", "Ultrasound", "Mammography",
  "Fluoroscopy", "Nuclear Medicine", "PET Scan", "Angiography"
  ```

- [ ] **Step 6: Fix any issues found and commit**

---

## Task 7 — Audit `PATCH /api/lab-tests/[id]` route

**Files:**
- Read: `app/api/lab-tests/[id]/route.ts` (already read — this is verification)

- [ ] **Step 1: Verify assignment notification fires correctly**

  Lines ~195-223: When `body.assignedRadiologistId` is set, a `'Radiology Case Assigned'` notification is inserted for that radiologist. Confirm:
  - `user_id = body.assignedRadiologistId` ✅
  - `type = 'Radiology'` ✅
  - `priority` set correctly from study priority ✅

- [ ] **Step 2: Verify completion notification fires for radiology**

  Lines ~257-324: When `body.status.toLowerCase() === 'completed'` and `body.results` is present:
  - `isRadiologyStudy` checks all 9 modalities ✅ (fixed last session)
  - Notification sent to `test.doctor_id` ✅
  - `type = 'Radiology'`, `title = 'Radiology Report Ready'` ✅

- [ ] **Step 3: Verify cancellation notification fires for radiology**

  Lines ~326-382: When status is 'cancelled':
  - `isRadiologyStudy` checks all 9 modalities ✅
  - Notification sent to ordering doctor with `type = 'Radiology'` ✅

- [ ] **Step 4: Verify null user_id broadcast notification (reviewed)**

  Lines ~447-450: A notification is inserted with `user_id = null`. Confirm the `notifications` table allows `NULL` for `user_id` (check schema or migration). If NOT NULL constraint exists, this will throw. If it does throw, wrap in try/catch or remove the broadcast.

- [ ] **Step 5: Fix any issues and commit**

---

## Task 8 — Audit SSE stream route

**Files:**
- Read: `app/api/lab-tests/stream/route.ts` (already read)

- [ ] **Step 1: Verify auth guard**

  Token verified, 401 returned if missing ✅

- [ ] **Step 2: Verify cleanup on cancel**

  `cancel()` calls `cleanup()` which clears interval and lifetime timer ✅

- [ ] **Step 3: Verify heartbeat sends `: keep-alive`**

  When payload unchanged, sends ``: keep-alive\n\n`` ✅

- [ ] **Step 4: Confirm the stream returns all lab tests (not just radiology)**

  The stream returns ALL lab tests. Client-side `normalizeRadiologyStudy()` filters to radiology-only. This is intentional — no bug. Document as architectural decision if not already noted.

- [ ] **Step 5: No fixes needed unless issues found above**

---

## Task 9 — Audit bulk export routes

**Files:**
- Read: `app/api/lab-tests/csv/route.ts`
- Read: `app/api/lab-tests/pdf/route.ts`
- Read: `app/api/lab-tests/xlsx/route.ts`

- [ ] **Step 1: Verify each route authenticates the user**

  Each export route must call `verifyToken` and return 401 if missing.

- [ ] **Step 2: Verify each route delegates to the `RadiologyLabTestsDataset`**

  Confirm each route passes `dataset = "radiology_lab_tests"` (or `"radiology"`) to the export engine.

- [ ] **Step 3: Verify filter params are passed correctly**

  Check that `from`, `to`, `statuses`, `modality`, `assignedRadiologistId`, `q` are extracted from the request and passed to the dataset.

- [ ] **Step 4: Fix any issues and commit**
  ```bash
  git add app/api/lab-tests/csv/route.ts app/api/lab-tests/pdf/route.ts app/api/lab-tests/xlsx/route.ts
  git commit -m "fix(exports): correct bulk export route filter passthrough"
  ```

---

## Task 10 — Audit per-study PDF route

**Files:**
- Read: `app/api/lab-tests/[id]/pdf/route.ts`

- [ ] **Step 1: Verify auth + role**

  Authenticated users only. Check role restriction (Radiologist / Hospital Admin / Clinician should be allowed).

- [ ] **Step 2: Verify study fields rendered**

  PDF should include: patient name, DOB, gender, accession number, modality, priority, ordered date, completed date, assigned radiologist, report content.

- [ ] **Step 3: Verify priority label is shown**

  STAT/Urgent/Routine should be visually labeled in the PDF.

- [ ] **Step 4: Fix any issues and commit**

---

## Task 11 — Audit `lib/exports/datasets/radiology-lab-tests.ts`

**Files:**
- Read: `lib/exports/datasets/radiology-lab-tests.ts` (already read partially)

- [ ] **Step 1: Verify modality IN list has all 9**

  Line 39:
  ```sql
  lt.test_name IN ('X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography', 'Fluoroscopy', 'Nuclear Medicine', 'PET Scan', 'Angiography')
  ```
  Count: 9 ✅

- [ ] **Step 2: Verify status normalization is correct**

  Lines 43-45:
  ```typescript
  params.push(f.statuses.map((s) => s.toLowerCase().replace(/-/g, " ")))
  whereParts.push(`REPLACE(LOWER(lt.status), '-', ' ') = ANY($${params.length}::text[])`)
  ```
  `REPLACE(LOWER('In Progress'), '-', ' ')` = `'in progress'`
  Input `'in-progress'.replace(/-/g,' ')` = `'in progress'`
  Match ✅

- [ ] **Step 3: No fixes needed if above verified**

---

## Task 12 — Audit `RadiologyTestQueue` component

**Files:**
- Read: `components/radiology/radiology-test-queue.tsx` (already read partially)

- [ ] **Step 1: Verify priority sorting uses correct field**

  The sort map `{ stat: 3, urgent: 2, routine: 1 }` keys match `RadiologyPriority` values (lowercase). The `study.priority` field comes from `normalizeStudyPriority()` which returns lowercase. ✅

- [ ] **Step 2: Verify STAT row highlighting**

  Find row className logic. Should be:
  ```typescript
  const isStatRow = test.priority === "stat"
  const isOverdue = getAgeMeta(test.orderedAt).severity === "critical"
  className={`... ${
    isStatRow ? "border-l-2 border-l-red-500 bg-red-50/40 ..."
    : isOverdue ? "border-l-2 border-l-amber-400 bg-amber-50/30 ..."
    : "hover:bg-muted/30"
  }`}
  ```

- [ ] **Step 3: Verify empty state renders `emptyMessage` prop**

  When `tests.length === 0`, a message should be rendered using the `emptyMessage` prop.

- [ ] **Step 4: Fix any issues and commit**

---

## Task 13 — Audit `RadiologistDashboard` component

**Files:**
- Read: `components/dashboards/radiologist-dashboard.tsx`

- [ ] **Step 1: Verify completion rate stat card is rendered**

  Should render a teal card showing `${completionRate}%` when `completionRate !== null`.

- [ ] **Step 2: Verify avg turnaround stat card is rendered**

  Should render an indigo card showing `${avgTurnaroundHours}h` when `avgTurnaroundHours !== null`.

- [ ] **Step 3: Verify new study dialog modality select includes all 9**

  The `Select` for `newStudyModality` should list:
  X-Ray, CT Scan, MRI, Ultrasound, Mammography, Fluoroscopy, Nuclear Medicine, PET Scan, Angiography.

- [ ] **Step 4: Verify upload dialog modality select includes all 9**

  Same list as above.

- [ ] **Step 5: Verify export filters are passed correctly to `runExport`**

  Check that `from`, `to`, modality filter, and status filter are passed to `runExport` when CSV/XLSX/PDF is triggered.

- [ ] **Step 6: Verify `openRadiologyStudy` DOM event handler is registered**

  In a `useEffect`, there should be an event listener for `openRadiologyStudy` that calls `setSelectedTestId(event.detail.studyId)`.

- [ ] **Step 7: Fix any issues and commit**

---

## Task 14 — Audit `RadiologyTestDetails` component (remaining)

**Files:**
- Read: `components/radiology/radiology-test-details.tsx`

- [ ] **Step 1: Verify tabs structure**

  Component should have tabs: Overview, Results/Report, History, Images/Attachments (or similar). Confirm all tabs render data.

- [ ] **Step 2: Verify claim/assign flow**

  When user clicks "Claim" (assign self) or uses assign dialog:
  - PATCH is called with `assignedRadiologistId: user.id`
  - Study reloads after success
  - `claiming` state prevents double-clicks

- [ ] **Step 3: Verify complete flow enforces structured sections**

  After Task 3 fix, confirm that the complete button is disabled or shows warning when `enforceStructuredSections === true` and `missingRequiredSections.length > 0`.

- [ ] **Step 4: Verify cancel flow**

  Cancel PATCH with `status: "Cancelled"` and optional `rejectionReason`. Confirm toast shown and study reloads.

- [ ] **Step 5: Verify priority-aware gradient header**

  CardHeader className should vary by priority:
  - `stat` → red gradient
  - `urgent` → amber gradient
  - `routine` / default → teal gradient

- [ ] **Step 6: Verify previous studies panel**

  `showPreviousStudies` state toggles visibility of prior studies list. After Task 3 fix, it opens automatically when `workflowPrefs?.showPreviousStudiesDefault === true`.

- [ ] **Step 7: Fix any issues and commit**

---

## Task 15 — Audit `ImageViewer` component

**Files:**
- Read: `components/radiology/image-viewer.tsx`

- [ ] **Step 1: Verify reset button uses RefreshCcw icon**

  The reset-view button must use `<RefreshCcw />` (not `<X />`). It should also have `title="Reset view"` or equivalent tooltip.

- [ ] **Step 2: Verify zoom in/out and rotate work independently**

  State: `zoom`, `rotation`. Each control only modifies its own state.

- [ ] **Step 3: Verify empty/placeholder state**

  If no image URLs are provided, a placeholder message should render.

- [ ] **Step 4: Fix any issues and commit**

---

## Task 16 — Audit `RadiologistWorkflowSettings` component

**Files:**
- Read: `components/settings/radiologist-workflow-settings.tsx`

- [ ] **Step 1: Verify all 6 fields are present**

  - `defaultModality` (Select, all 9 modalities + "any")
  - `overdueThresholdHours` (Select: 4, 8, 12, 24, 48)
  - `autoClaimOnOpen` (Switch)
  - `statAlertSound` (Switch)
  - `enforceStructuredReports` (Switch)
  - `showPreviousStudiesDefault` (Switch)

- [ ] **Step 2: Verify dirty-check prevents save when nothing changed**

  Save button should be disabled when `JSON.stringify(prefs) === JSON.stringify(original)`.

- [ ] **Step 3: Verify PATCH saves to correct key**

  Body sent: `{ radiologistWorkflow: prefs }` to `PATCH /api/settings/preferences`. ✅

- [ ] **Step 4: Verify GET loads from correct key**

  `data?.preferences?.radiologistWorkflow` merged with `DEFAULTS`. ✅

- [ ] **Step 5: Fix any issues and commit**

---

## Task 17 — Audit settings and preferences API

**Files:**
- Read: `app/api/settings/preferences/route.ts` (already read)

- [ ] **Step 1: Verify `extra_prefs` column is auto-created**

  `ensurePreferenceColumns()` should have a block that creates `extra_prefs JSONB DEFAULT '{}'` if it doesn't exist.

- [ ] **Step 2: Verify GET spreads `extra_prefs` into response**

  After returning core prefs, the response should include `...extra` where `extra = rows[0].extra_prefs`.

- [ ] **Step 3: Verify PATCH merges (not replaces)**

  SQL must use `||` operator on JSONB:
  ```sql
  extra_prefs = COALESCE(user_settings.extra_prefs, '{}'::jsonb) || $2::jsonb
  ```

- [ ] **Step 4: Verify `radiologistWorkflow` round-trips correctly**

  Mental check: PATCH `{ radiologistWorkflow: { enforceStructuredReports: true } }` → merged into `extra_prefs` → GET returns `preferences.radiologistWorkflow.enforceStructuredReports === true`. ✅

- [ ] **Step 5: Fix any issues and commit**

---

## Task 18 — Audit page wiring

**Files:**
- Read: `app/radiologist/page.tsx` (already read)
- Read: `app/radiologist/settings/page.tsx` (already read)

- [ ] **Step 1: Verify `app/radiologist/page.tsx` role guard**

  Non-Radiologist users should be redirected to `/dashboard`. ✅

- [ ] **Step 2: Verify `app/radiologist/settings/page.tsx` includes `RadiologistWorkflowSettings`**

  The settings page should render `<RadiologistWorkflowSettings />` in the primary column. ✅

- [ ] **Step 3: Fix any issues and commit**

---

## Task 19 — Run lint and build check

**Files:** All modified files.

- [ ] **Step 1: Run ESLint**
  ```bash
  cd dayspring-his
  npm run lint 2>&1 | head -60
  ```
  Expected: No errors. Warnings acceptable. Fix any errors before proceeding.

- [ ] **Step 2: Run TypeScript compiler check**
  ```bash
  npx tsc --noEmit 2>&1 | head -60
  ```
  Expected: No errors. Fix any type errors before proceeding.

- [ ] **Step 3: Run build**
  ```bash
  npm run build 2>&1 | tail -30
  ```
  Expected: Build completes successfully. Fix any build errors.

- [ ] **Step 4: Commit lint/type fixes if any arose**
  ```bash
  git add -p
  git commit -m "fix(types): resolve TypeScript/lint errors from radiology portal audit"
  ```

---

## Task 20 — Atomic commit of all session changes

This task runs the `finishing-a-development-branch` skill to assemble the final commit.

- [ ] **Step 1: Check git status**
  ```bash
  git status
  git diff --stat
  ```
  Expected remaining unstaged files: all 12 modified files + 1 new file from the previous session, minus any already committed in Tasks 1-19 above.

- [ ] **Step 2: Stage all remaining radiology portal changes**
  ```bash
  git add \
    lib/radiology.ts \
    lib/exports/datasets/radiology.ts \
    lib/exports/datasets/radiology-lab-tests.ts \
    app/api/lab-tests/route.ts \
    app/api/lab-tests/[id]/route.ts \
    app/api/settings/preferences/route.ts \
    app/radiologist/settings/page.tsx \
    components/dashboards/radiologist-dashboard.tsx \
    components/radiology/image-viewer.tsx \
    components/radiology/radiology-test-details.tsx \
    components/radiology/radiology-test-queue.tsx \
    components/settings/radiologist-workflow-settings.tsx
  ```
  (Skip any file already committed in earlier tasks of this plan.)

- [ ] **Step 3: Commit**
  ```bash
  git commit -m "$(cat <<'EOF'
  feat(radiology): complete portal overhaul — audit fixes, 9-modality support, workflow settings

  - Fix RadiologyDataset status filter SQL (LOWER normalisation mismatch)
  - Fix image-viewer reset button icon (RefreshCcw, not X)
  - Fix export status filter normalisation (in-progress vs in progress)
  - Fix modality detection in all notification routes (5 → 9 modalities)
  - Add STAT row highlighting and overdue amber borders to worklist
  - Add completion rate and avg turnaround KPI cards to dashboard
  - Add Fluoroscopy, Nuclear Medicine, PET Scan, Angiography modality support
  - Add RadiologistWorkflowSettings component with 6 preference toggles
  - Add PATCH /api/settings/preferences for partial extra_prefs JSONB updates
  - Wire enforceStructuredReports and showPreviousStudiesDefault into RadiologyTestDetails
  - Hero banner redesign with gradient, glow orbs, and live summary bar
  - Priority-aware gradient headers in study detail view (STAT=red, Urgent=amber)

  Co-Authored-By: claude-flow <ruv@ruv.net>
  EOF
  )"
  ```

- [ ] **Step 4: Verify commit landed**
  ```bash
  git log --oneline -5
  git status
  ```
  Expected: `nothing to commit, working tree clean`
