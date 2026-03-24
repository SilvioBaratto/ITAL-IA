import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SavedItemsController } from './saved-items.controller';
import { SavedItemsService } from './saved-items.service';

const mockSavedItemsService = {
  upsert: jest.fn(),
  listForUser: jest.fn(),
  check: jest.fn(),
  delete: jest.fn(),
};

const USER_ID = '00000000-0000-0000-0000-000000000001';
const mockReq = { user: { id: USER_ID } };

describe('SavedItemsController', () => {
  let controller: SavedItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedItemsController],
      providers: [{ provide: SavedItemsService, useValue: mockSavedItemsService }],
    }).compile();

    controller = module.get<SavedItemsController>(SavedItemsController);
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    const dto = {
      name: 'Trattoria da Mario',
      category: 'RESTAURANT' as const,
      region: 'Friuli Venezia Giulia',
      description: 'Traditional osteria',
    };

    it('should call SavedItemsService.upsert with userId from req.user.id and dto', async () => {
      mockSavedItemsService.upsert.mockResolvedValue({ id: 'abc', userId: USER_ID, ...dto });

      await controller.upsert(dto as any, mockReq as any);

      expect(mockSavedItemsService.upsert).toHaveBeenCalledWith(USER_ID, dto);
    });

    it('should return the upserted item from the service', async () => {
      const expected = { id: 'abc', userId: USER_ID, ...dto, savedAt: new Date() };
      mockSavedItemsService.upsert.mockResolvedValue(expected);

      const result = await controller.upsert(dto as any, mockReq as any);

      expect(result).toEqual(expected);
    });
  });

  describe('check', () => {
    const query = {
      name: 'Trattoria da Mario',
      region: 'Friuli Venezia Giulia',
      category: 'RESTAURANT' as const,
    };

    it('should call SavedItemsService.check with userId and query', async () => {
      mockSavedItemsService.check.mockResolvedValue({ isSaved: false });

      await controller.check(query as any, mockReq as any);

      expect(mockSavedItemsService.check).toHaveBeenCalledWith(USER_ID, query);
    });

    it('should return { isSaved: true, id } when item exists', async () => {
      mockSavedItemsService.check.mockResolvedValue({ isSaved: true, id: 'abc' });

      const result = await controller.check(query as any, mockReq as any);

      expect(result).toEqual({ isSaved: true, id: 'abc' });
    });

    it('should return { isSaved: false } when item does not exist', async () => {
      mockSavedItemsService.check.mockResolvedValue({ isSaved: false });

      const result = await controller.check(query as any, mockReq as any);

      expect(result).toEqual({ isSaved: false });
    });
  });

  describe('list', () => {
    const query = { limit: 20, offset: 0 };

    it('should call SavedItemsService.listForUser with userId and query', async () => {
      mockSavedItemsService.listForUser.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });

      await controller.list(query as any, mockReq as any);

      expect(mockSavedItemsService.listForUser).toHaveBeenCalledWith(USER_ID, query);
    });

    it('should return the paginated envelope from the service', async () => {
      const paginated = { data: [{ id: 'abc' }], total: 1, limit: 20, offset: 0 };
      mockSavedItemsService.listForUser.mockResolvedValue(paginated);

      const result = await controller.list(query as any, mockReq as any);

      expect(result).toEqual(paginated);
    });
  });

  describe('delete', () => {
    it('should call SavedItemsService.delete with id and userId', async () => {
      mockSavedItemsService.delete.mockResolvedValue(undefined);

      await controller.delete('item-id', mockReq as any);

      expect(mockSavedItemsService.delete).toHaveBeenCalledWith('item-id', USER_ID);
    });

    it('should return undefined (no body) on successful delete', async () => {
      mockSavedItemsService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('item-id', mockReq as any);

      expect(result).toBeUndefined();
    });

    it('should propagate NotFoundException from service when item not found', async () => {
      mockSavedItemsService.delete.mockRejectedValue(new NotFoundException('Item not found'));

      await expect(controller.delete('bad-id', mockReq as any)).rejects.toThrow(NotFoundException);
    });
  });
});
