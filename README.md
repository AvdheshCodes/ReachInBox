# ReachInbox Email Job Scheduler Service & Ops Dashboard

A production-grade email job scheduling system and operations dashboard built for ReachInbox.ai outreach workflows. 

Designed for high reliability, zero cron dependencies, restart safety, distributed Redis-backed hourly rate limiting, and configurable inter-email concurrency.

---

## 🚀 Quick Start Guide

### 1. Infrastructure Setup (Docker Compose)
Start PostgreSQL and Redis services in background:
```bash
docker-compose up -d
```
Verify that container services are healthy:
- **PostgreSQL**: `localhost:5432` (`user: reachinbox`, `pass: reachinbox_password`, `db: reachinbox_db`)
- **Redis**: `localhost:6379`

---

### 2. Backend Setup & Run

Navigate to the `backend/` directory:
```bash
cd backend
npm install
```

Set up Environment Variables:
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Apply Prisma Database Migrations:
```bash
npm run prisma:push
```

Start Development Backend Server & Worker:
```bash
npm run dev
```
The backend API will start on **`http://localhost:5000`**.

---

### 3. Frontend Setup & Run

In a separate terminal, navigate to the `frontend/` directory:
```bash
cd frontend
npm install
```

Set up Environment Variables:
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Start Development Frontend Server:
```bash
npm run dev
```
The operations dashboard will start on **`http://localhost:3000`**.

---

## 📧 Ethereal Email SMTP Setup

