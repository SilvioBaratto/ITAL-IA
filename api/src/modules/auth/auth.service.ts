import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const supabaseKey = this.configService.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY');
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('Supabase auth service initialized');
  }

  async getUser(jwt: string): Promise<{ id: string; email: string; role: string }> {
    const { data, error } = await this.supabase.auth.getUser(jwt);

    if (error || !data.user) {
      this.logger.warn(`Token validation failed: ${error?.message ?? 'No user returned'}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      role: data.user.role ?? 'authenticated',
    };
  }
}
