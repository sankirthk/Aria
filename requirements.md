# Westside Medical Group Demo Requirements

## Product Scope

This repository implements a demo patient portal for a single multi-specialty private practice:

- Practice: `Westside Medical Group`
- Address: `123 Westside Blvd, Suite 400, Los Angeles, CA 90025`
- End users: patients
- Internal operator/customer context: the practice is the clinic using the software

The app supports:

- authenticated patient signup with invite codes
- email verification before login
- patient profile completion
- AI chat for scheduling workflows
- outbound voice handoff from chat
- inbound voice calls for known and unknown callers
- booking, cancellation, and rescheduling
- confirmation emails for booking, cancellation, and rescheduling

The app does not provide:

- diagnosis
- treatment recommendations
- medication dosage advice
- SMS workflows
- multi-practice routing

## Functional Requirements

### Authentication

- Signup requires `name`, `email`, `password`, and a valid invite code.
- Email verification is required before the user can log in.
- Users are not auto-signed-in after verification; they must log in explicitly.
- Better Auth handles `/api/auth/*`.
- The custom signup endpoint is rate-limited separately.

### Patient Profile

- A patient can create or update first name, last name, date of birth, and phone number.
- Phone numbers are normalized to E.164 format.
- Inbound voice lookups use a deterministic `phoneHash`, not encrypted phone ciphertext.
- A profile is only considered complete when required fields are present.

### Scheduling

- Patients can book appointments through chat.
- Patients can book appointments through voice.
- Voice booking supports cold callers if the assistant provides collected `firstName`, `lastName`, `dateOfBirth`, and phone at booking time.
- Patients can cancel and reschedule future appointments.
- Booking, cancellation, and rescheduling send email confirmations when the patient has an email on file.
- Slot filtering for weekday/time preferences uses `America/Los_Angeles`.

### AI Chat

- Chat sessions are persisted.
- Only one active chat session exists per user at a time.
- Streaming responses use SSE with `chunk`, `tool_call`, `done`, and `error` events.
- Agent tools available in chat:
  - `get_providers`
  - `get_available_slots`
  - `book_appointment`
  - `cancel_appointment`
  - `reschedule_appointment`
  - `update_patient_profile`

### Voice

- Outbound handoff calls inject transcript and patient context directly into the Vapi call.
- Inbound calls identify known patients by `call.customer.number` using `phoneHash`.
- Voice server tools available:
  - `getContext`
  - `getProviders`
  - `getAvailableSlots`
  - `bookAppointment`
  - `cancelAppointment`
  - `rescheduleAppointment`
- `getAvailableSlots` accepts any of:
  - `concern`
  - `providerName`
  - `specialty`
- Voice call summaries and structured outcomes are stored on `VoiceCall`.
- Voice transcripts are not copied into `ChatMessage`.

## Non-Functional Requirements

- PostgreSQL via Prisma
- encrypted sensitive patient/chat fields
- operational logging via shared logger
- Docker-based backend deployment target
- frontend may be deployed separately as a static build

## Priority Demo Enhancements

The next feature additions for the interview demo are prioritized in this order:

### 1. Admin Dashboard

- The app should provide a simple staff-facing dashboard view.
- Staff should be able to see bookings, cancellations, and reschedules for the practice.
- The dashboard may be read-only for demo purposes.
- This is the highest-priority enhancement because it makes the system feel like a real clinic workflow rather than only a patient portal.

### 2. Voice Call History And Outcome Summary

- The app should expose recent voice-call records in the UI.
- Each record should show at minimum:
  - call direction
  - created time
  - ended status
  - call summary
  - pending action
  - whether a booking was completed
- This feature should reuse the existing `VoiceCall` data already persisted by the backend.

### 3. Waitlist Fallback

- If no appointment slots are available for the requested provider or specialty, the app should offer a waitlist or callback fallback.
- The patient should be able to submit a request for follow-up instead of reaching a dead end.
- For demo scope, this can be implemented as a lightweight waitlist record or callback request rather than a full scheduling engine.

## Demo Constraints

- This is a demo-quality application, not a production-hardened medical platform.
- Staff/admin workflows are minimal.
- HIPAA, formal auditing, and enterprise controls are out of scope for the interview demo.