This service uses [Ethereal Email](https://ethereal.email) as a fake SMTP service for testing email dispatches without sending real emails.
- **Automated Account Provisioning**: Upon backend startup, if no sender exists in the database, the backend automatically calls `nodemailer.createTestAccount()` to register an Ethereal SMTP account.
- **Ethereal Preview Links**: Every sent email stores its generated Ethereal test message preview URL in PostgreSQL. Clicking **"View Ethereal Mail"** in the Sent Emails tab opens the rendered test email directly in your browser.

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for Express API backend |
| `DATABASE_URL` | `postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db` | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `WORKER_CONCURRENCY` | `5` | BullMQ worker parallel job concurrency limit |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `2000` | Minimum throttle delay (ms) between consecutive sends |
| `MAX_EMAILS_PER_HOUR` | `200` | Global max emails allowed per hour window |
| `JWT_SECRET` | `reachinbox_jwt_secret_key_...` | Secret key for backend auth tokens |
| `GOOGLE_CLIENT_ID` | `your-google-client-id` | Google OAuth Client ID for token validation |

### Frontend (`frontend/.env.local`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth callback base URL |
| `NEXTAUTH_SECRET` | `reachinbox_nextauth_secret_key_...` | NextAuth session encryption key |
| `GOOGLE_CLIENT_ID` | `your-google-client-id` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `your-google-client-secret` | Google OAuth Client Secret |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:5000` | Express API endpoint URL |

---

## 🏗️ Architecture Overview

### 1. Scheduling Logic (Zero Cron)
- Scheduling is executed using **BullMQ delayed jobs** backed by Redis persistence.
- When an outreach campaign is submitted via API, the backend creates an `EmailSchedule` record and corresponding `EmailJob` rows in PostgreSQL.
- Each job is pushed into BullMQ using `queue.addBulk()` with `{ jobId: 'email_job_' + dbJobId, delay: targetTime - now }`.
- No cron jobs, crontab, node-cron, or agenda timers are used anywhere.

### 2. Restart Persistence & Idempotency
- **Persistence**: All delayed and pending jobs are stored in Redis data structures as well as PostgreSQL.
- **Startup Audit & Recovery**: On backend container restart, `syncPendingJobsOnRestart()` queries PostgreSQL for all `SCHEDULED` or `RESCHEDULED` jobs and verifies their presence in the BullMQ Redis queue. Any missing jobs are automatically re-enqueued with exact remaining delays.
- **Idempotency**: Unique BullMQ `jobId` parameters (`email_job_<id>`) and DB atomic state checks (`SCHEDULED` -> `PROCESSING` -> `SENT`) prevent double sending.

### 3. Hourly Rate Limiting & Concurrency
- **Concurrency**: BullMQ `Worker` is configured with `concurrency: WORKER_CONCURRENCY` (env driven).
- **Inter-Email Delay**: Worker enforces `MIN_DELAY_BETWEEN_EMAILS_MS` (e.g. 2000ms) before processing dispatches.
- **Hourly Rate Limiting**: The worker executes an atomic `INCR` on a Redis key (`rate_limit:{senderId}:{YYYY-MM-DD-HH}`).
- **Overflow Rescheduling**: If the count exceeds `hourlyLimit` (or `MAX_EMAILS_PER_HOUR`), the job is NOT failed or dropped. Instead, the worker calculates the exact time remaining until the next hour window (`nextHourStart`), updates the DB status to `RESCHEDULED`, and re-enqueues the job into BullMQ as a delayed job targeting the next hour window.

---

## 📊 Requirement to Feature Traceability Table

| PRD Requirement | Implementation Status | Implementation Details |
| :--- | :--- | :--- |
| **TS + Express Backend** | ✅ Implemented | `backend/src/index.ts`, Express routes, Controllers, Middlewares |
| **Relational Database** | ✅ Implemented | PostgreSQL + Prisma ORM (`User`, `Sender`, `EmailSchedule`, `EmailJob`) |
| **BullMQ + Redis Scheduler** | ✅ Implemented | BullMQ Queue (`emailQueue`) & Worker (`emailWorker`) backed by IORedis |
| **Fake SMTP (Ethereal)** | ✅ Implemented | `etherealService.ts` with auto-account registration & preview links |
| **Zero-Cron Constraint** | ✅ Implemented | Pure delayed job scheduling via BullMQ |
| **Restart Safety & Persistence** | ✅ Implemented | Redis queue persistence + Startup DB recovery audit sync |
| **Idempotency** | ✅ Implemented | Unique BullMQ job IDs + DB status checking |
| **Worker Concurrency** | ✅ Implemented | Configurable `WORKER_CONCURRENCY` env variable |
| **Inter-Email Delay** | ✅ Implemented | Configurable `MIN_DELAY_BETWEEN_EMAILS_MS` throttle |
| **Redis Hourly Rate Limiting** | ✅ Implemented | Distributed atomic Redis counter `INCR` keyed by hour window |
| **Limit Overflow Rescheduling** | ✅ Implemented | Jobs delayed to next hour window, preserving order without loss |
| **High Load (1000+ Emails)** | ✅ Implemented | Batch DB insertion + BullMQ `addBulk()` delayed job fanout |
| **Real Google OAuth Login** | ✅ Implemented | NextAuth.js Google OAuth provider + Express JWT session token |
| **Header User Profile & Logout**| ✅ Implemented | Top navbar showing name, email, avatar image, and sign-out button |
| **Main Dashboard & Layout** | ✅ Implemented | Figma-inspired dashboard layout with stats & tab views |
| **Compose New Email & File Upload**| ✅ Implemented | Modal form with CSV lead file parser regex & email counter |
| **Scheduled Emails Table** | ✅ Implemented | Table displaying scheduled queue with loading & empty states |
| **Sent Emails Table** | ✅ Implemented | Table displaying sent history with Ethereal preview URLs |
| **Docker Compose** | ✅ Implemented | `docker-compose.yml` for PostgreSQL and Redis services |

---

## 📝 Assumptions, Shortcuts & Trade-offs

1. **Ethereal Account Generation**: If no custom SMTP credentials are provided in `.env`, the server automatically creates a free Ethereal Email test account at boot time.
2. **NextAuth Session Synchronization**: NextAuth handles client-side Google OAuth login, while a lightweight JWT is minted by Express for API requests. A Quick Demo login option is also provided for instant local testing without setting up Google Cloud Console credentials.
3. **Rate Limit Window Keying**: Hour windows are calculated based on UTC hours (`rate_limit:{senderId}:{YYYY-MM-DD-HH}`) with a 2-hour TTL for auto-cleanup.
