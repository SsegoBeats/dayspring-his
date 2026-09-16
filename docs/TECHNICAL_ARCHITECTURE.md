# Dayspring Community Health Care HIS — Technical Architecture Document

## 1. Purpose of This Document

This document describes the technical architecture of the Dayspring Community Health Care Hospital Information System (HIS). It explains the application structure, system responsibilities, technology choices, layers of the platform, authentication model, database pattern, role-based security model, workflows, integrations, and operational concerns.

The goal is to provide a complete technical understanding of how the platform works, not just how it looks to end users.

---

## 2. Executive Summary

The application is a multi-role healthcare management platform built with Next.js, React, TypeScript, and PostgreSQL. It provides a complete digital workflow for a healthcare facility, including patient registration, consultation, triage, lab requests, pharmacy operations, imaging/radiology, billing, admin functions, and reporting.

The architecture follows a modern full-stack web application pattern:

- Frontend: Next.js App Router + React + TypeScript + Tailwind UI
- Backend: server-side route handlers in the same Next.js application
- Database: PostgreSQL with relational modeling and SQL-based security patterns
- Security: JWT-based auth plus Role-Based Access Control (RBAC) and database session-aware access
- Integration: email, SMS, background job queue, and optionally external healthcare standards such as DHIS2, FHIR, OpenMRS
- Deployment style: web app deployed in a Node environment with PostgreSQL storage

The codebase is designed for hospital operations in a controlled environment: users have different roles, departments are separated by permissions, patient data is protected, and operational flows are implemented through API routes.

---

## 3. Business and Functional Scope

Dayspring HIS is designed to support the operational needs of a community health facility or hospital. The system covers the patient journey from check-in to discharge, and it includes multiple departments.

### 3.1 Core Business Processes

The app supports the following primary processes:

- Patient registration and demographics management
- Appointment scheduling and queue coordination
- Clinical consultation and patient history management
- Nursing vitals and triage workflows
- Lab test ordering and result capture
- Radiology and image/report workflows
- Pharmacy medication issuance and inventory management
- Billing and payment processing
- Staff/user management and access assignments
- Reporting and exports
- Email/SMS notifications and alerts

### 3.2 Role-Based Operational Model

Each department is treated as a distinct operational domain. The app’s user model includes roles such as:

- Receptionist
- Clinician
- Nurse
- Lab Tech
- Radiologist
- Pharmacist
- Cashier
- Midwife
- Dentist
- Hospital Admin

This design supports stricter separation of duties, which is essential for healthcare systems.

---

## 4. High-Level Architecture

The app follows a layered web application architecture.

### 4.1 Layered View

1. Presentation Layer
   - Next.js pages and React components
   - Role-specific dashboards and forms
   - UI state management through hooks and providers

2. Application Layer
   - Route handlers under app/api
   - Business logic for patient, billing, lab, pharmacy, clinical, etc.
   - Validation, permission checks, and orchestration logic

3. Data Access Layer
   - PostgreSQL queries through a shared db utility
   - Session-aware database access using app.role and app.user_id settings

4. Persistence Layer
   - PostgreSQL database
   - Schema tables for users, patients, appointments, bills, medical records, labs, pharmacy inventory, etc.

5. Integration Layer
   - Email providers, SMS gateways, background jobs, analytics, and export services

6. Security Layer
   - JWT verification
   - bcrypt password hashing
   - rate limiting
   - role and database-level access checks

---

## 5. Technology Stack

### 5.1 Frontend

The app uses a modern React-based frontend stack:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Radix UI primitives
- shadcn-style component patterns
- Lucide React icons
- Recharts for charts and analytics
- Sonner for toast notifications
- React Hook Form + Zod for validation

### 5.2 Backend

The backend logic runs within the same Next.js application:

- App Router API route handlers
- Node.js runtime
- PostgreSQL driver: pg
- Server-side permission enforcement
- JSON request/response APIs
- JWT token handling

### 5.3 Database

- PostgreSQL as the main persistence layer
- SQL-based schema creation and migration logic
- Role and session variables set per request
- JSONB support for flexible clinical data such as history, metadata, and structured notes

### 5.4 Security and Identity

- bcryptjs for password hashing
- jsonwebtoken for token generation/verification
- HttpOnly cookies for session storage
- Role-based access policy checks
- Database session context via app.role and app.user_id
- Rate limiting for login and sensitive requests

