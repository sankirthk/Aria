# Westside Medical Group Demo Architecture

## Application Architecture

The system is split into:

- `kyron-medical/frontend/kyron-medical`: Vite/React patient UI
- `kyron-medical/backend`: Express API, Better Auth, Prisma, LangGraph agent, Vapi integration
- PostgreSQL: primary relational datastore

Core backend subsystems:

- `auth`: Better Auth for invite-code signup, email verification, session management, and password reset
- `patient/profile`: encrypted patient record storage plus deterministic `phoneHash` lookup
- `chat`: LangGraph-backed AI scheduling assistant with SSE streaming and persisted sessions/messages
- `voice`: Vapi outbound handoff, inbound webhook handling, and server tools
- `email`: Nodemailer-based transactional email service

## Runtime Flows

### Chat

1. User authenticates and opens the dashboard.
2. Frontend resumes the active chat session or creates one.
3. User sends a message over the SSE endpoint.
4. Backend streams agent output and tool activity.
5. Agent tools read and write appointments, profile data, and provider availability.

### Outbound Voice

1. User requests a callback from chat.
2. Backend serializes the active chat transcript.
3. Backend builds `patientContext` from patient profile and upcoming bookings.
4. Backend creates the Vapi outbound call with injected `patientContext` and `chatContext`.

### Inbound Voice

1. Vapi sends `assistant-request`.
2. Backend reads `message.call.customer.number`.
3. Backend hashes the normalized phone and looks up the patient.
4. If found, backend injects patient name and active chat summary/transcript.
5. If not found, the call starts as a fresh intake flow.

### Voice Tools

- All tool responses return `results[].toolCallId`.
- Tool auth uses `Bearer <VAPI_WEBHOOK_SECRET>`.
- `bookAppointment` can create a patient on the fly for cold callers if the assistant supplies intake fields.
- Voice slot lookup can resolve by `concern`, `providerName`, or `specialty`.

## Data Model Notes

Key application tables:

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

Better Auth owns its own auth tables separately.

## Scheduling Rules

- Slot seed window is roughly 30 to 60 days ahead.
- All weekday, month, and time-of-day filtering is evaluated in `America/Los_Angeles`.
- Concern-based provider matching uses provider keywords and specialty-name bonuses.

## Security And Privacy

- Sensitive fields are encrypted with Prisma field encryption.
- Queryable inbound phone lookup uses `phoneHash` because encrypted phone values are not searchable.
- Auth cookies and Better Auth trusted origins are configured centrally.

## Deployment Architecture

Production deployment targets AWS and is infrastructure-as-code driven with Terraform.

### Platform Choice

- Backend: AWS Elastic Beanstalk using the Docker platform
- Database: Amazon RDS for PostgreSQL
- Frontend: private S3 bucket behind CloudFront
- CI/CD: GitHub Actions using AWS OIDC

### Infrastructure Layout

The Terraform layout is:

```text
infrastructure/
├── providers.tf
├── main.tf
├── variables.tf
├── outputs.tf
├── terraform.tfvars.example
└── modules/
    ├── vpc/
    ├── iam/
    ├── rds/
    ├── elastic_beanstalk/
    └── frontend/
```

### Network Topology

- VPC CIDR: `10.0.0.0/16`
- 2 public subnets for ALB and NAT gateways
- 2 private subnets for RDS
- Internet Gateway plus 2 NAT Gateways

Security groups:

- `sg_alb`: inbound `80/443` from the internet
- `sg_eb`: inbound `8000` from `sg_alb` only
- `sg_rds`: inbound `5432` from `sg_eb` only

### Elastic Beanstalk

- Platform: Docker on 64bit Amazon Linux 2023
- ALB in public subnets
- EC2 instances in public subnets for low-cost demo deployment
- Environment settings:
  - instance type `t3.small`
  - autoscaling min `2`, max `4`
  - rolling updates with health-based deployment
- `DATABASE_URL` is injected as an Elastic Beanstalk environment variable
- Other secrets are read at runtime from SSM Parameter Store

### RDS

- PostgreSQL 17
- instance class `db.t3.micro`
- 20GB `gp3`
- `multi_az = true`
- `publicly_accessible = false`
- `deletion_protection = true`

### Frontend Hosting

- Private S3 bucket with all public access blocked
- CloudFront in front of S3 using Origin Access Control
- SPA routing via `403/404 -> /index.html -> 200`
- `PriceClass_100`

### IAM And CI/CD

- Elastic Beanstalk instance role includes:
  - `AWSElasticBeanstalkWebTier`
  - `AWSElasticBeanstalkMulticontainerDocker`
  - `CloudWatchAgentServerPolicy`
  - scoped `ssm:GetParameter` access on `/kyron/*`
- GitHub Actions uses AWS OIDC
- GitHub Actions role is scoped to the specific repo and `main` branch

Deployment workflows:

- `deploy-backend.yml`
  - packages backend source bundle
  - uploads artifact to S3
  - creates a new Elastic Beanstalk application version
  - updates the environment
  - waits for green health
- `deploy-frontend.yml`
  - builds Vite app
  - syncs `dist/` to S3
  - invalidates CloudFront

### Secrets Flow

Secrets are pre-created manually in SSM Parameter Store under `/kyron/*`.

Examples:

- `/kyron/db/username`
- `/kyron/db/password`
- `/kyron/app/better_auth_secret`
- `/kyron/app/openai_api_key`
- `/kyron/app/vapi_api_key`
- `/kyron/app/vapi_phone_number_id`
- `/kyron/app/vapi_assistant_id`
- `/kyron/app/vapi_webhook_secret`
- `/kyron/app/smtp_user`
- `/kyron/app/smtp_pass`
- `/kyron/app/field_encryption_key`

At runtime, the backend reads SSM parameters and hydrates `process.env`.

### Application Changes Required For AWS

- `kyron-medical/backend/entrypoint.sh`
  - replace Docker-hostname-specific DB readiness check
  - parse the RDS hostname from `DATABASE_URL` before calling `nc -z`
- `kyron-medical/backend/.ebextensions/01_platform.config`
  - configure nginx reverse proxy from port `80` to container port `8000`
  - set ALB health check path to `/health`
  - configure Docker/CloudWatch log streaming

### First-Time Setup Order

#### Phase 0: Bootstrap

1. Create S3 bucket for Terraform remote state.
2. Create DynamoDB table for Terraform locking.
3. Create required SSM parameters.
4. Configure Terraform backend settings in `providers.tf`.

#### Phase 1: Plan

1. Run `terraform init`.
2. Run `terraform plan`.
3. Review all resources and dependency ordering.

#### Phase 2: Apply

Terraform provisions, in effect:

1. VPC, subnets, NAT, route tables, and security groups
2. S3 buckets
3. CloudFront distribution
4. IAM roles, OIDC provider, and instance profile
5. RDS PostgreSQL
6. Elastic Beanstalk application and environment

#### Phase 3: Post-Apply

1. Capture Terraform outputs.
2. Set GitHub Actions variables.
3. Trigger backend deployment.
4. Trigger frontend deployment.
5. Verify frontend, API, auth, and database connectivity.

## Verification Checklist

- Terraform plans are idempotent on re-run.
- Elastic Beanstalk environment reaches `Green`.
- `GET /health` returns `200`.
- Prisma migrations succeed against RDS.
- CloudFront serves the React SPA.
- Auth flow works end-to-end.
- SSM parameter fetch succeeds on the running backend.

## Current Simplifications

- No staff/admin portal yet
- No waitlist yet
- No SMS consent flow
- No transcript storage in chat for voice calls
- No multi-tenant practice support
