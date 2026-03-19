# CLAUDE.md — Westside Medical Group Patient Portal

This file is the source of truth for AI-assisted development on this project.
Read it fully before writing any code.

---

## Project Overview

A full-stack AI-powered patient portal repurposed from the prior voice agent codebase. Patients interact with an AI assistant (Aria) via web chat or phone call to schedule appointments, ask about prescription refills, and get practice info. The AI is strictly non-clinical.

**Deadline: Thursday March 19, 8:00 PM ET**

---

## Repository Layout

```
Echo/
├── backend/
│   ├── src/
│   │   ├── clients/         # prismaClient.ts, vapiClient.ts
│   │   ├── config/          # env.ts, logger.ts, systemPrompt.ts (voice), voiceSystemPrompt.ts
│   │   ├── controllers/     # authController, patientController, chatController,
│   │   │                    # appointmentController, providerController, voiceController, webhookController
│   │   ├── middleware/       # setupMiddleware.ts, httpLoggerMiddleware.ts
│   │   ├── routes/          # authRoute, patientRoute, chatRoute, appointmentRoute,
│   │   │                    # providerRoute, voiceRoute, webhookRoute
│   │   ├── scripts/         # seedProviders.ts, seedSlots.ts, generateInviteCode.ts
│   │   ├── services/
│   │   │   └── agent/       # prismaMessageHistory.ts, tools.ts, systemPrompt.ts, agentService.ts
│   │   ├── services/        # vapiService.ts, emailService.ts
│   │   ├── types/           # shared TypeScript types
│   │   ├── utils/           # auth.ts (Better Auth), emailVerification.ts, normalizePhone.ts
│   │   └── validators/      # authSchema, patientSchema, appointmentSchema, providerSchema
│   ├── prisma/
│   │   └── schema.prisma
│   └── server.ts
└── frontend/kyron-medical/
    └── src/
        ├── api/             # auth.ts, patient.ts, appointments.ts, providers.ts, chat.ts
        ├── clients/         # authClient.ts, axiosClient.ts
        ├── components/
        │   ├── appointments/ # AppointmentCard.tsx, AppointmentPanel.tsx
        │   ├── chat/        # ChatPanel.tsx, ChatMessage.tsx, TypingIndicator.tsx, ToolCallIndicator.tsx
        │   └── layout/      # Navbar.tsx
        ├── context/         # AuthProvider.tsx, useAuth.ts
        ├── pages/           # DashboardPage.tsx, LoginPage.tsx, RegistrationPage.tsx,
        │                    # ForgotPasswordPage.tsx, ResetPasswordPage.tsx
        ├── routes/          # ProtectedRoute.tsx
        └── styles/          # globals.css, glass.css
```

---

## API Routes Reference

All application routes: **`/kyron/api/v1/*`**
Better Auth routes: **`/api/auth/*`** (handled by Better Auth, not custom controllers)
Webhook: **`/webhook`** (no auth middleware, uses its own bearer check)

| Method | Path | Controller |
|--------|------|------------|
| POST | `/kyron/api/v1/auth/validate-invite` | authController.validateInvite |
| POST | `/kyron/api/v1/auth/signup` | authController.signup |
| GET | `/kyron/api/v1/patient/profile` | patientController.getProfile |
| PUT | `/kyron/api/v1/patient/profile` | patientController.updateProfile |
| POST | `/kyron/api/v1/chat/session` | chatController.createSession |
| GET | `/kyron/api/v1/chat/session/active` | chatController.getActiveSession |
| GET | `/kyron/api/v1/chat/session/:id` | chatController.getSession |
| POST | `/kyron/api/v1/chat/session/:id/message` | chatController.sendMessage (SSE) |
| GET | `/kyron/api/v1/appointments` | appointmentController.getAppointments |
| POST | `/kyron/api/v1/appointments/book` | appointmentController.bookAppointment |
| GET | `/kyron/api/v1/providers` | providerController.getProviders |
| GET | `/kyron/api/v1/providers/:id/slots` | providerController.getSlots |
| POST | `/kyron/api/v1/voice/handoff` | voiceController.handoff |
| POST | `/webhook` | webhookController.handle |

