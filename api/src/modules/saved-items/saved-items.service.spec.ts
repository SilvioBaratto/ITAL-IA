import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SavedItemsService } from './saved-items.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PoiService } from '../poi/poi.service';

const mockPrisma = {
  savedItem: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockPoiService = {
  findByNameAndRegion: jest.fn().mockResolvedValue(null),
};

describe('SavedItemsService', () => {
  let service: SavedItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedItemsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PoiService, useValue: mockPoiService },
      ],
    }).compile();

    service = module.get<SavedItemsService>(SavedItemsService);
    jest.clearAllMocks();
  });

  const userId = '00000000-0000-0000-0000-000000000001';

  describe('upsert', () => {
    const dto = {
      name: 'Trattoria da Mario',
      category: 'RESTAURANT' as const,
      region: 'Friuli Venezia Giulia',
      description: 'Traditional osteria',
    };

    it('should upsert a saved item', async () => {
      const expected = { id: 'abc', userId, ...dto, savedAt: new Date() };
      mockPrisma.savedItem.upsert.mockResolvedValue(expected);

      const result = await service.upsert(userId, dto);

      expect(result).toEqual(expected);
      expect(mockPrisma.savedItem.upsert).toHaveBeenCalledWith({
        where: {
          userId_name_regionId_category: {
            userId,
            name: dto.name,
            regionId: dto.region,
            category: dto.category,
          },
        },
        create: expect.objectContaining({ userId, name: dto.name }),
        update: expect.objectContaining({ description: dto.description }),
      });
    });

    it('should pass optional fields to create/update', async () => {
      const fullDto = {
        ...dto,
        address: 'Via Roma 1',
        mapsUrl: 'https://maps.google.com/test',
        website: 'https://example.com',
        imageUrl: 'https://example.com/img.jpg',
      };
      mockPrisma.savedItem.upsert.mockResolvedValue({ id: 'abc', userId, ...fullDto });

      await service.upsert(userId, fullDto);

      expect(mockPrisma.savedItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            address: 'Via Roma 1',
            mapsUrl: 'https://maps.google.com/test',
            website: 'https://example.com',
            imageUrl: 'https://example.com/img.jpg',
          }),
        }),
      );
    });
  });

  describe('listForUser', () => {
    const mockItems = [{ id: 'abc', userId, name: 'Test', savedAt: new Date() }];

    beforeEach(() => {
      mockPrisma.$transaction.mockResolvedValue([mockItems, 1]);
    });

    it('should return paginated envelope { data, total, limit, offset }', async () => {
      const result = await service.listForUser(userId, { limit: 20, offset: 0 });

      expect(result).toEqual({ data: mockItems, total: 1, limit: 20, offset: 0 });
    });

    it('should call findMany with take and skip', async () => {
      await service.listForUser(userId, { limit: 20, offset: 0 });

      expect(mockPrisma.savedItem.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { savedAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should call count with the same where clause', async () => {
      await service.listForUser(userId, { limit: 20, offset: 0 });

      expect(mockPrisma.savedItem.count).toHaveBeenCalledWith({ where: { userId } });
    });

    it('should filter by region', async () => {
      await service.listForUser(userId, { region: 'Friuli Venezia Giulia', limit: 20, offset: 0 });

      expect(mockPrisma.savedItem.findMany).toHaveBeenCalledWith({
        where: { userId, regionId: 'Friuli Venezia Giulia' },
        orderBy: { savedAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(mockPrisma.savedItem.count).toHaveBeenCalledWith({
        where: { userId, regionId: 'Friuli Venezia Giulia' },
      });
    });

    it('should filter by category', async () => {
      await service.listForUser(userId, { category: 'MUSEUM', limit: 20, offset: 0 });

      expect(mockPrisma.savedItem.findMany).toHaveBeenCalledWith({
        where: { userId, category: 'MUSEUM' },
        orderBy: { savedAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by both region and category', async () => {
      await service.listForUser(userId, {
        region: 'Friuli Venezia Giulia',
        category: 'RESTAURANT',
        limit: 10,
        offset: 20,
      });

      expect(mockPrisma.savedItem.findMany).toHaveBeenCalledWith({
        where: { userId, regionId: 'Friuli Venezia Giulia', category: 'RESTAURANT' },
        orderBy: { savedAt: 'desc' },
        take: 10,
        skip: 20,
      });
    });

    it('should pass custom limit and offset', async () => {
      await service.listForUser(userId, { limit: 5, offset: 10 });

      expect(mockPrisma.savedItem.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { savedAt: 'desc' },
        take: 5,
        skip: 10,
      });
    });
  });

  describe('delete', () => {
    it('should delete an item owned by the user', async () => {
      const item = { id: 'abc', userId };
      mockPrisma.savedItem.findFirst.mockResolvedValue(item);
      mockPrisma.savedItem.delete.mockResolvedValue(item);

      await service.delete('abc', userId);

      expect(mockPrisma.savedItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'abc', userId },
      });
      expect(mockPrisma.savedItem.delete).toHaveBeenCalledWith({
        where: { id: 'abc' },
      });
    });

    it('should throw NotFoundException if item not found or not owned', async () => {
      mockPrisma.savedItem.findFirst.mockResolvedValue(null);

      await expect(service.delete('abc', userId)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.savedItem.delete).not.toHaveBeenCalled();
    });
  });

  describe('check', () => {
    const query = {
      name: 'Trattoria da Mario',
      region: 'Friuli Venezia Giulia',
      category: 'RESTAURANT' as const,
    };

    it('should return isSaved true with id when item exists', async () => {
      mockPrisma.savedItem.findFirst.mockResolvedValue({ id: 'abc' });

      const result = await service.check(userId, query);

      expect(result).toEqual({ isSaved: true, id: 'abc' });
      expect(mockPrisma.savedItem.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          name: query.name,
          regionId: query.region,
          category: query.category,
        },
        select: { id: true },
      });
    });

    it('should return isSaved false when item does not exist', async () => {
      mockPrisma.savedItem.findFirst.mockResolvedValue(null);

      const result = await service.check(userId, query);

      expect(result).toEqual({ isSaved: false });
    });
  });
});
