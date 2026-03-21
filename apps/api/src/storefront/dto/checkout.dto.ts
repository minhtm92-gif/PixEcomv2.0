import {
  IsEmail,
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
  IsIn,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

// Regex that accepts any UUID-shaped string (no version check) for seed data compat
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class AddressDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  @MinLength(1)
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  @MinLength(1)
  city!: string;

  @IsString()
  @MinLength(1)
  state!: string;

  @IsString()
  @MinLength(1)
  postalCode!: string;

  @IsString()
  @MinLength(1)
  country!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}

class CheckoutItemDto {
  @Matches(UUID_RE, { message: 'productId must be a valid UUID' })
  productId!: string;

  @IsOptional()
  @Matches(UUID_RE, { message: 'variantId must be a valid UUID' })
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CheckoutDto {
  @IsEmail()
  customerEmail!: string;

  @IsString()
  @MinLength(1)
  customerName!: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress!: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @IsIn(['standard', 'express', 'overnight'])
  shippingMethod!: 'standard' | 'express' | 'overnight';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @IsOptional()
  @IsUUID()
  discountId?: string;

  @IsOptional()
  @IsString()
  discountCode?: string;

  @IsIn(['stripe', 'paypal'])
  paymentMethod!: 'stripe' | 'paypal';

  @IsString()
  sellpageSlug!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;
}

export class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @IsOptional()
  @IsString()
  paypalOrderId?: string;
}