---

## Database (PostgreSQL + Prisma)

Single datastore — no MongoDB. Schema lives in `backend/prisma/schema.prisma`.

### Better Auth tables (auto-managed, do not touch)
`user`, `session`, `account`, `verification`, `rateLimit`

### Application tables

```prisma
model InviteCode {
  id        String    @id @default(cuid())
  code      String    @unique
  maxUses   Int       @default(1)
  usedCount Int       @default(0)
  createdAt DateTime  @default(now())
  expiresAt DateTime?
  createdBy String?
}

model Patient {
  id              String   @id @default(cuid())
  userId          String   @unique   // FK → Better Auth user.id
  firstName       String
  lastName        String
  dateOfBirth     String             // ISO date: YYYY-MM-DD
  phone           String             // E.164 format e.g. +14155550123
  profileComplete Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Provider {
  id        String   @id @default(cuid())
  name      String
  specialty String
  keywords  String[]
  bio       String?
  slots     Slot[]
  bookings  Booking[]
  createdAt DateTime @default(now())
}

model Slot {
  id         String   @id @default(cuid())
  providerId String
  provider   Provider @relation(fields: [providerId], references: [id])
  startTime  DateTime
  endTime    DateTime
  available  Boolean  @default(true)
  booking    Booking?
  createdAt  DateTime @default(now())
}

model Booking {
  id         String   @id @default(cuid())
  patientId  String             // FK → Patient.id
  providerId String
  provider   Provider @relation(fields: [providerId], references: [id])
  slotId     String   @unique
  slot       Slot     @relation(fields: [slotId], references: [id])
  status     String   @default("confirmed")
  createdAt  DateTime @default(now())
}

model ChatSession {
  id        String        @id @default(cuid())
  userId    String              // FK → Better Auth user.id
  messages  ChatMessage[]
  active    Boolean       @default(true)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

model ChatMessage {
  id        String      @id @default(cuid())
  sessionId String
  session   ChatSession @relation(fields: [sessionId], references: [id])
  role      String      // "user" | "assistant" | "tool"
  content   String
  toolName  String?     // only for tool call/result messages
  createdAt DateTime    @default(now())
}

model VapiAssistant {
  id              String   @id @default(cuid())
  vapiAssistantId String   @unique          // Vapi platform assistant ID
  phoneNumberId   String                    // Vapi phone number ID for outbound calls
  name            String                    // e.g. "Aria"
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model VoiceCall {
  id              String   @id @default(cuid())
  vapiCallId      String   @unique          // Vapi's call ID
  patientId       String                    // FK → Patient.id
  chatSessionId   String?                   // FK → ChatSession.id (null for inbound cold calls)
  phone           String                    // E.164 patient phone number
  direction       String                    // "outbound" | "inbound"
  status          String   @default("initiated") // "initiated" | "ended" | "failed"
  endedReason     String?                   // from Vapi end-of-call-report
  durationSeconds Int?                      // call duration in seconds
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Migrations
```bash
cd backend
npx prisma migrate dev --name <description>
npx prisma generate          # regenerate client after schema change
npx prisma studio            # inspect data in browser
```

---

## Better Auth (from local docs)

### Server setup — `backend/src/utils/auth.ts`

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../clients/prismaClient";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // call Nodemailer here — do NOT await (timing attack prevention)
      void sendVerificationEmail(user.email, url);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,      // 7 days
    updateAge: 60 * 60 * 24,           // refresh expiry daily
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    storage: "database",               // persisted in rateLimit table
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/sign-up/email": { window: 10, max: 3 },
    },
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "cf-connecting-ip"],
    },
  },
});
```

### Express handler — mount in `server.ts` or `setupMiddleware.ts`

```typescript
import { toNodeHandler } from "better-auth/node";

app.all("/api/auth/*", toNodeHandler(auth));
```

