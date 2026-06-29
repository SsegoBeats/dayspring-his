# Pharmacist Portal - Comprehensive Investigation Report
**Date:** June 29, 2026  
**Status:** Investigation Complete

---

## Executive Summary

The Pharmacist Portal has been thoroughly investigated for functionality issues, error handling, data consistency, and integration problems. **Critical authentication issues were identified** that would prevent core features from functioning properly. Additional issues relate to error handling, data synchronization, and API design.

---

## 🚨 CRITICAL ISSUES (Must Fix Immediately)

### 1. **Missing Authentication Credentials in API Calls**
**Severity:** CRITICAL 🔴  
**Impact:** Core pharmacy features will not work  
**File:** [lib/pharmacy-context.tsx](lib/pharmacy-context.tsx)

Multiple API calls are missing the `credentials: "include"` parameter, which prevents authentication cookies from being sent. This causes **401 Unauthorized errors** when pharmacists attempt these operations:

#### Affected Functions:

| Function | Line | API Endpoint | Impact |
|----------|------|--------------|--------|
| `refreshSuppliers()` | 212 | GET `/api/pharmacy/suppliers` | ❌ Suppliers list won't load |
| `refreshPurchaseOrders()` | 221 | GET `/api/pharmacy/purchase-orders` | ❌ PO list won't load |
| `createPurchaseOrder()` | 235 | POST `/api/pharmacy/purchase-orders` | ❌ Can't create purchase orders |
| `approvePurchaseOrder()` | 250 | PATCH `/api/pharmacy/purchase-orders/{id}` | ❌ Can't approve POs |
| `cancelPurchaseOrder()` | 263 | PATCH `/api/pharmacy/purchase-orders/{id}` | ❌ Can't cancel POs |
| `refreshGrns()` | 277 | GET `/api/pharmacy/grn` | ❌ GRN list won't load |
| `createGrn()` | 291 | POST `/api/pharmacy/grn` | ❌ Can't create GRNs |
| `refreshPharmacySettings()` | 307 | GET `/api/pharmacy/settings` | ❌ Settings won't load |
| `updatePharmacySettings()` | 315 | PATCH `/api/pharmacy/settings` | ❌ Can't update settings |

#### What's the Problem?
```typescript
// ❌ WRONG - No credentials parameter
const res = await fetch("/api/pharmacy/suppliers")

// ✅ CORRECT - Has credentials parameter
const res = await fetch("/api/pharmacy/suppliers", { credentials: "include" })
```

When credentials are not included, the browser's cookie (containing the session token) is NOT sent with the request. The API endpoint checks for authentication and rejects the request with 401 Unauthorized.

#### Fix Required:
Add `credentials: "include"` to all affected fetch calls in `lib/pharmacy-context.tsx`

---

### 2. **Missing Credentials in POST/PATCH Requests**
**Severity:** CRITICAL 🔴  
**File:** [lib/pharmacy-context.tsx](lib/pharmacy-context.tsx)

The POST and PATCH requests for purchase orders, GRNs, and settings are missing full credential configuration:

```typescript
// ❌ INCOMPLETE - Missing credentials option
const res = await fetch("/api/pharmacy/purchase-orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
})

// ✅ CORRECT - Has credentials
const res = await fetch("/api/pharmacy/purchase-orders", {
  method: "POST",
  credentials: "include",  // ← This is missing
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
})
```

---

## 🟡 HIGH PRIORITY ISSUES

### 3. **Silent Failures in Pharmacy Context**
**Severity:** HIGH 🟠  
**File:** [lib/pharmacy-context.tsx](lib/pharmacy-context.tsx)  
**Lines:** 213, 222, 278, 308

**Problem:**
```typescript
const refreshSuppliers = useCallback(async () => {
  try {
    const res = await fetch("/api/pharmacy/suppliers")
    if (!res.ok) return  // ← Silent failure, no error logging or user notification
    const data = await res.json()
    setSuppliers(data.suppliers ?? [])
  } catch {}  // ← Silent catch, completely ignores errors
}, [])
```

**Impact:**
- Pharmacists won't know when data fails to load
- Stale data will persist without warning
- No feedback on what went wrong
- Makes debugging very difficult

**Example User Experience:**
1. Pharmacist opens suppliers tab
2. List appears empty (but silently failed to load)
3. Pharmacist thinks there are no suppliers
4. Attempts to create a PO without supplier → Error

---

### 4. **Inconsistent Credential Parameter Across Components**
**Severity:** HIGH 🟠  
**Files:** Multiple pharmacy components

**Issue:**
Some components use `credentials: "include"` while others don't, creating inconsistency:

- ✅ `prescription-dispense.tsx` - Line 58: Has credentials
- ✅ `stock-taking.tsx` - Lines 82-83: Has credentials  
- ✅ `medication-inventory.tsx` - Export: Has credentials
- ❌ `pharmacy-context.tsx` - Multiple: Missing credentials

This inconsistency makes it hard to identify which API calls work and which don't.

---

## 🟡 MEDIUM PRIORITY ISSUES

