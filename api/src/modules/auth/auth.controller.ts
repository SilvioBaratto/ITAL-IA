import { Controller, Delete, Get, HttpCode, InternalServerErrorException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeleteAccountResponseDto, UserInfoDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user info' })
  getMe(@CurrentUser() user: UserInfoDto): UserInfoDto {
    return user;
  }

  @Delete('account')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete the authenticated user account and all associated data' })
  async deleteAccount(@CurrentUser() user: UserInfoDto): Promise<DeleteAccountResponseDto> {
    try {
      await this.authService.deleteAccount(user.id);
      return { message: 'Account eliminato con successo.' };
    } catch {
      throw new InternalServerErrorException('Failed to delete account');
    }
  }
}
