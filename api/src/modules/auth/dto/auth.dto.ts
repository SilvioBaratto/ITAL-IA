import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UserInfoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
});

export class UserInfoDto extends createZodDto(UserInfoSchema) {}
