import { SavedItemCategory } from './saved-item.model';

export type PoiCategory =
  | 'RESTAURANT'
  | 'MUSEUM'
  | 'PARK'
  | 'MARKET'
  | 'BAR'
  | 'LANDMARK'
  | 'VENUE'
  | 'CHURCH'
  | 'ROOFTOP'
  | 'NEIGHBORHOOD'
  | 'EVENT_VENUE'
  | 'WINERY'
  | 'EXPERIENCE_SITE'
  | 'SAGRA'
  | 'BEACH'
  | 'AGRITURISMO'
  | 'FESTIVAL'
  | 'DANCE'
  | 'STREET_FOOD'
  | 'PUB';

export interface PointOfInterest {
  id: string;
  name: string;
  regionId: string;
  category: PoiCategory;
  address: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
  imageUrl: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  region?: { id: string; name: string; group: string };
}

export interface PaginatedPoiResponse {
  data: PointOfInterest[];
  total: number;
  limit: number;
  offset: number;
}

const POI_CATEGORY_MAP: Record<PoiCategory, SavedItemCategory> = {
  RESTAURANT: 'RESTAURANT',
  BAR: 'RESTAURANT',
  MUSEUM: 'MUSEUM',
  LANDMARK: 'MUSEUM',
  CHURCH: 'MUSEUM',
  PARK: 'PLACE',
  NEIGHBORHOOD: 'PLACE',
  ROOFTOP: 'PLACE',
  VENUE: 'PLACE',
  EVENT_VENUE: 'EVENT',
  WINERY: 'WINE',
  MARKET: 'WINE',
  EXPERIENCE_SITE: 'EXPERIENCE',
  SAGRA: 'EVENT',
  BEACH: 'PLACE',
  AGRITURISMO: 'RESTAURANT',
  FESTIVAL: 'EVENT',
  DANCE: 'PLACE',
  STREET_FOOD: 'RESTAURANT',
  PUB: 'PLACE',
};

export function poiCategoryToSavedCategory(category: PoiCategory): SavedItemCategory {
  return POI_CATEGORY_MAP[category];
}

export interface PoiStatItem {
  category: PoiCategory;
  count: number;
}
