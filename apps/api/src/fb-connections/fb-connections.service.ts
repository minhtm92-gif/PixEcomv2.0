import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';
import { CreateFbConnectionDto } from './dto/create-fb-connection.dto';
import { ListFbConnectionsDto } from './dto/list-fb-connections.dto';
import { UpdateFbConnectionDto } from './dto/update-fb-connection.dto';

// ─── Prisma select shape ──────────────────────────────────────────────────────
// accessTokenEnc is intentionally excluded — NEVER returned in responses.

const FB_CONNECTION_SELECT = {
  id: true,
  sellerId: true,
  connectedByUserId: true,
  connectionType: true,
  externalId: true,
  name: true,
  parentId: true,
  isPrimary: true,
  isActive: true,
  metadata: true,
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
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Hierarchy rules ──────────────────────────────────────────────────────────
// AD_ACCOUNT and PAGE are top-level (parentId must be null).
// PIXEL must have a parent that is an AD_ACCOUNT.
// CONVERSION must have a parent that is a PIXEL.

const HIERARCHY_RULES: Record<
  string,
  { requiresParent: boolean; allowedParentType: string | null }
> = {
  AD_ACCOUNT: { requiresParent: false, allowedParentType: null },
  PAGE: { requiresParent: false, allowedParentType: null },
  PIXEL: { requiresParent: true, allowedParentType: 'AD_ACCOUNT' },
  CONVERSION: { requiresParent: true, allowedParentType: 'PIXEL' },
};

/** Map Meta numeric account_status to a human label. */
const ACCOUNT_STATUS_MAP: Record<number, string> = {
  1: 'Active',
  2: 'Disabled',
  3: 'Unsettled',
  7: 'Pending Review',
  9: 'In Grace Period',
  100: 'Pending Closure',
  101: 'Closed',
  201: 'Any Active',
};

@Injectable()
export class FbConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaService: MetaService,
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async createConnection(sellerId: string, userId: string, dto: CreateFbConnectionDto) {
    await this.validateHierarchy(sellerId, dto.connectionType, dto.parentId);

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
        connectedByUserId: userId,
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

  async listConnections(sellerId: string, userId: string, query: ListFbConnectionsDto) {
    const connections = await this.prisma.fbConnection.findMany({
      where: {
        sellerId,
        // User-scoped: show own connections + legacy unassigned ones
        OR: [
          { connectedByUserId: userId },
          { connectedByUserId: null },
        ],
        // Task 3: default to active-only; includeInactive bypasses this
        ...(query.includeInactive ? {} : { isActive: true }),
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

  // ─── DELETE (soft disable) ─────────────────────────────────────────────────
  // Task 3: Sets isActive=false instead of physically deleting the row.
  // This prevents FK/orphan issues when campaigns reference this connection.

  async deleteConnection(sellerId: string, id: string) {
    await this.assertBelongsToSeller(sellerId, id);

    const updated = await this.prisma.fbConnection.update({
      where: { id },
      data: { isActive: false },
      select: FB_CONNECTION_SELECT,
    });

    return { ok: true, id, isActive: updated.isActive };
  }

  // ─── ACCOUNT DETAILS (live from Meta) ─────────────────────────────────────

  async getAccountDetails(sellerId: string, id: string) {
    const conn = await this.prisma.fbConnection.findUnique({
      where: { id },
      select: { id: true, sellerId: true, connectionType: true, externalId: true },
    });

    if (!conn || conn.sellerId !== sellerId) {
      throw new NotFoundException('Connection not found');
    }

    if (conn.connectionType !== 'AD_ACCOUNT') {
      throw new BadRequestException('Account details are only available for AD_ACCOUNT connections');
    }

    const extId = conn.externalId.startsWith('act_')
      ? conn.externalId
      : `act_${conn.externalId}`;

    const data = await this.metaService.get<{
      account_status: number;
      spend_cap: string;
      amount_spent: string;
      currency: string;
      timezone_name: string;
      disable_reason?: number;
      name: string;
    }>(id, extId, {
      fields: 'account_status,spend_cap,amount_spent,currency,timezone_name,disable_reason,name',
    });

    return {
      accountStatus: data.account_status,
      accountStatusLabel: ACCOUNT_STATUS_MAP[data.account_status] ?? 'Unknown',
      spendCap: data.spend_cap ?? null,
      amountSpent: data.amount_spent ?? null,
      currency: data.currency,
      timezone: data.timezone_name,
      disableReason: data.disable_reason ?? null,
      name: data.name,
    };
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

  /**
   * Enforces the connection type hierarchy:
   * - AD_ACCOUNT / PAGE: parentId must be absent/null
   * - PIXEL: parentId must reference an AD_ACCOUNT belonging to the same seller
   * - CONVERSION: parentId must reference a PIXEL belonging to the same seller
   */
  private async validateHierarchy(
    sellerId: string,
    connectionType: string,
    parentId?: string,
  ) {
    const rule = HIERARCHY_RULES[connectionType];
    if (!rule) return; // unknown type — leave to other validators

    if (rule.allowedParentType === null) {
      // Top-level types must not have a parent
      if (parentId) {
        throw new BadRequestException(
          `${connectionType} connections must not have a parentId`,
        );
      }
      return;
    }

    // Types that require a parent
    if (!parentId) {
      throw new BadRequestException(
        `${connectionType} connections require a parentId referencing a ${rule.allowedParentType}`,
      );
    }

    // Verify parent exists, belongs to the same seller, and is the correct type
    const parent = await this.prisma.fbConnection.findUnique({
      where: { id: parentId },
      select: { id: true, sellerId: true, connectionType: true },
    });

    if (!parent || parent.sellerId !== sellerId) {
      throw new NotFoundException(`Parent connection not found`);
    }

    if (parent.connectionType !== rule.allowedParentType) {
      throw new BadRequestException(
        `${connectionType} requires a parent of type ${rule.allowedParentType}, but got ${parent.connectionType}`,
      );
    }
  }
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapToDto(c: FbConnectionRow) {
  const meta = (c.metadata ?? {}) as Record<string, unknown>;
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
    fbUserId: (meta.fbUserId as string) ?? null,
    fbUserName: (meta.fbUserName as string) ?? null,
    // Ad account metadata
    accountStatus: (meta.accountStatus as number) ?? null,
    accountStatusLabel: meta.accountStatus
      ? (ACCOUNT_STATUS_MAP[meta.accountStatus as number] ?? 'Unknown')
      : null,
    spendCap: (meta.spendCap as string) ?? null,
    amountSpent: (meta.amountSpent as string) ?? null,
    currency: (meta.currency as string) ?? null,
    timezone: (meta.timezone as string) ?? null,
    // Page metadata
    category: (meta.category as string) ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
