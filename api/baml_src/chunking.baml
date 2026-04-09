// ChunkPage takes a single per-comune deep-research markdown file and
// splits it into one chunk per venue, ready for embedding and upload
// to the `italia-kb` Qdrant collection. See `api/scripts/chunk-kb.ts`
// for the caller.
//
// Input shape (what the deep-research pipeline produces):
//
//   ## {Comune}
//   {paragrafo introduttivo sul comune}
//
//   ### {Nome Locale 1}
//   **Indirizzo:** Via Roma 12, 33100 {Comune} (UD)
//   **Telefono:** 0431 99427
//   **Orari:** 06:30–12:30
//   {descrizione in italiano del locale, 100-500 parole}
//
//   ### {Nome Locale 2}
//   ...
//
//   ## Fonti
//   - [OpenStreetMap](...)
//
// Output: one Chunk per H3 venue section. Comune intro, "Note sul
// contesto locale", "Cucina tradizionale", and "Fonti" sections are
// dropped on the floor — they're useful context for a human reader
// but pollute vector-search recall.

class LinkMeta {
  text string    @description("Anchor text from the markdown link, kept verbatim (no translation). Example: 'sito ufficiale del ristorante'.")
  url string     @description("Original URL kept exactly as it appears in the source markdown.")
}

class ChunkMetadata {
  section_title string         @description("Name of the venue, copied exactly from the markdown H3 heading (without the '### ' prefix). This is the chunk's semantic title.")
  links LinkMeta[]             @description("Inline hyperlinks that appear inside this venue's description (e.g. a link to the venue's own website). Do NOT include links from the '## Fonti' section at the bottom of the file.")
  addresses string[]           @description("Street addresses for this venue. Extract the value after '**Indirizzo:**' verbatim (strip the prefix). Usually exactly one, sometimes zero, rarely more than one.")
  image_urls string[]          @description("URLs of meaningful content images if any appear in the venue's section. Per-comune markdown rarely has images — empty array is the common case.")
  opening_hours string?        @description("Value of the '**Orari:**' field if present for this venue, null otherwise. Copy verbatim without the prefix.")
  prices string?               @description("Value of the '**Prezzi:**' (or 'Prezzo medio', 'Fascia di prezzo') field if present for this venue, null otherwise. Copy verbatim without the prefix.")
}

class Chunk {
  text string                  @description("The complete venue section as it appears in the source markdown: the heading, the metadata lines (Indirizzo/Telefono/Orari/Prezzi), and the full description paragraph(s). Keep the original Italian voice and structure — do NOT rewrite or summarize. Typical length: 100-500 words.")
  metadata ChunkMetadata
}

class PageChunkingResult {
  page_title string            @description("The comune name, kept exactly as provided in the function input. Not translated, not reformatted.")
  page_summary string          @description("A 1-2 sentence Italian summary of which venues of the given category this file describes in this comune. Example: 'Guida ai principali ristoranti del comune di Aiello del Friuli, inclusi trattorie tradizionali, pizzerie e una pasticceria storica.'")
  chunks Chunk[]               @description("One chunk per venue H3 section. Empty array is valid if the file contains no concrete venues.")
}

