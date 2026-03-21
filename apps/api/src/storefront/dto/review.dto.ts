import {
  IsString,
  IsInt,
  IsEmail,
  IsOptional,
  IsArray,
  IsUrl,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Submit a new review (public — no auth required).
 * Customer must provide order details for verified-purchase badge.
 */
export class SubmitReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  authorName!: string;

  @IsEmail()
  authorEmail!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  /** Optional — link to order for verified purchase badge */
  @IsOptional()
  @Matches(UUID_RE, { message: 'orderId must be a valid UUID' })
  orderId?: string;

  /** Product ID to review */
  @IsString()
  @Matches(UUID_RE)
  productId!: string;
}

/**
 * Moderate a review (seller auth required).
 */
export class ModerateReviewDto {
  @IsString()
  action!: 'approve' | 'reject';
}
