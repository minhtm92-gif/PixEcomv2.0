import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSellerDto } from './dto/update-seller.dto';

@Injectable()
export class SellerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the seller profile for the given sellerId.
   * sellerId is always sourced from the JWT — never from request params.
   */
  async getProfile(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!seller || !seller.isActive) {
      throw new NotFoundException('Seller not found');
    }

    return seller;
  }

  /**
   * Updates name and/or logoUrl for the given seller.
   * At least one field must be provided.
   * sellerId scopes the update — cannot touch another seller's row.
   */
  async updateProfile(sellerId: string, dto: UpdateSellerDto) {
    if (dto.name === undefined && dto.logoUrl === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    // Verify seller exists before update
    const existing = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, isActive: true },
    });

    if (!existing || !existing.isActive) {
      throw new NotFoundException('Seller not found');
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}
