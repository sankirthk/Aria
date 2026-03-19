# Westside Medical Group — Build Todo

Deadline: **Thursday March 19, 2026 — 8:00 PM ET**
Priority order: Setup → DB/Seed → Auth → Agent → Chat UI → Dashboard → Voice → Email → Deploy → Polish

---

## 0. Project Setup

- [x] 0.1 — Rename API prefix `/vanessa/api/v1` → `/kyron/api/v1` everywhere
- [x] 0.2 — Update package names, app name, log labels to `kyron-medical`
- [x] 0.3 — Remove unused MongoDB/client-call leftovers from the prior codebase
- [x] 0.4 — Remove irrelevant legacy controllers, routes, and validators
- [x] 0.5 — Remove legacy real-estate prompt/config files
- [x] 0.6 — Clean env/config surface for the patient-portal app
- [x] 0.7 — Install backend AI dependencies (`langchain`, `@langchain/openai`, `@langchain/core`, LangGraph checkpointing)
- [x] 0.8 — Update frontend structure and routes for the patient portal

---

## 1. Database — Prisma Schema

- [x] 1.1 — Add `Patient` model: `id`, `userId`, `firstName`, `lastName`, `dateOfBirth`, `phone`, `profileComplete`, timestamps
- [x] 1.2 — Add `Provider` model: `id`, `name`, `specialty`, `keywords`, `bio`, `createdAt`
- [x] 1.3 — Add `Slot` model: `id`, `providerId`, `startTime`, `endTime`, `available`, `createdAt`
- [x] 1.4 — Add `Booking` model: `id`, `patientId`, `providerId`, `slotId`, `status`, `createdAt`
- [x] 1.5 — Add `ChatSession` model: `id`, `userId`, `active`, `summary`, timestamps
- [x] 1.6 — Add `ChatMessage` model: `id`, `sessionId`, `role`, `content`, `toolName`, `createdAt`
- [x] 1.7 — Add `VapiAssistant` model
- [x] 1.8 — Add `VoiceCall` model with structured-output fields
- [x] 1.9 — Keep `InviteCode` model
- [x] 1.10 — Add encrypted patient fields and deterministic `phoneHash`
- [x] 1.11 — Add indexes for slot lookup, bookings, sessions, and inbound phone lookup
- [x] 1.12 — Generate Prisma client and establish initial migration set

---

## 2. Seed Data

- [x] 2.1 — Create `backend/src/scripts/seedProviders.ts`
  - [x] 2.1.1 — Seed 5 providers with distinct specialties
  - [x] 2.1.2 — Expand keyword sets with obvious patient-language aliases
  - [x] 2.1.3 — Make provider seeding idempotent
- [x] 2.2 — Create `backend/src/scripts/seedSlots.ts`
  - [x] 2.2.1 — Generate rolling 30–60 day availability
  - [x] 2.2.2 — Weekdays only, 30-minute slots, morning/afternoon spread
  - [x] 2.2.3 — Make slot seeding idempotent / refresh when all slots are stale
- [x] 2.3 — Seed active `VapiAssistant` from env
- [x] 2.4 — Add invite-code generator script
- [x] 2.5 — Call seed/setup flows from backend startup where appropriate

---

## 3. Auth — Backend

- [x] 3.1 — Keep Better Auth integration for email/password login
- [x] 3.2 — Require email verification before login
- [x] 3.3 — Disable auto-sign-in after verification so users explicitly log in
- [x] 3.4 — Keep invite-code validation + signup controller
- [x] 3.5 — Require `name`, `email`, `password`, and `inviteCode` at signup
- [x] 3.6 — Preserve signup rate limiting on custom `/kyron/api/v1/auth/signup`
- [x] 3.7 — Use configured `ALLOWED_ORIGIN` instead of hardcoded localhost
- [x] 3.8 — Default trusted origin to Vite dev server (`http://localhost:5173`)
- [x] 3.9 — Keep Better Auth core routes mounted at `/api/auth/*`

---

## 4. Patient Profile — Backend

- [x] 4.1 — Create `validators/patientSchema.ts`
- [x] 4.2 — Create `controllers/patientController.ts`
  - [x] 4.2.1 — `getProfile`
  - [x] 4.2.2 — `updateProfile`
- [x] 4.3 — Normalize phone to E.164 on save
- [x] 4.4 — Compute and persist `phoneHash`
- [x] 4.5 — Mark `profileComplete = true` when valid profile fields are present
- [x] 4.6 — Create `routes/patientRoute.ts`
- [x] 4.7 — Mount patient routes

---

## 5. Providers + Slots — Backend

