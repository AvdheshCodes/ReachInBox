import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { connectDB, prisma } from './db/client';
import { getIsRedisConnected } from './config/redis';
import { initEmailWorker } from './queues/emailWorker';
import { emailQueue } from './queues/emailQueue';
import { getOrCreateDefaultSender } from './controllers/emailController';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';

const app = express();

// Allow any origin in dev for local testing
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: getIsRedisConnected() ? 'connected' : 'disconnected (using in-memory fallback)',
    workerConcurrency: env.WORKER_CONCURRENCY,
    minDelayMs: env.MIN_DELAY_BETWEEN_EMAILS_MS,
    maxEmailsPerHour: env.MAX_EMAILS_PER_HOUR,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

async function startServer() {
  console.log('[Bootstrap] Starting ReachInbox Backend Service...');

  // 1. Database Connection
  await connectDB();

  // 2. Start Express HTTP Server immediately
  const server = app.listen(env.PORT, () => {
    console.log(`[Express] Backend server running on http://localhost:${env.PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Express] Port ${env.PORT} is already in use. Kill the other process or change PORT in .env`);
      process.exit(1);
    }
    throw err;
  });

  // 3. Initialize Default Ethereal Sender (background, non-blocking)
  getOrCreateDefaultSender().catch((err) => {
    console.warn('[Sender] Will create sender on first schedule request:', err.message);
  });

  // 4. Initialize Worker (DB ticker + optional BullMQ worker)
  initEmailWorker();

  // 5. Recovery sync (background, non-blocking)
  syncPendingJobsOnRestart().catch((err) => {
    console.warn('[Recovery] Sync skipped:', err.message);
  });
}

async function syncPendingJobsOnRestart() {
  console.log('[Recovery] Auditing DB jobs for restart safety...');
  const pendingJobs = await prisma.emailJob.findMany({
    where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
    include: { schedule: { include: { sender: true } } },
  });

  console.log(`[Recovery] Found ${pendingJobs.length} pending/scheduled jobs in DB.`);

  if (!getIsRedisConnected()) {
    console.log('[Recovery] Redis offline — DB ticker will pick up pending jobs automatically.');
    return;
  }

  let reEnqueuedCount = 0;
  for (const job of pendingJobs) {
    const bullJobId = `email_job_${job.id}`;
    try {
      const existingBullJob = await emailQueue.getJob(bullJobId);
      if (!existingBullJob) {
        const delay = Math.max(0, job.scheduledAt.getTime() - Date.now());
        await emailQueue.add(
          'send-email',
          {
            jobId: job.id,
            scheduleId: job.scheduleId,
            senderId: job.schedule.senderId,
            recipient: job.recipient,
            subject: job.subject,
            body: job.body,
            scheduledAt: job.scheduledAt.toISOString(),
            minDelayMs: job.schedule.minDelayMs,
            hourlyLimit: job.schedule.hourlyLimit,
          },
          { jobId: bullJobId, delay }
        );
        reEnqueuedCount++;
      }
    } catch {
      // Redis call failed, skip this job (DB ticker will handle it)
    }
  }

  console.log(`[Recovery] Re-enqueued ${reEnqueuedCount} missing jobs into BullMQ.`);
}

startServer();
