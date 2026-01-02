--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: AppointmentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AppointmentStatus" AS ENUM (
    'SCHEDULED',
    'ARRIVED',
    'IN_PROGRESS',
    'COMPLETED',
    'BILLED',
    'CANCELED',
    'LATE_CANCELED',
    'NO_SHOW'
);


ALTER TYPE public."AppointmentStatus" OWNER TO postgres;

--
-- Name: ConsentScope; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ConsentScope" AS ENUM (
    'SHARE_TO_DESTINATION',
    'SMS_REMINDERS',
    'INSURANCE_SUBMISSION',
    'RESEARCH_PARTICIPATION'
);


ALTER TYPE public."ConsentScope" OWNER TO postgres;

--
-- Name: EncounterStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EncounterStatus" AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'DISCHARGED',
    'CANCELED'
);


ALTER TYPE public."EncounterStatus" OWNER TO postgres;

--
-- Name: EncounterType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EncounterType" AS ENUM (
    'OUTPATIENT',
    'INPATIENT',
    'EMERGENCY'
);


ALTER TYPE public."EncounterType" OWNER TO postgres;

--
-- Name: HandoffStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."HandoffStatus" AS ENUM (
    'PENDING',
    'SENT',
    'RECEIVED',
    'OPENED',
    'CANCELLED'
);


ALTER TYPE public."HandoffStatus" OWNER TO postgres;

--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'OPEN',
    'PAID',
    'VOID'
);


ALTER TYPE public."InvoiceStatus" OWNER TO postgres;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PLACED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELED'
);


ALTER TYPE public."OrderStatus" OWNER TO postgres;

--
-- Name: OrderType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderType" AS ENUM (
    'LAB',
    'IMAGING',
    'MED'
);


ALTER TYPE public."OrderType" OWNER TO postgres;

--
-- Name: Priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Priority" AS ENUM (
    'EMERGENCY',
    'URGENT',
    'ROUTINE',
    'LOW'
);


ALTER TYPE public."Priority" OWNER TO postgres;

--
-- Name: QueueStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."QueueStatus" AS ENUM (
    'WAITING',
    'CALLED',
    'IN_ROOM',
    'DONE',
    'SKIPPED'
);


ALTER TYPE public."QueueStatus" OWNER TO postgres;

--
-- Name: ReportStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ReportStatus" AS ENUM (
    'DRAFT',
    'FINAL'
);


ALTER TYPE public."ReportStatus" OWNER TO postgres;

--
-- Name: SampleStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SampleStatus" AS ENUM (
    'PENDING',
    'COLLECTED',
    'ANALYZED',
    'VERIFIED',
    'FINALIZED'
);


ALTER TYPE public."SampleStatus" OWNER TO postgres;

--
-- Name: StudyStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StudyStatus" AS ENUM (
    'SCHEDULED',
    'ACQUIRED',
    'REPORTED'
);


ALTER TYPE public."StudyStatus" OWNER TO postgres;

--
-- Name: TriageColor; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TriageColor" AS ENUM (
    'RED',
    'YELLOW',
    'GREEN'
);


ALTER TYPE public."TriageColor" OWNER TO postgres;

--
-- Name: TriageStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TriageStatus" AS ENUM (
    'OPEN',
    'CONFIRMED',
    'CLOSED'
);


ALTER TYPE public."TriageStatus" OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Appointment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Appointment" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "clinicianId" text NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    status public."AppointmentStatus" DEFAULT 'SCHEDULED'::public."AppointmentStatus" NOT NULL,
    overbooked boolean DEFAULT false NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Appointment" OWNER TO postgres;

--
-- Name: Audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Audit" (
    id text NOT NULL,
    "actorId" text NOT NULL,
    action text NOT NULL,
    "resourceType" text NOT NULL,
    "resourceId" text NOT NULL,
    reason text,
    ts timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    meta jsonb
);


ALTER TABLE public."Audit" OWNER TO postgres;

--
-- Name: AuditEvent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AuditEvent" (
    id text NOT NULL,
    "actorId" text,
    "patientId" text,
    type text NOT NULL,
    details jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditEvent" OWNER TO postgres;

--
-- Name: Charge; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Charge" (
    id text NOT NULL,
    "encounterId" text NOT NULL,
    "itemCode" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    payer text NOT NULL
);


ALTER TABLE public."Charge" OWNER TO postgres;

--
-- Name: Consent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Consent" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    scope public."ConsentScope" NOT NULL,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone
);


ALTER TABLE public."Consent" OWNER TO postgres;

--
-- Name: Destination; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Destination" (
    id text NOT NULL,
    "facilityId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Destination" OWNER TO postgres;

--
-- Name: Dispense; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Dispense" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "medicationId" text NOT NULL,
    qty integer NOT NULL,
    "dispensedBy" text NOT NULL
);


ALTER TABLE public."Dispense" OWNER TO postgres;

--
-- Name: Encounter; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Encounter" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    type public."EncounterType" NOT NULL,
    status public."EncounterStatus" DEFAULT 'PLANNED'::public."EncounterStatus" NOT NULL,
    "startedAt" timestamp(3) without time zone NOT NULL,
    "endedAt" timestamp(3) without time zone
);


ALTER TABLE public."Encounter" OWNER TO postgres;

--
-- Name: Facility; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Facility" (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    address text,
    phone text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Facility" OWNER TO postgres;

--
-- Name: HandoffBundle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HandoffBundle" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "fromFacilityId" text,
    "toFacilityId" text NOT NULL,
    "fromUnitId" text,
    "toUnitId" text,
    reason text NOT NULL,
    attachments jsonb,
    status public."HandoffStatus" DEFAULT 'PENDING'::public."HandoffStatus" NOT NULL,
    priority public."Priority" DEFAULT 'ROUTINE'::public."Priority" NOT NULL,
    eta timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receivedAt" timestamp(3) without time zone,
    "openedAt" timestamp(3) without time zone
);


ALTER TABLE public."HandoffBundle" OWNER TO postgres;

--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "encounterId" text NOT NULL,
    status public."InvoiceStatus" DEFAULT 'OPEN'::public."InvoiceStatus" NOT NULL,
    total numeric(12,2) NOT NULL,
    balance numeric(12,2) NOT NULL
);


ALTER TABLE public."Invoice" OWNER TO postgres;

--
-- Name: LabResult; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LabResult" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    analyte text NOT NULL,
    value text NOT NULL,
    units text,
    "refRange" text,
    status text NOT NULL,
    "verifiedBy" text
);


ALTER TABLE public."LabResult" OWNER TO postgres;

--
-- Name: LabSample; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LabSample" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    barcode text NOT NULL,
    status public."SampleStatus" NOT NULL
);


ALTER TABLE public."LabSample" OWNER TO postgres;

--
-- Name: Medication; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Medication" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    strength text,
    route text,
    "stockQty" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."Medication" OWNER TO postgres;

--
-- Name: Order; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "encounterId" text NOT NULL,
    type public."OrderType" NOT NULL,
    status public."OrderStatus" DEFAULT 'PLACED'::public."OrderStatus" NOT NULL,
    "orderedById" text NOT NULL,
    payload jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Order" OWNER TO postgres;

--
-- Name: Outbox; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Outbox" (
    id text NOT NULL,
    topic text NOT NULL,
    payload jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    tries integer DEFAULT 0 NOT NULL,
    "lastError" text
);


ALTER TABLE public."Outbox" OWNER TO postgres;

--
-- Name: Patient; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Patient" (
    id text NOT NULL,
    mrn text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    dob timestamp(3) without time zone NOT NULL,
    sex text NOT NULL,
    phone text,
    "nationalId" text,
    allergies jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


ALTER TABLE public."Patient" OWNER TO postgres;

--
-- Name: Payment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    method text NOT NULL,
    amount numeric(12,2) NOT NULL,
    "cashierId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Payment" OWNER TO postgres;

--
-- Name: QueueEntry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."QueueEntry" (
    id text NOT NULL,
    "destinationId" text NOT NULL,
    "patientId" text NOT NULL,
    "triageTicketId" text,
    "bundleId" text,
    status public."QueueStatus" DEFAULT 'WAITING'::public."QueueStatus" NOT NULL,
    "position" integer NOT NULL,
    "calledAt" timestamp(3) without time zone,
    "roomedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."QueueEntry" OWNER TO postgres;

--
-- Name: Report; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Report" (
    id text NOT NULL,
    "studyId" text NOT NULL,
    body text NOT NULL,
    impression text NOT NULL,
    status public."ReportStatus" DEFAULT 'DRAFT'::public."ReportStatus" NOT NULL,
    "signedBy" text
);


ALTER TABLE public."Report" OWNER TO postgres;

--
-- Name: Role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public."Role" OWNER TO postgres;

--
-- Name: RoleOnUser; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RoleOnUser" (
    "userId" text NOT NULL,
    "roleId" text NOT NULL
);


ALTER TABLE public."RoleOnUser" OWNER TO postgres;

--
-- Name: Scope; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Scope" (
    id text NOT NULL,
    code text NOT NULL
);


ALTER TABLE public."Scope" OWNER TO postgres;

--
-- Name: ScopeOnRole; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ScopeOnRole" (
    "roleId" text NOT NULL,
    "scopeId" text NOT NULL
);


ALTER TABLE public."ScopeOnRole" OWNER TO postgres;

--
-- Name: Study; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Study" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    modality text NOT NULL,
    accession text NOT NULL,
    "pacsUri" text,
    status public."StudyStatus" NOT NULL
);


ALTER TABLE public."Study" OWNER TO postgres;

--
-- Name: TriageTicket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TriageTicket" (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "encounterId" text,
    "createdByUserId" text NOT NULL,
    "confirmedByUserId" text,
    color public."TriageColor" NOT NULL,
    status public."TriageStatus" DEFAULT 'OPEN'::public."TriageStatus" NOT NULL,
    "dangerSigns" jsonb NOT NULL,
    vitals jsonb,
    "suggestedDestinationId" text,
    "finalDestinationId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "confirmedAt" timestamp(3) without time zone
);


ALTER TABLE public."TriageTicket" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    "hashedPass" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid,
    appointment_date date NOT NULL,
    appointment_time time without time zone NOT NULL,
    department character varying(100) NOT NULL,
    reason text,
    status character varying(50) DEFAULT 'Scheduled'::character varying,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointments_status_check CHECK (((status)::text = ANY ((ARRAY['Scheduled'::character varying, 'Completed'::character varying, 'Cancelled'::character varying, 'No Show'::character varying])::text[])))
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id uuid,
    details jsonb,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: bed_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bed_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bed_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    discharge_date timestamp without time zone,
    status character varying(50) DEFAULT 'Active'::character varying NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bed_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Discharged'::character varying, 'Transfer'::character varying])::text[])))
);


ALTER TABLE public.bed_assignments OWNER TO postgres;

--
-- Name: beds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.beds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bed_number character varying(50) NOT NULL,
    ward character varying(100) NOT NULL,
    bed_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'Available'::character varying NOT NULL,
    location character varying(255),
    equipment jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT beds_bed_type_check CHECK (((bed_type)::text = ANY ((ARRAY['General'::character varying, 'ICU'::character varying, 'Pediatric'::character varying, 'Maternity'::character varying, 'Isolation'::character varying, 'Emergency'::character varying])::text[]))),
    CONSTRAINT beds_status_check CHECK (((status)::text = ANY ((ARRAY['Available'::character varying, 'Occupied'::character varying, 'Maintenance'::character varying, 'Reserved'::character varying])::text[])))
);


ALTER TABLE public.beds OWNER TO postgres;

--
-- Name: bill_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bill_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bill_id uuid NOT NULL,
    description character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bill_items OWNER TO postgres;

