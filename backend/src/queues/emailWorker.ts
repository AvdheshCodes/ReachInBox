import { Worker, Job } from 'bullmq';
import { redisConnection, getIsRedisConnected } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from './emailQueue';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { checkAndIncrementRateLimit } from '../services/rateLimiterService';
import { sendEtherealEmail } from '../services/etherealService';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function initEmailWorker() {
  // 1. Initialize BullMQ Worker
  try {
    const worker = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        await processSingleEmailJob(job.data.jobId, job.data);
      },
      {
        connection: redisConnection,
        concurrency: env.WORKER_CONCURRENCY,
      }
    );

    worker.on('completed', (job) => {
      console.log(`[BullMQ Worker] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[BullMQ Worker] Job ${job?.id} failed with error: ${err.message}`);
    });

    console.log(`[BullMQ] Initialized Worker with concurrency: ${env.WORKER_CONCURRENCY}`);
  } catch (err: any) {
    console.warn(`[BullMQ] BullMQ Worker initialization note: ${err.message}`);
  }

  // 2. Continuous DB Queue Scheduler Ticker (Fallback & Continuous Processing)
  startDatabaseSchedulerTicker();
}

// Single Email Dispatch Processor
async function processSingleEmailJob(jobId: string, customData?: Partial<EmailJobData>) {
  console.log(`[Worker] Processing Job ID: ${jobId}`);

  // 1. Idempotency & DB Lookup
  const dbJob = await prisma.emailJob.findUnique({
    where: { id: jobId },
    include: { schedule: { include: { sender: true } } },
  });

  if (!dbJob) {
    console.warn(`[Worker] Job ${jobId} not found in database. Skipping.`);
    return;
  }

  if (dbJob.status === 'SENT') {
    console.log(`[Worker] Job ${jobId} already SENT. Skipping duplicate execution.`);
    return;
  }

  // 2. Inter-Email Minimum Delay Throttling
  const effectiveDelay = customData?.minDelayMs ?? dbJob.schedule.minDelayMs ?? env.MIN_DELAY_BETWEEN_EMAILS_MS;
  if (effectiveDelay > 0) {
    console.log(`[Worker] Applying inter-email minimum delay of ${effectiveDelay}ms`);
    await sleep(effectiveDelay);
  }

  // 3. Hourly Rate Limit Verification
  const senderId = dbJob.schedule.senderId;
  const effectiveHourlyLimit = customData?.hourlyLimit ?? dbJob.schedule.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR;
  const rateCheck = await checkAndIncrementRateLimit(senderId, effectiveHourlyLimit);

  if (!rateCheck.allowed) {
    const rescheduleTime = new Date(Date.now() + rateCheck.msUntilNextWindow);
    console.warn(
      `[Worker] Hourly rate limit reached for sender ${senderId} (${effectiveHourlyLimit}/hr). Rescheduling job ${jobId} in ${Math.round(rateCheck.msUntilNextWindow / 1000)}s at ${rescheduleTime.toISOString()}`
    );

    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'RESCHEDULED',
        scheduledAt: rescheduleTime,
      },
    });

    if (getIsRedisConnected()) {
      const newBullJobId = `email_job_${jobId}_rescheduled_${Date.now()}`;
      await emailQueue.add(
        'send-email',
        {
          jobId: dbJob.id,
          scheduleId: dbJob.scheduleId,
          senderId: senderId,
          recipient: dbJob.recipient,
          subject: dbJob.subject,
          body: dbJob.body,
          scheduledAt: rescheduleTime.toISOString(),
          minDelayMs: effectiveDelay,
          hourlyLimit: effectiveHourlyLimit,
        },
        { delay: rateCheck.msUntilNextWindow, jobId: newBullJobId }
      );
    }

    return;
  }

  // 4. Update Status to PROCESSING
  await prisma.emailJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  });

  // 5. Send Email via Ethereal SMTP
  try {
    const sender = dbJob.schedule.sender;
    const sendResult = await sendEtherealEmail({
      senderEmail: sender.email,
      senderName: sender.name,
      smtpUser: sender.smtpUser,
      smtpPass: sender.smtpPass,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      to: dbJob.recipient,
      subject: dbJob.subject,
      body: dbJob.body,
    });

    const etherealUrl = sendResult.previewUrl || undefined;

    // 6. Update Status to SENT
    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        etherealUrl: etherealUrl,
      },
    });

    console.log(`[Worker] Successfully sent email for Job ${jobId} to ${dbJob.recipient}. Ethereal URL: ${etherealUrl}`);
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown sending error';
    console.error(`[Worker] Failed sending email for Job ${jobId}: ${errorMsg}`);

    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        errorMessage: errorMsg,
      },
    });

    throw err;
  }
}

// Database Scheduler Ticker (Runs every 3 seconds)
let isTickerRunning = false;
function startDatabaseSchedulerTicker() {
  setInterval(async () => {
    if (isTickerRunning) return;
    isTickerRunning = true;

    try {
      const now = new Date();
      // Find due jobs
      const dueJobs = await prisma.emailJob.findMany({
        where: {
          status: { in: ['SCHEDULED', 'RESCHEDULED'] },
          scheduledAt: { lte: now },
        },
        take: env.WORKER_CONCURRENCY || 5,
        orderBy: { scheduledAt: 'asc' },
      });

      for (const job of dueJobs) {
        // Atomic status transition check to prevent race conditions
        const updated = await prisma.emailJob.updateMany({
          where: { id: job.id, status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
          data: { status: 'PROCESSING' },
        });

        if (updated.count > 0) {
          await processSingleEmailJob(job.id);
        }
      }
    } catch (err: any) {
      // Ignore background loop error if DB is busy
    } finally {
      isTickerRunning = false;
    }
  }, 3000);
}