function ChunkPage(
  page_title: string,
  category: string,
  source_url: string,
  markdown_content: string
) -> PageChunkingResult {
  client AzureFoundry

  prompt #"
    {{ _.role("system") }}
    Sei un redattore esperto di guide turistiche italiane. Il tuo
    compito è processare un file markdown che descrive tutti i punti
    di interesse di una specifica categoria all'interno di UN singolo
    comune italiano, e produrre chunk semanticamente coerenti,
    ottimizzati per vector search (RAG).

    ## Regole di chunking

    1. **Un chunk per locale**. Ogni sezione `### Nome Locale` diventa
       ESATTAMENTE UN chunk. Il `text` del chunk contiene sia le righe
       di metadata (Indirizzo, Telefono, Orari, Prezzi) sia tutta la
       prosa descrittiva del locale. Mai spezzare la descrizione di
       un singolo locale in due chunk, e mai fondere due locali in
       uno stesso chunk.

    2. **Salta le sezioni non-POI**. NON creare chunk per:
       - Il paragrafo introduttivo subito dopo `## {Comune}` (descrive
         il comune in generale — è contesto, non un POI)
       - Heading H3 generici come "Note sul contesto locale",
         "La Cucina Tradizionale", "Storia del paese", "Conclusione",
         "Sapori locali", "Tradizioni culturali"
       - La sezione finale `## Fonti` con la lista di URL delle fonti
         consultate (OpenStreetMap, Wikipedia, Turismo FVG, ecc.)

       Queste sezioni sono utili per un lettore umano ma inquinerebbero
       il retrieval vettoriale.

    3. **Niente traduzione, niente riscrittura**. Il contenuto è già
       in italiano ed è stato curato. Copia il testo del locale nel
       campo `text` mantenendo voce e struttura originali. Puoi
       normalizzare spazi bianchi eccessivi ma non parafrasare.

    4. **Metadata per chunk**:
       - `section_title`: il nome del locale esattamente come appare
         nell'heading `### {nome}`, senza il prefisso `###`. Mantieni
         eventuali parentesi descrittive (es. "Osteria XYZ (Frazione
         Versutta)"). Questo è il titolo semantico del chunk.
       - `links`: eventuali URL inline nel testo del locale (tipicamente
         un link al sito/facebook del locale). NON includere URL dalla
         sezione Fonti: quelli sono sorgenti di ricerca, non link del
         POI.
       - `addresses`: il valore dopo `**Indirizzo:**` copiato verbatim,
         senza il prefisso. Zero o un elemento nella stragrande
         maggioranza dei casi. Se il locale non ha un indirizzo
         esplicito, array vuoto.
       - `image_urls`: URL di immagini embedded solo se effettivamente
         presenti nel markdown. Raro in questo dataset — aspettati
         array vuoto quasi sempre.
       - `opening_hours`: il valore dopo `**Orari:**` se presente,
         null altrimenti. Copia verbatim.
       - `prices`: il valore dopo `**Prezzi:**` (o "Prezzo medio",
         "Fascia di prezzo") se presente, null altrimenti. Copia
         verbatim.

    5. **Page-level fields**:
       - `page_title`: riproponi esattamente il nome del comune passato
         in input ({{ page_title }}). Non tradurre, non modificare.
       - `page_summary`: scrivi una frase (max due) in italiano che
         riassuma quali locali della categoria {{ category }} sono
         descritti in questo file per il comune {{ page_title }}.
         Esempio: "Guida ai principali ristoranti del comune di
         Aiello del Friuli: trattorie tradizionali friulane, pizzerie
         di quartiere e una pasticceria storica."

    6. **Self-contained chunk**. Ogni chunk sarà recuperato
       indipendentemente dagli altri in fase di ricerca. Non presumere
       che il lettore veda anche gli altri chunk del file. Se il nome
       del comune non compare naturalmente nel testo del chunk
       (perché l'autore l'ha omesso), includilo tu una volta in modo
       naturale — per esempio mantenendo la riga Indirizzo che
       tipicamente contiene il CAP e il comune.

    7. **Zero chunk è valido**. Se il file non contiene nessuna
       sezione `### Nome Locale` concreta (succede con file quasi
       vuoti o fatti solo di contesto), restituisci `chunks: []` con
       un page_summary che lo spieghi.

    ## Contesto della chiamata corrente
    - Comune: {{ page_title }}
    - Categoria POI: {{ category }}
    - Source URL interno: {{ source_url }}

    {{ _.role("user") }}
    Processa il seguente markdown secondo le regole sopra:

    {{ markdown_content }}

    {{ ctx.output_format }}
  "#
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test ChunkPerComuneRestaurant {
  functions [ChunkPage]
  args {
    page_title "Aiello del Friuli"
    category "RESTAURANT"
    source_url "kb/friuli-venezia-giulia/RESTAURANT/.comuni/aiello-del-friuli.md"
    markdown_content #"
      ## Aiello del Friuli

      Aiello del Friuli è un piccolo comune della provincia di Udine
      con una tradizione gastronomica legata alla cucina friulana.

      ---

      ### La Dolce Vita al Museo

      **Indirizzo:** Via Francesco Petrarca, 1, 33041 Aiello del Friuli (UD)

      Ristorante italiano con cucina mediterranea, specialità pesce.
      Valutazione 4.5 su TripAdvisor.

      ---

      ### Ristorante Da Brontolo M.C.M

      **Indirizzo:** Viale Vittorio Emanuele, 36, 33041 Aiello del Friuli (UD)
      **Telefono:** 342 649 9585
      **Orari:** Chiuso lunedì sera

      Primo posto su TripAdvisor nel comune. Specializzato in carne
      e pesce, con un'attenzione particolare ai frutti di mare.

      ---

      ### La Cucina Tradizionale Friulana ad Aiello del Friuli

      La cucina friulana include frico, gnocchi di patate, frutti di
      mare. Questa è una sezione di contesto e NON dovrebbe diventare
      un chunk.

      ---

      ## Fonti

      - [OpenStreetMap](https://www.openstreetmap.org)
      - [Wikipedia](https://it.wikipedia.org/wiki/Aiello_del_Friuli)
    "#
  }
}

test ChunkEmptyComune {
  functions [ChunkPage]
  args {
    page_title "Amaro"
    category "RESTAURANT"
    source_url "kb/friuli-venezia-giulia/RESTAURANT/.comuni/amaro.md"
    markdown_content #"
      ## Amaro

      Amaro è un piccolo comune montano della Carnia. Non sono
      attualmente documentati ristoranti di rilievo per questo paese.

      ## Fonti

      - [OpenStreetMap](https://www.openstreetmap.org)
    "#
  }
}
