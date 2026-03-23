export type RegionGroup = 'nord' | 'centro' | 'sud' | 'isole';

export interface Region {
  id: string;
  name: string;
  group: RegionGroup;
  hasKB: boolean;
}
