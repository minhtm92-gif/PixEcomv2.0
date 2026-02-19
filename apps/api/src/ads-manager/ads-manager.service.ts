import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export const QUEUE_NAME = 'stats-sync';
const LEVELS: Array<'CAMPAIGN' | 'ADSET' | 'AD'> = ['CAMPAIGN', 'ADSET', 'AD'];

interface StatsSyncJobData {
  sellerId: string;
  dateFrom: string;
  dateTo: string;
  level: 'CAMPAIGN' | 'ADSET' | 'AD';
}

@Injectable()
export class AdsManagerService implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue<StatsSyncJobData>;
  private connection!: IORedis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<StatsSyncJobData>(QUEUE_NAME, {
      connection: this.connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }

  /**
   * Enqueue CAMPAIGN + ADSET + AD sync jobs for the seller on the given date.
   * BullMQ jobId dedup ensures duplicate calls for the same seller/date are ignored.
   *
   * @returns jobIds of the enqueued jobs
   */
  async enqueueSync(sellerId: string, date: string): Promise<string[]> {
    const jobIds: string[] = [];

    for (const level of LEVELS) {
      // BullMQ v5+ forbids ':' in custom jobIds — use '__' separator
      const jobId = `sync__${sellerId}__${date}__${date}__${level}`;
      await this.queue.add(
        'stats-sync',
        { sellerId, dateFrom: date, dateTo: date, level },
        { jobId },
      );
      jobIds.push(jobId);
    }

    return jobIds;
  }

  /** Returns today's date in YYYY-MM-DD (UTC). */
  todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
