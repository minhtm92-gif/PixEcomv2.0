import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFbConnectionDto } from './dto/create-fb-connection.dto';
import { ListFbConnectionsDto } from './dto/list-fb-connections.dto';
import { UpdateFbConnectionDto } from './dto/update-fb-connection.dto';

// ─── Prisma select shape ──────────────────────────────────────────────────────
// accessTokenEnc is intentionally excluded — NEVER returned in responses.

const FB_CONNECTION_SELECT = {
  id: true,
  sellerId: true,
  connectionType: true,
  externalId: true,
  name: true,
  parentId: true,
  isPrimary: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type FbConnectionRow = {
  id: string;
  sellerId: string;
  connectionType: string;
  externalId: string;
  name: string;
  parentId: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class FbConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async createConnection(sellerId: string, dto: CreateFbConnectionDto) {
    // If parentId provided, verify it belongs to this seller
    if (dto.parentId) {
      const parent = await this.prisma.fbConnection.findUnique({
        where: { id: dto.parentId },
        select: { id: true, sellerId: true },
      });
      if (!parent || parent.sellerId !== sellerId) {
        throw new NotFoundException(`Parent connection not found`);
      }
    }

    // Enforce unique (sellerId, connectionType, externalId)
    const existing = await this.prisma.fbConnection.findFirst({
      where: {
        sellerId,
        connectionType: dto.connectionType as any,
        externalId: dto.externalId,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `A ${dto.connectionType} connection with externalId "${dto.externalId}" already exists`,
      );
    }

    const connection = await this.prisma.fbConnection.create({
      data: {
        sellerId,
        connectionType: dto.connectionType as any,
        externalId: dto.externalId,
        name: dto.name,
        parentId: dto.parentId ?? null,
        isPrimary: dto.isPrimary ?? false,
        isActive: true,
        // accessTokenEnc intentionally not set — NULL in DB
        metadata: {},
      },
      select: FB_CONNECTION_SELECT,
    });

    return mapToDto(connection as FbConnectionRow);
  }

  // ─── LIST ──────────────────────────────────────────────────────────────────

  async listConnections(sellerId: string, query: ListFbConnectionsDto) {
    const connections = await this.prisma.fbConnection.findMany({
      where: {
        sellerId,
        ...(query.connectionType
          ? { connectionType: query.connectionType as any }
          : {}),
      },
      orderBy: [{ connectionType: 'asc' }, { createdAt: 'asc' }],
      select: FB_CONNECTION_SELECT,
    });

    return connections.map((c) => mapToDto(c as FbConnectionRow));
  }

  // ─── GET ONE ───────────────────────────────────────────────────────────────

  async getConnection(sellerId: string, id: string) {
    const connection = await this.prisma.fbConnection.findUnique({
      where: { id },
      select: FB_CONNECTION_SELECT,
    });

    if (!connection || connection.sellerId !== sellerId) {
      throw new NotFoundException('Connection not found');
    }

    return mapToDto(connection as FbConnectionRow);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async updateConnection(
    sellerId: string,
    id: string,
    dto: UpdateFbConnectionDto,
  ) {
    const hasFields =
      dto.name !== undefined ||
      dto.isPrimary !== undefined ||
      dto.isActive !== undefined;

    if (!hasFields) {
      throw new BadRequestException('At least one field must be provided');
    }

    await this.assertBelongsToSeller(sellerId, id);

    const updated = await this.prisma.fbConnection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: FB_CONNECTION_SELECT,
    });

    return mapToDto(updated as FbConnectionRow);
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  async deleteConnection(sellerId: string, id: string) {
    await this.assertBelongsToSeller(sellerId, id);

    await this.prisma.fbConnection.delete({ where: { id } });

    return { deleted: true, id };
  }

  // ─── PRIVATE ───────────────────────────────────────────────────────────────

  private async assertBelongsToSeller(sellerId: string, id: string) {
    const connection = await this.prisma.fbConnection.findUnique({
      where: { id },
      select: { id: true, sellerId: true },
    });
    if (!connection || connection.sellerId !== sellerId) {
      throw new NotFoundException('Connection not found');
    }
    return connection;
  }
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapToDto(c: FbConnectionRow) {
  return {
    id: c.id,
    sellerId: c.sellerId,
    connectionType: c.connectionType,
    externalId: c.externalId,
    name: c.name,
    parentId: c.parentId,
    isPrimary: c.isPrimary,
    isActive: c.isActive,
    provider: 'META' as const,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
