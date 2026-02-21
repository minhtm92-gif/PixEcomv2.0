import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportRow {
  orderNumber: string;
  trackingNumber: string;
  trackingUrl?: string;
}

export interface ImportTrackingResult {
  updated: number;
  failed: Array<{ orderNumber: string; reason: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_ROWS = 1000;

// ─── CSV parser (no external deps) ───────────────────────────────────────────

/**
 * Parse a CSV string into an array of row objects.
 * Handles:
 *   - UTF-8 BOM prefix
 *   - CRLF and LF line endings
 *   - Quoted fields with embedded commas / escaped double-quotes
 *   - Trims whitespace from unquoted fields
 * Returns null on empty/header-only file.
 */
function parseCsvRows(raw: string): ImportRow[] | null {
  // Strip BOM
  const text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null; // header only

  // Parse header
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const orderNumberIdx = header.indexOf('ordernumber');
  const trackingNumberIdx = header.indexOf('trackingnumber');
  const trackingUrlIdx = header.indexOf('trackingurl');

  if (orderNumberIdx === -1) {
    throw new BadRequestException(
      'CSV missing required column: OrderNumber',
    );
  }
  if (trackingNumberIdx === -1) {
    throw new BadRequestException(
      'CSV missing required column: TrackingNumber',
    );
  }

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
    const cols = splitCsvLine(lines[i]);
    const orderNumber = cols[orderNumberIdx]?.trim();
    const trackingNumber = cols[trackingNumberIdx]?.trim();
    if (!orderNumber || !trackingNumber) continue; // skip blank rows
    rows.push({
      orderNumber,
      trackingNumber,
      trackingUrl:
        trackingUrlIdx !== -1 ? cols[trackingUrlIdx]?.trim() || undefined : undefined,
    });
  }
  return rows;
}

/**
 * Split a single CSV line into fields, respecting quoted fields.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OrdersImportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Import tracking numbers from CSV.
   * Validates each order belongs to the seller before updating.
   * Returns per-row success/failure summary.
   */
  async importTracking(
    sellerId: string,
    fileBuffer: Buffer,
  ): Promise<ImportTrackingResult> {
    if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds 2 MB limit');
    }

    const text = fileBuffer.toString('utf-8');
    const rows = parseCsvRows(text);

    if (!rows || rows.length === 0) {
      throw new BadRequestException('CSV file is empty or contains no data rows');
    }

    const updated: string[] = [];
    const failed: Array<{ orderNumber: string; reason: string }> = [];

    for (const row of rows) {
      try {
        // Find order scoped to this seller
        const order = await this.prisma.order.findFirst({
          where: {
            orderNumber: row.orderNumber,
            sellerId,
          },
          select: { id: true },
        });

        if (!order) {
          failed.push({
            orderNumber: row.orderNumber,
            reason: 'Order not found or does not belong to this seller',
          });
          continue;
        }

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            trackingNumber: row.trackingNumber,
            ...(row.trackingUrl !== undefined && { trackingUrl: row.trackingUrl }),
          },
        });

        updated.push(row.orderNumber);
      } catch {
        failed.push({
          orderNumber: row.orderNumber,
          reason: 'Internal error processing row',
        });
      }
    }

    return { updated: updated.length, failed };
  }
}