### Getting session in a controller (server-side)

```typescript
import { auth } from "../utils/auth";
import { fromNodeHeaders } from "better-auth/node";

const session = await auth.api.getSession({
  headers: fromNodeHeaders(req.headers),
});
if (!session) return res.status(401).json({ success: false, error: "Unauthorized" });
const userId = session.user.id;
```

### Key Better Auth behaviours
- `requireEmailVerification: true` → login blocked until email verified, 403 returned
- Rate limiting is **disabled in development** by default; set `enabled: true` to force it
- `rateLimit.storage: "database"` requires the `rateLimit` table — created by Prisma schema
- Do NOT await email sends in Better Auth callbacks (timing attack vector)
- Better Auth manages its own tables. Never manually query `user`, `session`, `account`, `verification` from app code — go through `auth.api.*` or `auth.handler`

---

## LangChain Agent

### Packages
```bash
npm install langchain @langchain/openai @langchain/core @langchain/langgraph-checkpoint-postgres
# @langchain/langgraph is bundled with langchain — no separate install needed
```

### Architecture: dual persistence
- **PostgresSaver** (LangGraph checkpointer) → persists agent state for conversation resumption (`thread_id = sessionId`)
- **ChatMessage table** (Prisma) → populated as side effect during streaming, used for frontend display + voice handoff transcript

### Agent setup

```typescript
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { z } from "zod";

// Checkpointer — persists agent state in Postgres
const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
await checkpointer.setup(); // creates LangGraph tables (idempotent)

// Model
const model = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.3,
});

// Agent
const agent = createAgent({
  model,
  tools: [getProvidersTool, getAvailableSlotsTool, bookAppointmentTool, updatePatientProfileTool],
  checkpointer,
});
```

### Tools (tool() with Zod)

```typescript
import { tool } from "langchain";
import { z } from "zod";

const getProvidersTool = tool(
  async () => {
    const providers = await prisma.provider.findMany();
    return JSON.stringify(providers);
  },
  {
    name: "get_providers",
    description: "Get all available providers and their specialties. Use this to semantically match a patient's concern to the right provider. Never show provider list directly to the patient.",
    schema: z.object({}),
  }
);

const getAvailableSlotsTool = tool(
  async ({ providerId, dayOfWeek, timeOfDay, limit }) => {
    // query slots logic
  },
  {
    name: "get_available_slots",
    description: "Get available appointment slots for a provider within the next 30-60 days.",
    schema: z.object({
      providerId: z.string().describe("The provider's ID from get_providers"),
      dayOfWeek: z.enum(["monday","tuesday","wednesday","thursday","friday"]).optional(),
      timeOfDay: z.enum(["morning","afternoon"]).optional().describe("morning=9AM-12PM, afternoon=12PM-5PM"),
      limit: z.number().optional().default(5),
    }),
  }
);

const bookAppointmentTool = tool(
  async ({ slotId }) => {
    // booking + email logic (Prisma transaction)
  },
  {
    name: "book_appointment",
    description: "Book a slot for the current patient. Only call this after the patient has explicitly confirmed the slot. Atomically marks slot unavailable and sends confirmation email.",
    schema: z.object({
      slotId: z.string().describe("The slot ID to book"),
    }),
  }
);

const updatePatientProfileTool = tool(
  async ({ firstName, lastName, dateOfBirth, phone }) => {
    // upsert Patient record
  },
  {
    name: "update_patient_profile",
    description: "Save the patient's profile after collecting and confirming firstName, lastName, dateOfBirth, phone.",
    schema: z.object({
      firstName: z.string(),
      lastName: z.string(),
      dateOfBirth: z.string().describe("ISO date YYYY-MM-DD"),
      phone: z.string().describe("E.164 format e.g. +14155550123"),
    }),
  }
);
```

### Dynamic system prompt (middleware)