### 5.5 Observability and Reliability

- Sentry for monitoring and error reporting
- Audit logs for major actions
- slow query logging in the DB wrapper
- server-side error handling and invalid-feedback flows

### 5.6 Document and Reporting Tools

- PDF generation via PDFKit / jsPDF / react-pdf
- Excel/CSV generation
- barcode generation
- printing support for receipts and reports

---

## 6. System Runtime Model

The application operates as a single Next.js web application that serves both the frontend and backend API from the same codebase.

This pattern has several benefits:

- simpler deployment
- shared TypeScript types and utilities
- unified route and auth handling
- easier coordination between UI and data access logic

### 6.1 Runtime Execution

The application runs in a Node environment and uses Next.js route handlers for server-side execution. This means server logic can access environment variables, Postgres, cookies, and backend security mechanisms without a separate API server.

### 6.2 Client-Side Behavior

The React app communicates with backend routes through fetch requests. These requests include credentials, send auth cookies, and retrieve JSON data. The UI reacts to response state and displays dashboards or forms accordingly.

The frontend is organized by department and feature area, and most pages are role-specific.

---

## 7. Frontend Architecture

### 7.1 App Router Structure

The application architecture is organized under the Next.js App Router pattern:

- app/page.tsx: login or landing page
- app/dashboard/page.tsx: portal redirection
- app/admin, app/receptionist, app/nurse, app/clinician, etc.: role-based portal pages
- app/api: backend endpoints

This structure keeps navigation and route responsibilities aligned with role and domain.

### 7.2 Provider Pattern

The system uses React context providers to centralize state for major domains. Examples include:

- AuthProvider
- PatientProvider
- MedicalProvider
- PharmacyProvider
- BillingProvider
- NursingProvider
- AdminProvider
- SettingsProvider
- AnalyticsProvider
- AuditProvider

These providers allow shared data and logic to be reused across modules without duplicating state.

### 7.3 Important Frontend Principle

The UI is highly role-aware. When a user logs in, the app retrieves the current user and redirects to the correct portal based on role. The role mapping is stored in the auth context and the dashboard redirect logic.

This approach reduces unauthorized UI exposure and keeps the user experience tailored to their job.

---

## 8. Authentication and Authorization Architecture

### 8.1 Authentication Flow

The login API is implemented in app/api/auth/login/route.ts.

Flow:

1. Client posts email, password, and role to /api/auth/login
2. IP-based and account-based rate limiting is checked
3. User record is looked up by email
4. Password is validated with bcrypt
5. Account lockout checks are enforced
6. JWT is created with user identity and role
7. HttpOnly cookie is set in the response
8. User is returned to the client

The JWT contains values such as:

- user id
- email
- role
- issuer and audience metadata

This token is later validated by verifyToken().

### 8.2 Session Validation

The current user endpoint app/api/auth/me/route.ts validates the cookie session. It:

- reads the session token from cookie storage
- verifies it with JWT
- loads the user from the database
- ensures the user is active
- returns user metadata for the frontend

This ensures the frontend always knows who is signed in.

### 8.3 Authorization Model

Authorization is built around RBAC. The file lib/security.ts defines a role policy matrix that maps roles to resources and actions.

Example resource types include:

- patients
- appointments
- billing
- medical
- pharmacy
- lab
- radiology
- users
- exports
- beds
- checkins
- queues
- payments
- documents
- insurance

Example actions:

- read
- create
- update
- delete

The function can(role, resource, action) checks whether the role is allowed to perform the requested action.

### 8.4 Enforcement Pattern

Most API routes follow this pattern:

- verify session
- verify role and JWT identity
- call can(auth.role, resource, action)
- reject unauthorized requests with a 401 or 403 response

This pattern is used across patients, medical records, billing, lab tests, pharmacy, queue, exports, and admin data.

### 8.5 Database-Level Security

The db utility sets session variables before executing queries:

- app.role
- app.user_id

This allows PostgreSQL row-level controls to enforce access based on the active authenticated user and role. In practice, this provides a second layer of permission enforcement beyond the app.

This is a very important architecture concept in healthcare systems: do not rely only on route checks; also protect access at the data layer.

---

## 9. Database Architecture

### 9.1 Primary Database

The system uses PostgreSQL as the main relational database. The database is a source of truth for the facility’s patient and operational data.

The application defines a large schema that includes tables such as:

