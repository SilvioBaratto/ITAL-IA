import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  deleteAccount: jest.fn(),
};

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@example.com',
  role: 'authenticated',
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('should return the user provided by @CurrentUser', () => {
      const result = controller.getMe(mockUser as any);

      expect(result).toEqual(mockUser);
    });

    it('should return id, email, and role fields', () => {
      const result = controller.getMe(mockUser as any);

      expect(result).toHaveProperty('id', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(result).toHaveProperty('role', mockUser.role);
    });
  });

  describe('deleteAccount', () => {
    it('should call AuthService.deleteAccount with user.id', async () => {
      mockAuthService.deleteAccount.mockResolvedValue(undefined);

      await controller.deleteAccount(mockUser as any);

      expect(mockAuthService.deleteAccount).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return success message on account deletion', async () => {
      mockAuthService.deleteAccount.mockResolvedValue(undefined);

      const result = await controller.deleteAccount(mockUser as any);

      expect(result).toEqual({ message: 'Account eliminato con successo.' });
    });

    it('should throw InternalServerErrorException when AuthService.deleteAccount rejects', async () => {
      mockAuthService.deleteAccount.mockRejectedValue(new Error('Supabase error'));

      await expect(controller.deleteAccount(mockUser as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