```typescript
import { createAgent, dynamicSystemPromptMiddleware } from "langchain";

const agent = createAgent({
  model,
  tools,
  checkpointer,
  middleware: [
    dynamicSystemPromptMiddleware((state, runtime) => {
      return buildSystemPrompt(runtime.context);
    }),
  ],
});
```

### Streaming from the agent (SSE controller)

```typescript
// In chatController.sendMessage:
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

const writeSSE = (event: string, data: object) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

// Save user message to ChatMessage table
await prisma.chatMessage.create({
  data: { sessionId, role: "user", content: userMessage },
});

let fullResponse = "";
let bookingCreated = false;
let booking = null;

// Stream with multiple modes: tokens + step updates
for await (const [mode, chunk] of await agent.stream(
  { messages: [{ role: "user", content: userMessage }] },
  {
    configurable: { thread_id: sessionId },
    context: patientContext,
    streamMode: ["messages", "updates"],
  }
)) {
  if (mode === "messages") {
    const [token, metadata] = chunk;
    if (metadata.langgraph_node === "model" && token.content) {
      const text = typeof token.content === "string" ? token.content : "";
      if (text) {
        fullResponse += text;
        writeSSE("chunk", { text });
      }
    }
  }
  if (mode === "updates") {
    const [step] = Object.entries(chunk);
    if (step === "tools") {
      writeSSE("tool_call", { tool: "executing", status: "running" });
    }
  }
}

// Save assistant response to ChatMessage table
if (fullResponse) {
  await prisma.chatMessage.create({
    data: { sessionId, role: "assistant", content: fullResponse },
  });
}

writeSSE("done", { bookingCreated, booking });
res.end();

// Handle client disconnect
req.on("close", () => res.end());
```

### Key LangChain patterns
- `createAgent()` replaces `createToolCallingAgent` + `AgentExecutor` + `RunnableWithMessageHistory`
- `tool()` replaces `DynamicStructuredTool` — Zod schemas are still used identically
- `dynamicSystemPromptMiddleware` replaces `ChatPromptTemplate` + `MessagesPlaceholder`
- `agent.stream({ streamMode: ["messages", "updates"] })` replaces `streamEvents("v2")`
- `PostgresSaver` handles agent state resumption via `thread_id`; `ChatMessage` table is populated as a side effect for frontend + voice
- Tool functions must return a `string` (serialize objects with `JSON.stringify`)
- Temperature 0.3 for medical context — keeps responses predictable and consistent
- `checkpointer.setup()` is idempotent — safe to call on every server start

---

## Static Seed Data

Seeded at startup via `scripts/seedProviders.ts` and `scripts/seedSlots.ts`.
Both scripts are idempotent (skip if data already exists).

### Providers

| Name | Specialty | Keywords |
|------|-----------|----------|
| Dr. Sarah Chen | Orthopedics | knee, joint, bone, fracture, back, spine, shoulder, hip, wrist, ankle, sports injury, arthritis |
| Dr. James Okafor | Cardiology | heart, chest, chest pain, palpitations, blood pressure, cardiovascular, shortness of breath |
| Dr. Priya Nair | Dermatology | skin, rash, acne, mole, eczema, psoriasis, hair, nail, wound, lesion |
| Dr. Michael Torres | Gastroenterology | stomach, gut, bowel, digestion, acid reflux, IBS, Crohn's, colonoscopy, liver, abdominal |
| Dr. Emily Hoffman | Neurology | brain, headache, migraine, nerve, numbness, tingling, dizziness, seizure, memory, stroke |

### Slots
- 3–4 slots per provider per week, weekdays only (Mon–Fri), 9AM–4PM, 30-min duration
- Window: today + 30 days → today + 60 days

---

## AI System Prompt Rules

The system prompt is built dynamically per session. It must always include:

1. **Identity**: "You are Aria, the AI assistant for Westside Medical Group."
2. **Practice info** (hardcoded static):
   - Address: 123 Westside Blvd, Suite 400, Los Angeles, CA 90025
   - Phone: (310) 555-0100
   - Hours: Monday–Friday, 8:00 AM – 6:00 PM
