import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdStrategyDto } from './dto/create-ad-strategy.dto';
import { ListAdStrategiesDto } from './dto/list-ad-strategies.dto';
import { UpdateAdStrategyDto } from './dto/update-ad-strategy.dto';

// ─── Prisma select shape ──────────────────────────────────────────────────────

const AD_STRATEGY_SELECT = {
  id: true,
  sellerId: true,
  name: true,
  config: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AdStrategyRow = {
  id: string;
  sellerId: string;
  name: string;
  config: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Config shape stored in JSON column ──────────────────────────────────────
// Exported so controller return types can reference it transitively.

export interface StrategyConfig {
  budget: { budgetType: string; amount: number };
  audience: { mode: string; attributionWindowDays?: number };
  placements: string[];
}

@Injectable()
export class AdStrategiesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────

  async createStrategy(sellerId: string, dto: CreateAdStrategyDto) {
    const config: StrategyConfig = {
      budget: { budgetType: dto.budget.budgetType, amount: dto.budget.amount },
      audience: {
        mode: dto.audience.mode,
        ...(dto.audience.attributionWindowDays !== undefined && {
          attributionWindowDays: dto.audience.attributionWindowDays,
        }),
      },
      placements: dto.placements,
    };

    const strategy = await this.prisma.adStrategy.create({
      data: {
        sellerId,
        name: dto.name,
        config: config as object,
        isActive: dto.isActive ?? true,
      },
      select: AD_STRATEGY_SELECT,
    });

    return mapToDto(strategy as AdStrategyRow);
  }

  // ─── LIST ────────────────────────────────────────────────────────────────

  async listStrategies(sellerId: string, query: ListAdStrategiesDto = {}) {
    const strategies = await this.prisma.adStrategy.findMany({
      where: {
        sellerId,
        // Task 3: default to active-only; includeInactive bypasses this
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
      select: AD_STRATEGY_SELECT,
    });

    return strategies.map((s) => mapToDto(s as AdStrategyRow));
  }

  // ─── GET ONE ─────────────────────────────────────────────────────────────

  async getStrategy(sellerId: string, id: string) {
    const strategy = await this.prisma.adStrategy.findUnique({
      where: { id },
      select: AD_STRATEGY_SELECT,
    });

    if (!strategy || strategy.sellerId !== sellerId) {
      throw new NotFoundException('Ad strategy not found');
    }

    return mapToDto(strategy as AdStrategyRow);
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────

  async updateStrategy(
    sellerId: string,
    id: string,
    dto: UpdateAdStrategyDto,
  ) {
    const hasFields =
      dto.name !== undefined ||
      dto.budget !== undefined ||
      dto.audience !== undefined ||
      dto.placements !== undefined ||
      dto.isActive !== undefined;

    if (!hasFields) {
      throw new BadRequestException('At least one field must be provided');
    }

    const existing = await this.prisma.adStrategy.findUnique({
      where: { id },
      select: { id: true, sellerId: true, config: true },
    });

    if (!existing || existing.sellerId !== sellerId) {
      throw new NotFoundException('Ad strategy not found');
    }

    // Merge config fields selectively — only update what was supplied
    const currentConfig = existing.config as unknown as StrategyConfig;

    const mergedConfig: StrategyConfig = {
      budget: dto.budget
        ? { budgetType: dto.budget.budgetType, amount: dto.budget.amount }
        : currentConfig.budget,
      audience: dto.audience
        ? {
            mode: dto.audience.mode,
            ...(dto.audience.attributionWindowDays !== undefined && {
              attributionWindowDays: dto.audience.attributionWindowDays,
            }),
          }
        : currentConfig.audience,
      placements: dto.placements ?? currentConfig.placements,
    };

    const updated = await this.prisma.adStrategy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        config: mergedConfig as object,
      },
      select: AD_STRATEGY_SELECT,
    });

    return mapToDto(updated as AdStrategyRow);
  }

  // ─── DELETE (soft disable) ────────────────────────────────────────────────
  // Task 3: Sets isActive=false instead of physically deleting the row.
  // Campaigns will later reference strategies — physical delete risks FK issues.

  async deleteStrategy(sellerId: string, id: string) {
    const existing = await this.prisma.adStrategy.findUnique({
      where: { id },
      select: { id: true, sellerId: true },
    });

    if (!existing || existing.sellerId !== sellerId) {
      throw new NotFoundException('Ad strategy not found');
    }

    const updated = await this.prisma.adStrategy.update({
      where: { id },
      data: { isActive: false },
      select: AD_STRATEGY_SELECT,
    });

    return { ok: true, id, isActive: updated.isActive };
  }
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapToDto(s: AdStrategyRow) {
  return {
    id: s.id,
    sellerId: s.sellerId,
    name: s.name,
    config: s.config as unknown as StrategyConfig,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