--
-- Name: bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bills (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bill_number character varying(50) NOT NULL,
    patient_id uuid NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    tax_amount numeric(10,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    final_amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying,
    payment_method character varying(50),
    paid_amount numeric(10,2) DEFAULT 0,
    barcode character varying(255),
    cashier_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp without time zone,
    CONSTRAINT bills_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Paid'::character varying, 'Partially Paid'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.bills OWNER TO postgres;

--
-- Name: checkins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checkins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    status character varying(30) DEFAULT 'Arrived'::character varying NOT NULL,
    receptionist_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT checkins_status_check CHECK (((status)::text = ANY ((ARRAY['Arrived'::character varying, 'With Nurse'::character varying, 'In Room'::character varying, 'Complete'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.checkins OWNER TO postgres;

--
-- Name: consent_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consent_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    rationale text NOT NULL,
    scope text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.consent_log OWNER TO postgres;

--
-- Name: dental_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dental_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    dentist_id uuid NOT NULL,
    visit_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    diagnosis text,
    procedure_performed text,
    tooth_chart jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.dental_records OWNER TO postgres;

--
-- Name: doctor_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    doctor_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    slot_duration integer NOT NULL,
    max_patients_per_slot integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doctor_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT doctor_schedules_max_patients_per_slot_check CHECK ((max_patients_per_slot >= 1)),
    CONSTRAINT doctor_schedules_slot_duration_check CHECK ((slot_duration = ANY (ARRAY[10, 15, 20, 30, 60])))
);


ALTER TABLE public.doctor_schedules OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    file_url text NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT documents_type_check CHECK (((type)::text = ANY ((ARRAY['ID'::character varying, 'INSURANCE'::character varying, 'CONSENT'::character varying, 'OTHER'::character varying])::text[])))
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    new_email character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.email_verification_tokens OWNER TO postgres;

--
-- Name: insurance_payers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_payers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(150) NOT NULL,
    payer_code character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.insurance_payers OWNER TO postgres;

--
-- Name: insurance_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    payer_id uuid NOT NULL,
    policy_no character varying(100) NOT NULL,
    coverage_notes text,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.insurance_policies OWNER TO postgres;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    queue character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    run_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    last_error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT jobs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.jobs OWNER TO postgres;

--
-- Name: lab_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid,
    test_name character varying(255) NOT NULL,
    test_type character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying,
    results text,
    notes text,
    lab_tech_id uuid,
    ordered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    priority character varying(20) DEFAULT 'Routine'::character varying,
    specimen_type character varying(100),
    accession_number character varying(50),
    collected_at timestamp without time zone,
    collected_by uuid,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    assigned_radiologist_id uuid,
    assigned_at timestamp without time zone,
    CONSTRAINT lab_tests_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'In Progress'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.lab_tests OWNER TO postgres;

--
-- Name: medical_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medical_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid,
    visit_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    chief_complaint text,
    diagnosis text,
    treatment_plan text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.medical_records OWNER TO postgres;

--
-- Name: medication_stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medication_stock_movements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    medication_id uuid NOT NULL,
    movement_type character varying(20) NOT NULL,
    quantity integer NOT NULL,
    reference text,
    batch_number character varying(50),
    expiry_date date,
    barcode_snapshot character varying(100),
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT medication_stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['Receive'::character varying, 'Adjust'::character varying, 'Dispense'::character varying, 'Return'::character varying])::text[])))
);


ALTER TABLE public.medication_stock_movements OWNER TO postgres;

--
-- Name: medications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    generic_name character varying(255),
    category character varying(100) NOT NULL,
    unit_type character varying(50) NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    reorder_level integer DEFAULT 50 NOT NULL,
    expiry_date date,
    manufacturer character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    barcode character varying(100),
    CONSTRAINT medications_unit_type_check CHECK (((unit_type)::text = ANY ((ARRAY['Tablets'::character varying, 'Capsules'::character varying, 'Syrup (ml)'::character varying, 'Injection'::character varying, 'Cream/Ointment'::character varying, 'Other'::character varying])::text[])))
);


ALTER TABLE public.medications OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    department character varying(100),
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    priority character varying(20) DEFAULT 'Standard'::character varying,
    is_read boolean DEFAULT false,
    related_patient_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    role character varying(50),
    read_at timestamp without time zone,
    payload jsonb,
    CONSTRAINT notifications_priority_check CHECK (((priority)::text = ANY ((ARRAY['Emergency'::character varying, 'High'::character varying, 'Standard'::character varying, 'Low'::character varying])::text[]))),
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY ((ARRAY['Patient Arrival'::character varying, 'Lab Result'::character varying, 'Prescription'::character varying, 'Payment'::character varying, 'Low Stock'::character varying, 'System'::character varying, 'Other'::character varying])::text[])))
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: nursing_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nursing_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    nurse_id uuid,
    note_type character varying(50) NOT NULL,
    note text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT nursing_notes_note_type_check CHECK (((note_type)::text = ANY ((ARRAY['Assessment'::character varying, 'Intervention'::character varying, 'Observation'::character varying, 'Medication'::character varying, 'Other'::character varying])::text[])))
);


ALTER TABLE public.nursing_notes OWNER TO postgres;

--
-- Name: obstetric_assessments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.obstetric_assessments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    recorded_by uuid NOT NULL,
    visit_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    gravida integer,
    parity integer,
    gestational_age_weeks integer,
    edd date,
    fundal_height_cm numeric(4,1),
    fetal_heart_rate integer,
    presentation character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.obstetric_assessments OWNER TO postgres;

--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_settings (
    id integer DEFAULT 1 NOT NULL,
    name character varying(200),
    logo_url text,
    email character varying(200),
    phone character varying(100),
    address text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.organization_settings OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: patient_deletion_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_deletion_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'Pending'::character varying NOT NULL,
    requested_by uuid,
    approved_by uuid,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_deletion_requests_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Approved'::character varying, 'Rejected'::character varying])::text[])))
);


ALTER TABLE public.patient_deletion_requests OWNER TO postgres;

--
-- Name: patient_routing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patient_routing (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    from_department character varying(100),
    to_department character varying(100) NOT NULL,
    routed_by uuid,
    reason text,
    priority character varying(20),
    status character varying(50) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at timestamp without time zone,
    completed_at timestamp without time zone,
    CONSTRAINT patient_routing_priority_check CHECK (((priority)::text = ANY ((ARRAY['Emergency'::character varying, 'Very Urgent'::character varying, 'Urgent'::character varying, 'Standard'::character varying, 'Non-urgent'::character varying])::text[]))),
    CONSTRAINT patient_routing_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Acknowledged'::character varying, 'Completed'::character varying])::text[])))
);


ALTER TABLE public.patient_routing OWNER TO postgres;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_number character varying(50) NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    date_of_birth date,
    gender character varying(20) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(255),
    address text,
    emergency_contact_name character varying(255),
    emergency_contact_phone character varying(20),
    blood_group character varying(10),
    allergies text,
    current_location character varying(100),
    current_status character varying(50) DEFAULT 'Registered'::character varying,
    triage_category character varying(20),
    triage_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    next_of_kin_relation character varying(100),
    next_of_kin_residence text,
    nin character varying(20),
    district character varying(100),
    subcounty character varying(100),
    parish character varying(100),
    village character varying(100),
    occupation character varying(100),
    insurance_provider character varying(100),
    insurance_member_no character varying(100),
    next_of_kin_name character varying(255),
    next_of_kin_phone character varying(20),
    next_of_kin_first_name character varying(255),
    next_of_kin_last_name character varying(255),
    next_of_kin_country character varying(100),
    age_years integer,
    CONSTRAINT patients_age_years_check CHECK (((age_years IS NULL) OR ((age_years >= 0) AND (age_years <= 130)))),
    CONSTRAINT patients_gender_check CHECK (((gender)::text = ANY ((ARRAY['Male'::character varying, 'Female'::character varying, 'Other'::character varying])::text[]))),
    CONSTRAINT patients_triage_category_check CHECK (((triage_category IS NULL) OR ((triage_category)::text = ANY ((ARRAY['Emergency'::character varying, 'Very Urgent'::character varying, 'Urgent'::character varying, 'Routine'::character varying, 'Standard'::character varying, 'Non-urgent'::character varying])::text[]))))
);


ALTER TABLE public.patients OWNER TO postgres;

--
-- Name: payment_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payment_id uuid NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    CONSTRAINT payment_items_amount_check CHECK ((amount >= (0)::numeric))
);


ALTER TABLE public.payment_items OWNER TO postgres;

--
-- Name: receipt_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.receipt_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.receipt_seq OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    receipt_no character varying(30) DEFAULT (('DMC'::text || to_char(now(), 'YYMMDD'::text)) || lpad((nextval('public.receipt_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    patient_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    method character varying(20) NOT NULL,
    reference character varying(100),
    cashier_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payments_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payments_method_check CHECK (((method)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'mobile_money'::character varying, 'bank'::character varying])::text[])))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE public.pgmigrations OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pgmigrations_id_seq OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: preauthorizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.preauthorizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    payer_id uuid NOT NULL,
    status character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    auth_code character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT preauthorizations_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Approved'::character varying, 'Denied'::character varying, 'Expired'::character varying])::text[])))
);


ALTER TABLE public.preauthorizations OWNER TO postgres;

--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid,
    medication_name character varying(255) NOT NULL,
    dosage character varying(100) NOT NULL,
    frequency character varying(100) NOT NULL,
    duration character varying(100) NOT NULL,
    instructions text,
    quantity integer NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying,
    dispensed_by uuid,
    dispensed_at timestamp without time zone,
    barcode character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT prescriptions_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Dispensed'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.prescriptions OWNER TO postgres;

