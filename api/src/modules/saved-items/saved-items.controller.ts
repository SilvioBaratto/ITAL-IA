import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SavedItemsService } from './saved-items.service';
import {
  CreateSavedItemDto,
  ListSavedItemsQueryDto,
  CheckSavedItemQueryDto,
} from './dto/saved-item.dto';

@ApiTags('SavedItems')
@ApiBearerAuth()
@Controller('saved-items')
export class SavedItemsController {
  private readonly logger = new Logger(SavedItemsController.name);

  constructor(private readonly savedItemsService: SavedItemsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert a saved item for the authenticated user' })
  async upsert(@Body() dto: CreateSavedItemDto, @Request() req: any) {
    const userId = req.user.id;
    return this.savedItemsService.upsert(userId, dto);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if an item is already saved' })
  async check(@Query() query: CheckSavedItemQueryDto, @Request() req: any) {
    const userId = req.user.id;
    return this.savedItemsService.check(userId, query);
  }

  @Get()
  @ApiOperation({ summary: 'List saved items for the authenticated user, optionally filtered by region or category' })
  async list(@Query() query: ListSavedItemsQueryDto, @Request() req: any) {
    const userId = req.user.id;
    return this.savedItemsService.listForUser(userId, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a saved item (verifies user ownership)' })
  async delete(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    await this.savedItemsService.delete(id, userId);
  }
}
