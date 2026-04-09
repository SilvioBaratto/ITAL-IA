import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PoiService } from './poi.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  pointOfInterest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('PoiService', () => {
  let service: PoiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoiService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PoiService>(PoiService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const mockPois = [
      { id: 'poi-1', name: 'Trattoria', regionId: 'friuli-venezia-giulia', category: 'RESTAURANT' },
    ];

    beforeEach(() => {
      mockPrisma.$transaction.mockResolvedValue([mockPois, 1]);
    });

    it('should return paginated envelope { data, total, limit, offset }', async () => {
      const result = await service.findAll({ limit: 20, offset: 0, order: 'default' });

      expect(result).toEqual({ data: mockPois, total: 1, limit: 20, offset: 0 });
    });

    it('should call findMany with take, skip, and region include', async () => {
      await service.findAll({ limit: 10, offset: 5, order: 'default' });

      expect(mockPrisma.pointOfInterest.findMany).toHaveBeenCalledWith({
        where: {},
        include: { region: { select: { id: true, name: true, group: true } } },
        orderBy: [{ regionId: 'asc' }, { category: 'asc' }, { name: 'asc' }],
        take: 10,
        skip: 5,
      });
    });

    it('should filter by regionId', async () => {
      await service.findAll({ regionId: 'friuli-venezia-giulia', limit: 20, offset: 0, order: 'default' });

      expect(mockPrisma.pointOfInterest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { regionId: 'friuli-venezia-giulia' },
        }),
      );
    });

    it('should filter by category', async () => {
      await service.findAll({ category: 'MUSEUM', limit: 20, offset: 0, order: 'default' });

      expect(mockPrisma.pointOfInterest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'MUSEUM' },
        }),
      );
    });

    it('should use same where for findMany and count', async () => {
      await service.findAll({ regionId: 'friuli-venezia-giulia', category: 'RESTAURANT', limit: 20, offset: 0, order: 'default' });

      const expectedWhere = { regionId: 'friuli-venezia-giulia', category: 'RESTAURANT' };
      expect(mockPrisma.pointOfInterest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.pointOfInterest.count).toHaveBeenCalledWith({ where: expectedWhere });
    });
  });

  describe('findOne', () => {
    it('should return a POI with nested region', async () => {
      const poi = { id: 'poi-1', name: 'Trattoria', region: { id: 'fvg', name: 'Friuli Venezia Giulia', group: 'NORD' } };
      mockPrisma.pointOfInterest.findUnique.mockResolvedValue(poi);

      const result = await service.findOne('poi-1');

      expect(result).toEqual(poi);
      expect(mockPrisma.pointOfInterest.findUnique).toHaveBeenCalledWith({
        where: { id: 'poi-1' },
        include: { region: { select: { id: true, name: true, group: true } } },
      });
    });

    it('should throw NotFoundException if POI not found', async () => {
      mockPrisma.pointOfInterest.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    const mockGroupBy = [
      { category: 'RESTAURANT', _count: { _all: 15 } },
      { category: 'MUSEUM', _count: { _all: 8 } },
      { category: 'PARK', _count: { _all: 3 } },
    ];

    it('should return category counts', async () => {
      mockPrisma.pointOfInterest.groupBy.mockResolvedValue(mockGroupBy);

      const result = await service.getStats();

      expect(result).toEqual([
        { category: 'RESTAURANT', count: 15 },
        { category: 'MUSEUM', count: 8 },
        { category: 'PARK', count: 3 },
      ]);
    });

    it('should filter by regionId when provided', async () => {
      mockPrisma.pointOfInterest.groupBy.mockResolvedValue([]);

      await service.getStats('friuli-venezia-giulia');

      expect(mockPrisma.pointOfInterest.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        where: { regionId: 'friuli-venezia-giulia' },
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
      });
    });

    it('should pass empty where when regionId is undefined', async () => {
      mockPrisma.pointOfInterest.groupBy.mockResolvedValue([]);

      await service.getStats();

      expect(mockPrisma.pointOfInterest.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        where: {},
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
      });
    });
  });

  describe('findRelated', () => {
    it('should return up to 4 related POIs excluding the current one', async () => {
      const poi = { category: 'RESTAURANT', regionId: 'friuli-venezia-giulia' };
      const related = [
        { id: 'poi-2', name: 'Osteria', category: 'RESTAURANT', imageUrl: null, address: 'Via Roma' },
        { id: 'poi-3', name: 'Pizzeria', category: 'RESTAURANT', imageUrl: null, address: null },
      ];
      mockPrisma.pointOfInterest.findUnique.mockResolvedValue(poi);
      mockPrisma.pointOfInterest.findMany.mockResolvedValue(related);

      const result = await service.findRelated('poi-1');

      expect(result).toEqual(related);
      expect(mockPrisma.pointOfInterest.findMany).toHaveBeenCalledWith({
        where: {
          regionId: 'friuli-venezia-giulia',
          category: 'RESTAURANT',
          id: { not: 'poi-1' },
        },
        select: {
          id: true,
          name: true,
          category: true,
          imageUrl: true,
          address: true,
        },
        take: 4,
        orderBy: { name: 'asc' },
      });
    });

    it('should throw NotFoundException if source POI not found', async () => {
      mockPrisma.pointOfInterest.findUnique.mockResolvedValue(null);

      await expect(service.findRelated('missing-id')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.pointOfInterest.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findByNameAndRegion', () => {
    it('should return POI id when match found', async () => {
      mockPrisma.pointOfInterest.findFirst.mockResolvedValue({ id: 'poi-1' });

      const result = await service.findByNameAndRegion('Trattoria', 'friuli-venezia-giulia');

      expect(result).toEqual({ id: 'poi-1' });
      expect(mockPrisma.pointOfInterest.findFirst).toHaveBeenCalledWith({
        where: {
          regionId: 'friuli-venezia-giulia',
          name: { equals: 'Trattoria', mode: 'insensitive' },
        },
        select: { id: true },
      });
    });

    it('should return null when no match found', async () => {
      mockPrisma.pointOfInterest.findFirst.mockResolvedValue(null);

      const result = await service.findByNameAndRegion('Nonexistent', 'friuli-venezia-giulia');

      expect(result).toBeNull();
    });
  });
});
