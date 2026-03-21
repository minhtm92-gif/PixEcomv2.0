import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailTemplateService } from './email-template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('email-templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplateController {
  constructor(private readonly templateService: EmailTemplateService) {}

  @Get()
  list(@Req() req: any) {
    const sellerId = req.user.sellerId;
    return this.templateService.list(sellerId);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.getById(id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTemplateDto) {
    const sellerId = req.user.sellerId;
    return this.templateService.create(sellerId, dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.delete(id);
  }

  @Post(':id/preview')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { variables?: Record<string, string> },
  ) {
    return this.templateService.preview(id, body.variables ?? {});
  }
}
