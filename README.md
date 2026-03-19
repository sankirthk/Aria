# Westside Medical Group — AI Patient Portal

Full-stack AI-powered patient portal for Westside Medical Group. Patients interact with **Aria**, an AI assistant, via web chat or phone call to schedule appointments, manage upcoming visits, and ask practice questions. The AI is strictly non-clinical.

- **AI chat** — streaming LangGraph agent with tool use: scheduling, cancellation, rescheduling, profile collection
- **Voice integration** — Vapi-powered inbound and outbound calls with full chat-context handoff and live server tools
- **Appointment management** — book, cancel, and reschedule via chat or phone; confirmation emails sent automatically
- **Secure auth** — invite-gated signup, email verification, session management via Better Auth
- **Observability** — Pino structured logging, LangSmith tracing for all LangGraph agent runs

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Repository Layout](#repository-layout)
4. [Environment Configuration](#environment-configuration)
5. [Quick Start with Docker Compose](#quick-start-with-docker-compose)
6. [Manual Local Development](#manual-local-development)
7. [Database & Prisma Tooling](#database--prisma-tooling)
8. [Authentication Flow](#authentication-flow)
9. [Chat & Agent Architecture](#chat--agent-architecture)
10. [Voice Integration](#voice-integration)
11. [API Surface](#api-surface)
12. [Logging & Observability](#logging--observability)
13. [Deployment](#deployment)
14. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌──────────────────────────────────────────┐
│  React/Vite Frontend  (Port 3000)        │
│  ├─ AuthProvider (Better Auth client)    │
│  ├─ ChatPanel  ──── SSE stream           │
│  ├─ AppointmentPanel                     │
│  ├─ ProfilePage                          │
│  └─ Axios → /kyron/api/v1/*             │
└─────────────────▲────────────────────────┘
                  │ HTTPS / CORS
┌─────────────────┴────────────────────────┐
│  Express Backend  (Port 8000)            │
│  ├─ /kyron/api/v1/*  — app routes        │
│  ├─ /api/auth/*      — Better Auth       │
│  ├─ /webhook         — Vapi webhook      │
│  ├─ /voice/tools/*   — Vapi server tools │
│  ├─ LangGraph agent (gpt-4o)             │
│  │    └─ PostgresSaver checkpointer      │
│  └─ Pino logging → /logs                 │
└───────┬──────────────────┬───────────────┘
        │                  │
┌───────▼──────┐   ┌───────▼──────────────┐   ┌──────────────┐
│ PostgreSQL   │   │  OpenAI (gpt-4o)     │   │ Vapi Platform│
│ App data +   │   │  LangSmith tracing   │   │ Inbound +    │
│ Auth tables  │   │                      │   │ Outbound     │
│ LangGraph    │   └──────────────────────┘   └──────────────┘
│ checkpoints  │
└──────────────┘
```

**Frontend**: React 19 + Vite, glass-morphism UI (GSAP animations), SSE-based chat streaming.

**Backend**: Express 5, modular controllers/services, Zod validation, Pino logging.

**AI Agent**: LangGraph `createAgent` with `PostgresSaver` checkpointer for conversation persistence. Dynamic system prompt injected per request with patient context (name, profile status, upcoming bookings with IDs). 6 agent tools:
- `get_providers` — semantic provider matching
- `get_available_slots` — slots by providerId, day, time
- `book_appointment` — atomic slot booking + confirmation email
- `cancel_appointment` — cancel future bookings only
- `reschedule_appointment` — swap slot atomically
- `update_patient_profile` — upsert patient record

**Voice**: Vapi handles inbound/outbound calls. Outbound injects serialized chat transcript at call start. Inbound injects session summary. Both have access to 6 server tools (`/voice/tools/*`) for live data during the call.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, React Router 7, Vite 7, TypeScript, GSAP, Lucide React |
| Backend | Node.js 22, Express 5, TypeScript, Zod, Pino |
| Auth | Better Auth (Prisma adapter, email verification, rate limiting, invite codes) |
| AI | LangChain `createAgent`, LangGraph, OpenAI gpt-4o, PostgresSaver, LangSmith |
| Voice | Vapi server SDK, Vapi webhook, Vapi server tools |
| Database | PostgreSQL 17, Prisma ORM |
| Email | Nodemailer (Gmail SMTP) |
| Infra | Docker Compose, Nginx, Certbot (production), ngrok (dev webhook) |

---

## Repository Layout

```
.
├── backend/
│   ├── src/
│   │   ├── clients/            # prismaClient.ts, vapiClient.ts
│   │   ├── config/             # logger.ts, voiceSystemPrompt.ts
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── patientController.ts
│   │   │   ├── chatController.ts
│   │   │   ├── appointmentController.ts
│   │   │   ├── providerController.ts
│   │   │   ├── voiceController.ts
│   │   │   ├── voiceToolsController.ts  # Vapi server tool handlers
│   │   │   └── webhookController.ts
│   │   ├── middleware/         # setupMiddleware.ts, httpLoggerMiddleware.ts
│   │   ├── routes/             # one file per controller
│   │   ├── scripts/            # seedProviders.ts, seedSlots.ts, seedVapiAssistant.ts, generateInviteCode.ts
│   │   ├── services/
│   │   │   ├── agent/
│   │   │   │   ├── agentService.ts   # LangGraph streaming
│   │   │   │   ├── tools.ts          # 6 agent tools
│   │   │   │   ├── systemPrompt.ts   # dynamic prompt builder
│   │   │   │   └── checkpointer.ts   # PostgresSaver setup
│   │   │   ├── vapiService.ts        # outbound call initiation
│   │   │   └── emailService.ts       # booking confirmation emails
│   │   ├── lib/
│   │   │   ├── auth/           # Better Auth setup, email verification
│   │   │   └── mailer.ts       # Nodemailer transporter
│   │   ├── types/
│   │   ├── utils/              # normalizePhone.ts, formatDuration.ts
│   │   └── validators/         # Zod schemas
│   ├── prisma/
│   │   └── schema.prisma
│   ├── logs/
│   ├── Dockerfile.backend
│   └── package.json
├── frontend/kyron-medical/
│   ├── src/
│   │   ├── api/                # auth.ts, patient.ts, appointments.ts, providers.ts, chat.ts
│   │   ├── clients/            # authClient.ts, axiosClient.ts
│   │   ├── components/
│   │   │   ├── appointments/   # AppointmentCard.tsx, AppointmentPanel.tsx
│   │   │   ├── chat/           # ChatPanel.tsx, ChatMessage.tsx, TypingIndicator.tsx, ToolCallIndicator.tsx
│   │   │   ├── dashboard/      # QuickCallModal.tsx, ProfileSetupModal.tsx
│   │   │   └── layout/         # Navbar.tsx
│   │   ├── context/            # AuthProvider.tsx, useAuth.ts
│   │   ├── pages/              # DashboardPage.tsx, ProfilePage.tsx, LoginPage.tsx, RegistrationPage.tsx, etc.
│   │   ├── routes/             # ProtectedRoute.tsx
│   │   ├── styles/             # CSS per component/page
│   │   └── utils/              # authValidation.ts, normalizePhone.ts, toastService.ts
│   ├── Dockerfile.frontend
│   ├── vite.config.ts
│   └── package.json
├── docker-compose.yaml
├── openapi.yaml
├── todo.md
└── README.md
```

---

## Environment Configuration

### Backend `backend/.env`

```ini
PORT=8000
NODE_ENV=development

# PostgreSQL
DATABASE_URL="postgresql://postgres:password@db:5432/kyron_medical"

# Better Auth
BETTER_AUTH_SECRET="64-char-secret"
BETTER_AUTH_URL="http://localhost:8000"

# OpenAI
OPENAI_API_KEY="sk-..."

# Vapi
VAPI_API_KEY="..."
VAPI_PHONE_NUMBER_ID="..."
VAPI_ASSISTANT_ID="..."
VAPI_WEBHOOK_SECRET="..."

# SMTP (Gmail)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="your-email@gmail.com"
SMTP_PASS="gmail-app-password"

# CORS
ALLOWED_ORIGIN="http://localhost:3000"

# Logging
LOG_LEVEL=debug
LOG_TO_FILE=true
LOG_DIR="./logs"

# LangSmith (optional — enables LangGraph tracing)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY="lsv2_pt_..."
LANGCHAIN_PROJECT="kyron-medical"
```

### Frontend `frontend/kyron-medical/.env`

```ini
VITE_API_BASE_URL="http://localhost:8000/kyron/api/v1"
VITE_SERVER_BASE_URL="http://localhost:8000/api/auth"
```

---

## Quick Start with Docker Compose

```bash
# 1. Fill in backend/.env and frontend/kyron-medical/.env
# 2. Start the stack
docker compose up --build

# Services:
#   Backend  → http://localhost:8000
#   Frontend → http://localhost:3000
#   Postgres → localhost:5432

# 3. For Vapi webhook testing, expose port 8000 via ngrok:
ngrok http 8000
# Set the forwarding URL as your Vapi server URL: https://<id>.ngrok-free.app/webhook
# Set Vapi server tool URLs: https://<id>.ngrok-free.app/voice/tools/<toolName>

# 4. Generate an invite code for signup
docker compose exec backend npx ts-node src/scripts/generateInviteCode.ts
```

On startup the backend automatically:
- Creates LangGraph checkpoint tables (`checkpointer.setup()`)
- Seeds 5 providers (idempotent)
- Seeds appointment slots for the next 30–60 days (re-seeds when all existing slots are in the past)
- Seeds the Vapi assistant record from `VAPI_ASSISTANT_ID` env var

---

## Manual Local Development

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend (separate terminal)
cd frontend/kyron-medical
npm install
npm run dev -- --host
```

---

## Database & Prisma Tooling

Schema: `backend/prisma/schema.prisma`
Generated client: `backend/src/generated/prisma`

```bash
npx prisma migrate dev --name <description>   # create + apply migration
npx prisma migrate deploy                      # apply in production
npx prisma generate                            # regenerate client after schema change
npx prisma studio                              # inspect data in browser
```

### Application tables

| Table | Purpose |
|---|---|
| `Patient` | Patient profile (name, DOB, phone, profileComplete) |
| `Provider` | Static providers seeded at startup |
| `Slot` | Available appointment slots (30–60 day rolling window) |
| `Booking` | Confirmed appointments (status: confirmed / cancelled) |
| `ChatSession` | One session per conversation thread, stores summary |
| `ChatMessage` | Individual messages (user / assistant / tool) |
| `VapiAssistant` | Vapi assistant + phone number IDs |
| `VoiceCall` | Record of every inbound/outbound call with structured outputs |

Better Auth tables (`user`, `session`, `account`, `verification`, `rateLimit`) are auto-managed.

---

## Authentication Flow

1. Patient visits `/register`, enters an invite code (validated against `InviteCode` table), fills in email + password.
2. Better Auth sends a verification email via Nodemailer.
3. Patient verifies email → auto-signed in → redirected to `/dashboard`.
4. Subsequent logins via `/login` (Better Auth `sign-in/email`).
5. Session cookies are httpOnly; `AuthProvider` loads session state on mount via `authClient.getSession()`.
6. `ProtectedRoute` redirects unauthenticated users to `/`.

---

## Chat & Agent Architecture

### Session lifecycle

- On dashboard mount, `getActiveSession` resumes the most-recently-updated active session (or creates one if none exists).
- Patients can start a new conversation via the **New Chat** button (SquarePen icon).
- Past sessions are browsable via the **History** drawer.

### Streaming

`POST /kyron/api/v1/chat/session/:id/message` opens an SSE stream. Events:

| Event | Payload | Meaning |
|---|---|---|
| `chunk` | `{ text }` | Incremental token from the model |
| `tool_call` | `{ status }` | Agent is executing a tool |
| `done` | `{ messageId, bookingCreated, booking }` | Stream complete |
| `error` | `{ message }` | Unrecoverable error |

### Agent tools

| Tool | Description |
|---|---|
| `get_providers` | Fetch all providers for semantic matching |
| `get_available_slots` | Open slots for a provider in the next 30–60 days |
| `book_appointment` | Atomic slot booking + confirmation email |
| `cancel_appointment` | Cancel a future booking, free the slot |
| `reschedule_appointment` | Swap booking to a new slot atomically |
| `update_patient_profile` | Upsert patient record (name, DOB, phone) |

Upcoming bookings (including `bookingId`) are injected into the system prompt on every request so the agent can cancel/reschedule without an extra tool call.

---

## Voice Integration

### Outbound ("Call Me" button)

1. Patient clicks **Call Me** in the chat panel.
2. `POST /kyron/api/v1/voice/handoff` serializes the current chat session transcript.
3. Backend calls Vapi to initiate an outbound call, injecting `patientName` and `chatContext` as `assistantOverrides`.
4. Aria picks up the conversation where the chat left off.

### Inbound (patient dials in)

1. Vapi fires `assistant-request` to `POST /webhook`.
2. Backend looks up the patient by caller phone number, fetches their most recent session summary.
3. Returns `assistantId` + `assistantOverrides` (firstMessage, patientName, chatContext).
4. Aria greets the patient with context.

### Vapi Server Tools

Both inbound and outbound assistants have access to 6 server tools configured in the Vapi dashboard:

| Tool name | URL | Auth | Parameters |
|---|---|---|---|
| `getContext` | `/voice/tools/getContext` | Bearer secret | none |
| `getProviders` | `/voice/tools/getProviders` | Bearer secret | none |
| `getAvailableSlots` | `/voice/tools/getAvailableSlots` | Bearer secret | `concern`, `dayOfWeek?`, `timeOfDay?`, `limit?` |
| `bookAppointment` | `/voice/tools/bookAppointment` | Bearer secret | `slotId` |
| `cancelAppointment` | `/voice/tools/cancelAppointment` | Bearer secret | `bookingId` |
| `rescheduleAppointment` | `/voice/tools/rescheduleAppointment` | Bearer secret | `bookingId`, `newSlotId` |

All tool endpoints use `POST`. Vapi automatically supplies the call context (phone number, callId) in the request body. Patient identity is resolved from `call.customer.number`.

---

## API Surface

All application endpoints are prefixed `/kyron/api/v1`. Better Auth routes are at `/api/auth/*`. Vapi integrations are at `/webhook` and `/voice/tools/*`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/kyron/api/v1/auth/validate-invite` | Public | Validate invite code |
| POST | `/kyron/api/v1/auth/signup` | Public | Register new patient |
| ALL | `/api/auth/*` | Varies | Better Auth (login, logout, session, password reset) |
| GET | `/kyron/api/v1/patient/profile` | Session | Get patient profile |
| PUT | `/kyron/api/v1/patient/profile` | Session | Update patient profile |
| POST | `/kyron/api/v1/chat/session` | Session | Create new chat session |
| GET | `/kyron/api/v1/chat/session/active` | Session | Get or create active session |
| GET | `/kyron/api/v1/chat/sessions` | Session | List all sessions (newest first) |
| GET | `/kyron/api/v1/chat/session/:id` | Session | Get session by ID with messages |
| POST | `/kyron/api/v1/chat/session/:id/message` | Session | Send message (SSE stream) |
| GET | `/kyron/api/v1/appointments` | Session | Get upcoming + past bookings |
| POST | `/kyron/api/v1/appointments/book` | Session | Book a slot directly |
| GET | `/kyron/api/v1/providers` | Session | List all providers |
| GET | `/kyron/api/v1/providers/:id/slots` | Session | Get available slots for provider |
| POST | `/kyron/api/v1/voice/handoff` | Session | Initiate outbound Vapi call |
| POST | `/webhook` | Bearer secret | Vapi webhook (assistant-request, end-of-call-report) |
| POST | `/voice/tools/getContext` | Bearer secret | Vapi server tool — patient context |
| POST | `/voice/tools/getProviders` | Bearer secret | Vapi server tool — provider list |
| POST | `/voice/tools/getAvailableSlots` | Bearer secret | Vapi server tool — slots by concern |
| POST | `/voice/tools/bookAppointment` | Bearer secret | Vapi server tool — book slot |
| POST | `/voice/tools/cancelAppointment` | Bearer secret | Vapi server tool — cancel booking |
| POST | `/voice/tools/rescheduleAppointment` | Bearer secret | Vapi server tool — reschedule booking |

Standard response shape:

```ts
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
  details?: unknown; // Zod validation errors
};
```

---

## Logging & Observability

- **Pino system logger** — structured JSON to `logs/system.dev.log`. Scoped per module via `getLogger("ModuleName")`.
- **HTTP access logger** — request/response pairs to `logs/http.dev.log`.
- **LangSmith** — all LangGraph agent runs are traced when `LANGCHAIN_TRACING_V2=true`. View at [smith.langchain.com](https://smith.langchain.com) under project `kyron-medical`.
- **Log level** — set via `LOG_LEVEL` env var (`debug`, `info`, `warn`, `error`).

---

## Deployment

Target: AWS EC2 t3.small, Ubuntu 22.04, Docker Compose + Nginx + Certbot.

```
Internet → Nginx (443/80) → Certbot TLS
                          → backend:8000   (/kyron/api/v1/*, /api/auth/*, /webhook, /voice/tools/*)
                          → frontend:3000  (static build, all other paths)
```

```bash
# On EC2:
docker compose -f docker-compose.prod.yaml up -d --build
certbot --nginx -d your-domain.com
```

- Set `NODE_ENV=production`, `ALLOWED_ORIGIN=https://your-domain.com`.
- Point Vapi webhook URL and server tool URLs to `https://your-domain.com/...`.
- Use `docker compose logs -f backend` for runtime log tailing.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Webhook 401 | Ensure `VAPI_WEBHOOK_SECRET` matches Vapi dashboard; check ngrok URL includes `/webhook` suffix |
| No agent responses | Verify `OPENAI_API_KEY` is set; check LangSmith for trace errors |
| Slots showing only one day | All existing slots are past — restart backend, `seedSlots` will re-seed automatically |
| Invite code rejected | Check `InviteCode` table — must be unused and unexpired |
| CORS errors | Update `ALLOWED_ORIGIN` in `backend/.env` |
| Emails not sending | Use Gmail App Password (not account password); check `SMTP_USER`/`SMTP_PASS` |
| Voice tools 401 | Confirm Vapi server tool header is set to `Authorization: Bearer <VAPI_WEBHOOK_SECRET>` |
| LangGraph checkpoint error on startup | Run `npx prisma migrate dev` — checkpoint tables may not exist |