- [x] 5.1 — Create `controllers/providerController.ts`
  - [x] 5.1.1 — `getProviders`
  - [x] 5.1.2 — `getSlots`
- [x] 5.2 — Create `validators/providerSchema.ts`
- [x] 5.3 — Create `routes/providerRoute.ts`
- [x] 5.4 — Mount provider routes
- [x] 5.5 — Use `America/Los_Angeles` for slot filtering (`dayOfWeek`, `timeOfDay`)

---

## 6. Appointments — Backend

- [x] 6.1 — Create `validators/appointmentSchema.ts`
- [x] 6.2 — Create `controllers/appointmentController.ts`
  - [x] 6.2.1 — `getAppointments` splits upcoming vs past
  - [x] 6.2.2 — `bookAppointment` uses a transaction to reserve slot + create booking
  - [x] 6.2.3 — Return `409` when slot is already booked
- [x] 6.3 — Create `routes/appointmentRoute.ts`
- [x] 6.4 — Mount appointment routes
- [x] 6.5 — Trigger confirmation email on successful web booking

---

## 7. Transactional Email

- [x] 7.1 — Create `services/emailService.ts`
  - [x] 7.1.1 — `sendBookingConfirmation(...)`
  - [x] 7.1.2 — `sendCancellationConfirmation(...)`
  - [x] 7.1.3 — `sendRescheduleConfirmation(...)`
- [x] 7.2 — Reuse existing mailer/transporter setup
- [x] 7.3 — Wire booking confirmation email from web booking
- [x] 7.4 — Wire cancellation email from chat and voice flows
- [x] 7.5 — Wire reschedule email from chat and voice flows
- [x] 7.6 — Log email send failures without failing the booking workflow

---

## 8. Chat Sessions — Backend

- [x] 8.1 — Create `controllers/chatController.ts`
  - [x] 8.1.1 — `createSession`
  - [x] 8.1.2 — `getActiveSession`
  - [x] 8.1.3 — `getSessions`
  - [x] 8.1.4 — `getSession`
  - [x] 8.1.5 — `deleteSession`
  - [x] 8.1.6 — `sendMessage`
- [x] 8.2 — Create `routes/chatRoute.ts`
- [x] 8.3 — Mount chat routes
- [x] 8.4 — Persist only one active session per user at a time

---

## 9. LangGraph Agent

- [x] 9.1 — Set up `PostgresSaver` checkpointer
- [x] 9.2 — Create agent tools in `services/agent/tools.ts`
  - [x] 9.2.1 — `get_providers`
  - [x] 9.2.2 — `get_available_slots`
  - [x] 9.2.3 — `book_appointment`
  - [x] 9.2.4 — `cancel_appointment`
  - [x] 9.2.5 — `reschedule_appointment`
  - [x] 9.2.6 — `update_patient_profile`
- [x] 9.3 — Build dynamic system prompt with patient context
- [x] 9.4 — Stream agent responses with tool-call updates
- [x] 9.5 — Use Los Angeles time for slot preference filters in agent tools
- [x] 9.6 — Reject invalid phone input before completing profile in agent tools

---

## 10. Chat SSE Streaming — Backend

- [x] 10.1 — Set SSE headers in `sendMessage`
- [x] 10.2 — Emit `chunk` events for token deltas
- [x] 10.3 — Emit `tool_call` events while tools run
- [x] 10.4 — Emit `done` event with booking metadata
- [x] 10.5 — Emit `error` event on unrecoverable failure
- [x] 10.6 — Handle client disconnects cleanly

---

## 11. Voice Handoff — Backend

- [x] 11.1 — Create outbound Vapi service integration
- [x] 11.2 — Serialize chat transcript for voice handoff
- [x] 11.3 — Inject outbound `patientContext`
  - [x] 11.3.1 — patient name
  - [x] 11.3.2 — phone
  - [x] 11.3.3 — profile completion state
  - [x] 11.3.4 — upcoming bookings with `bookingId`s
- [x] 11.4 — Create `voiceController.handoff`
- [x] 11.5 — Support quick-call path with phone + name even if profile is incomplete
- [x] 11.6 — Create and mount `voiceRoute.ts`

---

## 12. Voice Webhook + Inbound Calls — Backend

- [x] 12.1 — Create `webhookController.ts`
  - [x] 12.1.1 — Validate `Bearer ${VAPI_WEBHOOK_SECRET}`
  - [x] 12.1.2 — Handle `assistant-request`
  - [x] 12.1.3 — Handle `end-of-call-report`
