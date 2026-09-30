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

    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
    const hostUrl = process.env.RENDER_EXTERNAL_URL || `${protocol}://${host}`;

    const formattedJobs = jobs.map((job) => {
      let previewUrl = job.etherealUrl;
      if (!previewUrl || previewUrl.includes('ethereal.email') || previewUrl.includes('onrender.com')) {
        previewUrl = `${hostUrl}/api/emails/preview/${job.id}`;
      }
      return {
        ...job,
        etherealUrl: previewUrl,
        sandboxPreviewUrl: `${hostUrl}/api/emails/preview/${job.id}`,
      };
    });

    return res.json({ sent: formattedJobs });
  } catch (error: any) {
    console.error('[EmailController] Get Sent Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch sent emails' });
  }
}

export async function previewEmail(req: any, res: Response) {
  try {
    const { jobId } = req.params;
    const dbJob = await prisma.emailJob.findUnique({
      where: { id: jobId },
      include: { schedule: { include: { sender: true } } },
    });

    if (!dbJob) {
      return res.status(404).send('<h1>Email Not Found</h1><p>The requested email job ID does not exist.</p>');
    }

    const escapeHtml = (str?: string) => (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ethereal Mail Preview - ${escapeHtml(dbJob.subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: #0f172a; color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 16px; margin: 0; font-weight: 700; letter-spacing: 0.5px; }
    .badge { background: #10b981; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; }
    .meta { padding: 20px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 13px; line-height: 1.8; }
    .meta-row { display: flex; margin-bottom: 4px; }
    .meta-label { width: 100px; font-weight: 600; color: #64748b; }
    .meta-val { flex: 1; color: #1e293b; font-weight: 500; }
    .body-content { padding: 28px 24px; font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-wrap; background: #ffffff; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>✉️ Ethereal Sandbox Mail Preview</h1>
      <span class="badge">${dbJob.status}</span>
    </div>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Subject:</span><span class="meta-val">${escapeHtml(dbJob.subject)}</span></div>
      <div class="meta-row"><span class="meta-label">From:</span><span class="meta-val">${escapeHtml(dbJob.schedule?.sender?.name || 'ReachInbox Outreach Manager')} &lt;${escapeHtml(dbJob.schedule?.sender?.email || 'outreach@reachinbox.ai')}&gt;</span></div>
      <div class="meta-row"><span class="meta-label">To:</span><span class="meta-val">${escapeHtml(dbJob.recipient)}</span></div>
      <div class="meta-row"><span class="meta-label">Dispatched:</span><span class="meta-val">${dbJob.sentAt ? new Date(dbJob.sentAt).toUTCString() : new Date(dbJob.scheduledAt).toUTCString()}</span></div>
    </div>
    <div class="body-content">${escapeHtml(dbJob.body)}</div>
    <div class="footer">Dispatched via ReachInbox Email Scheduler &bull; Render Worker Engine &bull; Sandbox Ethereal Mail</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err: any) {
    return res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
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

export async function deleteScheduledEmail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const existingJob = await prisma.emailJob.findUnique({
      where: { id },
    });

    if (!existingJob) {
      return res.status(404).json({ error: 'Scheduled email job not found' });
    }

    // Delete from DB
    await prisma.emailJob.delete({
      where: { id },
    });

    // Remove from BullMQ queue if Redis is connected
    if (getIsRedisConnected()) {
      try {
        const bullJobId = `email_job_${id}`;
        const job = await emailQueue.getJob(bullJobId);
        if (job) {
          await job.remove();
          console.log(`[BullMQ] Removed job ${bullJobId} from queue.`);
        }
      } catch (queueErr: any) {
        console.warn(`[BullMQ] Failed to remove job ${id} from queue:`, queueErr.message);
      }
    }

    console.log(`[Scheduler] Successfully deleted scheduled email job ${id}`);

    return res.json({
      message: 'Scheduled email deleted successfully',
      id,
    });
  } catch (error: any) {
    console.error('[EmailController] Delete Scheduled Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete scheduled email' });
  }
}

export async function deleteScheduledEmailsBatch(req: AuthRequest, res: Response) {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of job ids is required' });
    }

    // Delete matching jobs from DB
    const deleteResult = await prisma.emailJob.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    // Remove from BullMQ queue if Redis is connected
    if (getIsRedisConnected()) {
      for (const id of ids) {
        try {
          const bullJobId = `email_job_${id}`;
          const job = await emailQueue.getJob(bullJobId);
          if (job) {
            await job.remove();
          }
        } catch (queueErr: any) {
          // ignore error for batch removal
        }
      }
    }

    console.log(`[Scheduler] Successfully deleted batch of ${deleteResult.count} scheduled email jobs`);

    return res.json({
      message: `Successfully deleted ${deleteResult.count} scheduled email(s)`,
      deletedCount: deleteResult.count,
    });
  } catch (error: any) {
    console.error('[EmailController] Delete Scheduled Batch Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete scheduled emails' });
  }
}

