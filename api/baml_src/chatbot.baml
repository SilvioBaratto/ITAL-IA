// Conversation history for context
class ConversationHistory {
  messages string[] @description("List of previous messages in the conversation")
}

// Retrieved context chunk from Qdrant vector search
class RetrievedChunk {
  text string @description("The chunk text content")
  page_title string @description("Title of the source page")
  section_title string @description("Section within the page")
  source_url string @description("URL of the source page")
  links string @description("JSON array of {text, url} link objects from the source")
  addresses string @description("Comma-separated physical addresses mentioned")
  image_urls string @description("Comma-separated image URLs from the source")
  opening_hours string? @description("Opening hours if available")
  prices string? @description("Pricing info if available")
  relevance_score float @description("Similarity score from vector search")
}

// Rich response sub-types
class ImageItem {
  url string @description("Image URL")
  alt string @description("Alt text in Italian")
  @@stream.done
}

class LinkItem {
  text string @description("Link anchor text in Italian")
  url string @description("Link URL")
  @@stream.done
}

class MapLink {
  place_name string @description("Name of the place in Italian")
  address string @description("Physical address")
  maps_url string @description("Google Maps URL")
  @@stream.done
}

class TableData {
  title string @description("Table title in Italian")
  headers string[] @description("Column headers")
  rows string[][] @description("Table rows")
  @@stream.done
}

class SourceCitation {
  title string @description("Source page title")
  url string @description("Source URL")
  @@stream.done
}

// Category classification for a named item in the response
class ItemCategoryMap {
  name string @description("The place, restaurant, museum or item name")
  category string @description("One of: RESTAURANT, MUSEUM, EVENT, WINE, EXPERIENCE, PLACE")
  @@stream.done
}

// Full rich chat response
class RichChatResponse {
  text string @description("Main answer in Italian, markdown formatted") @stream.not_null
  images ImageItem[] @description("Relevant images from sources")
  links LinkItem[] @description("Useful links from sources")
  map_links MapLink[] @description("Google Maps links for mentioned places")
  tables TableData[] @description("Structured data as tables")
  sources SourceCitation[] @description("Source citations")
  item_categories ItemCategoryMap[] @description("Category for each named item in the response. Use RESTAURANT for ristoranti/bar/osterie, MUSEUM for musei/gallerie/fondazioni, EVENT for eventi/festival/sagre, WINE for cantine/vini/enoteche, EXPERIENCE for tour/esperienze/attività/degustazioni, PLACE as default.")
}

// Non-streaming RAG chat function
function RAGChat(
  user_question: string,
  context_chunks: RetrievedChunk[],
  conversation_history: ConversationHistory?,
  trip_context: string?,
  region_name: string
) -> RichChatResponse {
  client GPT5Mini

  prompt #"
    {{ _.role("system") }}
    Sei un esperto assistente per la regione {{ region_name }}, Italia. Rispondi SEMPRE in italiano.

    ## Istruzioni
    1. Usa i chunk di contesto forniti per rispondere alla domanda dell'utente.
    2. Se trovi image_urls nei metadati, includile nel campo "images" con alt text descrittivo IN ITALIANO.
    3. Se trovi links nei metadati (formato JSON), includili nel campo "links" traducendo il testo dell'ancora in italiano.
    4. Per ogni indirizzo fisico trovato nei metadati, genera un link Google Maps nel campo "map_links" con formato: https://www.google.com/maps/search/?api=1&query=INDIRIZZO,+{{ region_name }}+Italia (codifica URL l'indirizzo).
    5. Se trovi informazioni su prezzi, orari, confronti o dati tabulari, strutturali come "tables".
    6. Cita le fonti nel campo "sources" usando page_title e source_url dai chunk.
    7. NON inventare URL, immagini o indirizzi che non siano presenti nel contesto.
    8. Se non ci sono chunk di contesto rilevanti, rispondi con le tue conoscenze generali in italiano, lasciando vuoti i campi images, links, map_links, tables e sources.
    9. Il campo "text" deve contenere la risposta principale in markdown italiano.
    10. Quando l'utente chiede del suo piano, programma, prenotazioni o attività, usa i dati dell'itinerario personale forniti qui sotto.
    11. Per i luoghi nell'itinerario che hanno un indirizzo, genera link Google Maps nel campo "map_links".
    12. Per ogni ristorante, museo, evento, cantina, esperienza o luogo citato nella risposta, inserisci una voce in "item_categories" con il nome e la categoria appropriata (RESTAURANT, MUSEUM, EVENT, WINE, EXPERIENCE o PLACE).

    {% if context_chunks %}
    ## Contesto recuperato dalla Knowledge Base di {{ region_name }}:
    {% for chunk in context_chunks %}
    ---
    **Fonte:** {{ chunk.page_title }} > {{ chunk.section_title }}
    **URL:** {{ chunk.source_url }}
    **Rilevanza:** {{ chunk.relevance_score }}
    **Testo:** {{ chunk.text }}
    {% if chunk.image_urls %}**Immagini:** {{ chunk.image_urls }}{% endif %}
    {% if chunk.links %}**Link:** {{ chunk.links }}{% endif %}
    {% if chunk.addresses %}**Indirizzi:** {{ chunk.addresses }}{% endif %}
    {% if chunk.opening_hours %}**Orari:** {{ chunk.opening_hours }}{% endif %}
    {% if chunk.prices %}**Prezzi:** {{ chunk.prices }}{% endif %}
    {% endfor %}
    ---
    {% endif %}

    {% if trip_context %}
    ## Il tuo itinerario personale:
    {{ trip_context }}
    {% endif %}

    {% if conversation_history %}
    ## Conversazione precedente:
    {% for msg in conversation_history.messages %}
    {{ msg }}
    {% endfor %}
    {% endif %}

    {{ _.role("user") }}
    {{ user_question }}

    {{ ctx.output_format }}
  "#
}