--
-- Name: queue_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.queue_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    queue_id uuid NOT NULL,
    from_status character varying(20),
    to_status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT queue_events_from_status_check CHECK (((from_status)::text = ANY ((ARRAY['waiting'::character varying, 'in_service'::character varying, 'done'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT queue_events_to_status_check CHECK (((to_status)::text = ANY ((ARRAY['waiting'::character varying, 'in_service'::character varying, 'done'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.queue_events OWNER TO postgres;

--
-- Name: queues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.queues (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    department character varying(100) NOT NULL,
    checkin_id uuid NOT NULL,
    status character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "position" integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT queues_status_check CHECK (((status)::text = ANY ((ARRAY['waiting'::character varying, 'in_service'::character varying, 'done'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.queues OWNER TO postgres;

--
-- Name: radiology_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.radiology_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid,
    test_name character varying(255) NOT NULL,
    test_type character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying,
    findings text,
    notes text,
    radiologist_id uuid,
    ordered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    CONSTRAINT radiology_tests_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'In Progress'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.radiology_tests OWNER TO postgres;

--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying(255) NOT NULL,
    window_seconds integer NOT NULL,
    window_start timestamp without time zone NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.rate_limits OWNER TO postgres;

--
-- Name: triage_assessments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.triage_assessments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    recorded_by uuid,
    mode character varying(20) DEFAULT 'Adult'::character varying,
    blood_pressure_systolic integer,
    blood_pressure_diastolic integer,
    heart_rate integer,
    respiratory_rate integer,
    temperature numeric(4,1),
    oxygen_saturation integer,
    avpu character varying(10),
    mobility character varying(30),
    chief_complaint text,
    discriminators jsonb,
    category character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    seen_by_doctor_at timestamp without time zone,
    metadata jsonb,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT triage_assessments_avpu_check CHECK (((avpu)::text = ANY ((ARRAY['A'::character varying, 'V'::character varying, 'P'::character varying, 'U'::character varying])::text[]))),
    CONSTRAINT triage_assessments_category_check CHECK (((category)::text = ANY ((ARRAY['Emergency'::character varying, 'Very Urgent'::character varying, 'Urgent'::character varying, 'Routine'::character varying, 'Standard'::character varying, 'Non-urgent'::character varying])::text[]))),
    CONSTRAINT triage_assessments_mode_check CHECK (((mode)::text = ANY ((ARRAY['Adult'::character varying, 'Child'::character varying])::text[])))
);


ALTER TABLE public.triage_assessments OWNER TO postgres;

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    theme character varying(20) DEFAULT 'system'::character varying,
    locale character varying(10) DEFAULT 'en-UG'::character varying,
    currency character varying(10) DEFAULT 'UGX'::character varying,
    notify_email_reminders boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    appointment_alerts boolean DEFAULT true,
    lab_results boolean DEFAULT true,
    system_updates boolean DEFAULT false,
    emergency_alerts boolean DEFAULT true,
    timezone character varying(50) DEFAULT 'Africa/Kampala'::character varying,
    date_format character varying(20) DEFAULT 'DD/MM/YYYY'::character varying,
    default_dashboard character varying(50) DEFAULT 'overview'::character varying,
    queue_wait_warn integer DEFAULT 30,
    queue_wait_crit integer DEFAULT 60,
    service_warn integer DEFAULT 30,
    service_crit integer DEFAULT 60
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    phone character varying(20),
    is_active boolean DEFAULT true,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email_verified_at timestamp without time zone,
    department character varying(100),
    signature character varying(255),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['Receptionist'::character varying, 'Doctor'::character varying, 'Radiologist'::character varying, 'Nurse'::character varying, 'Lab Tech'::character varying, 'Hospital Admin'::character varying, 'Cashier'::character varying, 'Pharmacist'::character varying, 'Midwife'::character varying, 'Dentist'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vital_signs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vital_signs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    nurse_id uuid,
    blood_pressure_systolic integer,
    blood_pressure_diastolic integer,
    heart_rate integer,
    temperature numeric(4,1),
    respiratory_rate integer,
    oxygen_saturation integer,
    weight numeric(5,2),
    height numeric(5,2),
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


ALTER TABLE public.vital_signs OWNER TO postgres;

--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Data for Name: Appointment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Appointment" (id, "patientId", "clinicianId", "startsAt", "endsAt", status, overbooked, reason, "createdAt") FROM stdin;
\.


--
-- Data for Name: Audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Audit" (id, "actorId", action, "resourceType", "resourceId", reason, ts, meta) FROM stdin;
\.


--
-- Data for Name: AuditEvent; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AuditEvent" (id, "actorId", "patientId", type, details, "createdAt") FROM stdin;
\.


--
-- Data for Name: Charge; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Charge" (id, "encounterId", "itemCode", amount, payer) FROM stdin;
\.


--
-- Data for Name: Consent; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Consent" (id, "patientId", scope, "grantedAt", "revokedAt") FROM stdin;
\.


--
-- Data for Name: Destination; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Destination" (id, "facilityId", name, code, type, "isActive", "createdAt") FROM stdin;
\.


--
-- Data for Name: Dispense; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Dispense" (id, "orderId", "medicationId", qty, "dispensedBy") FROM stdin;
\.


--
-- Data for Name: Encounter; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Encounter" (id, "patientId", type, status, "startedAt", "endedAt") FROM stdin;
\.


--
-- Data for Name: Facility; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Facility" (id, name, code, address, phone, "isActive", "createdAt") FROM stdin;
\.


--
-- Data for Name: HandoffBundle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HandoffBundle" (id, "patientId", "fromFacilityId", "toFacilityId", "fromUnitId", "toUnitId", reason, attachments, status, priority, eta, "createdAt", "receivedAt", "openedAt") FROM stdin;
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Invoice" (id, "encounterId", status, total, balance) FROM stdin;
\.


--
-- Data for Name: LabResult; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LabResult" (id, "orderId", analyte, value, units, "refRange", status, "verifiedBy") FROM stdin;
\.


--
-- Data for Name: LabSample; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LabSample" (id, "orderId", barcode, status) FROM stdin;
\.


--
-- Data for Name: Medication; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Medication" (id, code, name, strength, route, "stockQty") FROM stdin;
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Order" (id, "encounterId", type, status, "orderedById", payload, "createdAt") FROM stdin;
\.


--
-- Data for Name: Outbox; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Outbox" (id, topic, payload, "createdAt", "publishedAt", tries, "lastError") FROM stdin;
\.


--
-- Data for Name: Patient; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Patient" (id, mrn, "firstName", "lastName", dob, sex, phone, "nationalId", allergies, "createdAt", "deletedAt") FROM stdin;
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Payment" (id, "invoiceId", method, amount, "cashierId", "createdAt") FROM stdin;
\.


--
-- Data for Name: QueueEntry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."QueueEntry" (id, "destinationId", "patientId", "triageTicketId", "bundleId", status, "position", "calledAt", "roomedAt", "completedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: Report; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Report" (id, "studyId", body, impression, status, "signedBy") FROM stdin;
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Role" (id, name) FROM stdin;
\.


--
-- Data for Name: RoleOnUser; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RoleOnUser" ("userId", "roleId") FROM stdin;
\.


--
-- Data for Name: Scope; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Scope" (id, code) FROM stdin;
\.


--
-- Data for Name: ScopeOnRole; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ScopeOnRole" ("roleId", "scopeId") FROM stdin;
\.


--
-- Data for Name: Study; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Study" (id, "orderId", modality, accession, "pacsUri", status) FROM stdin;
\.


--
-- Data for Name: TriageTicket; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TriageTicket" (id, "patientId", "encounterId", "createdByUserId", "confirmedByUserId", color, status, "dangerSigns", vitals, "suggestedDestinationId", "finalDestinationId", notes, "createdAt", "confirmedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, name, "hashedPass", "createdAt") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
fdb27b8c-0151-44b6-b276-393512ea5114	c691a6ad6d623e2b7ced3bf674d6ffae36f34564afee4160937373d870479e01	2025-10-24 17:25:52.254668+03	20251024142551_init	\N	\N	2025-10-24 17:25:51.419165+03	1
\.


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.appointments (id, patient_id, doctor_id, appointment_date, appointment_time, department, reason, status, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at) FROM stdin;
dc98aeda-ede8-4034-93e4-d75a0b82e983	95e8a919-b8d4-4234-8b06-2168a2763546	user_delete	user	e8b97851-6787-49f2-8022-c12ec2ef4670	\N	\N	2025-11-14 08:19:02.654169
ba158464-87ff-49d0-b6c7-0d909faa087a	95e8a919-b8d4-4234-8b06-2168a2763546	CREATE	User	4beaf36f-b651-462a-9c00-6d95bae0c4ed	{"changes": [{"field": "name", "newValue": "Ssego Beats", "oldValue": null}, {"field": "email", "newValue": "ssegobeats299@gmail.com", "oldValue": null}, {"field": "role", "newValue": "Lab Tech", "oldValue": null}], "category": "USER_MANAGEMENT", "description": "New user created: Ssego Beats (ssegobeats299@gmail.com) with role Lab Tech"}	127.0.0.1	2025-11-14 08:20:03.607967
60312f0a-b37a-4bf4-8678-3c83889d7e33	95e8a919-b8d4-4234-8b06-2168a2763546	LOGOUT	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-14 08:20:20.355762
b2dbbdc1-7e03-4da2-aecb-faad573e3796	\N	LOGIN_FAILED	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "Role mismatch login attempt for stephenssegonga299@gmail.com - selected: Receptionist, actual: Hospital Admin"}	::1	2025-11-17 05:17:30.408386
f0331048-b1d3-4816-b64e-933e3840a3b4	95e8a919-b8d4-4234-8b06-2168a2763546	LOGIN	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User Stephen Ssegonga logged in as Hospital Admin"}	::1	2025-11-17 05:17:35.480669
7e75a779-7095-4af2-ae5b-5cd9065d8f6c	\N	LOGIN	User	4beaf36f-b651-462a-9c00-6d95bae0c4ed	{"category": "AUTHENTICATION", "description": "User Ssego Beats logged in as Lab Tech"}	::1	2025-11-14 08:21:27.211103
94d677b7-fcd8-47d8-811b-d803d2be8f11	\N	email_verified	user	\N	{"new_email": "ssegobeats299@gmail.com"}	\N	2025-11-14 08:21:58.093851
1f13714d-3c54-44c1-b71c-0698d5ae1379	\N	LOGIN	User	4beaf36f-b651-462a-9c00-6d95bae0c4ed	{"category": "AUTHENTICATION", "description": "User Ssego Beats logged in as Lab Tech"}	::1	2025-11-17 04:39:06.44524
2615a518-3cf7-4ceb-955d-7d2c74e51082	\N	LOGOUT	User	4beaf36f-b651-462a-9c00-6d95bae0c4ed	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-17 05:16:46.95403
6394f22a-caac-4f23-81a6-ed4ed18e1375	95e8a919-b8d4-4234-8b06-2168a2763546	user_delete	user	4beaf36f-b651-462a-9c00-6d95bae0c4ed	\N	\N	2025-11-17 05:35:19.690448
c94d2c1a-949a-495f-bfdb-eaadfb1c52c7	95e8a919-b8d4-4234-8b06-2168a2763546	LOGIN	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User Stephen Ssegonga logged in as Hospital Admin"}	::1	2025-11-17 12:03:39.003421
8168cd8f-ecf7-4f14-a268-3b8196707fc7	95e8a919-b8d4-4234-8b06-2168a2763546	CREATE	User	f6e14847-d61a-4e17-a098-68aadd029476	{"changes": [{"field": "name", "newValue": "Ssego Beats", "oldValue": null}, {"field": "email", "newValue": "ssegobeats299@gmail.com", "oldValue": null}, {"field": "role", "newValue": "Radiologist", "oldValue": null}], "category": "USER_MANAGEMENT", "description": "New user created: Ssego Beats (ssegobeats299@gmail.com) with role Radiologist"}	127.0.0.1	2025-11-17 12:42:05.053589
69b286b3-5a78-4f66-8cb5-e189f46689c2	95e8a919-b8d4-4234-8b06-2168a2763546	LOGOUT	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-17 12:46:35.308849
ecef11d2-ac5f-42e9-bd37-6d4b11e702cf	95e8a919-b8d4-4234-8b06-2168a2763546	LOGIN	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User Stephen Ssegonga logged in as Hospital Admin"}	::1	2025-11-17 17:37:12.108474
a1496d45-d5cb-49c1-aac7-92628912d7ce	\N	LOGIN	User	f6e14847-d61a-4e17-a098-68aadd029476	{"category": "AUTHENTICATION", "description": "User Ssego Beats logged in as Radiologist"}	::1	2025-11-17 12:47:19.97799
f497bd4f-c585-46d4-a544-b25c2ac8ab24	\N	email_verified	user	\N	{"new_email": "ssegobeats299@gmail.com"}	\N	2025-11-17 12:48:02.389324
698e02bc-3c7b-4e3a-a839-3332ba5e49c6	\N	LOGOUT	User	f6e14847-d61a-4e17-a098-68aadd029476	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-17 17:36:29.000812
c43f5a78-9c75-4c1d-9a27-5e0cb5a20ebc	95e8a919-b8d4-4234-8b06-2168a2763546	user_delete	user	f6e14847-d61a-4e17-a098-68aadd029476	\N	\N	2025-11-17 17:37:40.885971
29fa8d5c-4388-4544-9669-b3ab9459d42f	95e8a919-b8d4-4234-8b06-2168a2763546	CREATE	User	d57ea178-35e6-45d4-9d74-f39441007b37	{"changes": [{"field": "name", "newValue": "Ssego Beats", "oldValue": null}, {"field": "email", "newValue": "ssegobeats299@gmail.com", "oldValue": null}, {"field": "role", "newValue": "Cashier", "oldValue": null}], "category": "USER_MANAGEMENT", "description": "New user created: Ssego Beats (ssegobeats299@gmail.com) with role Cashier"}	127.0.0.1	2025-11-17 17:39:44.456873
42443aa6-0cb6-47b7-8307-ee59f2bc8068	95e8a919-b8d4-4234-8b06-2168a2763546	LOGOUT	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-17 17:39:50.76466
6e059b71-36f3-4084-930b-445a55c221d3	95e8a919-b8d4-4234-8b06-2168a2763546	LOGIN	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User Stephen Ssegonga logged in as Hospital Admin"}	::1	2025-11-17 20:20:18.406204
30ae1269-b66b-4254-a742-ef5ce52a3824	\N	LOGIN	User	d57ea178-35e6-45d4-9d74-f39441007b37	{"category": "AUTHENTICATION", "description": "User Ssego Beats logged in as Cashier"}	::1	2025-11-17 17:40:11.297107
aa14d5d2-0757-4b06-8111-157537c09b61	\N	email_verified	user	\N	{"new_email": "ssegobeats299@gmail.com"}	\N	2025-11-17 17:40:37.151615
14e00c1c-6170-4458-874b-4e35014dff8b	\N	LOGOUT	User	d57ea178-35e6-45d4-9d74-f39441007b37	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-17 20:19:28.120665
3c74e0e4-990e-4767-8658-215b09bec5a2	95e8a919-b8d4-4234-8b06-2168a2763546	user_delete	user	d57ea178-35e6-45d4-9d74-f39441007b37	\N	\N	2025-11-17 20:20:42.327805
3d09ef2b-ac61-4670-9e79-febb7b80d70b	95e8a919-b8d4-4234-8b06-2168a2763546	CREATE	User	6468f651-4768-4c05-9a3c-8563811659df	{"changes": [{"field": "name", "newValue": "Ssego Beats", "oldValue": null}, {"field": "email", "newValue": "ssegobeats299@gmail.com", "oldValue": null}, {"field": "role", "newValue": "Pharmacist", "oldValue": null}], "category": "USER_MANAGEMENT", "description": "New user created: Ssego Beats (ssegobeats299@gmail.com) with role Pharmacist"}	127.0.0.1	2025-11-17 20:21:22.291044
abd245ab-bd72-4e35-8929-f9e72b1dba7f	95e8a919-b8d4-4234-8b06-2168a2763546	LOGOUT	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-17 20:21:29.250886
f5a25d36-ddc9-4123-bfb6-11fed74a1915	\N	LOGIN_FAILED	User	6468f651-4768-4c05-9a3c-8563811659df	{"category": "AUTHENTICATION", "description": "Failed login attempt for ssegobeats299@gmail.com"}	::1	2025-11-17 20:21:48.120417
18fe5fae-b2b9-46d8-9c7c-5e8e5bf6ee58	\N	LOGIN	User	6468f651-4768-4c05-9a3c-8563811659df	{"category": "AUTHENTICATION", "description": "User Ssego Beats logged in as Pharmacist"}	::1	2025-11-17 20:21:57.668854
4f354b31-8651-4366-9492-d500b6a84c7b	\N	email_verified	user	\N	{"new_email": "ssegobeats299@gmail.com"}	\N	2025-11-17 20:22:16.662048
f672b785-c437-4f5b-9263-4179bfc4d7f9	95e8a919-b8d4-4234-8b06-2168a2763546	LOGIN	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User Stephen Ssegonga logged in as Hospital Admin"}	::1	2025-11-18 23:04:57.953609
b3583f33-5efe-4eeb-94b2-7cbc32711b10	\N	LOGIN	User	6468f651-4768-4c05-9a3c-8563811659df	{"category": "AUTHENTICATION", "description": "User Ssego Beats logged in as Pharmacist"}	::1	2025-11-18 10:02:30.322689
1e208e23-9181-4fde-b627-77925d6b6d40	\N	LOGIN	User	6468f651-4768-4c05-9a3c-8563811659df	{"category": "AUTHENTICATION", "description": "User Ssego Beats logged in as Pharmacist"}	::1	2025-11-18 21:32:21.39707
9e845597-2fb3-41eb-ba20-844bc87711b7	\N	LOGOUT	User	6468f651-4768-4c05-9a3c-8563811659df	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-18 23:04:25.431772
21358f72-bdd3-48df-a10a-de2c25d381f6	95e8a919-b8d4-4234-8b06-2168a2763546	user_delete	user	6468f651-4768-4c05-9a3c-8563811659df	\N	\N	2025-11-18 23:05:18.706449
558b04f8-9e9f-495e-b742-fbac00cee936	95e8a919-b8d4-4234-8b06-2168a2763546	LOGIN	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User Stephen Ssegonga logged in as Hospital Admin"}	::1	2025-11-19 07:57:26.756342
8d04aa9a-661a-464b-83fb-afd1deb31ae1	95e8a919-b8d4-4234-8b06-2168a2763546	LOGOUT	User	95e8a919-b8d4-4234-8b06-2168a2763546	{"category": "AUTHENTICATION", "description": "User logged out"}	127.0.0.1	2025-11-19 09:20:03.253413
\.


--
-- Data for Name: bed_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bed_assignments (id, bed_id, patient_id, assigned_by, assigned_at, discharge_date, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: beds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.beds (id, bed_number, ward, bed_type, status, location, equipment, notes, created_at, updated_at) FROM stdin;
aa677866-9474-4279-aaed-4108cf504d5d	ICU-001	ICU	ICU	Available	Room 1	["Oxygen"]	Patients who need Oxygen	2025-10-28 16:52:27.952244	2025-10-28 16:52:27.952244
74131e4f-9503-4470-8878-c006e4b64db9	ICU-002	ICU	ICU	Occupied	Room 1	["Oxygen", "IVStand"]	Patients who need Oxygen with an IVStand	2025-10-28 16:56:15.667306	2025-10-28 17:58:42.969357
\.


--
-- Data for Name: bill_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bill_items (id, bill_id, description, quantity, unit_price, total_price, created_at) FROM stdin;
\.


--
-- Data for Name: bills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bills (id, bill_number, patient_id, total_amount, tax_amount, discount_amount, final_amount, status, payment_method, paid_amount, barcode, cashier_id, created_at, paid_at) FROM stdin;
\.


--
-- Data for Name: checkins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.checkins (id, patient_id, appointment_id, status, receptionist_id, created_at, updated_at) FROM stdin;
36d57020-94be-4ca2-8eea-bdc18580a60e	00db978d-8442-4317-afc8-43e6322f988b	\N	Arrived	\N	2025-11-07 07:31:15.896799	2025-11-11 09:00:21.079475
c522e87a-f46e-46ad-b7ec-653e239c97ed	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	6e30ba19-9b42-47d8-96a5-dadbc7e2398b	2025-11-13 09:25:46.201229	2025-11-13 09:25:46.201229
e78dd063-e228-4845-9eb4-ec3f4d41a3ee	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	6e30ba19-9b42-47d8-96a5-dadbc7e2398b	2025-11-13 09:26:19.545981	2025-11-13 09:26:19.545981
26e19e1a-aa83-4138-af27-dfb73dc01189	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	6e30ba19-9b42-47d8-96a5-dadbc7e2398b	2025-11-13 09:27:28.460943	2025-11-13 09:27:28.460943
bea147d3-cc39-4142-b6de-385031a3b4c8	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	\N	2025-11-13 00:38:44.231223	2025-11-13 17:03:28.876194
268d7df5-e14c-40f2-a43a-e048f79dfccb	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	\N	2025-11-13 02:17:16.568128	2025-11-13 17:03:28.876194
baae5f56-718a-42a6-968c-b312f43c4529	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	\N	2025-11-13 02:22:13.408133	2025-11-13 17:03:28.876194
300fa69e-6379-4ac7-b065-027b8cee90bc	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	\N	2025-11-13 02:22:57.393963	2025-11-13 17:03:28.876194
04379fbc-cf06-4294-83c8-2fefb4989351	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	\N	2025-11-13 08:16:35.926663	2025-11-13 17:03:28.876194
ca452f33-d96f-4503-943c-b4cb6b57b2f8	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	\N	2025-11-13 08:17:19.703149	2025-11-13 17:03:28.876194
8fcdb038-3acb-4e9a-ab90-ef028fa3c04e	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	\N	2025-11-13 09:40:18.635299	2025-11-13 17:03:28.876194
1915b99f-185c-4be2-bfd2-22bbc5742d49	5f52db90-084d-46ee-b6d8-37f079c3c025	\N	Arrived	\N	2025-11-13 10:13:48.270554	2025-11-13 17:03:28.876194
\.


--
-- Data for Name: consent_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.consent_log (id, user_id, rationale, scope, created_at) FROM stdin;
\.


--
-- Data for Name: dental_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dental_records (id, patient_id, dentist_id, visit_date, diagnosis, procedure_performed, tooth_chart, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: doctor_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, slot_duration, max_patients_per_slot, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, patient_id, type, file_url, uploaded_by, uploaded_at) FROM stdin;
\.


--
-- Data for Name: email_verification_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_verification_tokens (id, user_id, token, new_email, expires_at, used, created_at) FROM stdin;
0f395ba9-a05d-4af7-bc5a-c084c5fd15da	95e8a919-b8d4-4234-8b06-2168a2763546	896797	stephenssegonga299@gmail.com	2025-10-27 16:32:13.696	t	2025-10-27 19:22:13.744169
\.


--
-- Data for Name: insurance_payers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_payers (id, name, payer_code, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: insurance_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.insurance_policies (id, patient_id, payer_id, policy_no, coverage_notes, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.jobs (id, queue, payload, run_at, attempts, max_attempts, status, last_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lab_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lab_tests (id, patient_id, doctor_id, test_name, test_type, status, results, notes, lab_tech_id, ordered_at, completed_at, priority, specimen_type, accession_number, collected_at, collected_by, rejection_reason, reviewed_by, reviewed_at, assigned_radiologist_id, assigned_at) FROM stdin;
\.


--
-- Data for Name: medical_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.medical_records (id, patient_id, doctor_id, visit_date, chief_complaint, diagnosis, treatment_plan, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: medication_stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.medication_stock_movements (id, medication_id, movement_type, quantity, reference, batch_number, expiry_date, barcode_snapshot, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: medications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.medications (id, name, generic_name, category, unit_type, stock_quantity, unit_price, reorder_level, expiry_date, manufacturer, created_at, updated_at, barcode) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, department, title, message, type, priority, is_read, related_patient_id, created_at, role, read_at, payload) FROM stdin;
\.


--
-- Data for Name: nursing_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nursing_notes (id, patient_id, nurse_id, note_type, note, created_at) FROM stdin;
\.


--
-- Data for Name: obstetric_assessments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.obstetric_assessments (id, patient_id, recorded_by, visit_date, gravida, parity, gestational_age_weeks, edd, fundal_height_cm, fetal_heart_rate, presentation, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organization_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_settings (id, name, logo_url, email, phone, address, updated_at) FROM stdin;
1	Dayspring Medical Center	\N	\N	\N	\N	2025-11-14 13:19:05.547387
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, used, created_at) FROM stdin;
\.


--
-- Data for Name: patient_deletion_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.patient_deletion_requests (id, patient_id, reason, status, requested_by, approved_by, approved_at, created_at) FROM stdin;
\.


--
-- Data for Name: patient_routing; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.patient_routing (id, patient_id, from_department, to_department, routed_by, reason, priority, status, created_at, acknowledged_at, completed_at) FROM stdin;
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.patients (id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact_name, emergency_contact_phone, blood_group, allergies, current_location, current_status, triage_category, triage_notes, created_at, updated_at, next_of_kin_relation, next_of_kin_residence, nin, district, subcounty, parish, village, occupation, insurance_provider, insurance_member_no, next_of_kin_name, next_of_kin_phone, next_of_kin_first_name, next_of_kin_last_name, next_of_kin_country, age_years) FROM stdin;
00db978d-8442-4317-afc8-43e6322f988b	P2500001	Stephen	Ssegonga	2001-10-16	Male	+256755826636	\N	Nakanyonyi	Robert Ssegonga	+256701460096	\N	\N	\N	Registered	\N	\N	2025-11-07 07:31:09.479199	2025-11-08 22:47:26.094257	Sibling	Nakanyonyi	\N	\N	\N	\N	\N	\N	\N	\N	Mary Ssegonga	+256785493106	Mary	Ssegonga	UG	24
5f52db90-084d-46ee-b6d8-37f079c3c025	P250002	Ruth	Peace	\N	Female	+256703344221	\N	Nakanyonyi	Magie	+256703344221	\N	\N	\N	Registered	\N	\N	2025-11-13 00:38:43.72932	2025-11-13 02:15:02.953483	Parent	Namulesa	CF0100710FYA7G	Jinja	Walukuba/Masese	Walukuba East	Church	Student	\N	\N	Darlin Wakabi	+256753230867	Darlin	Wakabi	UG	21
\.


--
-- Data for Name: payment_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_items (id, payment_id, description, amount) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, receipt_no, patient_id, amount, method, reference, cashier_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pgmigrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pgmigrations (id, name, run_on) FROM stdin;
1	0001_initial_schema	2025-10-27 00:25:57.031133
3	0002_receptionist_portal	2025-11-17 05:14:30.249533
4	0003_user_delete_fk	2025-11-17 05:14:30.249533
5	0004_user_fk_setnull	2025-11-17 05:14:30.249533
6	0005_user_fk_auto_setnull	2025-11-17 05:14:30.249533
7	0006_lab_tests_enhancements	2025-11-17 05:14:30.249533
8	0007_lab_tests_assignment	2025-11-17 17:30:42.322306
9	0008_medication_stock_movements	2025-11-18 10:51:04.788798
10	0009_add_midwife_dentist_roles	2025-11-19 08:01:05.913568
11	0010_obstetric_dental_enhancements	2025-11-19 08:11:21.81186
\.


--
-- Data for Name: preauthorizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.preauthorizations (id, patient_id, appointment_id, payer_id, status, auth_code, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: prescriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prescriptions (id, patient_id, doctor_id, medication_name, dosage, frequency, duration, instructions, quantity, status, dispensed_by, dispensed_at, barcode, created_at) FROM stdin;
\.


--
-- Data for Name: queue_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.queue_events (id, queue_id, from_status, to_status, created_at) FROM stdin;
\.


--
-- Data for Name: queues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.queues (id, department, checkin_id, status, priority, "position", updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: radiology_tests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.radiology_tests (id, patient_id, doctor_id, test_name, test_type, status, findings, notes, radiologist_id, ordered_at, completed_at) FROM stdin;
\.


--
-- Data for Name: rate_limits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rate_limits (id, key, window_seconds, window_start, count, created_at, updated_at) FROM stdin;
ed594908-e85a-42a7-9ec1-8fcddae8d781	login:::1	60	2025-10-26 21:38:00	1	2025-10-27 00:38:50.840709	2025-10-27 00:38:50.840709
2f390ac8-bb6f-43ec-8da4-d892d36b946c	login:::1	60	2025-10-26 21:43:00	1	2025-10-27 00:43:41.577184	2025-10-27 00:43:41.577184
926ba4ed-e159-45ef-ab60-5987fcec8aef	login:::1	60	2025-10-26 21:44:00	1	2025-10-27 00:44:03.419302	2025-10-27 00:44:03.419302
35ac9a99-03dc-4faa-920d-91ca09efd9b7	login:::1	60	2025-10-26 21:46:00	1	2025-10-27 00:46:38.94696	2025-10-27 00:46:38.94696
349c4da8-522b-4599-9242-6c6e7f5887a7	login:::1	60	2025-10-26 21:47:00	1	2025-10-27 00:47:11.484939	2025-10-27 00:47:11.484939
ef45f869-eb6f-40ea-be62-8ae2eb41837c	login:::1	60	2025-11-10 05:27:00	2	2025-11-10 08:27:31.652	2025-11-10 08:27:39.601293
b32ec289-c116-4519-861e-857de2c5b2e3	login:::1	60	2025-11-10 17:36:00	1	2025-11-10 20:36:32.7936	2025-11-10 20:36:32.7936
cb22e36f-c17f-4477-9ab8-047ef630a8e2	login:::1	60	2025-10-26 21:49:00	4	2025-10-27 00:49:41.863195	2025-10-27 00:49:58.791012
6f5e5290-194b-460d-ba32-09112893996d	login:::1	60	2025-10-26 21:55:00	1	2025-10-27 00:55:21.44439	2025-10-27 00:55:21.44439
d2856307-83c1-4446-839d-3fe0c0cd13bc	login:::1	60	2025-11-11 05:04:00	1	2025-11-11 08:04:01.303788	2025-11-11 08:04:01.303788
9f56fe3c-a36d-4cd9-9fe9-74fb58731407	login:::1	60	2025-11-11 06:51:00	2	2025-11-11 09:51:26.923227	2025-11-11 09:51:39.034881
6271be1f-a0ad-438c-a9d1-73ccb7074377	login:::1	60	2025-11-11 06:53:00	1	2025-11-11 09:53:18.717863	2025-11-11 09:53:18.717863
d50bae11-2b84-4735-8fbb-42405cc70dde	login:::1	60	2025-10-26 21:58:00	6	2025-10-27 00:58:03.178873	2025-10-27 00:58:46.405115
b1f2a0fc-dd19-4fa2-a7b6-b412ceacfca5	login:::1	60	2025-10-26 22:01:00	2	2025-10-27 01:01:35.151818	2025-10-27 01:01:59.346274
3c9a7e3b-5fec-43fd-b97b-b8e306c905e3	login:::1	60	2025-10-26 22:02:00	2	2025-10-27 01:02:04.088207	2025-10-27 01:02:18.078166
0a500b02-95fa-4378-974c-8dbe479cbdcb	login:::1	60	2025-10-26 22:38:00	1	2025-10-27 01:38:07.499288	2025-10-27 01:38:07.499288
61370087-8fe2-4e6b-902a-5483bd2c9c12	login:::1	60	2025-10-26 22:45:00	1	2025-10-27 01:45:42.172122	2025-10-27 01:45:42.172122
25c3d113-e53a-4fc9-a611-e4b435a73760	login:::1	60	2025-10-26 23:10:00	1	2025-10-27 02:10:56.443862	2025-10-27 02:10:56.443862
a9a2e2dc-6b3b-4ad0-909a-b1b5de95698c	login:::1	60	2025-10-26 23:39:00	1	2025-10-27 02:39:26.926034	2025-10-27 02:39:26.926034
00228fb5-abc7-4f32-899d-d1ff171914e3	login:::1	60	2025-10-27 00:49:00	1	2025-10-27 03:49:55.91548	2025-10-27 03:49:55.91548
efe14211-7547-4e2c-ac4a-00d6e34c4113	login:::1	60	2025-10-27 09:32:00	1	2025-10-27 12:32:17.074277	2025-10-27 12:32:17.074277
9a9f4bbd-3baa-427d-89a1-361711547fe6	login:::1	60	2025-10-27 09:52:00	1	2025-10-27 12:52:15.693293	2025-10-27 12:52:15.693293
77da5704-0c66-4610-aa9c-fafe5df56c61	login:::1	60	2025-10-27 09:53:00	1	2025-10-27 12:53:02.223884	2025-10-27 12:53:02.223884
91e5c5da-4956-41c9-8d7e-c86f2d0a8584	login:::1	60	2025-10-27 11:23:00	1	2025-10-27 14:23:33.520198	2025-10-27 14:23:33.520198
c7a47056-b272-4e20-a247-d52b0cb67dd6	login:::1	60	2025-10-27 11:42:00	1	2025-10-27 14:42:47.665915	2025-10-27 14:42:47.665915
044bfa37-74f9-4e08-b40f-4ab69c117382	login:::1	60	2025-11-12 07:47:00	1	2025-11-12 10:47:53.82545	2025-11-12 10:47:53.82545
ee37fe56-837f-49db-b68d-69c0d2e7f3fc	login:::1	60	2025-11-12 07:48:00	1	2025-11-12 10:48:17.236406	2025-11-12 10:48:17.236406
80229e19-0ca6-4b82-a5df-e326a65ffb4a	login:::1	60	2025-11-12 08:16:00	1	2025-11-12 11:16:32.374469	2025-11-12 11:16:32.374469
bbc804eb-8d0e-4125-8f96-a231bc345666	login:::1	60	2025-10-27 11:43:00	5	2025-10-27 14:43:02.920771	2025-10-27 14:43:23.207709
dddefde6-35fd-4820-b19c-18298ea13368	settings:email:::1	60	2025-10-27 13:45:00	1	2025-10-27 16:45:41.755093	2025-10-27 16:45:41.755093
95b63191-82b6-4e27-bf70-58386c63bcb9	settings:email:::1	60	2025-10-27 13:54:00	1	2025-10-27 16:54:15.624869	2025-10-27 16:54:15.624869
ede0064d-db41-48c6-8cbf-bb055b26709e	settings:otp:::1	60	2025-10-27 14:11:00	1	2025-10-27 17:11:36.728995	2025-10-27 17:11:36.728995
66fe09c1-68dc-49de-a9c3-dbd601605fc3	settings:otp:::1	60	2025-10-27 14:15:00	1	2025-10-27 17:15:13.503574	2025-10-27 17:15:13.503574
890f508b-9aa1-491c-9ca9-4756d6251e88	settings:otp:::1	60	2025-10-27 15:08:00	1	2025-10-27 18:08:06.733035	2025-10-27 18:08:06.733035
539fbaf3-cadf-479a-8ee7-4bce554080c5	settings:otp:::ffff:127.0.0.1	60	2025-10-27 15:27:00	1	2025-10-27 18:27:38.977748	2025-10-27 18:27:38.977748
51d0b47f-3441-4160-9f74-96a8586a2478	settings:otp:::1	60	2025-10-27 15:37:00	1	2025-10-27 18:37:11.87428	2025-10-27 18:37:11.87428
02b81ae3-2050-4dfd-b680-25aa0ec04b9d	settings:otp:::1	60	2025-10-27 15:42:00	1	2025-10-27 18:42:05.349108	2025-10-27 18:42:05.349108
735fb7dd-15b1-4a65-b39f-e6f20969881c	settings:otp:::1	60	2025-10-27 15:45:00	1	2025-10-27 18:45:36.802764	2025-10-27 18:45:36.802764
2fa68362-41fc-4d18-8851-0526990a8d8f	settings:otp:::1	60	2025-10-27 16:18:00	1	2025-10-27 19:18:47.154608	2025-10-27 19:18:47.154608
b3ff7dda-d7fd-4399-8924-68c512f6797f	settings:otp:::1	60	2025-10-27 16:22:00	1	2025-10-27 19:22:13.411109	2025-10-27 19:22:13.411109
23fd084e-f8e9-4819-9afd-792df19068ab	settings:password:::1	60	2025-10-27 17:05:00	1	2025-10-27 20:05:53.797239	2025-10-27 20:05:53.797239
0d331a6c-02cb-44cd-9e9a-af82845865bf	login:::1	60	2025-10-27 19:09:00	2	2025-10-27 22:09:17.460118	2025-10-27 22:09:56.719917
11f784fb-504f-4787-8ff3-d0db6e27ca63	login:::1	60	2025-10-27 20:15:00	1	2025-10-27 23:15:33.318069	2025-10-27 23:15:33.318069
d19f8194-88f1-410a-9ce0-999cb0a70591	login:::1	60	2025-11-12 08:49:00	1	2025-11-12 11:49:09.161931	2025-11-12 11:49:09.161931
995240a4-9b26-4d37-95d5-d8fdd7a19e7d	login:::1	60	2025-11-12 08:53:00	1	2025-11-12 11:53:09.135367	2025-11-12 11:53:09.135367
44500d1e-d5e0-4b01-b06e-e6d47d2f6b0e	login:::1	60	2025-10-27 20:23:00	4	2025-10-27 23:23:21.290753	2025-10-27 23:23:53.703587
bdf50760-a978-4c95-8b86-69158569578d	login:::1	60	2025-10-27 20:25:00	1	2025-10-27 23:25:47.33531	2025-10-27 23:25:47.33531
c28dac1c-e184-433a-9986-8667d1d457db	login:::1	60	2025-10-27 20:26:00	1	2025-10-27 23:26:31.993341	2025-10-27 23:26:31.993341
2016b8a6-25a5-427d-94ac-dc1cebb40c79	login:::1	60	2025-10-28 13:09:00	1	2025-10-28 16:09:31.042632	2025-10-28 16:09:31.042632
2889c603-6a58-46bd-8a56-afe028739f45	login:::1	60	2025-10-29 04:23:00	1	2025-10-29 07:23:33.870441	2025-10-29 07:23:33.870441
209a70cd-07a0-479e-a857-33bdceba17c6	login:::1	60	2025-10-29 10:09:00	1	2025-10-29 13:09:33.69143	2025-10-29 13:09:33.69143
0945a185-d69e-4a20-b6cc-4e65c47b710e	login:::1	60	2025-10-29 18:14:00	1	2025-10-29 21:14:53.591331	2025-10-29 21:14:53.591331
82478df8-c333-44ce-ab39-6d9e52bd5b42	login:::1	60	2025-10-30 09:03:00	1	2025-10-30 12:03:12.536017	2025-10-30 12:03:12.536017
0c821a6e-0e48-4b09-9c3c-eb26bb6bcff8	login:::1	60	2025-10-30 12:53:00	1	2025-10-30 15:53:50.377481	2025-10-30 15:53:50.377481
86777255-f8cc-4728-a9e4-37cf75c4ccf6	login:::1	60	2025-10-30 17:29:00	1	2025-10-30 20:29:55.584513	2025-10-30 20:29:55.584513
38eaabc4-e777-4a82-9443-e6f9dfbd6e2f	login:::1	60	2025-10-31 04:36:00	1	2025-10-31 07:36:56.375616	2025-10-31 07:36:56.375616
b99a1eba-2b07-489a-bcb5-9b02575c492c	login:::1	60	2025-10-31 12:58:00	1	2025-10-31 15:58:24.819719	2025-10-31 15:58:24.819719
42fc5b66-a71a-496c-9315-cc6a103bff7e	login:::1	60	2025-11-03 10:47:00	1	2025-11-03 13:47:07.488639	2025-11-03 13:47:07.488639
1eb9df7d-36b3-4c2b-a7b1-733e054ed19a	login:::1	60	2025-11-03 10:48:00	1	2025-11-03 13:48:46.960125	2025-11-03 13:48:46.960125
ef63bf8f-15c4-429e-b787-7133e4736a31	login:::1	60	2025-11-03 10:55:00	2	2025-11-03 13:55:22.204769	2025-11-03 13:55:41.057595
265b7b94-1510-41b4-acd1-4ee8d73c1292	login:::1	60	2025-11-04 19:09:00	1	2025-11-04 22:09:31.017942	2025-11-04 22:09:31.017942
1ecd7ddc-8d7f-4af5-a881-e0412abd5a10	login:::1	60	2025-11-05 18:12:00	1	2025-11-05 21:12:28.19184	2025-11-05 21:12:28.19184
cbcd46fe-9495-4285-9c89-cfed343aef83	login:::1	60	2025-11-06 05:13:00	1	2025-11-06 08:13:01.840132	2025-11-06 08:13:01.840132
17943fda-6bc9-43dc-990a-53c0bcaf2a59	login:::1	60	2025-11-06 17:01:00	1	2025-11-06 20:01:50.976645	2025-11-06 20:01:50.976645
4c075f48-316d-4732-b300-de410b4e6fe2	login:::1	60	2025-11-07 02:47:00	1	2025-11-07 05:47:48.554151	2025-11-07 05:47:48.554151
fc07b410-8040-4731-b246-370475b5094f	login:::1	60	2025-11-07 09:18:00	1	2025-11-07 12:18:34.060329	2025-11-07 12:18:34.060329
0e9c93a8-c5ff-4db8-a151-e516cd1b1f5f	login:::1	60	2025-11-08 17:04:00	1	2025-11-08 20:04:03.781149	2025-11-08 20:04:03.781149
2202eda9-c661-494c-b565-f9580401089b	login:::1	60	2025-11-09 19:06:00	1	2025-11-09 22:06:37.974301	2025-11-09 22:06:37.974301
6e2c6df5-cb1c-4efb-a5b4-ec8a010b5fda	login:::1	60	2025-11-09 20:35:00	1	2025-11-09 23:35:12.770452	2025-11-09 23:35:12.770452
8527ebd7-eaf3-4723-a665-f212a093c737	login:::1	60	2025-11-10 05:14:00	1	2025-11-10 08:14:54.715327	2025-11-10 08:14:54.715327
e86f7666-751f-471c-8068-5eef387817f0	login:::1	60	2025-11-12 09:19:00	1	2025-11-12 12:19:08.160024	2025-11-12 12:19:08.160024
fca0dade-db27-4d85-a9a2-00e1a6602347	login:::1	60	2025-11-12 09:39:00	1	2025-11-12 12:39:10.199794	2025-11-12 12:39:10.199794
2bdb2626-dbab-464c-9e52-fa1d552ce399	login:::1	60	2025-11-12 12:31:00	1	2025-11-12 15:31:09.837968	2025-11-12 15:31:09.837968
dc57ce17-fff2-413d-b4fe-88e9c639e193	login:::1	60	2025-11-12 16:28:00	1	2025-11-12 19:28:26.333342	2025-11-12 19:28:26.333342
2e50e6cf-1422-40c7-b45f-41fd19adeb2a	login:::1	60	2025-11-12 16:35:00	1	2025-11-12 19:35:37.515153	2025-11-12 19:35:37.515153
7f9db543-e2f4-4423-ad3c-d4eccd10688e	login:::1	60	2025-11-12 18:09:00	1	2025-11-12 21:09:49.762469	2025-11-12 21:09:49.762469
6498df33-aca2-402b-b618-c1472a133f2b	login:::1	60	2025-11-12 18:27:00	1	2025-11-12 21:27:03.909511	2025-11-12 21:27:03.909511
43308343-b03b-4fad-8233-30fdfbbf1804	login:::1	60	2025-11-12 18:32:00	1	2025-11-12 21:32:55.991577	2025-11-12 21:32:55.991577
e3d1ed57-4c92-453d-95fe-d5552ec86288	login:::1	60	2025-11-12 21:29:00	1	2025-11-13 00:30:00.204675	2025-11-13 00:30:00.204675
224f4047-b329-4f29-85f4-12709007f825	login:::1	60	2025-11-12 22:11:00	1	2025-11-13 01:11:59.055464	2025-11-13 01:11:59.055464
185eb56f-713c-4b21-acad-b014be96613a	login:::1	60	2025-11-12 23:14:00	1	2025-11-13 02:14:13.857444	2025-11-13 02:14:13.857444
17ffa071-2167-491d-92c3-8c32902269fd	login:::1	60	2025-11-12 23:41:00	1	2025-11-13 02:41:14.767702	2025-11-13 02:41:14.767702
7a04c6d9-2225-4264-af0e-eff797b4e0d8	login:::1	60	2025-11-13 05:03:00	1	2025-11-13 08:03:38.639454	2025-11-13 08:03:38.639454
130ca940-37b7-4167-ab98-5ee73a8623b3	login:::1	60	2025-11-13 05:13:00	1	2025-11-13 08:13:44.10417	2025-11-13 08:13:44.10417
8c74fd1c-8acc-4358-abe7-43da5b8537e0	login:::1	60	2025-11-13 05:58:00	1	2025-11-13 08:58:44.797085	2025-11-13 08:58:44.797085
76741dde-5413-45ff-bba5-459bb6f8452a	login:::1	60	2025-11-13 05:59:00	1	2025-11-13 08:59:02.663163	2025-11-13 08:59:02.663163
0bf2bbfb-6d1e-475f-81de-5228cdc0ee32	login:::1	60	2025-11-13 06:07:00	1	2025-11-13 09:07:29.851234	2025-11-13 09:07:29.851234
1d9920c3-b6c5-4bd8-9290-de6d949fd374	login:::1	60	2025-11-13 13:32:00	1	2025-11-13 16:32:52.5357	2025-11-13 16:32:52.5357
8c4721d4-0779-4144-9900-be7d05cbf18f	login:::1	60	2025-11-13 14:02:00	1	2025-11-13 17:02:41.789045	2025-11-13 17:02:41.789045
ec1a93d8-ffc4-4951-bb8b-f22878377f93	login:::1	60	2025-11-13 14:04:00	1	2025-11-13 17:04:27.521671	2025-11-13 17:04:27.521671
3862e5f9-21c9-469c-b3e4-c546c38a2b74	login:::1	60	2025-11-13 15:02:00	1	2025-11-13 18:02:53.416677	2025-11-13 18:02:53.416677
7f053a6d-e962-4132-92ff-49ef3cd07b74	login:::1	60	2025-11-13 15:47:00	1	2025-11-13 18:47:54.174983	2025-11-13 18:47:54.174983
b461ad48-af5f-4054-a780-b167a5a71dad	login:::1	60	2025-11-13 15:56:00	1	2025-11-13 18:56:00.361788	2025-11-13 18:56:00.361788
d30dfd88-0438-49da-81c0-90f504b3359c	login:::1	60	2025-11-14 05:14:00	1	2025-11-14 08:14:43.36241	2025-11-14 08:14:43.36241
32a66308-b4b7-4883-b480-3797f7d51c32	login:::1	60	2025-11-14 05:16:00	1	2025-11-14 08:16:59.312042	2025-11-14 08:16:59.312042
605e66b1-6c42-41f9-a4a6-d9fd2fc60fc8	login:::1	60	2025-11-14 05:21:00	1	2025-11-14 08:21:26.759412	2025-11-14 08:21:26.759412
c2c4fe12-5e12-4b31-8d38-90118833e157	login:::1	60	2025-11-17 01:39:00	1	2025-11-17 04:39:05.951336	2025-11-17 04:39:05.951336
b917af4e-dde1-4a75-b981-f7aec53762e1	login:::1	60	2025-11-17 02:17:00	2	2025-11-17 05:17:30.125611	2025-11-17 05:17:35.15273
7bc1f322-bf39-4494-9921-fbfa2dc1f514	login:::1	60	2025-11-17 09:03:00	1	2025-11-17 12:03:38.312482	2025-11-17 12:03:38.312482
48085451-e5ea-4ba1-97c5-b9380f824fe7	login:::1	60	2025-11-17 09:47:00	2	2025-11-17 12:47:01.784054	2025-11-17 12:47:19.605478
7344c913-01d6-4229-80df-932258a703df	login:::1	60	2025-11-17 14:37:00	1	2025-11-17 17:37:11.8155	2025-11-17 17:37:11.8155
bb924a86-79e9-42f5-ad39-c64a0f76ffc5	login:::1	60	2025-11-17 14:40:00	1	2025-11-17 17:40:10.980805	2025-11-17 17:40:10.980805
6a307d94-5529-4f4c-b975-69f5b6cc4e3e	login:::1	60	2025-11-17 17:20:00	1	2025-11-17 20:20:18.05971	2025-11-17 20:20:18.05971
85cb0826-6390-41e1-b83d-a6da14a9664c	login:::1	60	2025-11-17 17:21:00	2	2025-11-17 20:21:47.871658	2025-11-17 20:21:57.315009
76a56bf2-de85-43bc-a875-2b9b1f7381f1	login:::1	60	2025-11-18 07:02:00	1	2025-11-18 10:02:29.844314	2025-11-18 10:02:29.844314
af3a3911-4c69-4dc3-bbda-4870d55901f2	login:::1	60	2025-11-18 18:32:00	1	2025-11-18 21:32:20.949136	2025-11-18 21:32:20.949136
66aaa339-b314-4e0a-9716-78d0e03626c2	login:::1	60	2025-11-18 20:04:00	1	2025-11-18 23:04:57.000555	2025-11-18 23:04:57.000555
dfc15bcc-9d38-4fb2-998f-53e4f3f3a5ab	login:::1	60	2025-11-19 04:57:00	1	2025-11-19 07:57:26.361001	2025-11-19 07:57:26.361001
\.


--
-- Data for Name: triage_assessments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.triage_assessments (id, patient_id, recorded_by, mode, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, respiratory_rate, temperature, oxygen_saturation, avpu, mobility, chief_complaint, discriminators, category, created_at, seen_by_doctor_at, metadata, recorded_at) FROM stdin;
\.


--
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_settings (id, user_id, theme, locale, currency, notify_email_reminders, created_at, updated_at, appointment_alerts, lab_results, system_updates, emergency_alerts, timezone, date_format, default_dashboard, queue_wait_warn, queue_wait_crit, service_warn, service_crit) FROM stdin;
8df18cd8-a812-439b-82e1-1a46aab620f9	95e8a919-b8d4-4234-8b06-2168a2763546	light	en-GB	UGX	t	2025-10-27 20:06:31.618799	2025-11-03 13:49:49.285956	t	t	f	t	Africa/Kampala	DD/MM/YYYY	overview	30	60	30	60
dca0f87d-08c8-4cc7-bb07-0dbec1fdc4be	\N	system	en-GB	UGX	t	2025-11-18 21:37:09.887064	2025-11-18 21:39:24.59579	t	t	f	t	Africa/Kampala	DD/MM/YYYY	overview	30	60	30	60
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, name, role, phone, is_active, failed_login_attempts, locked_until, last_login, created_at, updated_at, email_verified_at, department, signature) FROM stdin;
6e30ba19-9b42-47d8-96a5-dadbc7e2398b	admin@dayspring.com	$2a$10$rZ5zKHYxMxLQN8vYJ5vYxOqKp7YxMxLQN8vYJ5vYxOqKp7YxMxLQN	System Administrator	Hospital Admin	+256700000000	t	0	\N	\N	2025-11-03 15:11:30.073466	2025-11-03 15:11:30.073466	\N	\N	\N
95e8a919-b8d4-4234-8b06-2168a2763546	stephenssegonga299@gmail.com	$2b$10$p4pFkVmH6gsqTj0tzLsY/uDKuZbB0v7YRBFz1rKWqsmBnWehubw8q	Stephen Ssegonga	Hospital Admin	+256 785493106	t	0	\N	2025-11-19 07:57:26.730414	2025-10-25 23:32:24.459122	2025-11-19 07:57:26.730414	2025-10-27 19:23:36.895346	administration	Mr. Stephen
\.


--
-- Data for Name: vital_signs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vital_signs (id, patient_id, nurse_id, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, weight, height, recorded_at, notes) FROM stdin;
\.


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 11, true);


--
-- Name: receipt_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.receipt_seq', 1, false);


--
-- Name: Appointment Appointment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_pkey" PRIMARY KEY (id);


--
-- Name: AuditEvent AuditEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditEvent"
    ADD CONSTRAINT "AuditEvent_pkey" PRIMARY KEY (id);


--
-- Name: Audit Audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Audit"
    ADD CONSTRAINT "Audit_pkey" PRIMARY KEY (id);


--
-- Name: Charge Charge_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Charge"
    ADD CONSTRAINT "Charge_pkey" PRIMARY KEY (id);


--
-- Name: Consent Consent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Consent"
    ADD CONSTRAINT "Consent_pkey" PRIMARY KEY (id);


--
-- Name: Destination Destination_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Destination"
    ADD CONSTRAINT "Destination_pkey" PRIMARY KEY (id);


--
-- Name: Dispense Dispense_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Dispense"
    ADD CONSTRAINT "Dispense_pkey" PRIMARY KEY (id);


--
-- Name: Encounter Encounter_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Encounter"
    ADD CONSTRAINT "Encounter_pkey" PRIMARY KEY (id);


--
-- Name: Facility Facility_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Facility"
    ADD CONSTRAINT "Facility_pkey" PRIMARY KEY (id);


--
-- Name: HandoffBundle HandoffBundle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HandoffBundle"
    ADD CONSTRAINT "HandoffBundle_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: LabResult LabResult_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LabResult"
    ADD CONSTRAINT "LabResult_pkey" PRIMARY KEY (id);


--
-- Name: LabSample LabSample_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LabSample"
    ADD CONSTRAINT "LabSample_pkey" PRIMARY KEY (id);


--
-- Name: Medication Medication_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Medication"
    ADD CONSTRAINT "Medication_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Outbox Outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Outbox"
    ADD CONSTRAINT "Outbox_pkey" PRIMARY KEY (id);


--
-- Name: Patient Patient_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Patient"
    ADD CONSTRAINT "Patient_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: QueueEntry QueueEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QueueEntry"
    ADD CONSTRAINT "QueueEntry_pkey" PRIMARY KEY (id);


--
-- Name: Report Report_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_pkey" PRIMARY KEY (id);


--
-- Name: RoleOnUser RoleOnUser_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RoleOnUser"
    ADD CONSTRAINT "RoleOnUser_pkey" PRIMARY KEY ("userId", "roleId");


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: ScopeOnRole ScopeOnRole_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ScopeOnRole"
    ADD CONSTRAINT "ScopeOnRole_pkey" PRIMARY KEY ("roleId", "scopeId");


--
-- Name: Scope Scope_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Scope"
    ADD CONSTRAINT "Scope_pkey" PRIMARY KEY (id);


--
-- Name: Study Study_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Study"
    ADD CONSTRAINT "Study_pkey" PRIMARY KEY (id);


--
-- Name: TriageTicket TriageTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TriageTicket"
    ADD CONSTRAINT "TriageTicket_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bed_assignments bed_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bed_assignments
    ADD CONSTRAINT bed_assignments_pkey PRIMARY KEY (id);


--
-- Name: beds beds_bed_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_bed_number_key UNIQUE (bed_number);


--
-- Name: beds beds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_pkey PRIMARY KEY (id);


--
-- Name: bill_items bill_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_items
    ADD CONSTRAINT bill_items_pkey PRIMARY KEY (id);


--
-- Name: bills bills_bill_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_bill_number_key UNIQUE (bill_number);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: checkins checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_pkey PRIMARY KEY (id);


--
-- Name: consent_log consent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consent_log
    ADD CONSTRAINT consent_log_pkey PRIMARY KEY (id);


--
-- Name: dental_records dental_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT dental_records_pkey PRIMARY KEY (id);


--
-- Name: doctor_schedules doctor_schedules_doctor_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_doctor_id_day_of_week_key UNIQUE (doctor_id, day_of_week);


--
-- Name: doctor_schedules doctor_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_key UNIQUE (token);


--
-- Name: insurance_payers insurance_payers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_payers
    ADD CONSTRAINT insurance_payers_name_key UNIQUE (name);


--
-- Name: insurance_payers insurance_payers_payer_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_payers
    ADD CONSTRAINT insurance_payers_payer_code_key UNIQUE (payer_code);


--
-- Name: insurance_payers insurance_payers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_payers
    ADD CONSTRAINT insurance_payers_pkey PRIMARY KEY (id);


--
-- Name: insurance_policies insurance_policies_patient_id_payer_id_policy_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_patient_id_payer_id_policy_no_key UNIQUE (patient_id, payer_id, policy_no);


--
-- Name: insurance_policies insurance_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: lab_tests lab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: medication_stock_movements medication_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_stock_movements
    ADD CONSTRAINT medication_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: medications medications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: nursing_notes nursing_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nursing_notes
    ADD CONSTRAINT nursing_notes_pkey PRIMARY KEY (id);


--
-- Name: obstetric_assessments obstetric_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.obstetric_assessments
    ADD CONSTRAINT obstetric_assessments_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: patient_deletion_requests patient_deletion_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_deletion_requests
    ADD CONSTRAINT patient_deletion_requests_pkey PRIMARY KEY (id);


--
-- Name: patient_routing patient_routing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_routing
    ADD CONSTRAINT patient_routing_pkey PRIMARY KEY (id);


--
-- Name: patients patients_patient_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_patient_number_key UNIQUE (patient_number);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payment_items payment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_receipt_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_receipt_no_key UNIQUE (receipt_no);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: preauthorizations preauthorizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preauthorizations
    ADD CONSTRAINT preauthorizations_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: queue_events queue_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_events
    ADD CONSTRAINT queue_events_pkey PRIMARY KEY (id);


--
-- Name: queues queues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT queues_pkey PRIMARY KEY (id);


--
-- Name: radiology_tests radiology_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_tests
    ADD CONSTRAINT radiology_tests_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_key_window_seconds_window_start_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_key_window_seconds_window_start_key UNIQUE (key, window_seconds, window_start);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: triage_assessments triage_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_assessments
    ADD CONSTRAINT triage_assessments_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vital_signs vital_signs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_pkey PRIMARY KEY (id);


--
-- Name: Appointment_clinicianId_startsAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Appointment_clinicianId_startsAt_idx" ON public."Appointment" USING btree ("clinicianId", "startsAt");


--
-- Name: Appointment_patientId_startsAt_clinicianId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Appointment_patientId_startsAt_clinicianId_key" ON public."Appointment" USING btree ("patientId", "startsAt", "clinicianId");


--
-- Name: Appointment_patientId_startsAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Appointment_patientId_startsAt_idx" ON public."Appointment" USING btree ("patientId", "startsAt");


--
-- Name: AuditEvent_actorId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON public."AuditEvent" USING btree ("actorId", "createdAt");


--
-- Name: AuditEvent_patientId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditEvent_patientId_createdAt_idx" ON public."AuditEvent" USING btree ("patientId", "createdAt");


--
-- Name: AuditEvent_type_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditEvent_type_createdAt_idx" ON public."AuditEvent" USING btree (type, "createdAt");


--
-- Name: Consent_patientId_scope_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Consent_patientId_scope_idx" ON public."Consent" USING btree ("patientId", scope);


--
-- Name: Destination_facilityId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Destination_facilityId_code_key" ON public."Destination" USING btree ("facilityId", code);


--
-- Name: Dispense_orderId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Dispense_orderId_key" ON public."Dispense" USING btree ("orderId");


--
-- Name: Encounter_patientId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Encounter_patientId_status_idx" ON public."Encounter" USING btree ("patientId", status);


--
-- Name: Facility_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Facility_code_key" ON public."Facility" USING btree (code);


--
-- Name: LabSample_barcode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "LabSample_barcode_key" ON public."LabSample" USING btree (barcode);


--
-- Name: LabSample_orderId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "LabSample_orderId_key" ON public."LabSample" USING btree ("orderId");


--
-- Name: Medication_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Medication_code_key" ON public."Medication" USING btree (code);


--
-- Name: Order_encounterId_type_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Order_encounterId_type_status_idx" ON public."Order" USING btree ("encounterId", type, status);


--
-- Name: Patient_mrn_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Patient_mrn_key" ON public."Patient" USING btree (mrn);


--
-- Name: Patient_nationalId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Patient_nationalId_idx" ON public."Patient" USING btree ("nationalId");


--
-- Name: Patient_nationalId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Patient_nationalId_key" ON public."Patient" USING btree ("nationalId");


--
-- Name: Patient_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Patient_phone_idx" ON public."Patient" USING btree (phone);


--
-- Name: QueueEntry_destinationId_status_position_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "QueueEntry_destinationId_status_position_idx" ON public."QueueEntry" USING btree ("destinationId", status, "position");


--
-- Name: QueueEntry_patientId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "QueueEntry_patientId_status_idx" ON public."QueueEntry" USING btree ("patientId", status);


--
-- Name: Report_studyId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Report_studyId_key" ON public."Report" USING btree ("studyId");


--
-- Name: Role_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Role_name_key" ON public."Role" USING btree (name);


--
-- Name: Scope_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Scope_code_key" ON public."Scope" USING btree (code);


--
-- Name: Study_accession_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Study_accession_key" ON public."Study" USING btree (accession);


--
-- Name: Study_orderId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Study_orderId_key" ON public."Study" USING btree ("orderId");


--
-- Name: TriageTicket_color_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TriageTicket_color_status_idx" ON public."TriageTicket" USING btree (color, status);


--
-- Name: TriageTicket_patientId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TriageTicket_patientId_status_idx" ON public."TriageTicket" USING btree ("patientId", status);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (appointment_date);


--
-- Name: idx_appointments_date_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_date_time ON public.appointments USING btree (appointment_date, appointment_time);


--
-- Name: idx_appointments_doctor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_doctor_id ON public.appointments USING btree (doctor_id);


--
-- Name: idx_appointments_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_patient_id ON public.appointments USING btree (patient_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_bed_assignments_assigned_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bed_assignments_assigned_at ON public.bed_assignments USING btree (assigned_at DESC);


--
-- Name: idx_bed_assignments_bed_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bed_assignments_bed_id ON public.bed_assignments USING btree (bed_id);


--
-- Name: idx_bed_assignments_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bed_assignments_patient_id ON public.bed_assignments USING btree (patient_id);


--
-- Name: idx_bed_assignments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bed_assignments_status ON public.bed_assignments USING btree (status);


--
-- Name: idx_beds_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_beds_status ON public.beds USING btree (status);


--
-- Name: idx_beds_ward; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_beds_ward ON public.beds USING btree (ward);


--
-- Name: idx_bills_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bills_patient_id ON public.bills USING btree (patient_id);


--
-- Name: idx_bills_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bills_status ON public.bills USING btree (status);


--
-- Name: idx_checkins_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_checkins_created ON public.checkins USING btree (created_at DESC);


--
-- Name: idx_checkins_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_checkins_patient ON public.checkins USING btree (patient_id);


--
-- Name: idx_checkins_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_checkins_status ON public.checkins USING btree (status);


--
-- Name: idx_consent_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consent_user_created ON public.consent_log USING btree (user_id, created_at DESC);


--
-- Name: idx_dental_records_patient_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dental_records_patient_date ON public.dental_records USING btree (patient_id, visit_date DESC);


--
-- Name: idx_doctor_schedules_doctor_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_doctor_schedules_doctor_day ON public.doctor_schedules USING btree (doctor_id, day_of_week);


--
-- Name: idx_documents_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_patient ON public.documents USING btree (patient_id);


--
-- Name: idx_email_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_tokens_user_id ON public.email_verification_tokens USING btree (user_id);


--
-- Name: idx_jobs_queue_run_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_queue_run_at ON public.jobs USING btree (queue, run_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_lab_tests_accession; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_tests_accession ON public.lab_tests USING btree (accession_number);


--
-- Name: idx_lab_tests_assigned_radiologist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_tests_assigned_radiologist ON public.lab_tests USING btree (assigned_radiologist_id);


--
-- Name: idx_lab_tests_ordered; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_tests_ordered ON public.lab_tests USING btree (ordered_at DESC);


--
-- Name: idx_lab_tests_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_tests_patient_id ON public.lab_tests USING btree (patient_id);


--
-- Name: idx_lab_tests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lab_tests_status ON public.lab_tests USING btree (status);


--
-- Name: idx_medical_records_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medical_records_patient_id ON public.medical_records USING btree (patient_id);


--
-- Name: idx_medications_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_medications_barcode ON public.medications USING btree (barcode);


--
-- Name: idx_notifications_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_department ON public.notifications USING btree (department);


--
-- Name: idx_notifications_dept; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_dept ON public.notifications USING btree (department, created_at DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_role ON public.notifications USING btree (role, created_at DESC);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_obstetric_assessments_patient_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_obstetric_assessments_patient_date ON public.obstetric_assessments USING btree (patient_id, visit_date DESC);


--
-- Name: idx_patient_routing_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patient_routing_patient_id ON public.patient_routing USING btree (patient_id);


--
-- Name: idx_patient_routing_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patient_routing_status ON public.patient_routing USING btree (status);


--
-- Name: idx_patients_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_created_at ON public.patients USING btree (created_at DESC);


--
-- Name: idx_patients_first_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_first_name_trgm ON public.patients USING gin (first_name public.gin_trgm_ops);


--
-- Name: idx_patients_last_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_last_name_trgm ON public.patients USING gin (last_name public.gin_trgm_ops);


--
-- Name: idx_patients_patient_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_patient_number ON public.patients USING btree (patient_number);


--
-- Name: idx_patients_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_phone ON public.patients USING btree (phone);


--
-- Name: idx_patients_phone_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_phone_trgm ON public.patients USING gin (phone public.gin_trgm_ops);


--
-- Name: idx_payment_items_payment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_items_payment ON public.payment_items USING btree (payment_id);


--
-- Name: idx_payments_patient_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_patient_created ON public.payments USING btree (patient_id, created_at DESC);


--
-- Name: idx_policies_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policies_patient ON public.insurance_policies USING btree (patient_id);


--
-- Name: idx_policies_payer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_policies_payer ON public.insurance_policies USING btree (payer_id);


--
-- Name: idx_preauth_patient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_preauth_patient ON public.preauthorizations USING btree (patient_id);


--
-- Name: idx_preauth_payer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_preauth_payer ON public.preauthorizations USING btree (payer_id);


--
-- Name: idx_preauth_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_preauth_status ON public.preauthorizations USING btree (status);


--
-- Name: idx_prescriptions_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions USING btree (patient_id);


--
-- Name: idx_prescriptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_status ON public.prescriptions USING btree (status);


--
-- Name: idx_queue_events_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_queue_events_created ON public.queue_events USING btree (created_at);


--
-- Name: idx_queue_events_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_queue_events_queue ON public.queue_events USING btree (queue_id, created_at);


--
-- Name: idx_queue_events_to_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_queue_events_to_status_created ON public.queue_events USING btree (to_status, created_at);


--
-- Name: idx_queues_checkin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_queues_checkin ON public.queues USING btree (checkin_id);


--
-- Name: idx_queues_dept_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_queues_dept_status ON public.queues USING btree (department, status);


--
-- Name: idx_queues_lane_pos; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_queues_lane_pos ON public.queues USING btree (department, status, "position");


--
-- Name: idx_radiology_tests_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radiology_tests_patient_id ON public.radiology_tests USING btree (patient_id);


--
-- Name: idx_radiology_tests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_radiology_tests_status ON public.radiology_tests USING btree (status);


--
-- Name: idx_rate_limits_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_limits_key ON public.rate_limits USING btree (key);


--
-- Name: idx_triage_assessments_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_triage_assessments_category ON public.triage_assessments USING btree (category);


--
-- Name: idx_triage_assessments_patient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_triage_assessments_patient_id ON public.triage_assessments USING btree (patient_id);


--
-- Name: idx_triage_assessments_recorded_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_triage_assessments_recorded_at ON public.triage_assessments USING btree (recorded_at DESC);


--
-- Name: idx_triage_patient_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_triage_patient_created ON public.triage_assessments USING btree (patient_id, created_at DESC);


--
-- Name: idx_user_settings_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_settings_user_id ON public.user_settings USING btree (user_id);


--
-- Name: idx_vitals_patient_recorded; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vitals_patient_recorded ON public.vital_signs USING btree (patient_id, recorded_at DESC);


--
-- Name: uniq_appointments_patient_slot; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_appointments_patient_slot ON public.appointments USING btree (patient_id, appointment_date, appointment_time);


--
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bed_assignments update_bed_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_bed_assignments_updated_at BEFORE UPDATE ON public.bed_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: beds update_beds_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_beds_updated_at BEFORE UPDATE ON public.beds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: checkins update_checkins_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_checkins_updated_at BEFORE UPDATE ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_schedules update_doctor_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_doctor_schedules_updated_at BEFORE UPDATE ON public.doctor_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: insurance_payers update_insurance_payers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_insurance_payers_updated_at BEFORE UPDATE ON public.insurance_payers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: insurance_policies update_insurance_policies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_insurance_policies_updated_at BEFORE UPDATE ON public.insurance_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: jobs update_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medical_records update_medical_records_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON public.medical_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medications update_medications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patients update_patients_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: preauthorizations update_preauthorizations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_preauthorizations_updated_at BEFORE UPDATE ON public.preauthorizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: queues update_queues_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON public.queues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rate_limits update_rate_limits_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON public.rate_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: Appointment Appointment_clinicianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Appointment Appointment_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuditEvent AuditEvent_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditEvent"
    ADD CONSTRAINT "AuditEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Consent Consent_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Consent"
    ADD CONSTRAINT "Consent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Destination Destination_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Destination"
    ADD CONSTRAINT "Destination_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Encounter Encounter_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Encounter"
    ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HandoffBundle HandoffBundle_fromFacilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HandoffBundle"
    ADD CONSTRAINT "HandoffBundle_fromFacilityId_fkey" FOREIGN KEY ("fromFacilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: HandoffBundle HandoffBundle_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HandoffBundle"
    ADD CONSTRAINT "HandoffBundle_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HandoffBundle HandoffBundle_toFacilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HandoffBundle"
    ADD CONSTRAINT "HandoffBundle_toFacilityId_fkey" FOREIGN KEY ("toFacilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_encounterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES public."Encounter"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QueueEntry QueueEntry_bundleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QueueEntry"
    ADD CONSTRAINT "QueueEntry_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES public."HandoffBundle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QueueEntry QueueEntry_destinationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QueueEntry"
    ADD CONSTRAINT "QueueEntry_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES public."Destination"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QueueEntry QueueEntry_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QueueEntry"
    ADD CONSTRAINT "QueueEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QueueEntry QueueEntry_triageTicketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QueueEntry"
    ADD CONSTRAINT "QueueEntry_triageTicketId_fkey" FOREIGN KEY ("triageTicketId") REFERENCES public."TriageTicket"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RoleOnUser RoleOnUser_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RoleOnUser"
    ADD CONSTRAINT "RoleOnUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RoleOnUser RoleOnUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RoleOnUser"
    ADD CONSTRAINT "RoleOnUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ScopeOnRole ScopeOnRole_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ScopeOnRole"
    ADD CONSTRAINT "ScopeOnRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ScopeOnRole ScopeOnRole_scopeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ScopeOnRole"
    ADD CONSTRAINT "ScopeOnRole_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES public."Scope"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TriageTicket TriageTicket_confirmedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TriageTicket"
    ADD CONSTRAINT "TriageTicket_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TriageTicket TriageTicket_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TriageTicket"
    ADD CONSTRAINT "TriageTicket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TriageTicket TriageTicket_encounterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TriageTicket"
    ADD CONSTRAINT "TriageTicket_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES public."Encounter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TriageTicket TriageTicket_finalDestinationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TriageTicket"
    ADD CONSTRAINT "TriageTicket_finalDestinationId_fkey" FOREIGN KEY ("finalDestinationId") REFERENCES public."Destination"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TriageTicket TriageTicket_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TriageTicket"
    ADD CONSTRAINT "TriageTicket_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public."Patient"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TriageTicket TriageTicket_suggestedDestinationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TriageTicket"
    ADD CONSTRAINT "TriageTicket_suggestedDestinationId_fkey" FOREIGN KEY ("suggestedDestinationId") REFERENCES public."Destination"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: appointments appointments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bed_assignments bed_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bed_assignments
    ADD CONSTRAINT bed_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bed_assignments bed_assignments_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bed_assignments
    ADD CONSTRAINT bed_assignments_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id) ON DELETE CASCADE;


--
-- Name: bed_assignments bed_assignments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bed_assignments
    ADD CONSTRAINT bed_assignments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: bill_items bill_items_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_items
    ADD CONSTRAINT bill_items_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;


--
-- Name: bills bills_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bills bills_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: checkins checkins_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: checkins checkins_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: checkins checkins_receptionist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_receptionist_id_fkey FOREIGN KEY (receptionist_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: consent_log consent_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consent_log
    ADD CONSTRAINT consent_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dental_records dental_records_dentist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT dental_records_dentist_id_fkey FOREIGN KEY (dentist_id) REFERENCES public.users(id);


--
-- Name: dental_records dental_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT dental_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: doctor_schedules doctor_schedules_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: documents documents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: insurance_policies insurance_policies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: insurance_policies insurance_policies_payer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES public.insurance_payers(id) ON DELETE RESTRICT;


--
-- Name: lab_tests lab_tests_assigned_radiologist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_assigned_radiologist_id_fkey FOREIGN KEY (assigned_radiologist_id) REFERENCES public.users(id);


--
-- Name: lab_tests lab_tests_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lab_tests lab_tests_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lab_tests lab_tests_lab_tech_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_lab_tech_id_fkey FOREIGN KEY (lab_tech_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lab_tests lab_tests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: lab_tests lab_tests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: medical_records medical_records_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: medical_records medical_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: medication_stock_movements medication_stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_stock_movements
    ADD CONSTRAINT medication_stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: medication_stock_movements medication_stock_movements_medication_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_stock_movements
    ADD CONSTRAINT medication_stock_movements_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_related_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_patient_id_fkey FOREIGN KEY (related_patient_id) REFERENCES public.patients(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nursing_notes nursing_notes_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nursing_notes
    ADD CONSTRAINT nursing_notes_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nursing_notes nursing_notes_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nursing_notes
    ADD CONSTRAINT nursing_notes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: obstetric_assessments obstetric_assessments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.obstetric_assessments
    ADD CONSTRAINT obstetric_assessments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: obstetric_assessments obstetric_assessments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.obstetric_assessments
    ADD CONSTRAINT obstetric_assessments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_deletion_requests patient_deletion_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_deletion_requests
    ADD CONSTRAINT patient_deletion_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: patient_deletion_requests patient_deletion_requests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_deletion_requests
    ADD CONSTRAINT patient_deletion_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_deletion_requests patient_deletion_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_deletion_requests
    ADD CONSTRAINT patient_deletion_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: patient_routing patient_routing_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_routing
    ADD CONSTRAINT patient_routing_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_routing patient_routing_routed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patient_routing
    ADD CONSTRAINT patient_routing_routed_by_fkey FOREIGN KEY (routed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_items payment_items_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: payments payments_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payments payments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: preauthorizations preauthorizations_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preauthorizations
    ADD CONSTRAINT preauthorizations_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: preauthorizations preauthorizations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preauthorizations
    ADD CONSTRAINT preauthorizations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: preauthorizations preauthorizations_payer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.preauthorizations
    ADD CONSTRAINT preauthorizations_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES public.insurance_payers(id) ON DELETE RESTRICT;


--
-- Name: prescriptions prescriptions_dispensed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: queue_events queue_events_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queue_events
    ADD CONSTRAINT queue_events_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.queues(id) ON DELETE CASCADE;


--
-- Name: queues queues_checkin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT queues_checkin_id_fkey FOREIGN KEY (checkin_id) REFERENCES public.checkins(id) ON DELETE CASCADE;


--
-- Name: radiology_tests radiology_tests_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_tests
    ADD CONSTRAINT radiology_tests_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: radiology_tests radiology_tests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_tests
    ADD CONSTRAINT radiology_tests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: radiology_tests radiology_tests_radiologist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.radiology_tests
    ADD CONSTRAINT radiology_tests_radiologist_id_fkey FOREIGN KEY (radiologist_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: triage_assessments triage_assessments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_assessments
    ADD CONSTRAINT triage_assessments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: triage_assessments triage_assessments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.triage_assessments
    ADD CONSTRAINT triage_assessments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: vital_signs vital_signs_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: vital_signs vital_signs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments appts_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY appts_insert ON public.appointments FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text, 'Nurse'::text])));


--
-- Name: appointments appts_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY appts_select ON public.appointments FOR SELECT USING ((current_setting('app.role'::text, true) IS NOT NULL));


--
-- Name: appointments appts_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY appts_update ON public.appointments FOR UPDATE USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text, 'Nurse'::text])));


--
-- Name: bills; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

--
-- Name: bills bills_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bills_select ON public.bills FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Cashier'::text])));


--
-- Name: bills bills_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bills_update ON public.bills FOR UPDATE USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Cashier'::text])));


--
-- Name: checkins; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: checkins checkins_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY checkins_rw ON public.checkins USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text, 'Nurse'::text]))) WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text, 'Nurse'::text])));


--
-- Name: dental_records dental_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dental_insert ON public.dental_records FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Dentist'::text])));


--
-- Name: dental_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dental_records ENABLE ROW LEVEL SECURITY;

--
-- Name: dental_records dental_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dental_select ON public.dental_records FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Dentist'::text])));


--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY documents_rw ON public.documents USING ((current_setting('app.role'::text, true) IS NOT NULL)) WITH CHECK ((current_setting('app.role'::text, true) IS NOT NULL));


--
-- Name: insurance_payers ins_payers_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_payers_select ON public.insurance_payers FOR SELECT USING ((current_setting('app.role'::text, true) IS NOT NULL));


--
-- Name: insurance_policies ins_policies_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_policies_rw ON public.insurance_policies USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text]))) WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text])));


--
-- Name: insurance_payers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.insurance_payers ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_policies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: lab_tests lab_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lab_insert ON public.lab_tests FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text])));


--
-- Name: lab_tests lab_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lab_select ON public.lab_tests FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text, 'Lab Tech'::text, 'Nurse'::text])));


