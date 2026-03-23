import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient, ActivityType, PlaceType, TipCategory } from '@generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

// Load .env from api/ directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROOT = path.join(__dirname, '..', '..');
const JSON_PATH = path.join(ROOT, 'kb', 'parsed-itinerary.json');
const USER_ID = '754310ad-faa5-4866-8290-a1a46b32e00e';

// Override map: place_name → correct PlaceType
// (the generic inferPlaceType maps everything from VISIT → MUSEUM, which is wrong)
const PLACE_TYPE_OVERRIDES: Record<string, PlaceType> = {
  'Palacio Real': PlaceType.LANDMARK,
  'Cattedrale dell\'Almudena + Giardini di Sabatini': PlaceType.CHURCH,
  'Templo de Debod': PlaceType.LANDMARK,
  'Jardín Botánico': PlaceType.PARK,
  'Parco del Retiro': PlaceType.PARK,
  'Azotea del Círculo de Bellas Artes': PlaceType.ROOFTOP,
  'Plaza Mayor + Mercado de San Miguel': PlaceType.LANDMARK,
  'Plaza de Cibeles': PlaceType.LANDMARK,
  'Mercado de San Fernando': PlaceType.MARKET,
  'Café Ziryab': PlaceType.VENUE,
  'El Rastro': PlaceType.MARKET,
  'Puerta de Alcalá': PlaceType.LANDMARK,
  'Bodega de la Ardosa': PlaceType.BAR,
  'Barajas Terminal 1': PlaceType.LANDMARK,
  'La Perejila / Pez Tortilla': PlaceType.RESTAURANT,
};

// Booking attraction_name → activity place_name (when they differ)
const BOOKING_PLACE_ALIASES: Record<string, string> = {
  'Café Ziryab flamenco': 'Café Ziryab',
  'Templo de Debod (interno)': 'Templo de Debod',
};

// ---------------------------------------------------------------------------
// Types (mirrors itinerary.service.ts)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapActivityType(type: string): ActivityType {
  const normalized = type.toUpperCase();
  if (normalized in ActivityType) {
    return ActivityType[normalized as keyof typeof ActivityType];
  }
  console.warn(`  Unknown activity type: ${type}, defaulting to VISIT`);
  return ActivityType.VISIT;
}

function mapTipCategory(category: string): TipCategory {
  const normalized = category.toUpperCase();
  if (normalized in TipCategory) {
    return TipCategory[normalized as keyof typeof TipCategory];
  }
  console.warn(`  Unknown tip category: ${category}, defaulting to TRANSPORT`);
  return TipCategory.TRANSPORT;
}

function inferPlaceType(activityType: string): PlaceType {
  const typeMap: Record<string, PlaceType> = {
    MEAL: PlaceType.RESTAURANT,
    VISIT: PlaceType.MUSEUM,
    NIGHTLIFE: PlaceType.BAR,
    SHOW: PlaceType.VENUE,
    SHOPPING: PlaceType.MARKET,
    WALK: PlaceType.NEIGHBORHOOD,
  };
  return typeMap[activityType.toUpperCase()] || PlaceType.LANDMARK;
}

function resolvePlaceType(placeName: string, activityType: string): PlaceType {
  return PLACE_TYPE_OVERRIDES[placeName] ?? inferPlaceType(activityType);
}