3. **Patient context**: injected per session (name, profileComplete status, upcoming bookings)
4. **Safety guardrails** (non-negotiable, must appear verbatim):
   - Never diagnose, interpret symptoms, or rule out conditions
   - Never recommend, adjust, or comment on medications or dosages
   - Never provide clinical advice of any kind
   - If asked anything medical/clinical → decline clearly, direct to their provider
5. **Profile gate**: if `profileComplete = false`, collect firstName, lastName, DOB, phone FIRST before any other workflow. Confirm before calling `update_patient_profile`.
6. **Scheduling**: semantically match concern to provider; never name-drop or let patient pick a doctor; confirm slot before calling `book_appointment`; summarize after booking.
7. **Rx refill**: acknowledge, explain general process, collect medication name, direct to provider/pharmacy. No approvals or clinical comments.

---

## Voice Handoff (Vapi)

### Outbound call (patient clicks "Call Me")

```typescript
// vapiService.ts
import { VapiClient } from "@vapi-ai/server-sdk";
const vapi = new VapiClient({ token: process.env.VAPI_API_KEY });

export async function initiateHandoffCall({ phone, patientName, transcript }: HandoffParams) {
  return vapi.calls.create({
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: { number: phone },
    assistantId: process.env.VAPI_ASSISTANT_ID,
    assistantOverrides: {
      firstMessage: `Hi ${patientName}, it's Aria from Westside Medical. I can see we were just chatting — let's pick up right where we left off.`,
      variableValues: {
        patientName,
        chatContext: transcript,  // serialized [User]/[Aria] transcript
      },
    },
  });
}
```

### Inbound call (Vapi webhook `assistant-request`)

```typescript
// webhookController.ts
const callerPhone = payload.message.call.customer.number;  // E.164
const patient = await prisma.patient.findFirst({ where: { phone: callerPhone } });

if (patient) {
  const session = await prisma.chatSession.findFirst({
    where: { userId: patient.userId, active: true },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  // return assistant override with context
} else {
  // return fresh-start assistant override
}
```

### Webhook authentication
```typescript
const secret = req.headers["authorization"]?.replace("Bearer ", "");
if (secret !== process.env.VAPI_WEBHOOK_SECRET) {
  return res.status(401).json({ error: "Unauthorized" });
}
```

---

## Email (Nodemailer)

Reuse the existing Nodemailer transporter from `utils/emailVerification.ts`.

### Booking confirmation template
- **Subject**: `Your appointment is confirmed — Westside Medical Group`
- **Fields**: patientName, providerName, specialty, formatted date/time, practice address
- Do NOT await in the booking controller — fire and forget, log errors separately