--
-- Name: lab_tests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: lab_tests lab_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY lab_update ON public.lab_tests FOR UPDATE USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Lab Tech'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text])));


--
-- Name: medical_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

--
-- Name: medication_stock_movements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.medication_stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: medications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

--
-- Name: medical_records medrec_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY medrec_insert ON public.medical_records FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text])));


--
-- Name: medical_records medrec_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY medrec_select ON public.medical_records FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text, 'Nurse'::text])));


--
-- Name: medical_records medrec_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY medrec_update ON public.medical_records FOR UPDATE USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text])));


--
-- Name: medications meds_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY meds_select ON public.medications FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Pharmacist'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text, 'Nurse'::text])));


--
-- Name: medication_stock_movements medstock_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY medstock_insert ON public.medication_stock_movements FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Pharmacist'::text])));


--
-- Name: medication_stock_movements medstock_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY medstock_select ON public.medication_stock_movements FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Pharmacist'::text])));


--
-- Name: notifications notif_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notif_select ON public.notifications FOR SELECT USING ((current_setting('app.role'::text, true) IS NOT NULL));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: obstetric_assessments obs_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY obs_insert ON public.obstetric_assessments FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text])));


--
-- Name: obstetric_assessments obs_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY obs_select ON public.obstetric_assessments FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Nurse'::text])));