- users
- patients
- appointments
- triage_assessments
- lab_tests
- radiology studies or related data
- bills and payments
- medication inventory tables
- notifications
- jobs
- rate limits
- integration mappings (DHIS2, FHIR, OpenMRS)

### 9.2 Shared Data Access Utility

The shared database utilities in lib/db.ts centralize database access:

- getPool(): creates a single PostgreSQL pool
- withClient(): acquires a database client
- query(): executes basic queries
- withSession(): wraps queries with session context
- queryWithSession(): executes session-aware queries

This reduces duplication and ensures all db calls follow the same pattern.

### 9.3 Database Session Context

The withSession function does this:

- begins transaction
- sets app.role if provided
- sets app.user_id if provided
- runs the business logic
- commits or rolls back accordingly

This pattern is crucial because it ensures database-level security rules know who is acting and in what role.

### 9.4 Schema Initialization and Migration Pattern

The migration endpoint app/api/migrate/route.ts builds or refreshes the database schema. It creates the initial tables and ensures required columns exist when upgrading old deployments.

Key points:

- schema is versioned through migration-like creation logic
- column updates are applied safely if tables already exist
- the system supports incremental database evolution
- application startup does not require a full schema rebuild unless migration is invoked

This is a typical pattern for production systems that evolve over time.

---

## 10. API Architecture

The system exposes a large set of REST-like API endpoints under app/api.

### 10.1 Route Organization

Examples of route groups include:

- /api/auth
- /api/patients
- /api/appointments
- /api/checkins
- /api/medical
- /api/lab-tests
- /api/pharmacy
- /api/billing
- /api/settings
- /api/jobs
- /api/exports
- /api/notifications
- /api/admin
- /api/fhir
- /api/dhis2
- /api/openmrs

This modular layout matches the business domains of the hospital.

### 10.2 Standard Request Pattern

Most API handlers follow a consistent flow:

1. read and validate request body or query parameters
2. verify user session
3. authorize based on role/resources
4. run database query or business logic
5. transform result data for the frontend
6. respond with JSON
7. write audit log when needed

### 10.3 Validation Layer

The project uses Zod for schema validation. This ensures malformed requests are rejected early instead of reaching deeper logic.

This is especially helpful for patient data, login credentials, lab parameters, and settings payloads.

### 10.4 Audit Logging

Many operations are recorded through audit logging. The app maintains event records for actions like login, account manipulation, medical updates, export operations, and system changes.

This supports accountability and tracking in a clinical environment.

---

## 11. Core Domain Modules

### 11.1 Patient Domain

The patient domain is the foundation of the application. It stores demographic and personal details, family/kin information, risk details, and patient status.

This domain is central because most other modules depend on patient identity and patient history.

### 11.2 Clinical and Medical Domain

This includes patient records, prescriptions, medical notes, conditions, allergies, diagnostics, and specialist care. The system allows different care roles to contribute to shared patient information without breaking confidentiality.

The permissions are tightly scoped, so roles like Nurse, Midwife, Clinician, and Dentist can contribute only where allowed.

### 11.3 Triage and Nursing Domain

The app includes triage assessments with fields like:

- blood pressure
- heart rate
- respiratory rate
- temperature
- oxygen saturation
- AVPU status
- chief complaint
- triage category

This is a clinically meaningful model and is organized to support emergency and outpatient workflows.

### 11.4 Lab Domain

The lab domain covers orders, result processing, test review, and reporting. It is modeled to allow test tracking from order entry to result completion and review.

### 11.5 Radiology Domain

The radiology domain manages imaging study records, worklists, review state, and departmental reporting. It supports workflow separation between ordering clinicians and reviewing radiologists.

### 11.6 Pharmacy Domain

The pharmacy domain includes:

- drug inventory
- medication dispensing
- stock levels
- purchase orders
- batch tracking
- stock adjustments
- supplier management

The architecture handles both patient medication fulfillment and hospital procurement.

### 11.7 Billing and Payment Domain

Billing is implemented as a dedicated domain with separate API routes and logic. It supports charges, invoices, collection, receipts, and financial reporting. This makes financial management distinct from care administration.

### 11.8 Administration and Settings Domain

The admin domain covers:

- user accounts
- role assignments
- integrations
- organization settings
- system feature flags
- exports and operational configuration

This domain acts as the operational control plane for the hospital system.

---

## 12. Security Architecture