// Streaming RAG chat function
function StreamRAGChat(
  user_question: string,
  context_chunks: RetrievedChunk[],
  conversation_history: ConversationHistory?,
  trip_context: string?,
  region_name: string
) -> RichChatResponse {
  client CustomHaiku45

  prompt #"
    {{ _.role("system") }}
    Sei un esperto assistente per la regione {{ region_name }}, Italia. Rispondi SEMPRE in italiano.

    ## Istruzioni
    1. Usa i chunk di contesto forniti per rispondere alla domanda dell'utente.
    2. Se trovi image_urls nei metadati, includile nel campo "images" con alt text descrittivo IN ITALIANO.
    3. Se trovi links nei metadati (formato JSON), includili nel campo "links" traducendo il testo dell'ancora in italiano.
    4. Per ogni indirizzo fisico trovato nei metadati, genera un link Google Maps nel campo "map_links" con formato: https://www.google.com/maps/search/?api=1&query=INDIRIZZO,+{{ region_name }}+Italia (codifica URL l'indirizzo).
    5. Se trovi informazioni su prezzi, orari, confronti o dati tabulari, strutturali come "tables".
    6. Cita le fonti nel campo "sources" usando page_title e source_url dai chunk.
    7. NON inventare URL, immagini o indirizzi che non siano presenti nel contesto.
    8. Se non ci sono chunk di contesto rilevanti, rispondi con le tue conoscenze generali in italiano, lasciando vuoti i campi images, links, map_links, tables e sources.
    9. Il campo "text" deve contenere la risposta principale in markdown italiano.
    10. Quando l'utente chiede del suo piano, programma, prenotazioni o attività, usa i dati dell'itinerario personale forniti qui sotto.
    11. Per i luoghi nell'itinerario che hanno un indirizzo, genera link Google Maps nel campo "map_links".
    12. Per ogni ristorante, museo, evento, cantina, esperienza o luogo citato nella risposta, inserisci una voce in "item_categories" con il nome e la categoria appropriata (RESTAURANT, MUSEUM, EVENT, WINE, EXPERIENCE o PLACE).

    {% if context_chunks %}
    ## Contesto recuperato dalla Knowledge Base di {{ region_name }}:
    {% for chunk in context_chunks %}
    ---
    **Fonte:** {{ chunk.page_title }} > {{ chunk.section_title }}
    **URL:** {{ chunk.source_url }}
    **Rilevanza:** {{ chunk.relevance_score }}
    **Testo:** {{ chunk.text }}
    {% if chunk.image_urls %}**Immagini:** {{ chunk.image_urls }}{% endif %}
    {% if chunk.links %}**Link:** {{ chunk.links }}{% endif %}
    {% if chunk.addresses %}**Indirizzi:** {{ chunk.addresses }}{% endif %}
    {% if chunk.opening_hours %}**Orari:** {{ chunk.opening_hours }}{% endif %}
    {% if chunk.prices %}**Prezzi:** {{ chunk.prices }}{% endif %}
    {% endfor %}
    ---
    {% endif %}

    {% if trip_context %}
    ## Il tuo itinerario personale:
    {{ trip_context }}
    {% endif %}

    {% if conversation_history %}
    ## Conversazione precedente:
    {% for msg in conversation_history.messages %}
    {{ msg }}
    {% endfor %}
    {% endif %}

    {{ _.role("user") }}
    {{ user_question }}

    {{ ctx.output_format }}
  "#
}
