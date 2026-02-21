import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';
import { ORDER_STATUSES, OrderStatusFilter } from './list-orders.dto';

export class BulkStatusDto {
  /** List of order UUIDs to update. Min 1, max 100 per batch. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  orderIds!: string[];

  /** Target status — must be a valid OrderStatus value. */
  @IsIn(ORDER_STATUSES)
  status!: OrderStatusFilter;
}