### 12.1 Threat Model Considerations

This application handles sensitive health data. The security design must therefore protect:

- identity and authentication
- patient confidentiality
- authorization boundaries
- database manipulation
- password recovery flows
- login abuse and brute-force attempts
- misuse of API endpoints

### 12.2 Password Security

Passwords are hashed using bcrypt before storage. The security library includes validation for password strength and lockout logic.

This is appropriate for a production hospital platform because plain-text storage is not acceptable.

### 12.3 JWT Security

JWTs are signed with a secret and validated with issuer and audience constraints. This prevents forged tokens from being accepted. Tokens have a limited lifetime (8 hours in the app configuration), which helps reduce risk when a session is left open.

### 12.4 Session Cookie Configuration

The app sets secure cookie settings for production and dev fallbacks. HttpOnly cookies keep browser scripts from accessing the session token directly.

This reduces common XSS risk patterns.

### 12.5 Authorization Enforcement

The app uses two enforcement layers:

1. Application-level RBAC (using can(...))
2. Database-level RLS/session-based policy checks (via app.role and app.user_id)

This dual-layer model is a strong architectural decision for healthcare platforms.

### 12.6 Rate Limiting

The application uses Postgres-backed rate limiting for key flows such as login and account attack prevention. This helps mitigate credential stuffing and brute-force patterns.

### 12.7 Auditability

Large actions are logged with timestamps and user context. This is important for accountability and forensic investigation in healthcare environments.

---

## 13. Data Flow Architecture

### 13.1 Common Request Flow

A typical request follows this sequence:

1. Browser triggers fetch call from a React component
2. Fetch includes credentials and sends cookies
3. Next.js route handler receives request
4. Security middleware checks token and role
5. Request is validated by schema or input rules
6. DB logic executes with session context
7. Response is converted to JSON
8. Frontend updates component state

### 13.2 Patient Workflow Example

A patient consultation might follow this flow:

- Reception registers patient
- Nurse performs triage
- Doctor opens patient record
- Doctor writes consultation notes / prescription
- Prescription route verifies permission and creates records
- Lab or radiology may be ordered
- Pharmacy receives prescription and fulfills it
- Cashier creates the invoice and processes payment
- Reports are generated from stored data

This shows the architectural emphasis on connected modules and shared patient identity.

---

## 14. Background Jobs and Async Processing

The app contains a job queue framework using Postgres-backed task management. This architecture separates work that should not block instant user interaction.

### 14.1 Why Background Jobs Exist

Background jobs are used for non-blocking operations such as:

- sending email
- sending notifications
- delayed processing
- scheduled maintenance or cleanup tasks

### 14.2 Job Flow

A request can enqueue a job instead of immediately executing a long-running process. Later, a runtime process or scheduled runner executes queued tasks. This keeps the user interface responsive and allows more scalable operating patterns.

### 14.3 Architectural Significance

This allows the application to evolve toward asynchronous operational workflows without forcing every task to be synchronous.

---

## 15. Notification and Communication Architecture

The app supports several communication channels:

- SMTP-based email
- Resend API integration
- SMS provider abstraction
- app-to-user notification logic

These channels are combined with role-specific workflows and event-driven triggers.

### 15.1 Email Flow

The application supports email validation and notifications. It uses SMTP or Resend providers depending on configuration. This is relevant for account verification, password reset, system alerts, and operational messaging.

### 15.2 SMS Flow

The app includes SMS support through a provider-agnostic layer. This is useful for patient reminders, alerts, or operational status updates.

---

## 16. Reporting, Print, and Export Architecture

The app supports rich reporting and export features, which are common in hospital systems.

### 16.1 Export Mechanism

Data is exported in formats such as:

- CSV
- Excel
- PDF
- printed receipts
- departmental exports

This is a key operational mechanism because healthcare facilities need data for audits, follow-up, billing, and management reporting.

### 16.2 Printing

The app includes support for patient receipts, queue printing, and report printing. This is important for clinics where real paper documents still matter in addition to digital records.

---

## 17. Integration Architecture

### 17.1 DHIS2, FHIR, and OpenMRS

The repository includes integration support for systems such as:

- DHIS2 mappings
- FHIR resource mapping
- OpenMRS concept mapping

This indicates that the app is designed to interoperate with health information exchange systems, public health reporting systems, or external EMR ecosystems.

### 17.2 Why Interoperability Matters

