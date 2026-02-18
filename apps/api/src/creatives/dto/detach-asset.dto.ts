import { IsIn } from 'class-validator';

/** Body for DELETE /api/creatives/:id/assets/:role */
export class DetachAssetDto {
  /** The role slot to clear */
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
