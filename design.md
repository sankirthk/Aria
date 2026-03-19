# Westside Medical Group Demo Architecture

## Architecture

The system is split into:

- `frontend/kyron-medical`: Vite/React patient UI
- `backend`: Express API, Better Auth, Prisma, LangGraph agent, Vapi integration
- `Postgres`: primary data store

Core backend subsystems:

- `auth`: Better Auth for sessions, verification, password reset, and auth routes
- `patient/profile`: encrypted patient record storage plus deterministic `phoneHash`
- `chat`: LangGraph-backed AI scheduling assistant with persisted sessions/messages
- `voice`: Vapi outbound handoff, inbound webhook handling, and server tools
- `email`: Nodemailer-based transactional email service

## Data Model

Key app tables:

- `Patient`
  - encrypted `firstName`, `lastName`, `dateOfBirth`, `phone`
  - deterministic `phoneHash` for inbound phone lookup
- `Provider`
  - specialty and keyword list for concern matching
- `Slot`
  - provider availability
- `Booking`
  - appointment record linked to patient, provider, and slot
- `ChatSession` / `ChatMessage`
  - persisted web chat history
- `VapiAssistant`
  - active assistant and outbound phone number configuration
- `VoiceCall`
  - inbound/outbound call lifecycle and structured outcome storage

Better Auth owns its own tables separately.

## Chat Flow

1. User authenticates and opens the dashboard.
2. Frontend resumes the active chat session or creates one.
3. User sends a message over the SSE endpoint.
4. Backend streams agent output and tool activity.
5. Agent tools read/write appointments, profile data, and provider availability.

## Voice Flow

### Outbound

1. User requests a callback from chat.
2. Backend serializes the active chat transcript.
3. Backend builds `patientContext` from patient profile and upcoming bookings.
4. Backend creates the Vapi outbound call with injected `patientContext` and `chatContext`.

### Inbound

1. Vapi sends `assistant-request`.
2. Backend reads `message.call.customer.number`.
3. Backend hashes the normalized phone and looks up the patient.
4. If found, backend injects patient name and active chat summary/transcript.
5. If not found, the call starts as a fresh intake flow.

### Voice Tools

- All tool responses return `results[].toolCallId`.
- Tool auth uses `Bearer <VAPI_WEBHOOK_SECRET>`.
- `bookAppointment` can create a patient on the fly for cold callers if the assistant supplies intake fields.

## Scheduling Logic

- Slot seed window is roughly 30 to 60 days ahead.
- All weekday/month/time-of-day filtering is evaluated in `America/Los_Angeles`.
- Voice slot lookup can resolve by concern, provider name, or specialty.
- Concern-based matching uses provider keywords and specialty-name bonuses.

## Security/Privacy Notes

- Sensitive fields are encrypted with Prisma field encryption.
- Queryable phone lookup uses `phoneHash` because encrypted phone values are not searchable.
- Auth cookies and Better Auth trusted origins are configured centrally.

## Known Simplifications

- No staff/admin portal yet
- No waitlist yet
- No SMS consent flow
- No transcript storage in chat for voice calls
- No multi-tenant practice support
