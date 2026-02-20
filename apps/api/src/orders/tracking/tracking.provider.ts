/**
 * TrackingResult — returned by any TrackingProvider implementation.
 *
 * Status values (normalised from carrier-specific codes):
 *   PENDING       — registered but not yet shipped
 *   IN_TRANSIT    — in transit (carrier has it)
 *   ARRIVED       — arrived at destination facility
 *   DELIVERED     — delivered to recipient
 *   UNDELIVERED   — delivery attempted but failed
 *   EXCEPTION     — exception / problem (customs hold, lost, etc.)
 *   UNKNOWN       — could not determine status (API error, no data)
 */
export interface TrackingResult {
  status: string;
  lastEvent?: string;
  updatedAt: Date;
}
