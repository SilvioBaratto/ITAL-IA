/**
 * Wikimedia Commons images — one verified, iconic photo per Italian region.
 * Sourced from Wikipedia article lead images (CC-BY-SA / public domain).
 * Using w=400 thumbnail size for fast card loading.
 */
const REGION_IMAGES: Record<string, string> = {
  'piemonte':              'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Mole_Antonelliana_%28Torino%29_09.jpg/400px-Mole_Antonelliana_%28Torino%29_09.jpg',
  'valle-d-aosta':         'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Aosta_and_mountains.jpg/400px-Aosta_and_mountains.jpg',
  'lombardia':             'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Milan_Cathedral_from_Piazza_del_Duomo.jpg/400px-Milan_Cathedral_from_Piazza_del_Duomo.jpg',
  'trentino-alto-adige':   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Faloria_Cortina_d%27Ampezzo_10.jpg/400px-Faloria_Cortina_d%27Ampezzo_10.jpg',
  'veneto':                'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Venezia_aerial_view.jpg/400px-Venezia_aerial_view.jpg',
  'friuli-venezia-giulia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Trieste_%2828766391880%29.jpg/400px-Trieste_%2828766391880%29.jpg',
  'liguria':               'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Cinque_Terre_%28Italy%2C_October_2020%29_-_24_%2850543603956%29.jpg/400px-Cinque_Terre_%28Italy%2C_October_2020%29_-_24_%2850543603956%29.jpg',
  'emilia-romagna':        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Torri_di_Bologna%2C_Bologna.jpg/400px-Torri_di_Bologna%2C_Bologna.jpg',
  'toscana':               'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/FirenzeDec092023_01.jpg/400px-FirenzeDec092023_01.jpg',
  'umbria':                'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/AssisiDec122023_03.jpg/400px-AssisiDec122023_03.jpg',
  'marche':                'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Urbino_dalla_Strada_Rossa.jpg/400px-Urbino_dalla_Strada_Rossa.jpg',
  'lazio':                 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg/400px-Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg',
  'abruzzo':               'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Rocca_Calascio_06_2023.jpg/400px-Rocca_Calascio_06_2023.jpg',
  'molise':                'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Vista_su_Campobasso_dal_Castello_Monforte.jpg/400px-Vista_su_Campobasso_dal_Castello_Monforte.jpg',
  'campania':              'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Amalfi_sea_view_Italy.JPG/400px-Amalfi_sea_view_Italy.JPG',
  'puglia':                'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Alberobello_-_View_from_Piazza_Giangirolamo_II_-_03.jpg/400px-Alberobello_-_View_from_Piazza_Giangirolamo_II_-_03.jpg',
  'basilicata':            'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Matera_-_View_from_Sant%27Agostino.jpg/400px-Matera_-_View_from_Sant%27Agostino.jpg',
  'calabria':              'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Old_city_of_Tropea_-_View_from_the_road_-_Italy_2015.JPG/400px-Old_city_of_Tropea_-_View_from_the_road_-_Italy_2015.JPG',
  'sicilia':               'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Aerial_image_of_the_coast_of_Taormina_%28view_from_the_southeast%29.jpg/400px-Aerial_image_of_the_coast_of_Taormina_%28view_from_the_southeast%29.jpg',
  'sardegna':              'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Stintino_-_Panorama_%2803%29.jpg/400px-Stintino_-_Panorama_%2803%29.jpg',
};

export function getRegionImageUrl(regionId: string): string {
  return REGION_IMAGES[regionId] ?? '';
}
