import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export interface EmailJobData {
  jobId: string; // Database EmailJob UUID
  scheduleId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
  minDelayMs: number;
  hourlyLimit: number;
}

export const EMAIL_QUEUE_NAME = 'email-scheduler-queue';

let emailQueue: Queue<EmailJobData>;

try {
  emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
  console.log(`[BullMQ] Initialized Queue: ${EMAIL_QUEUE_NAME}`);
} catch (err: any) {
  console.warn(`[BullMQ] Queue init deferred (Redis offline): ${err.message}`);
  // Create a stub queue that will work once Redis connects
  emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: redisConnection,
  });
}

export { emailQueue };
