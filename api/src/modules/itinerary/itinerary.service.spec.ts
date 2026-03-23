import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ItineraryService } from './itinerary.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ItineraryService', () => {
  let service: ItineraryService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn(),
    trip: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    tripDay: {
      create: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    activityHighlight: {
      create: jest.fn(),
    },
    place: {
      create: jest.fn(),
    },
    booking: {
      create: jest.fn(),
    },
    travelTip: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItineraryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ItineraryService>(ItineraryService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadPdfAndExtract', () => {
    it('should throw BadRequestException when PDF extraction fails', async () => {
      const invalidPdfBuffer = Buffer.from('invalid pdf content');
      const userId = 'user-123';

      await expect(
        service.uploadPdfAndExtract(invalidPdfBuffer, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully process valid PDF and create trip', async () => {
      // This test would require mocking the BAML client
      // For now, this serves as a placeholder for integration testing
      expect(service).toBeDefined();
    });
  });

  describe('mapActivityType', () => {
    it('should map valid activity type strings to enum', () => {
      const service = new ItineraryService(prismaService);
      // Access private method via any for testing
      const result = (service as any).mapActivityType('MEAL');
      expect(result).toBe('MEAL');
    });

    it('should default to VISIT for unknown activity types', () => {
      const service = new ItineraryService(prismaService);
      const result = (service as any).mapActivityType('UNKNOWN');
      expect(result).toBe('VISIT');
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration between valid times', () => {
      const service = new ItineraryService(prismaService);
      const result = (service as any).calculateDuration('09:00', '11:30');
      expect(result).toBe(150); // 2.5 hours = 150 minutes
    });

    it('should return null for missing times', () => {
      const service = new ItineraryService(prismaService);
      const result = (service as any).calculateDuration(undefined, '11:30');
      expect(result).toBeNull();
    });

    it('should return null for invalid time format', () => {
      const service = new ItineraryService(prismaService);
      const result = (service as any).calculateDuration('invalid', '11:30');
      expect(result).toBeNull();
    });
  });
});
