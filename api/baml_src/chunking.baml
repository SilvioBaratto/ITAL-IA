class LinkMeta {
  text string    @description("Anchor text, translated to Italian")
  url string     @description("Original URL, kept as-is")
}

class ChunkMetadata {
  section_title string         @description("Section heading in Italian")
  links LinkMeta[]             @description("Relevant hyperlinks found in this chunk")
  addresses string[]           @description("Street addresses, kept in original Italian")
  image_urls string[]          @description("Meaningful content images only, no logos/icons/nav images")
  opening_hours string?        @description("Opening hours if mentioned")
  prices string?               @description("Pricing info if mentioned")
}

class Chunk {
  text string                  @description("150-400 word self-contained paragraph in Italian")
  metadata ChunkMetadata
}

class PageChunkingResult {
  page_title string            @description("Page title translated to Italian")
  page_summary string          @description("1-2 sentence Italian summary of the entire page")
  chunks Chunk[]
}

function ChunkPage(
  page_title: string,
  category: string,
  source_url: string,
  markdown_content: string
) -> PageChunkingResult {
  client GPT52

  prompt #"
    {{ _.role("system") }}
    You are a professional content editor and translator specializing in Italian regional guides about Italy.

    Your task is to process a scraped markdown page and produce structured, semantically coherent chunks in Italian, optimized for vector search (RAG).

    ## Rules

    1. **Strip cruft**: Ignore navigation menus, cookie banners, footers, sidebars, forms, login prompts, breadcrumbs, "Related Posts", ads, and any non-content elements.
    2. **Chunk semantically**: Split the content into 150-400 word chunks. Each chunk must cover ONE coherent topic (e.g., one attraction, one restaurant, one practical tip). Never split a single attraction/restaurant/place description across multiple chunks.
    3. **Translate to Italian**: All text output must be in Italian. Keep these as-is: URLs, street names, Italian place names, proper nouns of venues.
    4. **Extract metadata per chunk**:
       - `section_title`: A descriptive Italian heading for the chunk's topic
       - `links`: Relevant hyperlinks from the source (translate anchor text to Italian, keep URL as-is). Only include links that are useful to a traveler.
       - `addresses`: Street addresses mentioned (keep original Italian names)
       - `image_urls`: URLs of meaningful content images (photos of places/food). Exclude logos, icons, thumbnails, avatars, decorative images.
       - `opening_hours`: Opening hours if present in this chunk (null otherwise)
       - `prices`: Pricing information if present in this chunk (null otherwise)
    5. **Page-level fields**:
       - `page_title`: Translate the page title to Italian
       - `page_summary`: Write a 1-2 sentence Italian summary of the entire page content
    6. **Quality**: Each chunk must be self-contained and understandable without the other chunks. A reader should get value from any single chunk alone.

    ## Source page metadata
    - Title: {{ page_title }}
    - Category: {{ category }}
    - Source URL: {{ source_url }}

    {{ _.role("user") }}
    Process the following markdown content according to the rules above:

    {{ markdown_content }}

    {{ ctx.output_format }}
  "#
}
