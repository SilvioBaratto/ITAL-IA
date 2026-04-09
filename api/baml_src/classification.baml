// Query classifier for the Italia chatbot.
//
// Runs before every Qdrant search to narrow retrieval to the relevant
// slice of the knowledge base. Reads the raw user question + the active
// region + recent conversation history and emits:
//   - categories: which POI categories to filter Qdrant on (0..N enum values)
//   - comune:     an explicit comune if the user named one
//
// Empty `categories` means "no category filter" — the retrieval step
// widens to every category in the active region. That's the correct
// behavior for generic questions like "cosa vedere?".
//
// Reuses the AzureFoundry client from clients.baml so the classifier
// runs on the same deployment as StreamRAGChat. If classifier latency
// becomes a problem, define a smaller client and swap this one line.

enum PoiCategoryEnum {
  RESTAURANT
  MUSEUM
  PARK
  MARKET
  BAR
  LANDMARK
  VENUE
  CHURCH
  ROOFTOP
  NEIGHBORHOOD
  EVENT_VENUE
  WINERY
  EXPERIENCE_SITE
  SAGRA
  BEACH
  AGRITURISMO
  FESTIVAL
  DANCE
  STREET_FOOD
  PUB
}

class QueryClassification {
  categories PoiCategoryEnum[] @description("POI categories relevant to the question. Empty array means no category filter — search all categories in the region.")
  comune string? @description("Specific comune name if the user explicitly mentions one (e.g. 'Trieste', 'Udine'). Null if no comune is mentioned.")
}

function ClassifyQuery(
  question: string,
  region: string,
  recent_history: string
) -> QueryClassification {
  client AzureFoundry

  prompt #"
    {{ _.role("system") }}
    Sei un classificatore di domande per una guida turistica italiana.
    Il tuo unico compito: leggere la domanda dell'utente e scegliere quali
    categorie di luoghi di interesse sono rilevanti per rispondere.
    NON rispondere alla domanda — limitati a classificare.

    ## Regione attiva
    {{ region }}

    ## Tassonomia delle categorie
    Ogni categoria copre luoghi specifici. Quando classifichi, pensa a quale
    categoria potrebbe contenere la risposta nel database della guida.

    - RESTAURANT: ristoranti, trattorie, osterie, locande, pizzerie, ristoranti stellati
    - BAR: bar, caffetterie, enoteche, bistrot, wine bar, lounge
    - PUB: pub, birrerie, birrifici artigianali
    - STREET_FOOD: cibo di strada, chioschi, food truck, panifici con asporto
    - AGRITURISMO: agriturismi, fattorie didattiche, cascine con ristoro
    - WINERY: cantine, vigneti, produttori di vino, degustazioni in cantina
    - MUSEUM: musei, pinacoteche, gallerie d'arte, mostre, collezioni permanenti, fondazioni culturali
    - CHURCH: chiese, duomi, basiliche, abbazie, santuari, monasteri, pievi
    - LANDMARK: monumenti, castelli, palazzi storici, rovine archeologiche, ponti storici, torri, fortezze.
      NOTA IMPORTANTE: diversi castelli e palazzi storici ospitano musei al loro interno.
      Quando l'utente cerca musei, includi SEMPRE anche LANDMARK per non perdere questi casi.
    - PARK: parchi naturali, giardini pubblici, riserve naturali, aree protette, sentieri naturalistici
    - BEACH: spiagge, lidi, bagni, coste, baie
    - NEIGHBORHOOD: quartieri, rioni, zone caratteristiche della città, centri storici
    - ROOFTOP: rooftop, terrazze panoramiche, punti panoramici, belvedere
    - MARKET: mercati settimanali, mercatini di prodotti tipici, fiere alimentari
    - VENUE: locali serali, club, sale da concerto, spazi multifunzionali per musica/eventi
    - EVENT_VENUE: spazi dedicati a eventi culturali, congressi, fiere, auditorium
    - DANCE: discoteche, locali da ballo, dancing all'aperto
    - EXPERIENCE_SITE: esperienze guidate, tour, laboratori artigianali, attività all'aperto, escursioni
    - SAGRA: sagre di paese, feste gastronomiche stagionali, feste del patrono con cibo
    - FESTIVAL: festival culturali, rassegne musicali, eventi artistici non gastronomici

    ## Regole di classificazione
    1. **Includi generosamente**. Se hai un dubbio fra due categorie, includile entrambe.
       Meglio una categoria in più che perdere contenuto rilevante.
    2. **Questioni generiche → array vuoto**. Per domande come "cosa vedere?",
       "consigli per il weekend", "raccontami della regione", restituisci
       `categories: []` — nessun filtro significa cercare in tutta la regione.
    3. **Comuni espliciti**. Se l'utente nomina UN comune preciso (es. "a Trieste",
       "cosa fare a Udine"), riportalo in `comune` con il nome in formato display
       (es. "Trieste", "Pavia di Udine"). Se nomina la regione intera o un'area
       generica ("in Friuli", "in Carnia"), lascia `comune` a null.
    4. **Non inventare categorie**. Usa esclusivamente i valori dell'enum fornito.

    ## Esempi

    Domanda: "dove mangiare pesce a Trieste?"
    → categories: [RESTAURANT], comune: "Trieste"

    Domanda: "quali musei ci sono a Udine?"
    → categories: [MUSEUM, LANDMARK], comune: "Udine"
    (perché il Castello di Udine ospita i Civici Musei)

    Domanda: "dove bere un buon calice di vino?"
    → categories: [BAR, WINERY], comune: null

    Domanda: "cosa posso fare nel weekend?"
    → categories: [], comune: null
    (domanda generica, nessun filtro)

    Domanda: "spiagge libere vicino Grado?"
    → categories: [BEACH], comune: "Grado"

    Domanda: "ci sono sagre questo weekend?"
    → categories: [SAGRA, FESTIVAL], comune: null

    ## Cronologia recente (contesto)
    {{ recent_history }}

    {{ _.role("user") }}
    {{ question }}

    {{ ctx.output_format }}
  "#
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test ClassifySpecificRestaurantQuery {
  functions [ClassifyQuery]
  args {
    question "dove mangiare pesce a Trieste?"
    region "Friuli Venezia Giulia"
    recent_history ""
  }
}

test ClassifyMuseumLandmarkCrossover {
  functions [ClassifyQuery]
  args {
    question "quali musei posso visitare a Udine?"
    region "Friuli Venezia Giulia"
    recent_history ""
  }
}

test ClassifyGenericQuery {
  functions [ClassifyQuery]
  args {
    question "cosa posso fare questo weekend in Friuli?"
    region "Friuli Venezia Giulia"
    recent_history ""
  }
}

test ClassifyMultiCategoryQuery {
  functions [ClassifyQuery]
  args {
    question "dove posso bere un buon calice di vino rosso a Cividale?"
    region "Friuli Venezia Giulia"
    recent_history ""
  }
}