```typescript
// emailService.ts
export async function sendBookingConfirmation(params: BookingEmailParams) {
  const { to, patientName, providerName, specialty, dateTime, address } = params;
  // use existing transporter, do not create a new one
  void transporter.sendMail({
    from: `"Westside Medical Group" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your appointment is confirmed — Westside Medical Group",
    html: bookingEmailTemplate(params),
  });
}
```

---

## Frontend SSE Consumption

```typescript
// api/chat.ts
export async function* sendMessage(sessionId: string, content: string) {
  const response = await fetch(`/kyron/api/v1/chat/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    credentials: "include",
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const data = JSON.parse(line.slice(5).trim());
        yield { event: "chunk", data };
      }
      if (line.startsWith("event:")) {
        // parse event type for next data line
      }
    }
  }
}
```

Use `EventSource` only for GET endpoints. For POST+SSE (our case), use `fetch` + `ReadableStream` as above.

---

## UI — Liquid Glass + Westside Medical Group

### CSS Variables (`styles/globals.css`)
```css
:root {
  --navy:        #0A1628;
  --navy-mid:    #0D1F3C;
  --blue:        #2563EB;
  --blue-light:  #3B82F6;
  --glass-bg:    rgba(255, 255, 255, 0.07);
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-blur:  20px;
  --text-primary: #F0F4FF;
  --text-muted:  rgba(240, 244, 255, 0.55);
}
```

### Glass panel class (`styles/glass.css`)
```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: 16px;
}
```

### GSAP animations
```typescript
import gsap from "gsap";

// Panel entrance
gsap.fromTo(panelRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });

// Stagger appointment cards
gsap.fromTo(cards, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.4 });

// Call Me button pulse
gsap.to(btnRef.current, { scale: 1.04, repeat: -1, yoyo: true, duration: 1.2, ease: "sine.inOut" });
```

---

## Environment Variables

### Backend (`backend/.env`)
```ini
PORT=8000
NODE_ENV=development

# PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/kyron_medical"

# Better Auth
BETTER_AUTH_SECRET="replace-with-64-char-secret"
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
SMTP_USER="..."
SMTP_PASS="..."

# CORS
ALLOWED_ORIGIN="http://localhost:3000"

# Logging
LOG_LEVEL=debug
LOG_TO_FILE=true
LOG_DIR="./logs"
```

### Frontend (`frontend/kyron-medical/.env`)
```ini
VITE_API_BASE_URL="http://localhost:8000/kyron/api/v1"
VITE_SERVER_BASE_URL="http://localhost:8000/api/auth"
```

---

## Common Patterns

### Standard API response shape
```typescript
type ApiResponse<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  count?: number;
  details?: unknown;  // Zod validation errors
};
```

### Auth session extraction (use this in every protected controller)
```typescript
import { auth } from "../utils/auth";
import { fromNodeHeaders } from "better-auth/node";

const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
if (!session) return res.status(401).json({ success: false, error: "Unauthorized" });
```

### Phone number normalisation
```typescript
import { normalizePhone } from "../utils/normalizePhone";
const e164 = normalizePhone(rawPhone); // always store/compare in E.164
```

### Prisma transaction (use for booking to prevent double-booking)
```typescript
const result = await prisma.$transaction(async (tx) => {
  const slot = await tx.slot.findUnique({ where: { id: slotId } });
  if (!slot || !slot.available) throw new Error("SLOT_UNAVAILABLE");
  await tx.slot.update({ where: { id: slotId }, data: { available: false } });
  return tx.booking.create({ data: { ... } });
});
```

---

## Deployment (AWS EC2)

- **Instance**: t3.small, Ubuntu 22.04
- **Stack**: Docker Compose → Nginx → Certbot (Let's Encrypt)
- **Nginx**: serves React static build on 80/443; proxies `/kyron/api/v1/*`, `/api/auth/*`, `/webhook` → `backend:8000`
- **SSL**: Certbot auto-renew, certs volume-mounted into Nginx container
- HTTP redirects to HTTPS enforced in `nginx.conf`

---

## What Was Removed from Echo

The following were deleted when repurposing from the real-estate agent:
- MongoDB client and all mongo services
- `callService.ts`, `mongoService.ts`
- `callController.ts`, `agentRoute.ts`
- `callSchema.ts`, `agentTypes.ts`
- Real estate `systemPrompt.ts`, `structuredOutput.ts`
- Frontend: `MakeCallForm`, `LogsPage`, `Dashboard` (calls), `CallSummary`, `CallsTable`, `CallLogs`, `ChartsSection`
- `api/agent.ts` frontend API file
- Invite code requirement is **kept** for signup

---

## Key Constraints / Non-Negotiables

- The AI must NEVER provide medical advice, diagnoses, or dosage info — enforce in both system prompt and safety tests
- Slots marked booked must NEVER appear as available — use Prisma transactions
- Voice handoff must preserve ALL chat context — serialize full message history before Vapi call
- Patient profile must be complete before any workflow starts — check `profileComplete` at the top of every agent run
- Booking confirmation email must fire on every successful booking — do not gate on any condition
- `POST /webhook` must NOT have session auth middleware — it authenticates itself via Bearer secret
