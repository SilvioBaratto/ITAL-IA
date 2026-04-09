/// Italian municipality — matches the backend Comune model shape returned by
/// `GET /api/v1/comuni?regionId=...`. `latitude` and `longitude` come back as
/// strings because Prisma serializes `Decimal` as JSON strings; we coerce
/// them to numbers in the service layer before exposing them to components.
export interface Comune {
  id: string;
  name: string;
  province: string;
  regionId: string;
  latitude: number;
  longitude: number;
}

export interface PaginatedComuneResponse {
  data: Comune[];
  total: number;
  limit: number;
  offset: number;
}
