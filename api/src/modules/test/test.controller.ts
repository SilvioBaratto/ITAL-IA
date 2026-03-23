import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TestService } from './test.service';
import { CreateItemDto, UpdateItemDto, ItemResponseDto } from './dto/item.dto';
import { EchoRequestDto, EchoResponseDto } from './dto/echo.dto';

@ApiTags('Test')
@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get('ping')
  @ApiOperation({ summary: 'Ping endpoint' })
  ping() {
    return { message: 'pong' };
  }

  @Get('echo/:message')
  @ApiOperation({ summary: 'Echo a message (GET)' })
  echoGet(@Param('message') message: string): EchoResponseDto {
    return { message };
  }

  @Post('echo')
  @ApiOperation({ summary: 'Echo a message (POST)' })
  echoPost(@Body() body: EchoRequestDto): EchoResponseDto {
    return { message: body.message };
  }

  @Get('items')
  @ApiOperation({ summary: 'List all items' })
  findAll(): ItemResponseDto[] {
    return this.testService.findAll();
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an item' })
  @ApiResponse({ status: 201, description: 'Item created' })
  create(@Body() createItemDto: CreateItemDto): ItemResponseDto {
    return this.testService.create(createItemDto);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get an item by ID' })
  findOne(@Param('id') id: string): ItemResponseDto {
    return this.testService.findOne(id);
  }

  @Put('items/:id')
  @ApiOperation({ summary: 'Update an item' })
  update(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
  ): ItemResponseDto {
    return this.testService.update(id, updateItemDto);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an item' })
  remove(@Param('id') id: string): void {
    this.testService.remove(id);
  }
}
