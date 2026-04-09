// POI extraction for the Italia database populator.
//
// Reads one per-comune markdown file from the deep-research KB
// (kb/{region}/{CATEGORY}/.comuni/{comune-slug}.md) and returns a list
// of structured POIs that map 1:1 onto the Prisma `PointOfInterest`
// model. The caller (api/scripts/extract-pois.ts) handles path →
// region/category/comune derivation — this function only cares about
// the markdown content and the hint of which comune/category it came
// from.
//
// Output shape is aligned with points_of_interest columns. See
// db-context skill for the full schema. Fields intentionally omitted
// because they're caller-supplied or DB-managed:
//   - id           (gen_random_uuid() on insert)
//   - region_id    (from the caller's path parsing)
//   - category     (from the caller's path parsing)
//   - created_at, updated_at
//
// Reuses the AzureFoundry client. Extraction is a one-shot structured
// output — no streaming, no tool use.

class ExtractedPoi {
  name string @description("Official name of the place. Use the H3 heading from the markdown as-is. Max 500 characters.")
  address string? @description("Full street address if mentioned, e.g. 'Via Roma 12, 33100 Udine (UD)'. Take it verbatim from the markdown — usually after '**Indirizzo:**'. Max 500 characters. Null if not present.")
  website_url string? @description("Official website URL if present in the text or as a markdown link. Must be a full URL starting with http:// or https://. Max 1000 characters. Null if not present.")
  image_url string? @description("URL to a representative photo of the venue if one is embedded or linked in the markdown. Max 1000 characters. Null if not present.")
  description string? @description("Concise Italian description of the venue, 2-4 sentences. Write a natural paragraph, not a bullet list. Focus on what makes the venue distinctive: cuisine type, atmosphere, specialties, historical notes. You may paraphrase but do NOT invent facts the source does not support. Leave null only if the markdown has no real content about this place.")
}

class PoiExtractionResult {
  pois ExtractedPoi[] @description("All POIs extracted from the markdown. Order does not matter. Empty array is valid if the file describes no concrete venues.")
}

