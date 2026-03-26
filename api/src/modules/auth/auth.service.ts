import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabase: SupabaseClient;
  private readonly supabaseUrl: string;
  private adminClient: SupabaseClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const supabaseKey = this.configService.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY');
    this.supabase = createClient(this.supabaseUrl, supabaseKey);
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

  async deleteAccount(userId: string): Promise<void> {
    // Delete from Supabase auth first — invalidates the user's JWT immediately
    // and is the operation that cannot be rolled back, so it must succeed before
    // we touch application data.
    const { error } = await this.getAdminClient().auth.admin.deleteUser(userId);
    if (error) {
      this.logger.error(`Failed to delete Supabase user ${userId}: ${error.message}`);
      throw new Error('Failed to delete account');
    }

    await this.prisma.savedItem.deleteMany({ where: { userId } });
  }

  private getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      const serviceRoleKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
      this.adminClient = createClient(this.supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return this.adminClient;
  }
}
