import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prisma } from '../db/client';
import { emailQueue } from '../queues/emailQueue';
import { env } from '../config/env';
import { createEtherealAccount } from '../services/etherealService';
import { getIsRedisConnected } from '../config/redis';

// Ensure a default sender exists in DB
export async function getOrCreateDefaultSender() {
  const existing = await prisma.sender.findFirst();
  if (existing) return existing;

  console.log('[Sender] Generating new Ethereal SMTP test sender...');
  const eth = await createEtherealAccount();
  return await prisma.sender.create({
    data: {
      email: eth.user,
      name: 'ReachInbox Outreach Manager',
      smtpUser: eth.user,
      smtpPass: eth.pass,
      smtpHost: eth.smtpHost,
      smtpPort: eth.smtpPort,
    },
  });
}

export async function scheduleEmails(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subject, body, recipients, scheduledAt, minDelayMs, hourlyLimit, senderId } = req.body;

    if (!subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'subject, body, and non-empty recipients array are required' });
    }

    const targetScheduledTime = scheduledAt ? new Date(scheduledAt) : new Date();
    if (isNaN(targetScheduledTime.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt ISO date timestamp' });
    }

    const effectiveMinDelay = minDelayMs !== undefined ? Number(minDelayMs) : env.MIN_DELAY_BETWEEN_EMAILS_MS;
    const effectiveHourlyLimit = hourlyLimit !== undefined ? Number(hourlyLimit) : env.MAX_EMAILS_PER_HOUR;

    let sender = senderId ? await prisma.sender.findUnique({ where: { id: senderId } }) : null;
    if (!sender) {
      sender = await getOrCreateDefaultSender();
    }

    // 1. Create EmailSchedule batch record in DB
    const schedule = await prisma.emailSchedule.create({
      data: {
        userId,
        senderId: sender.id,
        subject,
        body,
        totalLeads: recipients.length,
        minDelayMs: effectiveMinDelay,
        hourlyLimit: effectiveHourlyLimit,
        scheduledAt: targetScheduledTime,
      },
    });

    // 2. Prepare EmailJob records for DB
    const jobsToCreate = recipients.map((email: string) => ({
      scheduleId: schedule.id,
      recipient: email.trim(),
      subject,
      body,
      scheduledAt: targetScheduledTime,
      status: 'SCHEDULED' as const,
    }));

    // Batch insert EmailJobs in PostgreSQL
    await prisma.emailJob.createMany({
      data: jobsToCreate,
    });

    // Fetch created jobs to get their unique DB UUIDs
    const createdJobs = await prisma.emailJob.findMany({
      where: { scheduleId: schedule.id },
      select: { id: true, recipient: true, scheduledAt: true },
    });

    const now = Date.now();
    const targetMs = targetScheduledTime.getTime();
    const initialDelay = Math.max(0, targetMs - now);

    // 3. Queue jobs in BullMQ using addBulk
    const bulkBullJobs = createdJobs.map((dbJob, index) => {
      // Stagger initial delays if minDelayMs is set to space out initial queueing
      const staggeredDelay = initialDelay + index * effectiveMinDelay;

      return {
        name: 'send-email',
        data: {
          jobId: dbJob.id,
          scheduleId: schedule.id,
          senderId: sender!.id,
          recipient: dbJob.recipient,
          subject,
          body,
          scheduledAt: dbJob.scheduledAt.toISOString(),
          minDelayMs: effectiveMinDelay,
          hourlyLimit: effectiveHourlyLimit,
        },
        opts: {
          jobId: `email_job_${dbJob.id}`,
          delay: staggeredDelay,
        },
      };
    });

    // 3. Queue jobs in BullMQ if Redis is active
    if (getIsRedisConnected()) {
      try {
        await Promise.race([
          emailQueue.addBulk(bulkBullJobs),
          new Promise((_, reject) => setTimeout(() => reject(new Error('BullMQ enqueue timeout')), 3000)),
        ]);
        console.log(`[Scheduler] Enqueued ${bulkBullJobs.length} jobs into BullMQ.`);
      } catch (queueErr: any) {
        console.warn('[Scheduler] BullMQ enqueue skipped (DB ticker will handle execution):', queueErr.message);
      }
    } else {
      console.log(`[Scheduler] Redis offline — ${createdJobs.length} jobs stored in DB; DB ticker will dispatch them automatically.`);
    }

    console.log(
      `[Scheduler] Successfully scheduled ${createdJobs.length} email jobs for Schedule ${schedule.id} starting at ${targetScheduledTime.toISOString()}`
    );

    return res.status(201).json({
      message: `Successfully scheduled ${createdJobs.length} emails`,
      scheduleId: schedule.id,
      totalScheduled: createdJobs.length,
      scheduledAt: targetScheduledTime,
      senderEmail: sender.email,
    });
  } catch (error: any) {
    console.error('[EmailController] Schedule Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to schedule emails' });
  }
}

export async function getScheduledEmails(req: AuthRequest, res: Response) {
  try {
    const jobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'PROCESSING', 'RESCHEDULED'] },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        schedule: {
          select: {
            subject: true,
            minDelayMs: true,
            hourlyLimit: true,
            sender: { select: { email: true, name: true } },
          },
        },
      },
    });

    return res.json({ scheduled: jobs });
  } catch (error: any) {
    console.error('[EmailController] Get Scheduled Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch scheduled emails' });
  }
}

export async function getSentEmails(req: AuthRequest, res: Response) {
  try {
    const jobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SENT', 'FAILED'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        schedule: {
          select: {
            subject: true,
            sender: { select: { email: true, name: true } },
          },
        },
      },
    });

    return res.json({ sent: jobs });
  } catch (error: any) {
    console.error('[EmailController] Get Sent Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch sent emails' });
  }
}

export async function getStats(req: AuthRequest, res: Response) {
  try {
    const [scheduledCount, sentCount, failedCount, totalSchedules] = await Promise.all([
      prisma.emailJob.count({ where: { status: { in: ['SCHEDULED', 'PROCESSING', 'RESCHEDULED'] } } }),
      prisma.emailJob.count({ where: { status: 'SENT' } }),
      prisma.emailJob.count({ where: { status: 'FAILED' } }),
      prisma.emailSchedule.count(),
    ]);

    return res.json({
      scheduled: scheduledCount,
      sent: sentCount,
      failed: failedCount,
      totalSchedules,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