function calculateDuration(startTime?: string, endTime?: string): number | null {
  if (!startTime || !endTime) return null;
  try {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) return null;
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    return isNaN(duration) ? null : duration;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const forceFlag = process.argv.includes('--force');

  // Validate env
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Check api/.env');
  }

  // Init Prisma with PrismaPg adapter (same as PrismaService)
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // Load parsed itinerary
    console.log(`Loading itinerary from ${JSON_PATH}...`);
    const data: ParsedItinerary = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    console.log(`  Title: ${data.title}`);
    console.log(`  Days: ${data.days.length}, Activities: ${data.days.reduce((sum, d) => sum + d.activities.length, 0)}`);
    console.log(`  Bookings: ${data.bookings.length}, Tips: ${data.tips.length}\n`);

    // Idempotency check
    const existing = await prisma.trip.findFirst({
      where: { title: data.title, userId: USER_ID },
    });

    if (existing && !forceFlag) {
      console.log(`Trip "${data.title}" already exists (id: ${existing.id}).`);
      console.log('Use --force to delete and re-seed.');
      return;
    }

    if (existing && forceFlag) {
      console.log(`--force: Deleting existing trip ${existing.id}...`);
      await prisma.trip.delete({ where: { id: existing.id } });
      console.log('  Deleted.\n');
    }

    // Run everything in a transaction
    const trip = await prisma.$transaction(async (tx) => {
      // Phase 1: Collect unique places and create Place rows
      console.log('Phase 1: Creating places...');
      const placeMap = new Map<string, string>(); // place_name → place.id
      const uniquePlaces = new Map<string, { address?: string; neighborhood?: string; activityType: string }>();

      for (const day of data.days) {
        for (const activity of day.activities) {
          if (activity.place_name && !uniquePlaces.has(activity.place_name)) {
            uniquePlaces.set(activity.place_name, {
              address: activity.address ?? undefined,
              neighborhood: activity.neighborhood ?? undefined,
              activityType: activity.activity_type,
            });
          }
          // Update with better data if this activity has address and previous didn't
          if (activity.place_name && activity.address) {
            const prev = uniquePlaces.get(activity.place_name)!;
            if (!prev.address) {
              prev.address = activity.address;
              prev.neighborhood = activity.neighborhood ?? prev.neighborhood;
            }
          }
        }
      }

      // Also collect places from bookings (via aliases)
      for (const booking of data.bookings) {
        const resolvedName = BOOKING_PLACE_ALIASES[booking.attraction_name] ?? booking.attraction_name;
        if (!uniquePlaces.has(resolvedName)) {
          uniquePlaces.set(resolvedName, { activityType: 'VISIT' });
        }
      }

      for (const [placeName, info] of uniquePlaces) {
        const placeType = resolvePlaceType(placeName, info.activityType);
        const place = await tx.place.create({
          data: {
            name: placeName,
            address: info.address || null,
            neighborhood: info.neighborhood || null,
            placeType,
          },
        });
        placeMap.set(placeName, place.id);
        console.log(`  ${placeName} → ${placeType}`);
      }
      console.log(`  Total: ${placeMap.size} places\n`);

      // Phase 2: Create Trip
      console.log('Phase 2: Creating trip...');
      const newTrip = await tx.trip.create({
        data: {
          userId: USER_ID,
          title: data.title,
          city: data.city,
          startDate: new Date(data.start_date),
          endDate: new Date(data.end_date),
          isShared: true,
        },
      });
      console.log(`  Trip id: ${newTrip.id}\n`);

      // Phase 3: Create TripDays + Activities + Highlights
      console.log('Phase 3: Creating days & activities...');
      let totalActivities = 0;
      let totalHighlights = 0;

      for (const dayData of data.days) {
        const tripDay = await tx.tripDay.create({
          data: {
            tripId: newTrip.id,
            dayNumber: dayData.day_number,
            date: new Date(dayData.date),
            title: dayData.title,
            theme: dayData.theme || null,
          },
        });

        // Sort: main activities first, alternatives last
        const sortedActivities = [...dayData.activities].sort((a, b) => {
          if (a.is_alternative && !b.is_alternative) return 1;
          if (!a.is_alternative && b.is_alternative) return -1;
          return 0;
        });

        const activityMap = new Map<string, string>(); // activity.title → activity.id
        let sortOrder = 1;

        for (const act of sortedActivities) {
          const placeId = act.place_name ? (placeMap.get(act.place_name) ?? null) : null;
          const alternativeToId = act.is_alternative && act.alternative_to
            ? (activityMap.get(act.alternative_to) ?? null)
            : null;

          const activity = await tx.activity.create({
            data: {
              tripDayId: tripDay.id,
              sortOrder: sortOrder++,
              title: act.title,
              description: act.description || null,
              startTime: act.start_time || null,
              endTime: act.end_time || null,
              durationMinutes: calculateDuration(act.start_time ?? undefined, act.end_time ?? undefined),
              activityType: mapActivityType(act.activity_type),
              priceMinCents: act.price_min_cents ?? null,
              priceMaxCents: act.price_max_cents ?? null,
              priceCurrency: 'EUR',
              priceNote: act.price_note || null,
              placeId,
              alternativeToId,
            },
          });

          activityMap.set(act.title, activity.id);
          totalActivities++;

          // Create highlights
          for (let i = 0; i < act.highlights.length; i++) {
            await tx.activityHighlight.create({
              data: {
                activityId: activity.id,
                sortOrder: i + 1,
                description: act.highlights[i],
              },
            });
            totalHighlights++;
          }
        }

        console.log(`  Day ${dayData.day_number}: ${sortedActivities.length} activities`);
      }
      console.log(`  Total: ${totalActivities} activities, ${totalHighlights} highlights\n`);

      // Phase 4: Create Bookings
      console.log('Phase 4: Creating bookings...');
      for (const booking of data.bookings) {
        const resolvedName = BOOKING_PLACE_ALIASES[booking.attraction_name] ?? booking.attraction_name;
        const placeId = placeMap.get(resolvedName) ?? null;

        await tx.booking.create({
          data: {
            tripId: newTrip.id,
            placeId,
            attractionName: booking.attraction_name,
            priceCents: booking.price_cents ?? null,
            priceCurrency: 'EUR',
            discountNote: booking.discount_note || null,
            bookingUrl: booking.booking_url || null,
          },
        });
        console.log(`  ${booking.attraction_name} → place: ${resolvedName} (${placeId ? 'linked' : 'no place'})`);
      }
      console.log();

      // Phase 5: Create Travel Tips
      console.log('Phase 5: Creating travel tips...');
      for (const tip of data.tips) {
        await tx.travelTip.create({
          data: {
            tripId: newTrip.id,
            category: mapTipCategory(tip.category),
            content: tip.content,
          },
        });
        console.log(`  [${tip.category}] ${tip.content.substring(0, 60)}...`);
      }
      console.log();

      // Phase 6: Return complete trip
      return tx.trip.findUnique({
        where: { id: newTrip.id },
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
          bookings: { include: { place: true } },
          tips: true,
        },
      });
    }, { timeout: 30000 });

    // Summary
    console.log('========== Summary ==========');
    console.log(`Trip: ${trip!.title} (${trip!.id})`);
    console.log(`Days: ${trip!.days.length}`);
    for (const day of trip!.days) {
      const mainCount = day.activities.filter(a => !a.alternativeToId).length;
      const altCount = day.activities.filter(a => a.alternativeToId).length;
      console.log(`  Day ${day.dayNumber}: ${mainCount} main + ${altCount} alternatives`);
    }
    console.log(`Bookings: ${trip!.bookings.length}`);
    console.log(`Tips: ${trip!.tips.length}`);
    console.log('\nDone!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
