export type SavedItemCategory =
  | 'RESTAURANT'
  | 'MUSEUM'
  | 'EVENT'
  | 'PLACE'
  | 'WINE'
  | 'EXPERIENCE';

export interface SaveItemRequest {
  name: string;
  category: SavedItemCategory;
  region: string;
  description: string;
  address?: string;
  mapsUrl?: string;
  website?: string;
  imageUrl?: string;
}

export interface SavedItem {
  id: string;
  userId: string;
  name: string;
  category: SavedItemCategory;
  region: string;
  description: string;
  address: string | null;
  mapsUrl: string | null;
  website: string | null;
  imageUrl: string | null;
  savedAt: string;
}