function ExtractPois(
  comune_name: string,
  category: string,
  markdown_content: string
) -> PoiExtractionResult {
  client AzureFoundry

  prompt #"
    {{ _.role("system") }}
    Sei un estrattore strutturato di punti di interesse (POI) per una
    guida turistica italiana. Il tuo compito è leggere un file markdown
    che descrive i luoghi di una specifica categoria in un comune, ed
    estrarre tutti i POI in formato strutturato.

    NON inventare dati. Se un campo non è presente nel testo, lascialo a null.
    È meglio un POI con molti null che un POI con informazioni inventate.

    ## Contesto
    - Comune: {{ comune_name }}
    - Categoria: {{ category }}

    La categoria ti dice che tipo di POI cercare:
    - RESTAURANT: ristoranti, trattorie, osterie, locande, pizzerie
    - BAR: bar, caffetterie, enoteche, bistrot
    - PUB: pub, birrerie, birrifici
    - STREET_FOOD: cibo di strada, chioschi, food truck, panetterie con asporto
    - AGRITURISMO: agriturismi, fattorie didattiche
    - WINERY: cantine, vigneti, produttori di vino
    - MUSEUM: musei, pinacoteche, gallerie d'arte, collezioni, fondazioni
    - CHURCH: chiese, duomi, basiliche, abbazie, santuari
    - LANDMARK: monumenti, castelli, palazzi storici, rovine, ponti storici, torri
    - PARK: parchi, giardini, riserve naturali
    - BEACH: spiagge, lidi, bagni
    - NEIGHBORHOOD: quartieri, rioni, zone caratteristiche
    - ROOFTOP: rooftop, terrazze panoramiche
    - MARKET: mercati, mercatini
    - VENUE: locali serali, club, sale da concerto
    - EVENT_VENUE: spazi eventi, auditorium, sale congressi
    - DANCE: discoteche, locali da ballo
    - EXPERIENCE_SITE: esperienze guidate, tour, laboratori
    - SAGRA: sagre di paese, feste gastronomiche stagionali
    - FESTIVAL: festival culturali, rassegne musicali

    ## Regole di estrazione

    1. **Una voce per heading H3**. Ogni sezione `### Nome Locale` è
       generalmente un POI. Il titolo H3 diventa il campo `name` (senza il
       prefisso `###`). Se il nome contiene informazioni superflue tra
       parentesi (es. "Ristorante XYZ (gestito da Mario)"), mantieni
       solo il nome principale.

    2. **Salta le sezioni generiche**. Gli heading come "La Cucina
       Tradizionale", "Storia del paese", "Contesto gastronomico",
       "Sapori locali", "Conclusione", o qualunque sezione che non
       descrive un luogo specifico con un nome proprio, NON vanno
       estratti. Sono contesto culturale, non POI.

    3. **Salta l'introduzione del comune**. Il paragrafo iniziale subito
       dopo `## {comune}` descrive il comune in generale e non è un POI.

    4. **Indirizzo verbatim**. Se il testo contiene `**Indirizzo:**
       Via Roma 12, 33100 Udine (UD)`, copia quella riga esattamente
       (senza il prefisso "Indirizzo:") nel campo `address`. Se il
       testo menziona solo il comune senza via, lascia `address` a null.

    5. **URL completi**. Estrai website_url solo se il markdown contiene
       un URL completo (http:// o https://). Non costruire URL a partire
       da nomi. Il maps_url viene generato automaticamente fuori da qui
       a partire da nome + indirizzo, non è un campo da estrarre.

    6. **Description concisa**. Riassumi la descrizione del POI in 2-4
       frasi italiane. Mantieni i dettagli distintivi (cucina, atmosfera,
       specialità, prezzo, valutazioni importanti) ma evita di copiare
       paragrafi interi. Non inventare.

    7. **Nomi duplicati**. Se per sbaglio il markdown descrive due POI
       con esattamente lo stesso nome, estraili entrambi — il populator
       gestirà eventuali conflitti di unique constraint.

    8. **Zero POI è valido**. Se il file non contiene nessun POI
       concreto (capita con file quasi vuoti o pieni solo di contesto),
       restituisci `pois: []`.

    {{ _.role("user") }}
    Estrai tutti i POI di categoria {{ category }} da questo markdown
    relativo al comune di {{ comune_name }}:

    {{ markdown_content }}

    {{ ctx.output_format }}
  "#
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test ExtractRestaurantPoisFromAielloDelFriuli {
  functions [ExtractPois]
  args {
    comune_name "Aiello del Friuli"
    category "RESTAURANT"
    markdown_content #"
      ## Aiello del Friuli

      Aiello del Friuli è un piccolo comune della provincia di Udine.

      ### La Dolce Vita al Museo

      **Indirizzo:** Via Francesco Petrarca, 1, 33041 Aiello del Friuli (UD)

      Ristorante italiano con cucina mediterranea, specialità pesce.
      Valutazione 4.5 su TripAdvisor, secondo posto nel comune.

      ### Ristorante Da Brontolo M.C.M

      **Indirizzo:** Viale Vittorio Emanuele, 36, 33041 Aiello del Friuli (UD)
      **Telefono:** 342 649 9585

      Primo posto su TripAdvisor. Specializzato in carne e pesce.

      ### La Cucina Tradizionale Friulana ad Aiello del Friuli

      La cucina tradizionale friulana include frico, gnocchi di patate,
      e frutti di mare. Questa è una sezione di contesto, non un POI.
    "#
  }
}

test ExtractEmptyResult {
  functions [ExtractPois]
  args {
    comune_name "Amaro"
    category "RESTAURANT"
    markdown_content #"
      ## Amaro

      Amaro è un piccolo comune montano. Non sono attualmente
      presenti ristoranti di rilievo documentati per questo paese.
    "#
  }
}
