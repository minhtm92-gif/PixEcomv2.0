import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(sellerId: string) {
    const sellerTemplates = await this.prisma.emailTemplate.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });

    const sellerFlowIds = sellerTemplates.map((t) => t.flowId);

    const defaultTemplates = await this.prisma.emailTemplate.findMany({
      where: {
        isDefault: true,
        sellerId: null,
        flowId: { notIn: sellerFlowIds },
      },
      orderBy: { createdAt: 'desc' },
    });

    return [...sellerTemplates, ...defaultTemplates];
  }

  async getById(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    return template;
  }

  async getByFlow(sellerId: string, flowId: string) {
    const sellerTemplate = await this.prisma.emailTemplate.findUnique({
      where: { sellerId_flowId: { sellerId, flowId } },
    });

    if (sellerTemplate) return sellerTemplate;

    const defaultTemplate = await this.prisma.emailTemplate.findFirst({
      where: { flowId, isDefault: true, sellerId: null },
    });

    return defaultTemplate;
  }

  async create(sellerId: string, dto: CreateTemplateDto) {
    return this.prisma.emailTemplate.create({
      data: {
        sellerId,
        flowId: dto.flowId,
        name: dto.name,
        subject: dto.subject,
        htmlBody: dto.htmlBody,
        textBody: dto.textBody,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.htmlBody !== undefined && { htmlBody: dto.htmlBody }),
        ...(dto.textBody !== undefined && { textBody: dto.textBody }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Template ${id} not found`);
    }

    await this.prisma.emailTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  async preview(id: string, sampleData: Record<string, string>) {
    const template = await this.getById(id);
    const html = this.resolveVariables(template.htmlBody, sampleData);
    const subject = this.resolveVariables(template.subject, sampleData);
    return { subject, html };
  }

  resolveVariables(
    content: string,
    variables: Record<string, string>,
  ): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] ?? match;
    });
  }
}
