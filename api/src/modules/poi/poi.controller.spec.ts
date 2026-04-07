import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PoiController } from './poi.controller';
import { PoiService } from './poi.service';

const mockPoiService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  getStats: jest.fn(),
  findRelated: jest.fn(),
};

describe('PoiController', () => {
  let controller: PoiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoiController],
      providers: [{ provide: PoiService, useValue: mockPoiService }],
    }).compile();

    controller = module.get<PoiController>(PoiController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call PoiService.findAll with query and return paginated result', async () => {
      const query = { regionId: 'friuli-venezia-giulia', limit: 10, offset: 0 };
      const paginated = { data: [{ id: 'poi-1' }], total: 1, limit: 10, offset: 0 };
      mockPoiService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(query as any);

      expect(mockPoiService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginated);
    });
  });

  describe('getStats', () => {
    it('should call PoiService.getStats with regionId', async () => {
      const stats = [{ category: 'RESTAURANT', count: 15 }];
      mockPoiService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats({ regionId: 'friuli-venezia-giulia' } as any);

      expect(mockPoiService.getStats).toHaveBeenCalledWith('friuli-venezia-giulia');
      expect(result).toEqual(stats);
    });

    it('should call PoiService.getStats with undefined when no regionId', async () => {
      mockPoiService.getStats.mockResolvedValue([]);

      await controller.getStats({} as any);

      expect(mockPoiService.getStats).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('should call PoiService.findOne with id', async () => {
      const poi = { id: 'poi-1', name: 'Trattoria' };
      mockPoiService.findOne.mockResolvedValue(poi);

      const result = await controller.findOne('poi-1');

      expect(mockPoiService.findOne).toHaveBeenCalledWith('poi-1');
      expect(result).toEqual(poi);
    });

    it('should propagate NotFoundException from service', async () => {
      mockPoiService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRelated', () => {
    it('should call PoiService.findRelated with id', async () => {
      const related = [
        { id: 'poi-2', name: 'Osteria', category: 'RESTAURANT', imageUrl: null, address: 'Via Roma' },
      ];
      mockPoiService.findRelated.mockResolvedValue(related);

      const result = await controller.findRelated('poi-1');

      expect(mockPoiService.findRelated).toHaveBeenCalledWith('poi-1');
      expect(result).toEqual(related);
    });

    it('should propagate NotFoundException when POI not found', async () => {
      mockPoiService.findRelated.mockRejectedValue(new NotFoundException());

      await expect(controller.findRelated('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