- [x] 12.2 — Identify inbound callers via `phoneHash`
- [x] 12.3 — Inject known-patient context into inbound calls
- [x] 12.4 — Fresh-start unknown callers
- [x] 12.5 — Persist `VoiceCall` summary fields and mark linked chat session inactive
- [x] 12.6 — Do not copy voice transcript into `ChatMessage`
- [x] 12.7 — Remove unused webhook local that broke TypeScript build
- [x] 12.8 — Mount `/webhook` at root level

---

## 13. Voice Server Tools — Backend

- [x] 13.1 — Create `voiceToolsController.ts`
- [x] 13.2 — Implement `getContext`
- [x] 13.3 — Implement `getProviders`
- [x] 13.4 — Implement `getAvailableSlots`
- [x] 13.5 — Implement `bookAppointment`
- [x] 13.6 — Implement `cancelAppointment`
- [x] 13.7 — Implement `rescheduleAppointment`
- [x] 13.8 — Ensure all tool responses include `results[].toolCallId`
- [x] 13.9 — Read inbound phone from Vapi call payload, not model-generated args
- [x] 13.10 — Support `getAvailableSlots` by concern, provider name, or specialty
- [x] 13.11 — Use Los Angeles time for voice slot filtering
- [x] 13.12 — Allow cold-call booking by creating patient inline from collected intake fields
- [x] 13.13 — Ensure `bookAppointment` always returns a tool-shaped result on errors
- [x] 13.14 — Mount all 6 `/voice/tools/*` routes

---

## 14. Auth — Frontend

- [x] 14.1 — Registration flow with invite code
- [x] 14.2 — Login flow
- [x] 14.3 — Email verification flow
- [x] 14.4 — Forgot/reset password screens
- [x] 14.5 — Redirect registration success to login
- [x] 14.6 — Add spacing between login and resend-verification controls
- [x] 14.7 — Preserve session-protected dashboard routing

---

## 15. Patient Dashboard — Frontend

- [x] 15.1 — Create dashboard with appointments + chat side by side
- [x] 15.2 — Appointment panel for upcoming bookings
- [x] 15.3 — Appointment cards with provider/specialty/date/time
- [x] 15.4 — Session persistence / resume on login
- [x] 15.5 — Refresh appointment panel immediately after profile completion
- [x] 15.6 — Profile page with editable patient fields and read-only email
- [x] 15.7 — Navbar/profile menu

---

## 16. Chat UI — Frontend

- [x] 16.1 — Build SSE-backed chat panel
- [x] 16.2 — Show typing indicator and tool-call indicator
- [x] 16.3 — New chat button
- [x] 16.4 — History drawer with reverse-chronological sessions
- [x] 16.5 — Call Me action for voice handoff

---

## 17. Onboarding + Profile Collection — Frontend

- [x] 17.1 — `ProfileSetupModal`
- [x] 17.2 — `QuickCallModal`
- [x] 17.3 — Live validation for phone and DOB
- [x] 17.4 — Phone normalization on blur

---

## 18. UI / Branding

- [x] 18.1 — Switch visible branding to `Westside Medical Group`
- [x] 18.2 — Update logo mark and navigation branding
- [x] 18.3 — Preserve glass-morphism dashboard styling
- [x] 18.4 — Landing page CTA polish

---

## 19. Logging / Observability

- [x] 19.1 — Shared logger integration
- [x] 19.2 — Startup/infrastructure logs
- [x] 19.3 — Prisma warn/error logs
- [x] 19.4 — Controller and voice-tool logs
- [x] 19.5 — LangSmith observability

---

## 20. Vapi Dashboard Configuration (REQUIRED for voice to work)

- [x] 20.1 — Add 6 server tools to the Vapi assistant
  - [x] 20.1.1 — `getContext` → `POST https://<domain>/voice/tools/getContext`
  - [x] 20.1.2 — `getProviders` → `POST https://<domain>/voice/tools/getProviders`
  - [x] 20.1.3 — `getAvailableSlots` → `POST https://<domain>/voice/tools/getAvailableSlots`
  - [x] 20.1.4 — `bookAppointment` → `POST https://<domain>/voice/tools/bookAppointment`
  - [x] 20.1.5 — `cancelAppointment` → `POST https://<domain>/voice/tools/cancelAppointment`
  - [x] 20.1.6 — `rescheduleAppointment` → `POST https://<domain>/voice/tools/rescheduleAppointment`
