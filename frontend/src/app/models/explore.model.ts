export interface ExplorePrompt {
  text: string;
  fullPrompt: string;
}

export interface ExploreCategory {
  id: string;
  label: string;
  icon: string;
  prompts: ExplorePrompt[];
}

export interface ExploreData {
  regionId: string;
  categories: ExploreCategory[];
}