### 5. **Deprecation Warning in Prescription Dispense**
**Severity:** MEDIUM 🟡  
**File:** [components/pharmacy/prescription-dispense.tsx](components/pharmacy/prescription-dispense.tsx)  
**Line:** 36

```typescript
/** @deprecated Pass nothing — bill status is now fetched automatically */
billingPaid?: boolean
```

**Issue:** The `billingPaid` prop is marked as deprecated but is still being passed from the dashboard. This prop is ignored, but it creates confusion about the actual flow.

**Check in:** [components/dashboards/pharmacist-dashboard.tsx](components/dashboards/pharmacist-dashboard.tsx) - Line ~160
```typescript
billingPaid={isScannedPatient ? scannedInfo?.billStatus === "paid" : undefined}
```

---

### 6. **Medication Lookup by Name Instead of ID**
**Severity:** MEDIUM 🟡  
**File:** [app/api/pharmacy/dispense/[prescriptionId]/route.ts](app/api/pharmacy/dispense/[prescriptionId]/route.ts)  
**Line:** 26

**Issue:**
```sql
LEFT JOIN medications m ON m.name = p.medication_name
```

The medication lookup uses **name matching** instead of **ID**:

**Risks:**
- ⚠️ If two medications have similar names → wrong medication could be dispensed
- ⚠️ If medication name is spelled differently → medication won't be found
- ⚠️ No guaranteed uniqueness on medication names in the database
- ⚠️ Difficult to maintain data integrity across name changes

**Example Problem:**
- Medication recorded as "Paracetamol" in inventory
- Prescription written as "Paracetamol 500mg"  
- Name doesn't match exactly → dispensing fails

**Recommendation:** Use a foreign key relationship with medication ID instead.

---

### 7. **Missing Credentials in Medicine.Add Flow**
**Severity:** MEDIUM 🟡  
**File:** [lib/pharmacy-context.tsx](lib/pharmacy-context.tsx)  
**Line:** 348

The `addMedication()` function has credentials, but the fallback logic shows a problem:

```typescript
if (res.ok) {
  // Refresh from server
  await refreshMedications()
} else {
  // ⚠️ PROBLEM: Optimistic update on server error
  const newMedication: Medication = {
    ...medication,
    id: `MED${String(medications.length + 1).padStart(3, "0")}`,  // Generated ID!
  }
  setMedications([...medications, newMedication])
}
```

**Issue:** When the server request fails, it adds a medication with a **locally generated ID** that won't match the actual database. This creates a **data sync mismatch**.

---

## 🟢 MEDIUM-LOW PRIORITY ISSUES

### 8. **Pharmacy Settings API Missing Credentials**
**Severity:** MEDIUM 🟡  
**File:** [lib/pharmacy-context.tsx](lib/pharmacy-context.tsx)

The pharmacy settings retrieval and update are missing credentials, which means:
- Pharmacists can't load their preferences
- They can't update warning thresholds
- Personalized settings won't work

---

### 9. **GRN Item Fetch Missing Credentials**
**Severity:** MEDIUM 🟡  
**File:** [components/pharmacy/goods-received-note.tsx](components/pharmacy/goods-received-note.tsx)

When a pharmacist links a GRN to a purchase order, the PO items are fetched without credentials.

---

### 10. **Error Handling Inconsistency in Stock Taking**
**Severity:** LOW 🟢  
**File:** [components/pharmacy/stock-taking.tsx](components/pharmacy/stock-taking.tsx)

Some fetch calls have proper error messages while others don't:

```typescript
// ❌ Silent failure
const [nonMedRes] = await Promise.all([...])
if (nonMedRes.ok) { ... }  // No error handling

// ✅ Good error handling
if (!res.ok) {
  const error = await res.json().catch(() => ({}))
  toast({ title: "Error", description: error.error || "..." })
}
```

---

## 📊 Issue Summary Matrix

| Issue # | Category | Severity | Component(s) | Status |
|---------|----------|----------|--------------|--------|
| 1 | Authentication | CRITICAL | pharmacy-context.tsx | ❌ Not Fixed |
| 2 | Authentication | CRITICAL | pharmacy-context.tsx | ❌ Not Fixed |
| 3 | Error Handling | HIGH | pharmacy-context.tsx | ❌ Not Fixed |
| 4 | Consistency | HIGH | Multiple files | ❌ Not Fixed |
| 5 | Code Quality | MEDIUM | prescription-dispense.tsx | ⚠️ Minor |
| 6 | Database Design | MEDIUM | dispense API | ⚠️ Moderate |
| 7 | Data Consistency | MEDIUM | pharmacy-context.tsx | ❌ Not Fixed |
| 8 | Authentication | MEDIUM | pharmacy-context.tsx | ❌ Not Fixed |
| 9 | Authentication | MEDIUM | GRN component | ❌ Not Fixed |
| 10 | Error Handling | LOW | stock-taking.tsx | ⚠️ Minor |

---

## 🔄 Cross-Portal Communication

### Verification Completed ✅

The following cross-portal data flows were verified:

