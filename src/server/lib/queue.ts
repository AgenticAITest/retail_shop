import { Queue, Worker, type Processor } from 'bullmq';
import { getRedis } from './redis';

const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

/**
 * Get or create a named BullMQ queue
 */
export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    queues.set(name, queue);
  }
  return queues.get(name)!;
}

/**
 * Register a worker for a named queue
 */
export function registerWorker(
  name: string,
  processor: Processor,
  concurrency = 5
): Worker {
  const worker = new Worker(name, processor, {
    connection: getRedis(),
    concurrency,
  });

  worker.on('completed', (job) => {
    console.log(`[INFO] Job ${job.id} in queue "${name}" completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[ERROR] Job ${job?.id} in queue "${name}" failed:`, err.message);
  });

  workers.set(name, worker);
  return worker;
}

/**
 * Gracefully close all queues and workers
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  for (const [, worker] of workers) {
    closePromises.push(worker.close());
  }
  for (const [, queue] of queues) {
    closePromises.push(queue.close());
  }
  await Promise.all(closePromises);
  queues.clear();
  workers.clear();
}

// Pre-defined queue names for the retail system
export const QUEUE_NAMES = {
  SYNC_PROCESSING: 'sync-processing',
  REPORT_GENERATION: 'report-generation',
  DATA_ARCHIVAL: 'data-archival',
  NOTIFICATIONS: 'notifications',
  APPROVAL_TIMEOUT: 'approval-timeout',
} as const;
