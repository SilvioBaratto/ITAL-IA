import { PoiCategory } from '../../models/poi.model';

export interface CategoryBadgeConfig {
  label: string;
  classes: string;
  icon: string;
}

const CATEGORY_BADGE_CONFIG: Record<PoiCategory, CategoryBadgeConfig> = {
  RESTAURANT:      { label: 'Ristorante',      classes: 'bg-primary-light text-primary',   icon: 'LucideUtensils' },
  BAR:             { label: 'Bar',              classes: 'bg-primary-light text-primary',   icon: 'LucideCoffee' },
  MUSEUM:          { label: 'Museo',            classes: 'bg-accent-light text-accent',     icon: 'LucideLandmark' },
  CHURCH:          { label: 'Chiesa',           classes: 'bg-accent-light text-accent',     icon: 'LucideChurch' },
  LANDMARK:        { label: 'Monumento',        classes: 'bg-accent-light text-accent',     icon: 'LucideMapPin' },
  PARK:            { label: 'Parco',            classes: 'bg-success/10 text-success',      icon: 'LucideTreePine' },
  NEIGHBORHOOD:    { label: 'Quartiere',        classes: 'bg-success/10 text-success',      icon: 'LucideMap' },
  VENUE:           { label: 'Locale',           classes: 'bg-success/10 text-success',      icon: 'LucideBuilding2' },
  ROOFTOP:         { label: 'Rooftop',          classes: 'bg-gold/10 text-gold',            icon: 'LucideSunrise' },
  EVENT_VENUE:     { label: 'Sala eventi',      classes: 'bg-gold/10 text-gold',            icon: 'LucideCalendar' },
  WINERY:          { label: 'Cantina',          classes: 'bg-info/10 text-info',            icon: 'LucideWine' },
  MARKET:          { label: 'Mercato',          classes: 'bg-warning/10 text-warning',      icon: 'LucideShoppingBag' },
  EXPERIENCE_SITE: { label: 'Esperienza',       classes: 'bg-warning/10 text-warning',      icon: 'LucideStar' },
  SAGRA:           { label: 'Sagra',            classes: 'bg-gold/10 text-gold',            icon: 'LucidePartyPopper' },
  BEACH:           { label: 'Spiaggia',         classes: 'bg-info/10 text-info',            icon: 'LucideWaves' },
  AGRITURISMO:     { label: 'Agriturismo',      classes: 'bg-success/10 text-success',      icon: 'LucideWheat' },
  FESTIVAL:        { label: 'Festa',            classes: 'bg-gold/10 text-gold',            icon: 'LucideSparkles' },
  DANCE:           { label: 'Discoteca',        classes: 'bg-accent-light text-accent',     icon: 'LucideMusic' },
  STREET_FOOD:     { label: 'Street Food',      classes: 'bg-warning/10 text-warning',      icon: 'LucideFlame' },
  PUB:             { label: 'Pub',              classes: 'bg-accent-light text-accent',     icon: 'LucideBeer' },
};

export function getCategoryBadgeConfig(category: PoiCategory): CategoryBadgeConfig {
  return CATEGORY_BADGE_CONFIG[category];
}