Healthcare systems rarely operate in isolation. The presence of integration layers allows data to communicate with other systems for:

- reporting
- public health aggregated statistics
- external EMR ingestion
- interoperability compliance

### 17.3 Architectural Direction

The application is designed to be open to external health system standards while still functioning as a self-contained HIS.

---

## 18. Infrastructure and Deployment Concerns

### 18.1 Application Deployment

The project is designed for deployment as a Next.js app with:

- a PostgreSQL database
- environment variables for secrets and app configuration
- optional SSL configuration for production database connections
- static assets and public files

### 18.2 Production Requirements

Critical deployment requirements include:

- DATABASE_URL
- JWT_SECRET
- SMTP or email provider configuration
- optional SMS provider configuration
- Sentry DSN if monitoring is enabled
- secure production credentials and environment isolation

### 18.3 Operational Reliability

The system includes several operational safeguards:

- migration support for schema updates
- DB connection pooling
- failure handling for login and auth flows
- audit logging
- slow query tracing
- error monitoring

---

## 19. Scalability and Extensibility

### 19.1 Why This Architecture Scales Well

The architecture is modular and domain-oriented. Each major package or route group can be evolved independently based on a department’s needs.

Examples:

- patient workflows can be expanded without affecting pharmacy logic
- billing can be modified without impacting radiology
- new roles can be added following the RBAC policy matrix

### 19.2 Extensibility Points

The system is extensible in several key areas:

- adding new roles and permissions
- adding new clinical modules
- extending reporting tools
- adding third-party integrations
- building new workflows over the same patient identity model

### 19.3 Current Architectural Strength

The combination of role-based UI, authorization checking, and database session context gives the app a strong foundation for enterprise healthcare operations.

---

## 20. Design Trade-offs and Observations

### 20.1 Single App Monolith

This project uses a single Next.js application for both UI and backend. This is a practical and fast architecture for a clinic or hospital product. It simplifies deployment and reduces system boundary complexity.

### 20.2 Benefits

- fewer moving parts
- easier local development
- unified auth and data access patterns
- simpler operational management

### 20.3 Limitations

As the application grows, complexity may increase in areas such as:

- domain coupling between modules
- large route handlers
- many role-specific screens and logic paths
- schema growth complexity

At scale, a future evolution may be to split the system into multiple bounded services or modules, but the current architecture is intentionally cohesive and pragmatic.

---

## 21. Architectural Principles Embedded in the Codebase

The design reflects several clear principles:

1. Role-specific access is enforced everywhere
2. Patient identity is the core anchor of the system
3. The database is the system of record
4. UI pages are thin interfaces over backend logic
5. Sensitive operations must be auditable
6. Operational tasks should be resilient and observable
7. Clinical workflows should be connected across departments
8. Healthcare data must be protected at both app and database layer

---

## 22. Technical Summary

The Dayspring HIS is a full-stack healthcare management system implemented as a single Next.js application with a PostgreSQL backend, JWT-based auth, RBAC enforcement, session-aware database access, and modular healthcare workflows across patient management, lab, pharmacy, billing, radiology, and administration.

Its architecture is designed for a real hospital operation model, where many different departments must collaborate on the same patient record while being restricted by role, workflow, and security policy.

The result is a practical, enterprise-oriented HIS architecture with strong patient-data protection, departmental modularity, and a clear business operational model.

---

## 23. Glossary of Key Architecture Terms

- App Router: the Next.js routing model used to organize pages and API handlers
- RBAC: Role-Based Access Control
- JWT: JSON Web Token used for secure identity verification
- RLS: Row-Level Security implemented through Postgres session context
- Session context: database variables that describe current user role and identity
- API route: a server handler that responds to HTTP requests
- Provider: a React context component that shares state across the app
- Migration: database schema update mechanism
- Pool: a PostgreSQL connection pool used for efficient db access
- Audit log: a record of significant system actions for accountability
- Role portal: the user-specific department dashboard a user is directed to after login

---

## 24. Final Conclusion

This project is technically a modern, secure, full-stack healthcare application. It combines Next.js, React, TypeScript, PostgreSQL, RBAC, JWT auth, automated job processing, monitoring, and healthcare workflow modeling into one coherent system.

The architecture is well-suited to a hospital or clinic setting because it keeps patient data centralized, role-based access explicit, and operational functions separated by business domain while still supporting a shared patient journey.
