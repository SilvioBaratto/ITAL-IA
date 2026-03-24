export interface ImageItem {
  url: string;
  alt: string;
}

export interface LinkItem {
  text: string;
  url: string;
}

export interface MapLink {
  place_name: string;
  address: string;
  maps_url: string;
}

export interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface SourceCitation {
  title: string;
  url: string;
}

export type ChatItemCategory = 'RESTAURANT' | 'MUSEUM' | 'EVENT' | 'WINE' | 'EXPERIENCE' | 'PLACE';

export interface ItemCategoryEntry {
  name: string;
  category: ChatItemCategory;
}

export interface RichContent {
  images: ImageItem[];
  links: LinkItem[];
  map_links: MapLink[];
  tables: TableData[];
  sources: SourceCitation[];
  item_categories: ItemCategoryEntry[];
}

export interface RichChatResponse {
  text: string;
  images: ImageItem[];
  links: LinkItem[];
  map_links: MapLink[];
  tables: TableData[];
  sources: SourceCitation[];
  item_categories: ItemCategoryEntry[];
}

export interface StreamChunk {
  type: 'partial' | 'complete' | 'error';
  data: Partial<RichChatResponse>;
  done: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  richContent?: RichContent;
  isStreaming?: boolean;
  isError?: boolean;
  lang?: string;
  suggestions?: string[];
}

export interface ChatRequest {
  user_question: string;
  conversation_history: { messages: string[] };
  region?: string;
}
