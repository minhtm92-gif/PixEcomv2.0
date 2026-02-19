import { IsIn } from 'class-validator';

export const TOGGLABLE_STATUSES = ['ACTIVE', 'PAUSED'] as const;
export type TogglableStatus = (typeof TOGGLABLE_STATUSES)[number];

/**
 * DTO for PATCH /api/campaigns/:id/status
 * Only ACTIVE and PAUSED are togglable via API.
 * ARCHIVED and DELETED are system-only states.
 */
export class UpdateCampaignStatusDto {
  @IsIn(TOGGLABLE_STATUSES)
  status!: TogglableStatus;
}
