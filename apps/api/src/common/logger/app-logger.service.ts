import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

/**
 * AppLogger — WS2 (Milestone 2.3.7)
 *
 * Thin structured-JSON wrapper around NestJS built-in logger.
 * In production (NODE_ENV=production) outputs newline-delimited JSON;
 * in development falls back to NestJS pretty format.
 *
 * Log shape:
 *   { ts, level, requestId?, sellerId?, context?, route?, method?,
 *     statusCode?, durationMs?, msg, ...extra }
 *
 * No secrets are logged (no tokens, no fileUrl, no passwords).
 */

export interface StructuredLogEntry {
  msg: string;
  requestId?: string;
  sellerId?: string;
  context?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

@Injectable()
export class AppLogger implements LoggerService {
  private readonly isProd = process.env.NODE_ENV === 'production';

  private emit(level: string, entry: StructuredLogEntry): void {
    const record = {
      ts: new Date().toISOString(),
      level,
      ...entry,
    };

    if (this.isProd) {
      // Structured JSON for log aggregators (Datadog, Loki, etc.)
      process.stdout.write(JSON.stringify(record) + '\n');
    } else {
      // Human-readable in dev
      const { ts, level: lvl, msg, ...rest } = record;
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
      console.log(`[${ts}] ${lvl.toUpperCase().padEnd(5)} ${msg}${extra}`);
    }
  }

  log(msgOrEntry: string | StructuredLogEntry, context?: string): void {
    if (typeof msgOrEntry === 'string') {
      this.emit('info', { msg: msgOrEntry, context });
    } else {
      this.emit('info', { context, ...msgOrEntry });
    }
  }

  info(entry: StructuredLogEntry): void {
    this.emit('info', entry);
  }

  warn(msgOrEntry: string | StructuredLogEntry, context?: string): void {
    if (typeof msgOrEntry === 'string') {
      this.emit('warn', { msg: msgOrEntry, context });
    } else {
      this.emit('warn', { context, ...msgOrEntry });
    }
  }

  error(msgOrEntry: string | StructuredLogEntry, trace?: string, context?: string): void {
    if (typeof msgOrEntry === 'string') {
      this.emit('error', { msg: msgOrEntry, trace, context });
    } else {
      this.emit('error', { trace, context, ...msgOrEntry });
    }
  }

  debug(msgOrEntry: string | StructuredLogEntry, context?: string): void {
    if (process.env.LOG_LEVEL === 'debug') {
      if (typeof msgOrEntry === 'string') {
        this.emit('debug', { msg: msgOrEntry, context });
      } else {
        this.emit('debug', { context, ...msgOrEntry });
      }
    }
  }

  verbose(msg: string, context?: string): void {
    this.emit('verbose', { msg, context });
  }

  setLogLevels?(_levels: LogLevel[]): void {
    // No-op — controlled via LOG_LEVEL env
  }
}
