export type ActivityType = 'MEAL' | 'VISIT' | 'TRANSPORT' | 'WALK' | 'NIGHTLIFE' | 'SHOW' | 'SHOPPING' | 'REST';
export type PlaceType = 'RESTAURANT' | 'MUSEUM' | 'PARK' | 'MARKET' | 'BAR' | 'LANDMARK' | 'VENUE' | 'CHURCH' | 'ROOFTOP' | 'NEIGHBORHOOD';
export type TipCategory = 'TRANSPORT' | 'SAFETY' | 'BUDGET' | 'PACKING';

export interface Place {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  placeType: PlaceType;
  websiteUrl: string | null;
}

export interface ActivityHighlight {
  id: string;
  sortOrder: number;
  description: string;
}

export interface Activity {
  id: string;
  sortOrder: number;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  activityType: ActivityType;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  priceCurrency: string;
  priceNote: string | null;
  placeId: string | null;
  alternativeToId: string | null;
  place: Place | null;
  highlights: ActivityHighlight[];
  alternatives: Activity[];
}

export interface TripDay {
  id: string;
  dayNumber: number;
  date: string;
  title: string;
  theme: string | null;
  activities: Activity[];
}

export interface Booking {
  id: string;
  attractionName: string;
  priceCents: number | null;
  priceCurrency: string;
  discountNote: string | null;
  bookingUrl: string | null;
  place: Place | null;
}

export interface TravelTip {
  id: string;
  category: TipCategory;
  content: string;
}

export interface Trip {
  id: string;
  title: string;
  city: string;
  startDate: string;
  endDate: string;
  isShared: boolean;
  days: TripDay[];
  bookings: Booking[];
  tips: TravelTip[];
}

export interface TripSummary {
  id: string;
  title: string;
  city: string;
  startDate: string;
  endDate: string;
  isShared: boolean;
  _count?: { days: number };
}