1. **Pharmacy → Billing** ✅ Correct
   - Bill status is fetched via `/api/pharmacy/bill-status/[prescriptionId]`
   - Has proper credentials and error handling

2. **Medical Records → Pharmacy** ✅ Correct
   - Prescriptions are fetched via medical context
   - Patient information is properly linked

3. **Pharmacy → Inventory (Non-Medication)** ✅ Correct
   - Stock taking queries both medication and non-medication items
   - Proper separation of concerns

**No cross-portal data inconsistencies detected** (issues are internal to pharmacy portal, not integration issues).

---

## ✅ What's Working Well

1. **Prescription Dispensing Flow** - Authentication and error handling are correct
2. **Export Functionality** - Properly includes credentials and error feedback
3. **Stock Taking** - Loads data with proper error handling
4. **Payment Validation** - Bill status check is implemented correctly
5. **Controlled Drugs Register** - Transaction safety and audit trails are in place
6. **FEFO Batch Selection** - Correctly implements first-expired-first-out logic
7. **Expired Medication Check** - Prevents dispensing of expired medications

---

## 🔧 Recommended Fixes (Priority Order)

### Phase 1: Critical Fixes (Do First)
1. **Add `credentials: "include"` to ALL pharmacy API calls in `lib/pharmacy-context.tsx`**
   - This is blocking core functionality
   - Estimated effort: 10 minutes
   - Impact: Unblocks suppliers, purchase orders, GRN, and settings features

### Phase 2: High-Priority Fixes
2. **Implement proper error handling with user feedback**
   - Replace silent failures with toast notifications
   - Estimated effort: 20 minutes
   - Impact: Pharmacists will know when something fails

3. **Fix optimistic update ID generation in addMedication()**
   - Use server-returned ID instead of generating locally
   - Estimated effort: 5 minutes
   - Impact: Prevents data sync mismatches

### Phase 3: Medium-Priority Improvements
4. **Add credentials to all remaining API calls**
   - Use a fetch wrapper utility to ensure consistency
   - Estimated effort: 15 minutes
   - Impact: Prevents future authentication bugs

5. **Consider ID-based medication lookup**
   - Update dispense API to use medication IDs instead of names
   - Estimated effort: 30 minutes
   - Impact: Improves data integrity

6. **Remove deprecated prop from PrescriptionDispense**
   - Clean up the component interface
   - Estimated effort: 5 minutes
   - Impact: Code clarity

---

## 📝 Testing Recommendations

After fixes are applied, test these scenarios:

1. **Supplier Management**
   - [ ] Load suppliers list
   - [ ] Search suppliers
   - [ ] Create new supplier (if allowed)

2. **Purchase Order Workflow**
   - [ ] Create purchase order
   - [ ] Add items to PO
   - [ ] Approve PO
   - [ ] Cancel PO
   - [ ] Verify PO list updates

3. **Goods Received Note**
   - [ ] Create GRN from scratch
   - [ ] Link GRN to approved PO
   - [ ] Verify stock quantities update
   - [ ] Check audit trail

4. **Pharmacy Settings**
   - [ ] Load current settings
   - [ ] Update expiry warning threshold
   - [ ] Verify changes persist on reload

5. **Edge Cases**
   - [ ] Test with no suppliers
   - [ ] Test with no purchase orders
   - [ ] Test network errors
   - [ ] Test invalid data

---

## 🚀 Implementation Checklist

- [ ] Fix critical authentication issues (Phase 1)
- [ ] Implement error handling (Phase 2)
- [ ] Add remaining credentials parameters (Phase 3)
- [ ] Update documentation with best practices
- [ ] Run full test suite
- [ ] Create pull request with fixes
- [ ] Code review and approval
- [ ] Deploy to staging
- [ ] Regression testing
- [ ] Deploy to production

---

## 📞 Questions for Stakeholder

1. **Are pharmacists currently reporting issues** with supplier or purchase order lists appearing empty?
2. **Is there a wrapper utility** used for all API calls that should enforce credentials?
3. **What's the naming strategy** for medications? Are names guaranteed to be unique?
4. **Have there been any data consistency issues** between pharmacy and other portals?

---

## 📎 Appendix: File Locations

- Core Issue: [lib/pharmacy-context.tsx](lib/pharmacy-context.tsx)
- Dispense Logic: [app/api/pharmacy/dispense/[prescriptionId]/route.ts](app/api/pharmacy/dispense/[prescriptionId]/route.ts)
- Inventory: [components/pharmacy/medication-inventory.tsx](components/pharmacy/medication-inventory.tsx)
- Purchase Orders: [app/api/pharmacy/purchase-orders/route.ts](app/api/pharmacy/purchase-orders/route.ts)
- Goods Received: [components/pharmacy/goods-received-note.tsx](components/pharmacy/goods-received-note.tsx)
- Stock Taking: [components/pharmacy/stock-taking.tsx](components/pharmacy/stock-taking.tsx)

---

**Report Generated:** June 29, 2026  
**Investigation Status:** ✅ Complete  
**Recommended Action:** Implement Phase 1 fixes immediately