--
-- Name: obstetric_assessments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.obstetric_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: patients patients_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY patients_insert ON public.patients FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text])));


--
-- Name: patients patients_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY patients_select ON public.patients FOR SELECT USING ((current_setting('app.role'::text, true) IS NOT NULL));


--
-- Name: patients patients_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY patients_update ON public.patients FOR UPDATE USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text])));


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payments_rw ON public.payments USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Cashier'::text, 'Receptionist'::text]))) WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Cashier'::text, 'Receptionist'::text])));


--
-- Name: preauthorizations preauth_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY preauth_rw ON public.preauthorizations USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text]))) WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text])));


--
-- Name: preauthorizations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.preauthorizations ENABLE ROW LEVEL SECURITY;

--
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: queues; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

--
-- Name: queues queues_rw; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY queues_rw ON public.queues USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text, 'Nurse'::text]))) WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Receptionist'::text, 'Nurse'::text])));


--
-- Name: radiology_tests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.radiology_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: radiology_tests rads_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rads_insert ON public.radiology_tests FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text])));


--
-- Name: radiology_tests rads_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rads_select ON public.radiology_tests FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Radiologist'::text, 'Nurse'::text])));


--
-- Name: radiology_tests rads_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rads_update ON public.radiology_tests FOR UPDATE USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Radiologist'::text])));


--
-- Name: prescriptions rx_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rx_insert ON public.prescriptions FOR INSERT WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text])));


--
-- Name: prescriptions rx_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rx_select ON public.prescriptions FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text, 'Pharmacist'::text])));


--
-- Name: prescriptions rx_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rx_update ON public.prescriptions FOR UPDATE USING ((current_setting('app.role'::text, true) = ANY (ARRAY['Hospital Admin'::text, 'Doctor'::text, 'Midwife'::text, 'Dentist'::text, 'Pharmacist'::text])));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

