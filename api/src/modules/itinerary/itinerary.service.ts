import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityType, PlaceType, TipCategory } from '@generated/prisma';
import { UpdateTripDto, UpdateTripDayDto, UpdateActivityDto, CreateActivityDto } from './dto/update-itinerary.dto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

interface ParsedItinerary {
  title: string;
  city: string;
  start_date: string;
  end_date: string;
  days: ItineraryDay[];
  bookings: BookingInfo[];
  tips: TravelTipInfo[];
}

interface ItineraryDay {
  day_number: number;
  date: string;
  title: string;
  theme?: string;
  activities: ActivityEntry[];
}

interface ActivityEntry {
  start_time?: string;
  end_time?: string;
  title: string;
  description: string;
  activity_type: string;
  place_name?: string;
  address?: string;
  neighborhood?: string;
  price_min_cents?: number;
  price_max_cents?: number;
  price_note?: string;
  highlights: string[];
  is_alternative: boolean;
  alternative_to?: string;
}

interface BookingInfo {
  attraction_name: string;
  price_cents?: number;
  discount_note?: string;
  booking_url?: string;
}

interface TravelTipInfo {
  category: string;
  content: string;
}

@Injectable()
export class ItineraryService {
  private readonly logger = new Logger(ItineraryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTripsForUser(userId: string) {
    return this.prisma.trip.findMany({
      where: {
        OR: [
          { userId },
          { isShared: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { days: true } },
      },
    });
  }

  async getTripById(tripId: string, userId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            activities: {
              orderBy: { sortOrder: 'asc' },
              include: {
                place: true,
                highlights: { orderBy: { sortOrder: 'asc' } },
                alternatives: {
                  include: {
                    place: true,
                    highlights: { orderBy: { sortOrder: 'asc' } },
                  },
                },
              },
            },
          },
        },
        bookings: { include: { place: true } },
        tips: true,
      },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    const isOwner = trip.userId === userId;
    const isShared = trip.isShared;

