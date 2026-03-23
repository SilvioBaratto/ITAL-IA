import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from './auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserInfoDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user info' })
  getMe(@CurrentUser() user: UserInfoDto): UserInfoDto {
    return user;
  }
}
