import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const ActivityTypeEnum = z.enum([
  'MEAL',
  'VISIT',
  'TRANSPORT',
  'WALK',
  'NIGHTLIFE',
  'SHOW',
  'SHOPPING',
  'REST',
]);

export const UpdateTripSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  city: z.string().min(1).max(255).optional(),
});

export const UpdateTripDaySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  theme: z.string().max(500).nullable().optional(),
});

export const UpdateActivitySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  startTime: z.string().max(10).nullable().optional(),
  endTime: z.string().max(10).nullable().optional(),
  activityType: ActivityTypeEnum.optional(),
});

export const CreateActivitySchema = z.object({
  title: z.string().min(1).max(500),
  activityType: ActivityTypeEnum,
  description: z.string().nullable().optional(),
  startTime: z.string().max(10).nullable().optional(),
  endTime: z.string().max(10).nullable().optional(),
  sortOrder: z.number().int().positive().optional(),
});

export const ReorderActivitiesSchema = z.object({
  activityIds: z.array(z.string().uuid()).min(1),
});

export class UpdateTripDto extends createZodDto(UpdateTripSchema) {}
export class UpdateTripDayDto extends createZodDto(UpdateTripDaySchema) {}
export class UpdateActivityDto extends createZodDto(UpdateActivitySchema) {}
export class CreateActivityDto extends createZodDto(CreateActivitySchema) {}
export class ReorderActivitiesDto extends createZodDto(ReorderActivitiesSchema) {}
