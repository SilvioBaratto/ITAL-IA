import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Response DTOs matching Prisma schema
export const PlaceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  neighborhood: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  placeType: z.enum([
    'RESTAURANT',
    'MUSEUM',
    'PARK',
    'MARKET',
    'BAR',
    'LANDMARK',
    'VENUE',
    'CHURCH',
    'ROOFTOP',
    'NEIGHBORHOOD',
  ]),
  websiteUrl: z.string().nullable(),
});

export const ActivityHighlightResponseSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  sortOrder: z.number(),
  description: z.string(),
});

export const ActivityResponseSchema: z.ZodType<any> = z.object({
  id: z.string().uuid(),
  tripDayId: z.string().uuid(),
  sortOrder: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  activityType: z.enum([
    'MEAL',
    'VISIT',
    'TRANSPORT',
    'WALK',
    'NIGHTLIFE',
    'SHOW',
    'SHOPPING',
    'REST',
  ]),
  priceMinCents: z.number().nullable(),
  priceMaxCents: z.number().nullable(),
  priceCurrency: z.string(),
  priceNote: z.string().nullable(),
  placeId: z.string().uuid().nullable(),
  alternativeToId: z.string().uuid().nullable(),
  place: PlaceResponseSchema.nullable(),
  highlights: z.array(ActivityHighlightResponseSchema),
  alternatives: z.array(z.lazy(() => ActivityResponseSchema)),
});

export const TripDayResponseSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  dayNumber: z.number(),
  date: z.date(),
  title: z.string(),
  theme: z.string().nullable(),
  activities: z.array(ActivityResponseSchema),
});

export const BookingResponseSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  placeId: z.string().uuid().nullable(),
  attractionName: z.string(),
  priceCents: z.number().nullable(),
  priceCurrency: z.string(),
  discountNote: z.string().nullable(),
  bookingUrl: z.string().nullable(),
  place: PlaceResponseSchema.nullable(),
});

export const TravelTipResponseSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  category: z.enum(['TRANSPORT', 'SAFETY', 'BUDGET', 'PACKING']),
  content: z.string(),
});

export const TripResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  city: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  days: z.array(TripDayResponseSchema),
  bookings: z.array(BookingResponseSchema),
  tips: z.array(TravelTipResponseSchema),
});

export class PlaceResponseDto extends createZodDto(PlaceResponseSchema) {}
export class ActivityHighlightResponseDto extends createZodDto(
  ActivityHighlightResponseSchema,
) {}
export class ActivityResponseDto extends createZodDto(ActivityResponseSchema) {}
export class TripDayResponseDto extends createZodDto(TripDayResponseSchema) {}
export class BookingResponseDto extends createZodDto(BookingResponseSchema) {}
export class TravelTipResponseDto extends createZodDto(TravelTipResponseSchema) {}
export class TripResponseDto extends createZodDto(TripResponseSchema) {}
