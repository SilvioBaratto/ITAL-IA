import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateItemDto, UpdateItemDto, ItemResponseDto } from './dto/item.dto';

@Injectable()
export class TestService {
  private items: Map<string, ItemResponseDto> = new Map();

  findAll(): ItemResponseDto[] {
    return Array.from(this.items.values());
  }

  findOne(id: string): ItemResponseDto {
    const item = this.items.get(id);
    if (!item) {
      throw new NotFoundException(`Item with id '${id}' not found`);
    }
    return item;
  }

  create(createItemDto: CreateItemDto): ItemResponseDto {
    const now = new Date().toISOString();
    const item: ItemResponseDto = {
      id: uuidv4(),
      ...createItemDto,
      created_at: now,
      updated_at: now,
    };
    this.items.set(item.id, item);
    return item;
  }

  update(id: string, updateItemDto: UpdateItemDto): ItemResponseDto {
    const existing = this.findOne(id);
    const updated: ItemResponseDto = {
      ...existing,
      ...updateItemDto,
      updated_at: new Date().toISOString(),
    };
    this.items.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    if (!this.items.has(id)) {
      throw new NotFoundException(`Item with id '${id}' not found`);
    }
    this.items.delete(id);
  }
}
