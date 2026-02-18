import { IsUUID, IsIn } from 'class-validator';

/** Body for POST /api/creatives/:id/assets */
export class AttachAssetDto {
  /** ID of the asset to attach */
  @IsUUID()
  assetId!: string;

  /** Slot the asset occupies in this creative */
  @IsIn([
    'PRIMARY_VIDEO',
    'THUMBNAIL',
    'PRIMARY_TEXT',
    'HEADLINE',
    'DESCRIPTION',
    'EXTRA',
  ])
  role!:
    | 'PRIMARY_VIDEO'
    | 'THUMBNAIL'
    | 'PRIMARY_TEXT'
    | 'HEADLINE'
    | 'DESCRIPTION'
    | 'EXTRA';
}
