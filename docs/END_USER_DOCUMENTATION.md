# Dayspring Community Health Care — Hospital Information System
## Complete End-User Documentation
### Prepared for End-User Training — April 2026

---

## Table of Contents

1. [What Is This System?](#1-what-is-this-system)
2. [Logging In & Getting Started](#2-logging-in--getting-started)
3. [User Roles — Who Does What](#3-user-roles--who-does-what)
4. [How a Patient Moves Through the System](#4-how-a-patient-moves-through-the-system)
5. [Receptionist Portal](#5-receptionist-portal)
6. [Nurse Portal](#6-nurse-portal)
7. [Clinician / Doctor Portal](#7-clinician--doctor-portal)
8. [Lab Technician Portal](#8-lab-technician-portal)
9. [Radiologist Portal](#9-radiologist-portal)
10. [Pharmacist Portal](#10-pharmacist-portal)
11. [Cashier Portal](#11-cashier-portal)
12. [Dentist Portal](#12-dentist-portal)
13. [Midwife Portal](#13-midwife-portal)
14. [Admin Portal](#14-admin-portal)
15. [Billing & Payments — Detailed Guide](#15-billing--payments--detailed-guide)
16. [Settings — Your Personal Configuration](#16-settings--your-personal-configuration)
17. [Notifications](#17-notifications)
18. [Printing — Tokens, Receipts & Reports](#18-printing--tokens-receipts--reports)
19. [Exporting Data](#19-exporting-data)
20. [Security, Passwords & Session Policy](#20-security-passwords--session-policy)
21. [Common Questions & Troubleshooting](#21-common-questions--troubleshooting)
22. [Glossary of Terms](#22-glossary-of-terms)

---

## 1. What Is This System?

**Dayspring Community Health Care HIS** (Hospital Information System) is a web-based software application that manages the entire operation of the hospital — from the moment a patient walks through the door to the moment they leave, and every step in between.

**What does it do?**
- Keeps a complete, accurate digital record of every patient
- Routes patients through departments in an organised queue
- Coordinates clinical care across doctors, nurses, lab techs, radiologists, pharmacists, and specialist clinicians
- Processes billing and payments
- Generates reports for management

**How is it accessed?**
- Open any modern web browser (Chrome, Edge, Firefox)
- Navigate to the hospital's web address (URL)
- Log in with your assigned email and password

**Key principle — Role-Based Access:**
Every staff member sees only what is relevant to their job. A nurse does not see the cashier's payment screen. A pharmacist does not see the admin's user management panel. The system automatically shows you only your portal.

---

## 2. Logging In & Getting Started

### Step-by-Step Login

1. Open your web browser
2. Go to the hospital's system address (provided by your system administrator)
3. Enter your **Email Address** — this is the one the administrator registered you with
4. Enter your **Password**
5. Click **Sign In**

> **First login?** You may receive a verification email. Open that email and click the verification link before your first login.

### What Happens After You Log In?

The system reads your role and automatically takes you to your dashboard. For example:
- A nurse lands on the **Nurse Dashboard**
- A cashier lands on the **Cashier Dashboard**
- An admin lands on the **Admin Dashboard**

### Session Duration

For security purposes — and because this is a hospital with shared computers — your session lasts **8 hours**. After 8 hours (or when you close your browser), you will need to log in again. This is intentional. It protects patient data if a workstation is left unattended.

> **Important:** Always log out when you leave a shared workstation. Do not leave your account open for others to use.

### Logging Out

Click your name or avatar in the top-right corner of the screen and select **Sign Out**.

---

## 3. User Roles — Who Does What

The system has **10 user roles**. Each role has specific permissions — things they are allowed to see and do.

---

### Hospital Admin
**Who**: Hospital management, IT, administrators  
**What they can do**:
- Create, deactivate, and manage all user accounts
- Change any user's role
- View all patient records across the entire hospital
- Manage bed inventory and ward occupancy
- View full financial reports and revenue analysis
- Review the audit trail (a log of every action taken in the system)
- Manage non-medication supplies inventory

---

### Receptionist
**Who**: Front desk staff  
**What they can do**:
- Register new patients
- Search and update existing patient records
- Book and manage appointments
- Check patients in and assign them to queues
- Print queue tokens
- View and manage the patient queue
- Process basic payments (if needed)
- Export daily registration reports

---

### Clinician (Doctor)
**Who**: Medical officers, general practitioners, doctors  
**What they can do**:
- View full patient records and medical history
- Write clinical (medical) notes and assessments
- Create and manage prescriptions
- Order lab tests and radiology scans
- Create billing items for services rendered
- Export their own medical records and prescriptions

---

### Nurse
**Who**: Nurses, nursing officers  
**What they can do**:
- Record and monitor vital signs for patients
- Perform and document triage assessments
- Write nursing notes linked to patient care
- Assign patients to beds and manage transfers
- Order lab tests
- Receive alerts when vital signs are critical
- Export vital signs and nursing records

---

### Lab Technician
**Who**: Laboratory staff  
**What they can do**:
- View and manage the lab test queue
- Update sample collection and processing status
- Enter test results and reference ranges
- Upload test report documents
- View turnaround time analytics
- Export lab data and reports

---

### Radiologist
**Who**: Radiologists and radiology staff  
**What they can do**:
- View and manage the radiology worklist (queue of ordered scans)
- Update the status of imaging studies
- Write radiology reports
- Upload imaging documents
- View study completion analytics
- Export radiology reports

---

### Pharmacist
**Who**: Pharmacists and pharmacy technicians  
**What they can do**:
- View and fulfil prescriptions from the prescription queue
- Manage medication inventory (stock levels, expiry, reorders)
- Scan barcodes to verify prescriptions and bills
- Create and manage purchase orders for medications
- Record goods received from suppliers
- Perform stock takes and adjustments
- View usage analytics and ABC analysis for inventory
- Manage supplier information

---

### Cashier
**Who**: Billing staff, cashiers  
**What they can do**:
- View bills awaiting payment
- Create new bills for patients
- Process payments by all methods (cash, mobile money, card, bank, insurance)
- Generate receipts and print them
- Process partial payments and split payments
- View daily shift summary and reconciliation
- Generate and export financial reports

---

### Dentist
**Who**: Dental officers and staff  
**What they can do**:
- All the same clinical functions as a Clinician, but focused on dental care
- Write dental-specific notes and treatment plans
- Order dental X-rays and imaging
- Track dental procedures (fillings, extractions, root canals, prosthetics)
- Export dental records

---

### Midwife
**Who**: Midwives and obstetric nursing staff  
**What they can do**:
- All the same clinical functions as a Clinician, but focused on maternal and child health
- Track pregnancy (weeks of gestation, expected delivery date)
- Document labour progression and delivery
- Write postnatal and newborn assessment notes
- Export obstetric records

---

## 4. How a Patient Moves Through the System

Understanding this flow is the most important part of the training. Every patient follows a similar path, though some steps may vary depending on whether they are outpatient (OPD) or inpatient.

```
PATIENT ARRIVES
      |
      v
[1] REGISTRATION (Receptionist)
      |
      v
[2] TRIAGE (Nurse)
      |
      v
[3] CHECK-IN & QUEUE (Receptionist)
      |
      v
[4] CLINICAL ENCOUNTER (Doctor / Specialist / Dentist / Midwife)
      |
      |----> [5a] LAB TESTS (Lab Tech)
      |----> [5b] RADIOLOGY (Radiologist)
      |----> [5c] PHARMACY (Pharmacist)
      |
      v
[6] BILLING & PAYMENT (Cashier)
      |
      v
[7] DISCHARGE
```

---

### Step 1 — Registration (Receptionist)

**Where**: Receptionist Portal → Patients

The receptionist registers every new patient into the system. Returning patients are searched for and their records updated.

**Information collected at registration**:
- **Full Name** (First, Middle, Last)
- **Date of Birth** (or estimated age)
- **Gender**
- **Phone Number** (in Uganda format, e.g. 0771234567)
- **Address** — District, Subcounty, Parish, Village
- **National Identification Number (NIN)** — optional
- **Blood Group** (e.g., O+, A-)
- **Known Allergies** — very important for pharmacy
- **Occupation**
- **Emergency Contact** — Name and phone number
- **Next of Kin** — Name, relationship, phone number
- **Insurance** — Insurance provider and membership number (if applicable)

**After registration**, the system automatically generates a **unique Patient Number** in the format `P` + Year + 5 random digits (e.g., **P261A34F2**). This number is used everywhere in the system to identify the patient.

> **Key tip for Receptionists**: Always search for a patient before creating a new record. Use their name and phone number to check. Duplicate records cause confusion across all departments.

---

### Step 2 — Triage (Nurse)

**Where**: Nurse Portal → Triage

**What is triage?** Triage is the process of quickly assessing how urgent a patient's condition is, so the sickest patients are seen first.

**Information recorded during triage**:

| Vital Sign | What it Measures | Normal Adult Range |
|---|---|---|
| Blood Pressure (Systolic/Diastolic) | Force of blood against artery walls | 90–140 / 60–90 mmHg |
| Heart Rate | Number of heartbeats per minute | 60–100 bpm |
| Respiratory Rate | Number of breaths per minute | 12–20 breaths/min |
| Temperature | Body heat | 36.1–37.2 °C |
| Oxygen Saturation (SpO2) | % of oxygen in the blood | 95–100% |
| Pain Score | Patient-reported pain level | 0 (none) – 10 (worst) |
| AVPU | Level of consciousness | A = Alert (normal) |
| Mobility | How the patient is moving | Ambulatory = walking normally |
| Pregnancy Status | Weeks gestation (if applicable) | — |

**AVPU Definitions**:
- **A — Alert**: Patient is fully awake and responds normally
- **V — Verbal**: Patient only responds when you speak to them
- **P — Pain**: Patient only responds to painful stimuli
- **U — Unresponsive**: Patient does not respond at all

**Triage Categories**:

| Category | Colour | Meaning | Example |
|---|---|---|---|
| Emergency | RED | Life-threatening. See immediately | Unconscious patient, SpO2 below 90%, major trauma |
| Very Urgent | YELLOW | Serious but stable. See within 10–30 minutes | High fever, chest pain, difficulty breathing |
| Urgent | GREEN | Non-emergency. See within 2 hours | Minor injury, stable chronic condition review |
| Non-Urgent | GREEN | Routine. Can wait longer | Routine checkup, prescription refill |

> **Critical Alert**: If the system detects vitals that fall into emergency ranges, it automatically flags the record and generates an alert visible to clinical staff. This helps ensure no critical patient is missed.

---

### Step 3 — Check-In & Queue (Receptionist)

**Where**: Receptionist Portal → Check-in

After triage, the receptionist checks the patient in and assigns them to the appropriate department queue.

**Steps**:
1. Search for the patient by name or patient number
2. Select which department they are going to (e.g., OPD, Dental, Maternity)
3. Click **Check In**
4. A **queue token** is generated and can be printed

**The Queue Token** (the printed slip given to the patient) contains:
- Patient name and patient number
- Check-in time
- Department assigned
- Queue position (e.g., Patient No. 7 for OPD)

**Queue Statuses** — what happens to a patient's queue entry:

| Status | Meaning |
|---|---|
| WAITING | Patient has checked in and is waiting to be called |
| CALLED | Staff have called the patient's name |
| IN_ROOM | Patient is currently with a clinician |
| DONE | Consultation/service is complete |
| SKIPPED | Patient did not respond when called; moved later in queue |

> **Tip**: The queue board is visible to all clinical staff. This helps each department see who is waiting and how long they have waited.

---

### Step 4 — Clinical Encounter (Doctor / Specialist)

**Where**: Clinician Portal / Dentist Portal / Midwife Portal

The doctor or specialist:
1. Opens the patient record from their queue
2. Reviews the patient's triage information, medical history, allergies, and current medications
3. Performs their assessment
4. Records a **medical note** documenting:
   - Chief complaint (why the patient came)
   - Clinical findings (what the doctor observed)
   - Diagnosis or assessment
   - Treatment plan
5. Places orders for any of the following (if needed):
   - **Lab Tests** — these appear immediately in the Lab Tech's queue
   - **Radiology Scans** — these appear immediately in the Radiologist's worklist
   - **Prescriptions** — these appear immediately in the Pharmacist's prescription queue
6. Creates billing items for all services rendered

---

### Steps 5a, 5b, 5c — Supporting Services (Run in Parallel)

These services often happen simultaneously while the patient waits.

**Lab Tests (Lab Tech)**:
- Lab Tech sees the ordered test in their queue
- Collects sample → marks **Collected**
- Processes test → marks **Analyzed**
- Verifies result → marks **Verified**
- Releases result → marks **Finalized**
- Doctor can view results immediately once finalized

**Radiology (Radiologist)**:
- Radiologist sees the study in their worklist
- Acquires the image (X-ray, ultrasound, etc.) → marks **Acquired**
- Reviews and writes the report → marks **Reported**
- Doctor can view the radiology report once completed

**Pharmacy (Pharmacist)**:
- Pharmacist sees the prescription in their queue
- Verifies the prescribed medications are in stock
- Dispenses the medications to the patient
- Updates stock levels automatically

---

### Step 6 — Billing & Payment (Cashier)

**Where**: Cashier Portal

**What is a bill?** A bill is a financial record of all the services the patient received during their visit. It is created by the clinical staff as they work, or by the cashier at checkout.

The cashier:
1. Finds the patient's bill in the queue (it will show as **Pending**)
2. Reviews all items on the bill
3. Processes the payment using the patient's chosen method
4. Generates and prints a receipt
5. The bill status changes to **Paid**

> **If the patient cannot pay the full amount**, a partial payment can be recorded, and the bill is marked **Partially Paid**. The outstanding balance remains trackable until fully settled.

---

### Step 7 — Discharge

For **outpatients**: The patient leaves after receiving their medications and receipt.

For **inpatients** (admitted patients):
1. The clinical team decides the patient is ready for discharge
2. A discharge summary is written
3. The nurse releases the patient's bed in the system (marking it **Available**)
4. The patient collects their documents and any remaining medications
5. Follow-up appointments are scheduled if needed

---

## 5. Receptionist Portal

**Access**: `/receptionist`  
**Main sections**: Overview, Patients, Check-in, Queue, Payments, Reports

---

### 5.1 Overview Dashboard

The first page you see when you log in. Shows today's key numbers:
- **Total Arrivals Today**: How many patients registered today
- **Currently Waiting**: Patients in the queue not yet seen
- **In Service**: Patients currently with clinical staff
- **Payments Today**: Revenue processed through the reception

---

### 5.2 Registering a New Patient

1. Go to **Patients** tab
2. Click **Register New Patient** (or similar button)
3. Fill in the form — required fields are marked with an asterisk (*)
4. Click **Save**
5. The system assigns the patient a unique **Patient Number** (shown on screen)
6. Optionally print a patient card or label

> **Searching for an existing patient**: Type the patient's name, phone number, or patient number in the search box. Results appear as you type.

---

### 5.3 Check-In

1. Go to **Check-in** tab
2. Search for the patient by name or patient number
3. Confirm the patient's identity
4. Select their **destination department** (OPD, Dental, Obstetrics, etc.)
5. Click **Check In**
6. A queue token is generated — print it using the **Print Token** button
7. Give the token to the patient

---

### 5.4 Queue Management

The **Queue** tab shows a real-time list of all patients currently in the system.

**What you can do from the queue**:
- **Call** a patient (changes status to CALLED)
- **Mark In Room** (changes status to IN_ROOM)
- **Mark Done** (changes status to DONE)
- **Skip** a patient who didn't respond (changes status to SKIPPED)
- See **wait time** for each patient (how long they have been waiting)
- Filter by department

> **Department Pressure**: The queue board shows how busy each department is. If one department has many patients waiting, the receptionist can coordinate to redirect non-urgent cases.

---

### 5.5 Appointments

1. Go to **Appointments** tab
2. Click **New Appointment**
3. Select:
   - **Patient** (search by name or number)
   - **Clinician/Doctor**
   - **Date and Time** (only available slots are shown)
   - **Appointment Type** (consultation, follow-up, procedure, etc.)
   - **Notes** (optional)
4. Click **Save**
5. The patient receives a reminder (if email/SMS is configured)

**Appointment Statuses**:

| Status | Meaning |
|---|---|
| Scheduled | Appointment booked, patient has not yet arrived |
| Arrived | Patient has checked in on their appointment day |
| In Progress | Patient is with the clinician |
| Completed | Appointment is finished |
| Billed | Appointment has been added to a bill |
| Cancelled | Appointment was cancelled |

---

## 6. Nurse Portal

**Access**: `/nurse`  
**Main sections**: Vital Signs, Nursing Notes, Patient Care List, Triage History

---

### 6.1 Recording Vital Signs

1. Go to **Vital Signs** tab
2. Search for or select the patient
3. Fill in the vital signs form:
   - Blood Pressure (Systolic / Diastolic)
   - Heart Rate
   - Respiratory Rate
   - Temperature
   - Oxygen Saturation (SpO2)
   - Pain Score (0–10)
   - AVPU
   - Mobility
   - Weight, Height (if required)
4. Add any notes in the **Clinical Notes** field
5. Click **Save Vitals**

**Critical Values**: If any entered value falls outside safe limits, the field turns red and a warning appears. The system flags this patient record for urgent attention.

---

### 6.2 Triage Assessment

The triage form is a structured assessment tool. Complete every section carefully.

**Sections of the Triage Form**:
1. **Basic Vitals** (as listed above)
2. **Chief Complaint** — What is the patient's primary problem in their own words?
3. **Injury/Trauma Assessment** — Is there physical injury? Burns? Size estimation?
4. **Pregnancy/Postpartum** — Is the patient pregnant? How many weeks? Postpartum?
5. **Respiratory Assessment** — Any breathing difficulty?
6. **Nutritional Status** (especially for paediatric patients) — MUAC measurement, weight-for-age
7. **Capillary Refill** — Press finger; does colour return within 2 seconds?
8. **Final Triage Category** — System calculates this based on vitals, but nurse can adjust

---

### 6.3 Nursing Notes

Nursing notes are written records of patient care activities — observations, interventions, patient responses.

1. Go to **Nursing Notes** tab
2. Select the patient
3. Click **New Note**
4. Write your note (what you observed, what you did, how the patient responded)
5. Click **Save**

Notes are linked to the patient's record and are visible to clinical staff.

---

### 6.4 Patient Care List

Shows all patients currently under nursing care. From this list you can:
- View a patient's latest vitals summary
- Click into a patient's detailed record
- Sort by triage category to prioritise RED and YELLOW patients
- Filter by date range

---

### 6.5 Vital Signs Export

1. Go to **Vital Signs** tab
2. Select your date range (Today, Last 7 Days, Last Month, Custom)
3. Apply any filters (e.g., only EMERGENCY category)
4. Click **Export**
5. Choose format: CSV, Excel (XLSX), or PDF
6. Download the file

---

## 7. Clinician / Doctor Portal

**Access**: `/clinician` or `/doctor`  
**Main sections**: Patient Queue, Medical Notes, Prescriptions, Test Orders, Exports

---

### 7.1 Finding Your Patients

When you log in, your queue shows patients waiting to see you, based on the department you are assigned to.

You can also **search for any patient** by:
- Patient number
- Full name
- Phone number

---

### 7.2 Writing a Medical Note

1. Open the patient record
2. Click **New Medical Note**
3. Complete the note:
   - **Chief Complaint**: Why is the patient here today?
   - **History of Presenting Illness**: When did it start? Is it getting worse?
   - **Past Medical History**: Relevant previous illnesses or surgeries
   - **Medications**: Current medications (from pharmacy record)
   - **Allergies**: Confirmed from patient record
   - **Physical Examination Findings**: What you found on examination
   - **Assessment/Diagnosis**: Your clinical conclusion
   - **Plan**: What you will do (medications, tests, follow-up)
4. Click **Save Note**

---

### 7.3 Writing a Prescription

1. Open the patient record
2. Click **New Prescription**
3. Search for the medication by name (searches the pharmacy inventory)
4. Select the medication
5. Fill in:
   - **Dose** (e.g., 500mg)
   - **Route** (Oral, IV, IM, etc.)
   - **Frequency** (e.g., Three times daily)
   - **Duration** (e.g., 5 days)
   - **Special Instructions** (e.g., Take with food)
6. Click **Add to Prescription**
7. Repeat for each medication
8. Click **Submit Prescription**

The prescription appears immediately in the **Pharmacist's queue**.

---

### 7.4 Ordering a Lab Test

1. Open the patient record
2. Click **Order Lab Test**
3. Select the test type from the catalogue
4. Set the **priority**:
   - **Emergency** — Life-threatening; process immediately
   - **Urgent** — Process within 2 hours
   - **Routine** — Standard processing
   - **Low** — Process when time allows
5. Add **clinical indication** (reason for the test)
6. Click **Submit Order**

The test appears immediately in the **Lab Tech's queue**.

---

### 7.5 Ordering Radiology (Imaging)

1. Open the patient record
2. Click **Order Imaging**
3. Select the study type (X-ray, Ultrasound, CT, MRI, etc.)
4. Set the priority
5. Add clinical indication
6. Click **Submit**

The study appears immediately in the **Radiologist's worklist**.

---

### 7.6 Creating a Billing Item

As you work, add each service to the bill:

1. Click **Add to Bill**
2. Select the service type (Consultation, Procedure, etc.)
3. The system shows the standard price from the hospital tariff
4. Adjust quantity if needed (e.g., 2 procedures)
5. Click **Save Item**

These items form the patient's bill, which the cashier will process.

---

## 8. Lab Technician Portal

**Access**: `/lab-tech`  
**Main sections**: Lab Queue, Test Details, Analytics, Exports

---

### 8.1 Lab Queue Overview

The queue is divided into tabs:
- **Pending**: Tests ordered but sample not yet collected
- **In Progress**: Tests where sample has been collected and is being processed
- **Completed**: Tests with finalized results
- **All**: Every test in the system

**Each test card shows**:
- Patient name and patient number
- Test type (e.g., Full Blood Count, Malaria RDT)
- Priority (colour-coded: red = emergency, orange = urgent, grey = routine)
- Time ordered
- Current status
- Assigned technician (if any)
- If the test is overdue (past the expected turnaround time), it is highlighted

---

### 8.2 Processing a Test — Step by Step

**1. Collect Sample**
- Click on the test in the queue
- Confirm patient identity
- Collect the sample (blood, urine, swab, etc.)
- In the system, update status to **Collected**
- Note collection time and collector name

**2. Analyze Sample**
- Process the sample in the laboratory
- When the test is complete, update status to **Analyzed**

**3. Enter Results**
- Click **Enter Results**
- For each test parameter, enter the measured value
- The system shows the normal reference range
- Values outside the normal range are automatically highlighted
- Add any comments or observations

**4. Verify Results**
- A senior technician reviews the results
- If correct, update status to **Verified**

**5. Finalize**
- Click **Finalize** to release results to the requesting clinician
- Status changes to **Finalized**
- The clinician is notified that results are ready

**6. Upload Report (Optional)**
- If there is a printed report document, click **Upload Document**
- Attach the scanned or digital file

---

### 8.3 Turnaround Time (TAT)

**What is TAT?** Turnaround Time is the total time from when a test is ordered to when results are released. It is a key quality indicator.

The **Analytics** tab shows:
- **Average TAT**: Average time to complete tests
- **Minimum TAT**: Fastest test completion
- **Maximum TAT**: Slowest test completion
- **Tests by Status**: How many in each stage
- **Test Type Distribution**: Which tests are ordered most

---

## 9. Radiologist Portal

**Access**: `/radiologist`  
**Main sections**: Worklist (Active/Completed/All), Study Details, Add Scan, Analytics, Exports

---

### 9.1 Worklist Overview

The worklist shows all imaging studies ordered by clinicians. Each study shows:
- Patient name and ID
- Study type (X-ray, CT scan, MRI, Ultrasound, etc.)
- Priority
- Ordering clinician
- Date and time ordered
- Current status
- If the study is older than 24 hours and not yet completed, it is flagged as **urgent**

---

### 9.2 Processing an Imaging Study

**1. Acquire Image**
- Open the study from the worklist
- The imaging equipment is used to take the scan
- In the system, update status to **Acquired**

**2. Review Images**
- Review the images on the PACS viewer or your imaging equipment
- Compare with any prior studies if available

**3. Write the Report**
- Click **Write Report**
- Document your findings:
  - **Clinical History**: What the clinician noted when ordering
  - **Technique**: How the image was acquired
  - **Findings**: What you observe in the image
  - **Impression**: Your diagnostic conclusion
- Click **Save Report**
- Update status to **Reported**

**4. Upload Images/Documents** (Optional)
- If digitized images exist, upload them via **Upload Document**

The clinician receives a notification and can view the report immediately.

---

### 9.3 Adding a Scan Directly

If a patient walks in for imaging (without a digital order):

1. Click **Add Scan**
2. Search for the patient
3. Select study type
4. Set priority
5. Add clinical indication
6. Save — the study is added to your own queue for immediate processing

---

## 10. Pharmacist Portal

**Access**: `/pharmacist`  
**Main sections**: Prescription Queue, Inventory, Stock Management, Suppliers, Purchase Orders, Analytics

---

### 10.1 Prescription Queue

Shows all prescriptions waiting to be dispensed.

**Tabs**:
- **Active**: Prescriptions not yet fully dispensed
- **Completed**: Fully dispensed prescriptions

**Each prescription shows**:
- Patient name and ID
- Medication name and dose
- Prescribing clinician
- Time prescribed
- Current status

---

### 10.2 Dispensing a Prescription — Step by Step

1. Click on the prescription in the queue
2. Review all items on the prescription
3. For each medication:
   - Confirm the medication is in stock (stock level shown)
   - Enter the **quantity to dispense**
   - Select the **batch/lot** (for tracking expiry)
   - Add any **dispense notes** (e.g., special storage instructions for patient)
4. Optionally scan a barcode on the bill to verify the patient's identity
5. Click **Dispense**
6. The system automatically deducts the dispensed quantity from stock

---

### 10.3 Inventory Management

**What is inventory?** The inventory is the complete list of all medications in the pharmacy, their stock quantities, prices, and expiry dates.

**The inventory table shows**:
- Medication name and formulation (tablet, syrup, injection, etc.)
- Current stock quantity
- Reorder level (the minimum quantity before a reorder is triggered)
- Unit price
- Nearest expiry date
- Batch/lot numbers

**Important alerts**:
- **Low Stock**: When quantity falls below the reorder level — shown in orange
- **Expiring Soon**: Medications expiring within 90 days — shown in yellow/red
- **Out of Stock**: Zero quantity — shown in red

---

### 10.4 Stock Taking

A stock take is a physical count of all medications, compared against the system's recorded quantities.

1. Go to **Stock Taking** section
2. Select the date of the physical count
3. For each medication, enter the **physical count** (what you actually counted)
4. The system shows the **expected count** (what it thinks is there)
5. Any **variance** (difference) is highlighted for investigation
6. Submit the stock take to update records

---

### 10.5 Stock Adjustments

Use adjustments for situations where stock levels need to change outside of normal dispensing:
- **Write-off**: Damaged or expired medication removed from inventory
- **Transfer**: Stock moved between wards or stores
- **Manual Correction**: Correcting an error in the count

For each adjustment, you must provide a **reason**. All adjustments are logged for audit purposes.

---

### 10.6 Purchase Orders

When stock needs to be replenished:

1. Go to **Purchase Orders**
2. Click **New Purchase Order**
3. Select the **supplier**
4. Add each medication and the quantity needed
5. The system shows the current price from the last order
6. Submit the purchase order
7. Track delivery status (Pending → Delivered)

---

### 10.7 Receiving Goods (GRN — Goods Received Note)

When a delivery arrives:

1. Go to **Purchase Orders** and find the relevant order
2. Click **Receive Goods**
3. For each item:
   - Enter quantity actually received
   - Enter batch/lot number
   - Enter expiry date
   - Note any damages or discrepancies
4. Click **Confirm Receipt**
5. Stock levels are automatically updated

---

### 10.8 Supplier Management

Maintain contact information for all suppliers:
- Supplier name
- Contact person
- Phone and email
- Address
- Typical lead time (how many days from order to delivery)

---

## 11. Cashier Portal

**Access**: `/cashier`  
**Main sections**: Overview, Bill Queue, Create Bill, Process Payment, Financial Reports, Exports

---

### 11.1 Overview Dashboard

Shows today's financial activity:
- **Today's Revenue**: Total amount collected today
- **This Week's Revenue**: Revenue so far this week
- **Outstanding Balance**: Total unpaid across all bills
- **Bills Awaiting Payment**: Number of pending/partially paid bills
- **Recent Transactions**: Last few payments processed
- **Shift Summary**: Your shift start time and how many bills you have processed

---

### 11.2 Bill Queue

Bills are organized into tabs:
- **Pending**: Bills created but no payment received yet
- **Partially Paid**: Bills with some payment received but balance remaining
- **Paid**: Fully settled bills
- **All**: Every bill in the system

**Each bill shows**:
- Patient name and ID
- Invoice number (unique bill identifier)
- Total amount
- Amount already paid
- Outstanding balance
- Bill status (colour-coded)

---

### 11.3 Creating a Bill

If a bill has not already been created by the clinical staff:

1. Click **Create Bill**
2. Search for the patient
3. Click **Add Item** for each service:
   - Select service type (Consultation, Lab Test, Imaging, Medication, Procedure, Bed Charge, Other)
   - Enter item name
   - Enter unit price
   - Enter quantity
   - System calculates the line total
4. If the patient has insurance, enter insurance details and the amount covered
5. Apply any discount if applicable (must be authorised)
6. Review the total
7. Click **Save Bill**

The bill appears in the queue with status **Pending**.

---

### 11.4 Processing a Payment — Step by Step

1. Find the patient's bill in the queue (or search by patient name/invoice number)
2. Click **Process Payment** or **Pay**
3. Review the bill items and total
4. Select **Payment Type**:
   - **Full Payment**: Patient pays the entire amount
   - **Partial Payment**: Patient pays less than the full amount (enter the amount being paid)
5. Select **Payment Method**:

**Cash**:
- Enter amount tendered by patient
- System calculates change automatically
- Confirm payment
- Receipt is generated

**Mobile Money** (Pesapal):
- Enter patient's phone number
- Enter amount
- System initiates a payment request to the patient's phone
- Patient receives a prompt on their phone and approves
- System confirms payment automatically
- Receipt is generated

**Card**:
- Process through the card terminal
- Enter transaction reference number in system
- Confirm payment
- Receipt is generated

**Bank Transfer**:
- Patient provides bank transfer reference
- Enter reference number in system
- Mark as received (admin may need to verify with bank)
- Receipt is generated

**Insurance**:
- Verify insurance card details
- Enter claim reference
- Mark the insurance portion as covered
- Patient pays any co-payment in cash or mobile money
- Receipt generated showing both portions

**Split Payment** (two or more methods):
- Click **Split Payment**
- Select first method and enter amount paid by that method
- Click **Add Method**
- Select second method and enter remaining amount
- Confirm
- Receipt shows both payment methods

6. After confirming payment, the system:
   - Changes bill status to **Paid** (or **Partially Paid** for partial payments)
   - Generates a **Receipt** with a unique receipt number
   - Offers option to **Print Receipt**

---

### 11.5 Receipt Format

Every receipt contains:
- **Receipt Number** in the format `DMC` + date (YYMMDD) + 4 random digits (e.g., DMC260410XXXX)
- Patient name and patient number
- All bill items with prices
- Total amount billed
- Amount paid
- Payment method
- Change given (cash payments)
- Date and time
- Cashier name
- Space for signatures (physical receipt)

---

### 11.6 Financial Reports

The **Reports** section provides management-level financial data:

| Report | What It Shows |
|---|---|
| Revenue by Period | Daily, weekly, monthly revenue totals |
| Payment Method Breakdown | How much was paid by cash, mobile money, card, etc. |
| Outstanding Aging | How long bills have been unpaid (30 days, 60 days, 90+ days) |
| Service Performance | Revenue by service type (consultations, lab, pharmacy, etc.) |
| Department Revenue | Revenue contribution per department |

All reports can be exported as CSV, Excel, or PDF.

---

### 11.7 Shift Summary & Reconciliation

At the end of your shift:

1. Go to **Shift Summary**
2. Review:
   - Shift start and end times
   - Total number of bills processed
   - Total revenue collected
   - Breakdown by payment method (how much cash, how much mobile money, etc.)
3. Cross-check with your physical cash count
4. Report any discrepancies to your supervisor

---

## 12. Dentist Portal

**Access**: `/dentist`

The Dentist Portal works the same way as the Clinician Portal (Section 7), with additional dental-specific features:

---

### Dental-Specific Features

**Dental Notes**: Include dental-specific fields:
- Tooth chart (tooth number and condition)
- Dental procedure performed (e.g., extraction, filling, root canal, scaling)
- Anaesthesia used
- Patient cooperation level
- Post-procedure instructions given

**Treatment Plans**: Create staged treatment plans when the patient needs multiple appointments:
- List all procedures planned
- Estimated cost for each
- Schedule next appointment
- Track which steps are completed

**Dental Radiology**: Order dental X-rays specifically:
- Periapical X-rays (single tooth)
- Bitewing X-rays (side teeth)
- OPG — Orthopantomogram (full jaw panoramic X-ray)

**Prosthetics Orders**: Track custom dental prosthetics sent to a dental laboratory:
- Crown, bridge, denture, or orthodontic appliance ordered
- Date sent to lab
- Expected return date
- Fitting appointment scheduling

---

## 13. Midwife Portal

**Access**: `/midwife`

The Midwife Portal works similarly to the Clinician Portal (Section 7), with additional maternal health features:

---

### Midwife-Specific Features

**Pregnancy Tracking**:
- Last Menstrual Period (LMP) date
- Gestational age (calculated automatically)
- Expected Delivery Date (EDD)
- Number of previous pregnancies (Gravida) and deliveries (Para)
- Antenatal visit schedule and completion

**Labour Documentation**:
- Labour onset time
- Cervical dilation progress (partograph)
- Foetal heart rate monitoring
- Oxytocin use
- Complications noted during labour
- Delivery method (Normal Vaginal Delivery, Assisted, Caesarean Section)
- Delivery time
- APGAR score at 1 and 5 minutes

**Postpartum Care**:
- Days since delivery
- Maternal vital signs with postpartum normal ranges
- Lochia assessment (post-delivery bleeding)
- Wound inspection (episiotomy or C-section wound)
- Breastfeeding status

**Newborn Assessment**:
- Birth weight and length
- Head circumference
- APGAR score
- Initiation of breastfeeding
- Immunisations given at birth (BCG, OPV)
- Any abnormalities noted

---

## 14. Admin Portal

**Access**: `/admin`  
**Main sections**: Overview, User Management, Bed Management, Patient Management, Financial Reports, Audit Trail, Inventory

---

### 14.1 System Overview Dashboard

The admin dashboard is a hospital-wide view:
- **Department Activity**: Shows which departments are active, idle, or under high pressure
- **Staffing**: Overview of logged-in staff across departments
- **Revenue Snapshot**: Today's earnings summary
- **Throughput**: Patients registered, checked in, and discharged today
- **Bed Occupancy**: Current ward occupancy rates

---

### 14.2 User Management

**View All Users**:
- Table showing every user account
- Columns: Name, Email, Role, Status (Active/Inactive), Last Login, Department

**Create a New User**:
1. Click **Add User**
2. Fill in:
   - Full name
   - Email address (becomes their login username)
   - Assign role (from the 10 roles described in Section 3)
   - Assign department (if applicable)
3. Click **Save**
4. The new user receives a welcome email with instructions to set their password

**Deactivating a User** (when someone leaves the organisation):
1. Find the user in the list
2. Click **Deactivate**
3. Confirm the action
4. The user can no longer log in
5. Their records remain in the system (for audit purposes) but they cannot access the system

> **Important**: Never delete a user. Deactivate them instead. Deleted users could create gaps in audit records.

**Changing a User's Role**:
1. Click the user's name
2. Select the new role from the dropdown
3. Save — takes effect immediately on next login

**Bulk Operations**:
- Select multiple users using the checkboxes
- Apply bulk actions: Activate, Deactivate, or Change Role for all selected users at once

---

### 14.3 Bed Management

**Bed Inventory Table**:
- Lists every bed in every ward
- Shows: Ward Name, Bed Number, Status, Current Patient (if occupied), Time Occupied

**Bed Statuses**:

| Status | Meaning |
|---|---|
| Available | Bed is clean and ready for a new patient |
| Occupied | A patient is currently assigned to this bed |
| Maintenance | Bed is out of service (cleaning, repair, equipment issue) |

**Occupying a Bed**:
1. Find an **Available** bed in the desired ward
2. Click **Assign Patient**
3. Search for the patient
4. Confirm
5. Bed status changes to **Occupied**

**Releasing a Bed** (on patient discharge):
1. Find the occupied bed
2. Click **Release**
3. Bed returns to **Available** status

**Transferring a Patient**:
1. Find the currently occupied bed
2. Click **Transfer**
3. Select the destination bed (must be Available)
4. Confirm
5. Old bed becomes Available; new bed becomes Occupied

**Maintenance Mode**:
1. Click **Set Maintenance**
2. Enter reason and expected duration
3. Bed is removed from the available pool until maintenance is cleared

---

### 14.4 Audit Trail

**What is an audit trail?** A log of every significant action taken in the system. It records who did what, on which record, and when.

**Why is it important?**
- Ensures accountability
- Required for regulatory compliance
- Helps investigate discrepancies or suspicious activity
- Protects both the hospital and staff

**What is logged?**
- All logins and logouts
- Patient record creation and modification
- Bill creation, modification, and payment
- User account changes (created, deactivated, role changed)
- Prescriptions written and dispensed
- Lab test orders, results, and modifications
- Exports and downloads of data
- Any deletion events

**How to review the audit trail**:
1. Go to **Audit Trail** section
2. Filter by:
   - Date range
   - User (who performed the action)
   - Action type (login, edit, delete, export, etc.)
   - Record type (patient, bill, prescription, etc.)
3. Review the entries
4. Export as CSV or PDF for compliance records

---

### 14.5 Non-Medication Inventory

Tracks non-drug hospital supplies (gloves, syringes, bandages, forms, stationery, etc.):
- Item name and category
- Current stock quantity
- Reorder level
- Unit cost
- Supplier information
- Reorder suggestions

Managed similarly to the pharmacy inventory, but for operational supplies.

---

## 15. Billing & Payments — Detailed Guide

This section provides a comprehensive reference for all billing functions.

---

### Bill Structure

A bill (also called an **invoice**) has:

| Element | Description |
|---|---|
| Invoice Number | Unique identifier, auto-generated |
| Patient | Who the bill is for |
| Status | Open / Pending / Partially Paid / Paid / Void |
| Items | List of services with quantities and prices |
| Subtotal | Sum of all items before discount |
| Discount | Amount deducted (if any) |
| Insurance | Amount covered by insurance (if applicable) |
| Total Due | Final amount the patient owes |
| Amount Paid | How much has been collected so far |
| Balance | Total Due minus Amount Paid |

---

### Bill Statuses Explained

| Status | Meaning |
|---|---|
| Open | Bill is being created/edited; not yet submitted |
| Pending | Bill submitted; no payment received |
| Partially Paid | Some payment received; balance remains |
| Paid | Bill fully settled |
| Void | Bill cancelled (no payment) |

---

### Outstanding Bills & Overdue Management

The **Overdue Bills** section shows bills that have not been paid within a set period.

**Aging categories**:
- **0–30 days**: Recent, still within follow-up window
- **31–60 days**: Needs follow-up call or reminder
- **61–90 days**: Escalate to management
- **90+ days**: High-priority collections

For each overdue bill, actions available:
- Send reminder (SMS or email if configured)
- Record a payment promise (patient commits to a payment date)
- Add notes about payment arrangements

---

## 16. Settings — Your Personal Configuration

Every user can access their own settings page to personalise their experience.

**Access**: Click your name/avatar → Settings, or navigate to `/settings`

---

### 16.1 Profile Settings

Update your personal information:
- **Full Name**
- **Phone Number**
- **Department** (read-only for non-admins; changed by admin only)
- Click **Save Profile**

---

### 16.2 Change Email Address

1. Go to **Email** tab in settings
2. Enter your new email address
3. Click **Update Email**
4. A verification email is sent to the new address
5. Click the link in that email to confirm
6. Your login email is updated

---

### 16.3 Change Password

1. Go to **Password** tab in settings
2. Enter your **Current Password**
3. Enter your **New Password**
4. Check the password strength indicators:
   - At least 8 characters
   - Contains an uppercase letter
   - Contains a lowercase letter
   - Contains a number
   - Contains a special character (e.g., !, @, #)
5. The button is only enabled when the new password is at least **Medium** strength
6. Click **Change Password**

> **Security note**: Change your password if you believe someone else has seen it or accessed your account.

---

### 16.4 Display & Preference Settings

Depending on your role, you can configure:
- **Default Dashboard Tab**: Which section opens when you first log in
  - Example: Lab Tech can set "Queue" so they land directly on the test queue each morning
- **Currency Format**: Adjust how amounts are displayed
- **Date Format**: Choose your preferred date display
- **Notification Preferences**: Which notifications you want to receive
- **Overdue Test Threshold** (Lab Tech only): How many hours before a test is flagged as overdue

---

## 17. Notifications

The notification system keeps you informed of events relevant to your role.

**The notification bell** appears in the top navigation bar. A red badge shows how many unread notifications you have.

**Clicking the bell** opens a panel showing recent notifications with:
- Type of event
- Patient name
- Time
- Link to the relevant record

**Clicking a notification** takes you directly to the relevant item.

---

### Types of Notifications by Role

| Role | Notifications Received |
|---|---|
| Clinician | Lab results ready, radiology report ready, prescription dispensed, appointment reminders |
| Lab Tech | New test ordered (emergency/urgent priority) |
| Radiologist | New imaging study ordered (urgent) |
| Pharmacist | New prescription received, low stock alert, expiring medication alert |
| Nurse | Critical vital signs detected, lab results ready for patients in care |
| Cashier | New bill pending payment |
| Admin | System alerts, audit events, user actions |
| All Roles | Account security alerts (password changed, email changed) |

---

## 18. Printing — Tokens, Receipts & Reports

The system supports printing through two mechanisms:

---

### 18.1 QZ Tray (Thermal Printer)

**What is QZ Tray?** It is a small program installed on the computer that connects the web browser to the thermal receipt printer (the 80mm printer at reception and pharmacy).

**When it is used**:
- Printing queue tokens at reception
- Printing medication labels at pharmacy (if configured)
- Printing receipts at the cashier station

**If QZ Tray is not installed or not running**: The system automatically falls back to the browser's standard print dialog.

---

### 18.2 Browser Print (Standard)

Used for:
- Receipts
- Lab reports
- Radiology reports
- Patient medical certificates
- Referral letters
- Export PDFs

Click the **Print** button, and your browser's print dialog opens. Select your printer and print as normal.

---

### 18.3 If Printing Fails

1. Check that QZ Tray is running (look for its icon in the system tray at the bottom right of the screen)
2. If not running, double-click the QZ Tray icon on the desktop to start it
3. Refresh the browser page and try printing again
4. If still failing, use the browser's print option as a fallback

---

## 19. Exporting Data

Most sections of the system allow data to be exported for reporting and record-keeping.

---

### How to Export

1. Navigate to the section with the data you want
2. Apply any filters (date range, department, status)
3. Click the **Export** button
4. Select your format:
   - **CSV**: Plain spreadsheet data, opens in Excel or Google Sheets
   - **XLSX**: Formatted Excel file with multiple sheets
   - **PDF**: Formatted printable document
5. The file downloads to your computer

---

### What Can Be Exported

| Portal | Exportable Data |
|---|---|
| Receptionist | Patient register, daily arrivals, appointment list |
| Nurse | Vital signs records, nursing notes, triage history |
| Lab Tech | Lab test results, TAT analytics, test queue |
| Radiologist | Radiology reports, study list, completion analytics |
| Pharmacist | Prescription logs, inventory report, stock valuation, usage analytics |
| Cashier | Transaction report, financial summary, overdue bills, shift summary |
| Clinician | Medical notes, prescriptions (own records or per patient) |
| Admin | Full patient register, user list, audit trail, financial reports, inventory |

---

## 20. Security, Passwords & Session Policy

### Password Requirements

When setting or changing your password, it must:
- Be at least **8 characters** long
- Contain at least one **uppercase letter** (A–Z)
- Contain at least one **lowercase letter** (a–z)
- Contain at least one **number** (0–9)
- Contain at least one **special character** (e.g., `!`, `@`, `#`, `$`, `%`)

### Session Timeout

For security:
- Sessions expire automatically after **8 hours**
- This aligns with a typical hospital shift length
- After 8 hours (or after closing the browser), you must log in again

**Why no auto-login or "Remember Me"?**
This is a hospital system. Multiple staff use the same computers. An auto-login feature would allow the next person who opens the browser to access the previous person's account — which would be a serious breach of patient confidentiality and security compliance.

### Account Security Best Practices

1. **Never share your password** with anyone — not even IT staff
2. **Always log out** when leaving a shared workstation
3. **Lock your screen** if stepping away briefly (Windows Key + L)
4. **Change your password** if you suspect it has been compromised
5. **Report suspicious activity** to your supervisor and the system administrator immediately
6. **Do not use the same password** you use for personal accounts

### Rate Limiting (Automatic Protection)

The system automatically blocks accounts that receive too many failed login attempts. This protects against unauthorised access. If your account is blocked:
- Wait 15 minutes and try again
- Or contact your system administrator to have the block cleared

---

## 21. Common Questions & Troubleshooting

---

**Q: I cannot log in. What do I do?**  
A: First, check that your email and password are correct (passwords are case-sensitive). If you still cannot log in, check if your account has been deactivated. Contact your system administrator to verify your account status and reset your password if needed.

---

**Q: I made a mistake in a patient's record. Can I fix it?**  
A: Yes, you can edit records if your role has update permission for that record type. Open the record, make the correction, and save. The edit is logged in the audit trail with your name and the time of the change.

---

**Q: I cannot find a patient. What should I check?**  
A: Try searching by:
- Patient number (most reliable)
- Full name (try just surname)
- Phone number (with and without country code)
- If still not found, they may not be registered yet — check with reception

---

**Q: A prescription or lab test is not showing in my queue.**  
A: Check:
1. Is the order under your department?
2. Has the clinician actually submitted the order (not just saved as draft)?
3. Refresh the page (Ctrl+R or F5)
4. Check the **All** tab (not just the filtered tabs like **Pending**)
5. Contact the requesting clinician to confirm

---

**Q: I cannot process a payment — the button is greyed out.**  
A: The payment button requires:
- A valid bill with at least one item
- A payment method selected
- A payment amount greater than zero
Check all these fields are filled correctly.

---

**Q: I accidentally marked a bill as Paid when it wasn't.**  
A: Contact your supervisor and the system administrator immediately. Payment records can be reviewed and corrected by an admin with audit justification.

---

**Q: The printer is not working.**  
A: See Section 18.3. Check that QZ Tray is running. If using a normal browser print, ensure the correct printer is selected in the print dialog.

---

**Q: I see an error message on screen.**  
A: Note the exact error message and what you were doing when it appeared. Report it to your supervisor or IT support with:
- Your name and role
- Date and time
- What you were trying to do
- The exact error message

---

**Q: The system is running slowly.**  
A: This can happen when the network is slow or the server is under heavy load. Try:
1. Refreshing the page
2. Closing unnecessary browser tabs
3. If on Wi-Fi, move closer to the router
4. Report persistent slowness to IT so they can investigate

---

**Q: Can I access the system from home or on my phone?**  
A: The system works on any device with a modern web browser. However, access is governed by your hospital's security policy. Check with your administrator whether remote access is permitted for your role.

---

**Q: I got a "CSRF token" error when saving something.**  
A: This is a security protection message. The fix is simple:
1. Refresh the page (Ctrl+R)
2. Try your action again
3. If it persists, log out and log back in
If the error continues, report it to IT.

---

## 22. Glossary of Terms

| Term | Definition |
|---|---|
| **APGAR Score** | A quick assessment of a newborn's health at 1 and 5 minutes after birth. Scores Appearance, Pulse, Grimace, Activity, and Respiration. Maximum score is 10. |
| **AVPU** | A scale for assessing consciousness level: Alert, Verbal, Pain, Unresponsive. |
| **Bill** | A financial record of all services provided to a patient, also called an invoice. |
| **Blood Pressure** | The force of blood pushing against artery walls. Expressed as two numbers: Systolic (heart pumping) over Diastolic (heart resting). |
| **Check-in** | The process of officially registering a patient's arrival on a given day and assigning them to a department queue. |
| **Chief Complaint** | The main reason a patient is seeking medical care, in their own words. |
| **CSRF Token** | A security code used behind the scenes to verify that actions taken in the system are coming from legitimate users, not automated attacks. |
| **Dental Charting** | A diagram of all teeth, used to note which teeth have problems and what treatment has been done. |
| **EDD** | Expected Delivery Date — the estimated date when a pregnant patient is due to give birth. |
| **Expiry Date** | The date after which a medication should no longer be used. |
| **FIFO** | First In, First Out — a stock management method where the oldest stock is used first. |
| **Finalized** | Lab test status meaning results have been reviewed, verified, and released to the ordering clinician. |
| **GRN** | Goods Received Note — a record of medications or supplies received from a supplier. |
| **Gravida** | The total number of times a woman has been pregnant (including current pregnancy). |
| **HIS** | Hospital Information System — this software system. |
| **HIPAA** | Health Insurance Portability and Accountability Act — a standard for protecting patient health information privacy (widely followed even outside the USA). |
| **JWT** | JSON Web Token — the secure digital key used to verify your identity during your session. You do not interact with this directly. |
| **Lab Queue** | The list of all laboratory tests that have been ordered, showing their current status. |
| **Lochia** | Normal vaginal discharge after childbirth, which the midwife tracks for abnormalities. |
| **LMP** | Last Menstrual Period — the date of the patient's last period, used to calculate pregnancy weeks. |
| **MUAC** | Mid-Upper Arm Circumference — a measurement taken at the midpoint of the upper arm to assess nutritional status, particularly in children. |
| **OPD** | Outpatient Department — the area where patients are seen and treated without being admitted to a hospital bed. |
| **OPG** | Orthopantomogram — a panoramic X-ray of the entire upper and lower jaw, used in dentistry. |
| **Para** | The number of pregnancies that resulted in delivery (at 20+ weeks), not counting current pregnancy. |
| **Partial Payment** | A payment that covers only part of the total bill amount. The remaining balance continues to be tracked. |
| **Patient Number** | A unique identifier assigned to every patient at registration, in the format P + Year + Random characters (e.g., P261A34F2). |
| **PACS** | Picture Archiving and Communication System — software used to store and display medical images (X-rays, CT scans, etc.). |
| **Pesapal** | The integrated mobile money payment gateway used to process mobile payments. |
| **Prescription** | A doctor's written instruction for a specific medication, dose, and duration for a patient. |
| **Priority** | The urgency level assigned to a lab test or radiology order: Emergency, Urgent, Routine, or Low. |
| **PO** | Purchase Order — a formal request sent to a supplier to deliver a specific quantity of goods. |
| **RBAC** | Role-Based Access Control — the system that restricts what each user can see and do based on their assigned role. |
| **Receipt** | A printed proof of payment given to the patient after a payment is processed. |
| **Reorder Level** | The minimum stock quantity at which a new order should be placed to avoid running out. |
| **RLS** | Row-Level Security — a database feature that ensures clinical staff can only access records relevant to them. |
| **Session** | The period of time from when you log in to when you log out or the session expires (after 8 hours). |
| **Split Payment** | A payment using two or more different payment methods for a single bill (e.g., part cash, part mobile money). |
| **SpO2** | Oxygen Saturation — the percentage of haemoglobin in the blood that is carrying oxygen. Normal is 95–100%. |
| **Stock Take** | A physical count of all items in inventory, compared to the system's recorded quantities. |
| **TAT** | Turnaround Time — the total time taken to complete a lab test from when it is ordered to when results are finalized. |
| **Triage** | The rapid initial assessment of patients to determine how urgently they need medical attention. |
| **Void** | A bill that has been cancelled without any payment being collected. |
| **Worklist** | The list of pending work items in a specific department — for example, the radiologist's list of ordered scans. |

---

*Document prepared by the Dayspring HIS Development Team*  
*For end-user training — April 2026*  
*Version 1.0*