    if (!isOwner && !isShared) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    return trip;
  }

  async uploadPdfAndExtract(pdfBuffer: Buffer, userId: string) {
    this.logger.log(`Extracting itinerary from PDF (${pdfBuffer.length} bytes) for user ${userId}`);

    // Step 1: Extract structured data using BAML
    const parsedItinerary = await this.extractItineraryFromPdf(pdfBuffer);

    // Step 2: Save to database in transaction
    const trip = await this.saveItineraryToDatabase(parsedItinerary, userId);

    if (!trip) {
      throw new BadRequestException('Failed to create trip');
    }

    this.logger.log(`Successfully created trip ${trip.id} with ${trip.days.length} days`);
    return trip;
  }

  // ── CRUD helpers ──────────────────────────────────────────────────

  private async assertTripAccess(tripId: string, userId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { userId: true, isShared: true },
    });
    if (!trip || (trip.userId !== userId && !trip.isShared)) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    return trip;
  }

  async updateTrip(tripId: string, data: UpdateTripDto, userId: string) {
    await this.assertTripAccess(tripId, userId);
    return this.prisma.trip.update({
      where: { id: tripId },
      data,
    });
  }

  async updateTripDay(tripId: string, dayId: string, data: UpdateTripDayDto, userId: string) {
    await this.assertTripAccess(tripId, userId);
    const day = await this.prisma.tripDay.findUnique({
      where: { id: dayId },
      select: { tripId: true },
    });
    if (!day || day.tripId !== tripId) {
      throw new NotFoundException(`Day ${dayId} not found in trip ${tripId}`);
    }
    return this.prisma.tripDay.update({
      where: { id: dayId },
      data,
    });
  }

  async updateActivity(tripId: string, activityId: string, data: UpdateActivityDto, userId: string) {
    await this.assertTripAccess(tripId, userId);
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { tripDay: { select: { tripId: true } } },
    });
    if (!activity || activity.tripDay.tripId !== tripId) {
      throw new NotFoundException(`Activity ${activityId} not found in trip ${tripId}`);
    }

    const updateData: any = { ...data };
    if (data.activityType) {
      updateData.activityType = this.mapActivityType(data.activityType);
    }
    // Recalculate duration if times changed
    const startTime = data.startTime !== undefined ? data.startTime : activity.startTime;
    const endTime = data.endTime !== undefined ? data.endTime : activity.endTime;
    updateData.durationMinutes = this.calculateDuration(startTime ?? undefined, endTime ?? undefined);

    return this.prisma.activity.update({
      where: { id: activityId },
      data: updateData,
      include: { place: true, highlights: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createActivity(tripId: string, dayId: string, data: CreateActivityDto, userId: string) {
    await this.assertTripAccess(tripId, userId);
    const day = await this.prisma.tripDay.findUnique({
      where: { id: dayId },
      select: { tripId: true },
    });
    if (!day || day.tripId !== tripId) {
      throw new NotFoundException(`Day ${dayId} not found in trip ${tripId}`);
    }

    // If no sortOrder given, put it at the end
    let sortOrder = data.sortOrder;
    if (!sortOrder) {
      const last = await this.prisma.activity.findFirst({
        where: { tripDayId: dayId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? 0) + 1;
    }

    return this.prisma.activity.create({
      data: {
        tripDayId: dayId,
        sortOrder,
        title: data.title,
        description: data.description ?? null,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMinutes: this.calculateDuration(data.startTime ?? undefined, data.endTime ?? undefined),
        activityType: this.mapActivityType(data.activityType),
      },
      include: { place: true, highlights: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async deleteActivity(tripId: string, activityId: string, userId: string) {
    await this.assertTripAccess(tripId, userId);
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { tripDay: { select: { tripId: true } } },
    });
    if (!activity || activity.tripDay.tripId !== tripId) {
      throw new NotFoundException(`Activity ${activityId} not found in trip ${tripId}`);
    }
    await this.prisma.activity.delete({ where: { id: activityId } });
  }

  async reorderActivities(tripId: string, dayId: string, activityIds: string[], userId: string) {
    await this.assertTripAccess(tripId, userId);
    const day = await this.prisma.tripDay.findUnique({
      where: { id: dayId },
      select: { tripId: true },
    });
    if (!day || day.tripId !== tripId) {
      throw new NotFoundException(`Day ${dayId} not found in trip ${tripId}`);
    }

    // First clear all sortOrders to avoid unique constraint violations
    await this.prisma.$transaction(async (tx) => {
      // Temporarily set negative sortOrders
      for (let i = 0; i < activityIds.length; i++) {
        await tx.activity.update({
          where: { id: activityIds[i] },
          data: { sortOrder: -(i + 1) },
        });
      }
      // Then set final positive values
      for (let i = 0; i < activityIds.length; i++) {
        await tx.activity.update({
          where: { id: activityIds[i] },
          data: { sortOrder: i + 1 },
        });
      }
    });
  }

  async deleteDay(tripId: string, dayId: string, userId: string) {
    await this.assertTripAccess(tripId, userId);
    const day = await this.prisma.tripDay.findUnique({
      where: { id: dayId },
      select: { tripId: true },
    });
    if (!day || day.tripId !== tripId) {
      throw new NotFoundException(`Day ${dayId} not found in trip ${tripId}`);
    }
    await this.prisma.tripDay.delete({ where: { id: dayId } });
  }

  async getMostRecentTrip(userId: string) {
    return this.prisma.trip.findFirst({
      where: {
        OR: [
          { userId },
          { isShared: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            activities: {
              orderBy: { sortOrder: 'asc' },
              include: {
                place: true,
                highlights: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
        bookings: { include: { place: true } },
        tips: true,
      },
    });
  }

  // ── PDF extraction ──────────────────────────────────────────────

  private async extractItineraryFromPdf(pdfBuffer: Buffer): Promise<ParsedItinerary> {
    try {
      // Extract text from PDF (Azure OpenAI doesn't support PDF file input)
      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text;
      this.logger.log(`Extracted ${pdfText.length} chars from PDF (${pdfData.numpages} pages)`);

      const { b } = await import('../../../baml_client');
      const result = await b.ExtractItinerary(pdfText);
      return result as ParsedItinerary;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error(`BAML extraction failed: ${msg}`);
      if (stack) this.logger.error(`Stack: ${stack.substring(0, 500)}`);
      throw new BadRequestException(`PDF extraction failed: ${msg}`);
    }
  }

  private async saveItineraryToDatabase(parsedItinerary: ParsedItinerary, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Step 1: Create/find all unique places
      const placeMap = await this.upsertPlaces(tx, parsedItinerary);

      // Step 2: Create the trip
      const trip = await tx.trip.create({
        data: {
          userId,
          title: parsedItinerary.title,
          city: parsedItinerary.city,
          startDate: new Date(parsedItinerary.start_date),
          endDate: new Date(parsedItinerary.end_date),
        },
      });

      // Step 3: Create trip days with activities
      for (const dayData of parsedItinerary.days) {
        const tripDay = await tx.tripDay.create({
          data: {
            tripId: trip.id,
            dayNumber: dayData.day_number,
            date: new Date(dayData.date),
            title: dayData.title,
            theme: dayData.theme || null,
          },
        });

        // Build activity map for alternative references
        const activityMap = new Map<string, string>();

        // First pass: create all main activities
        const sortedActivities = [...dayData.activities].sort((a, b) => {
          if (a.is_alternative && !b.is_alternative) return 1;
          if (!a.is_alternative && b.is_alternative) return -1;
          return 0;
        });

        let sortOrder = 1;
        for (const activityData of sortedActivities) {
          const placeId = activityData.place_name
            ? placeMap.get(activityData.place_name)
            : null;

          const alternativeToId = activityData.is_alternative && activityData.alternative_to
            ? activityMap.get(activityData.alternative_to)
            : null;

          const activity = await tx.activity.create({
            data: {
              tripDayId: tripDay.id,
              sortOrder: sortOrder++,
              title: activityData.title,
              description: activityData.description || null,
              startTime: activityData.start_time || null,
              endTime: activityData.end_time || null,
              durationMinutes: this.calculateDuration(activityData.start_time, activityData.end_time),
              activityType: this.mapActivityType(activityData.activity_type),
              priceMinCents: activityData.price_min_cents || null,
              priceMaxCents: activityData.price_max_cents || null,
              priceCurrency: 'EUR',
              priceNote: activityData.price_note || null,
              placeId: placeId || null,
              alternativeToId: alternativeToId || null,
            },
          });

          activityMap.set(activityData.title, activity.id);

          // Create highlights
          for (let i = 0; i < activityData.highlights.length; i++) {
            await tx.activityHighlight.create({
              data: {
                activityId: activity.id,
                sortOrder: i + 1,
                description: activityData.highlights[i],
              },
            });
          }
        }
      }

      // Step 4: Create bookings
      for (const bookingData of parsedItinerary.bookings) {
        const placeId = placeMap.get(bookingData.attraction_name) || null;

        await tx.booking.create({
          data: {
            tripId: trip.id,
            placeId: placeId,
            attractionName: bookingData.attraction_name,
            priceCents: bookingData.price_cents || null,
            priceCurrency: 'EUR',
            discountNote: bookingData.discount_note || null,
            bookingUrl: bookingData.booking_url || null,
          },
        });
      }

      // Step 5: Create travel tips
      for (const tipData of parsedItinerary.tips) {
        await tx.travelTip.create({
          data: {
            tripId: trip.id,
            category: this.mapTipCategory(tipData.category),
            content: tipData.content,
          },
        });
      }

      // Return the complete trip with all relations
      return tx.trip.findUnique({
        where: { id: trip.id },
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              activities: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  place: true,
                  highlights: { orderBy: { sortOrder: 'asc' } },
                  alternatives: true,
                },
              },
            },
          },
          bookings: {
            include: { place: true },
          },
          tips: true,
        },
      });
    }, { timeout: 30000 });
  }

  private async upsertPlaces(tx: any, parsedItinerary: ParsedItinerary): Promise<Map<string, string>> {
    const placeMap = new Map<string, string>();
    const uniquePlaces = new Set<string>();

    // Collect all unique place names
    for (const day of parsedItinerary.days) {
      for (const activity of day.activities) {
        if (activity.place_name) {
          uniquePlaces.add(activity.place_name);
        }
      }
    }

    for (const booking of parsedItinerary.bookings) {
      uniquePlaces.add(booking.attraction_name);
    }

    // Create or find each place
    for (const placeName of uniquePlaces) {
      // Find the activity with the most complete place data
      let bestActivity: ActivityEntry | null = null;
      for (const day of parsedItinerary.days) {
        for (const activity of day.activities) {
          if (activity.place_name === placeName) {
            if (!bestActivity || (activity.address && !bestActivity.address)) {
              bestActivity = activity;
            }
          }
        }
      }

      const placeType = this.inferPlaceType(bestActivity?.activity_type || 'VISIT');

      const place = await tx.place.create({
        data: {
          name: placeName,
          address: bestActivity?.address || null,
          neighborhood: bestActivity?.neighborhood || null,
          latitude: null,
          longitude: null,
          placeType,
          websiteUrl: null,
        },
      });

      placeMap.set(placeName, place.id);
    }

    return placeMap;
  }

  private mapActivityType(type: string): ActivityType {
    const normalized = type.toUpperCase();
    if (normalized in ActivityType) {
      return ActivityType[normalized as keyof typeof ActivityType];
    }
    this.logger.warn(`Unknown activity type: ${type}, defaulting to VISIT`);
    return ActivityType.VISIT;
  }

  private mapTipCategory(category: string): TipCategory {
    const normalized = category.toUpperCase();
    if (normalized in TipCategory) {
      return TipCategory[normalized as keyof typeof TipCategory];
    }
    this.logger.warn(`Unknown tip category: ${category}, defaulting to TRANSPORT`);
    return TipCategory.TRANSPORT;
  }

  private inferPlaceType(activityType: string): PlaceType {
    const typeMap: Record<string, PlaceType> = {
      MEAL: PlaceType.RESTAURANT,
      VISIT: PlaceType.MUSEUM,
      NIGHTLIFE: PlaceType.BAR,
      SHOW: PlaceType.VENUE,
      SHOPPING: PlaceType.MARKET,
      WALK: PlaceType.NEIGHBORHOOD,
    };

    const normalized = activityType.toUpperCase();
    return typeMap[normalized] || PlaceType.LANDMARK;
  }

  private calculateDuration(startTime?: string, endTime?: string): number | null {
    if (!startTime || !endTime) return null;

    try {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      // Check for NaN values
      if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
        return null;
      }

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      const duration = endMinutes - startMinutes;
      return isNaN(duration) ? null : duration;
    } catch {
      return null;
    }
  }
}