- [x] 20.2 — Set Authorization header on all tools to `Bearer <VAPI_WEBHOOK_SECRET>`
- [x] 20.3 — Match Vapi tool schemas to backend payload expectations
  - [x] 20.3.1 — `getAvailableSlots`: `concern` or `providerName` or `specialty`, plus optional `dayOfWeek`, `timeOfDay`, `month`, `limit`
  - [x] 20.3.2 — `bookAppointment`: `slotId`, and for cold callers optionally `firstName`, `lastName`, `dateOfBirth`, `phone`
- [x] 20.4 — Ensure call payload includes caller number where backend expects it
- [x] 20.5 — Ensure outbound variable injection aligns with backend (`patientName`, `patientContext`, `chatContext`)

---

## 21. Testing

- [ ] 21.1 — E2E: new user signup → invite code → email verification → login
- [ ] 21.2 — E2E: profile setup via chat
- [ ] 21.3 — E2E: book appointment via chat
- [ ] 21.4 — E2E: cancel appointment via chat
- [ ] 21.5 — E2E: reschedule appointment via chat
- [ ] 21.6 — E2E: outbound "Call Me" handoff
- [ ] 21.7 — E2E: inbound call from known patient
- [ ] 21.8 — E2E: inbound call from unknown patient with intake + booking completion
- [ ] 21.9 — E2E: cancel/reschedule via inbound voice call
- [ ] 21.10 — Safety checks: no diagnosis, no medication guidance, no dosing advice

---

## 22. Deployment — AWS / Terraform / CI-CD

- [x] 22.1 — Create `infrastructure/providers.tf` with AWS provider config, remote state backend, and DynamoDB locking
- [x] 22.2 — Create `infrastructure/main.tf` to compose VPC, IAM, RDS, Elastic Beanstalk, and frontend modules plus root source-bundle bucket
- [x] 22.3 — Create `infrastructure/variables.tf`, `outputs.tf`, and `terraform.tfvars.example`
- [x] 22.4 — Create `infrastructure/modules/vpc/*`
  - [x] 22.4.1 — VPC `10.0.0.0/16`
  - [x] 22.4.2 — 2 public subnets
  - [x] 22.4.3 — 2 private subnets
  - [x] 22.4.4 — IGW, NAT gateways, route tables
  - [x] 22.4.5 — `sg_alb`, `sg_eb`, `sg_rds`
- [x] 22.5 — Create `infrastructure/modules/iam/*`
  - [x] 22.5.1 — EB instance role + instance profile
  - [x] 22.5.2 — GitHub OIDC provider
  - [x] 22.5.3 — GitHub Actions deploy role scoped to repo + main branch
- [x] 22.6 — Create `infrastructure/modules/rds/*` for PostgreSQL 17, subnet group, and SSM-backed credentials
- [x] 22.7 — Create `infrastructure/modules/elastic_beanstalk/*`
  - [x] 22.7.1 — Docker platform on Amazon Linux 2023
  - [x] 22.7.2 — ALB in public subnets
  - [x] 22.7.3 — EC2 in public subnets for demo deployment
  - [x] 22.7.4 — `DATABASE_URL` env var construction
- [x] 22.8 — Create `infrastructure/modules/frontend/*` for private S3 bucket, OAC, and CloudFront SPA distribution
- [x] 22.9 — Create root S3 bucket resource for EB source bundles
- [x] 22.10 — Manually bootstrap Terraform state bucket and lock table before first apply
- [x] 22.11 — Manually create `/kyron/*` SSM parameters before first apply
- [x] 22.12 — Run `terraform init`, `terraform plan`, and `terraform apply`
- [x] 22.13 — Modify `kyron-medical/backend/entrypoint.sh` to parse RDS host from `DATABASE_URL`
- [x] 22.14 — Create `kyron-medical/backend/.ebextensions/01_platform.config`
- [x] 22.15 — Create `.github/workflows/deploy-backend.yml`
- [x] 22.16 — Create `.github/workflows/deploy-frontend.yml`
- [x] 22.17 — Set GitHub Actions variables from Terraform outputs
- [x] 22.18 — Trigger first backend deploy, then first frontend deploy
- [ ] 22.19 — Smoke test CloudFront, EB `/health`, auth flow, Prisma migrations, and SSM secret loading

---

## 23. Next Feature Priorities

- [ ] 23.1 — Admin dashboard for practice staff
- [ ] 23.2 — Voice call history and outcome summary in the UI
- [ ] 23.3 — Waitlist fallback when no slots are available

---

## 24. Nice-to-Have

- [ ] 24.1 — Appointment panel: display cancelled appointments with strikethrough
- [ ] 24.2 — Past appointments tab / expanded history UX
- [ ] 24.3 — Rate-limit voice tool endpoints
- [ ] 24.4 — Profile page: change email via Better Auth flow
