# Prompt di ricerca approfondita — Italiapedia

20 prompt separati, uno per categoria. Per ogni prompt:

1. Sostituisci `Trentino-Alto Adige` con il nome della regione (es. "Friuli Venezia Giulia")
2. Sostituisci `trentino-alto-adige` con l'id della regione (es. "friuli-venezia-giulia")
3. Sostituisci `05 aprile 2026` con la data di oggi (es. "5 aprile 2026")
4. Lancia il prompt con Claude deep research
5. Salva l'output markdown in `kb/trentino-alto-adige/{CATEGORY}/knowledge.md`
6. Lancia la pipeline: `chunk-pages.ts` → `upload-to-qdrant.ts`

---

## Formato output

Ogni prompt deve restituire un documento markdown completo e dettagliato, organizzato per città/comune. Per ogni luogo o punto di interesse, includere:

- **Nome** del luogo
- **Città/Comune** dove si trova
- **Indirizzo** (se disponibile)
- **Descrizione** dettagliata (3-5 frasi: storia, cosa lo rende speciale, cosa aspettarsi)
- **Sito web** (se disponibile)
- **Fonti** consultate

Il documento deve essere scritto in italiano, in prosa discorsiva, ricco di dettagli e leggibile — come una guida turistica di alta qualità. NON restituire elenchi secchi o tabelle: scrivi testi descrittivi che un chatbot possa usare per rispondere a domande degli utenti.

---

## 1. RESTAURANT — Ristoranti

```
Sei un ricercatore esperto di gastronomia italiana. La data di oggi è 05 aprile 2026. Devi creare una guida completa e approfondita dei ristoranti della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo che copra tutti i ristoranti, le trattorie, le osterie e i locali di ristorazione rilevanti della regione. Non limitarti ai più famosi — includi le gemme nascoste, i posti amati dai locali, le trattorie fuori dai circuiti turistici.

### Cosa coprire:
- Ristoranti di cucina tradizionale regionale (trattorie, osterie, locande)
- Ristoranti stellati Michelin e fine dining
- Locali storici (aperti da almeno 30-50 anni)
- Trattorie e osterie di paese, fuori dal capoluogo
- Locali specializzati in piatti tipici di Trentino-Alto Adige
- Ristoranti di pesce (se la regione ha costa)
- Agriturismi con ristorazione di qualità
- Pizzerie storiche o di eccellenza
- Locali emergenti e nuova cucina regionale
- Piatti tipici della regione: cosa sono, dove mangiarli, la loro storia
- Prodotti DOP/IGP e specialità gastronomiche locali

### Per ogni ristorante descrivi:
- Nome e città/comune
- Indirizzo (se disponibile)
- Cosa lo rende speciale, piatti signature, storia, atmosfera
- Fascia di prezzo indicativa
- Sito web (se disponibile)

### Struttura del documento:
Organizza il contenuto per città/comune, con un'intestazione h2 per ogni città e h3 per ogni ristorante. Inizia con un'introduzione sulla cucina tipica di Trentino-Alto Adige.

### Linee guida:
- Copri tutta la regione: capoluogo, province, borghi, zone rurali e costiere
- Scrivi in italiano, in prosa discorsiva e dettagliata
- Punta ad almeno 30-50 voci distribuite su tutta la regione
- Cita le fonti principali consultate alla fine del documento
- Il testo deve essere utile a un chatbot che risponde a domande su dove mangiare in Trentino-Alto Adige
```

---

## 2. BAR — Bar e Caffetterie

```
Sei un ricercatore esperto di cultura del caffè, della colazione e della socialità italiana. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei bar, caffetterie, pasticcerie, gelaterie e locali da aperitivo della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo. Includi bar di ogni tipo — non solo storici o famosi, ma anche quelli comuni dove la gente del posto va a fare colazione, bere un caffè o prendere un aperitivo.

### Cosa coprire:
- Bar per la colazione: dove fare una buona colazione, brioche e caffè
- Locali per l'aperitivo: dove prendere uno spritz o un aperitivo in compagnia
- Pasticcerie artigianali e tradizionali
- Gelaterie artigianali di qualità
- Caffetterie specialty e torrefazioni artigianali
- Bar storici e caffè letterari
- Bar con dehors, terrazze o ambienti particolari
- Tradizioni dolciarie e di colazione tipiche della regione

### Per ogni locale descrivi:
- Nome e città/comune
- Indirizzo (se disponibile)
- Specialità, cosa ordinare, atmosfera, storia
- Sito web (se disponibile)

### Struttura del documento:
Organizza per città/comune (h2), poi per locale (h3). Introduci con le tradizioni di colazione e aperitivo tipiche di Trentino-Alto Adige.

### Linee guida:
- Copri tutta la regione, non solo il capoluogo
- Scrivi in italiano, in prosa discorsiva
- Punta ad almeno 20-30 voci
- Cita le fonti alla fine
```

---

## 3. MUSEUM — Musei

```
Sei uno storico dell'arte e ricercatore culturale. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei musei e delle istituzioni culturali della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo su tutti i musei, le gallerie, le pinacoteche e gli spazi espositivi della regione. Includi sia i grandi musei nazionali che i piccoli musei civici e le collezioni private.

### Cosa coprire:
- Musei d'arte (antica, moderna, contemporanea)
- Musei archeologici
- Musei di storia e storia naturale
- Musei etnografici e delle tradizioni popolari
- Pinacoteche e gallerie d'arte
- Fondazioni culturali e spazi espositivi
- Musei tematici (del vino, della seta, della carta, etc.)
- Piccoli musei civici e collezioni di paese
- Case-museo di personaggi illustri

### Per ogni museo descrivi:
- Nome e città/comune
- Indirizzo (se disponibile)
- Collezioni principali, opere imperdibili, storia dell'edificio
- Orari e biglietti (se disponibili)
- Sito web (se disponibile)

### Struttura: per città (h2), per museo (h3). Introduci con il panorama culturale di Trentino-Alto Adige.
### Linee guida: copri tutta la regione, prosa italiana, 20-30 voci, fonti alla fine.
```

---

## 4. CHURCH — Chiese e Luoghi di Culto

```
Sei uno storico dell'architettura sacra italiana. La data di oggi è 05 aprile 2026. Devi creare una guida completa delle chiese e dei luoghi di culto di interesse storico-artistico della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo su chiese, cattedrali, basiliche, santuari, abbazie e monasteri rilevanti.

### Cosa coprire:
- Cattedrali e duomi
- Basiliche maggiori e minori
- Santuari e luoghi di pellegrinaggio
- Abbazie e monasteri (anche rurali)
- Chiese con affreschi, dipinti o sculture di pregio
- Battisteri e cappelle storiche
- Cripte e catacombe

### Per ogni luogo descrivi:
- Nome e città/comune
- Stile architettonico, epoca di costruzione
- Opere d'arte contenute, rilevanza storica
- Sito web (se disponibile)

### Struttura: per città (h2), per chiesa (h3). Introduci con la storia dell'architettura sacra in Trentino-Alto Adige.
### Linee guida: copri tutta la regione incluse pievi rurali, prosa italiana, 20-30 voci, fonti alla fine.
```

---

## 5. LANDMARK — Monumenti e Attrazioni

```
Sei uno storico e esperto di patrimonio culturale italiano. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei monumenti, delle attrazioni storiche e dei siti di interesse della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo su tutti i monumenti e siti storici.

### Cosa coprire:
- Castelli, fortezze e rocche
- Palazzi storici e ville nobiliari (aperti al pubblico)
- Piazze celebri e fontane monumentali
- Torri, porte, mura e archi storici
- Siti archeologici e rovine
- Ponti storici, statue, monumenti commemorativi
- Siti UNESCO della regione

### Per ogni monumento descrivi:
- Nome e città/comune
- Epoca, stile, storia, perché visitarlo
- Sito web (se disponibile)

### Struttura: per città (h2), per monumento (h3). Introduci con la storia del patrimonio di Trentino-Alto Adige.
### Linee guida: copri tutta la regione, prosa italiana, 25-40 voci, fonti alla fine.
```

---

## 6. PARK — Parchi e Natura

```
Sei un naturalista e esperto di turismo outdoor italiano. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei parchi, delle aree naturali e dei luoghi naturalistici della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Parchi nazionali e regionali
- Riserve naturali e aree marine protette
- Giardini botanici e giardini storici
- Spiagge notevoli e calette
- Grotte, cascate, laghi e forre
- Sentieri e percorsi escursionistici celebri
- Oasi WWF e LIPU

### Per ogni area descrivi:
- Nome e localizzazione (comune, zona)
- Cosa si trova, flora e fauna, percorsi, cosa aspettarsi
- Come arrivarci
- Sito web (se disponibile)

### Struttura: per zona/comune (h2), per area naturale (h3). Introduci con il paesaggio naturale di Trentino-Alto Adige.
### Linee guida: copri montagna, collina, costa e pianura, prosa italiana, 20-30 voci, fonti alla fine.
```

---

## 7. NEIGHBORHOOD — Quartieri e Zone

```
Sei un urbanista e conoscitore del tessuto sociale italiano. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei quartieri storici, borghi e zone caratteristiche della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Quartieri storici delle città principali
- Borghi medievali e centri storici di piccoli comuni
- Borghi bandiera (Borghi più belli d'Italia, Bandiera Arancione)
- Rioni e contrade con identità propria
- Zone pedonali e aree vivaci
- Borghi fantasma o semi-abbandonati di interesse

### Per ogni quartiere/borgo descrivi:
- Nome e localizzazione
- Storia, atmosfera, cosa si trova passeggiando, perché visitarlo

### Struttura: per zona (h2), per quartiere/borgo (h3). Introduci con il tessuto urbano di Trentino-Alto Adige.
### Linee guida: copri dai capoluoghi ai borghi rurali, prosa italiana, 20-30 voci, fonti alla fine.
```

---

## 8. VENUE — Locali e Intrattenimento

```
Sei un esperto di vita notturna e socialità italiana. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei locali e degli spazi di intrattenimento della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo sui locali dove la gente del posto va per socializzare e divertirsi.

### Cosa coprire:
- Wine bar e enoteche con mescita
- Cocktail bar e speakeasy
- Jazz club e locali con musica dal vivo
- Circoli culturali e associazioni con eventi
- Locali alternativi e sale da tè
- Beach bar e stabilimenti con eventi

### Per ogni locale descrivi:
- Nome e città/comune
- Tipo di locale, musica, atmosfera, quando andare

### Struttura: per città (h2), per locale (h3).
### Linee guida: copri le città principali, prosa italiana, 15-20 voci, fonti alla fine.
```

---

## 9. ROOFTOP — Rooftop e Punti Panoramici

```
Sei un esperto di panorami e belvedere italiani. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei punti panoramici e delle terrazze con vista della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Rooftop bar e terrazze panoramiche
- Belvedere pubblici e punti di osservazione
- Torri e campanili visitabili con vista
- Colline e alture accessibili con panorama
- Ristoranti con vista, fari costieri

### Per ogni punto descrivi:
- Nome e localizzazione
- Cosa si vede, orari migliori (tramonto?), se gratuito o a pagamento

### Struttura: per zona (h2), per punto panoramico (h3).
### Linee guida: copri tutta la regione, prosa italiana, 10-20 voci, fonti alla fine.
```

---

## 10. EVENT_VENUE — Sale Eventi e Spazi Culturali

```
Sei un esperto di programmazione culturale e spettacolo in Italia. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei teatri, delle sale concerti e degli spazi culturali della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Teatri storici e teatri d'opera
- Sale concerti e auditorium
- Centri culturali e spazi polivalenti
- Cinema d'essai
- Spazi espositivi per mostre temporanee
- Anfiteatri e arene per eventi estivi

### Per ogni spazio descrivi:
- Nome e città/comune
- Tipo di programmazione, storia, capienza, eventi principali

### Struttura: per città (h2), per spazio (h3).
### Linee guida: copri tutta la regione, prosa italiana, 15-25 voci, fonti alla fine.
```

---

## 11. WINERY — Cantine e Produttori di Vino

```
Sei un sommelier e esperto di enologia italiana. La data di oggi è 05 aprile 2026. Devi creare una guida completa delle cantine, dei produttori di vino e delle esperienze enologiche della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Cantine storiche e aziende vitivinicole con visite e degustazioni
- Produttori di vini DOC, DOCG e IGT della regione
- Produttori di vini naturali e biodinamici
- Enoteche regionali
- Strade del vino e percorsi enoturistici
- Distillerie e produttori di grappe
- Vitigni autoctoni e vini tipici della regione

### Per ogni cantina descrivi:
- Nome e città/comune
- Vitigni coltivati, vini principali, storia, esperienza di visita
- Sito web (se disponibile)

### Struttura: per zona vinicola (h2), per cantina (h3). Introduci con i vitigni e le denominazioni di Trentino-Alto Adige.
### Linee guida: copri tutte le zone vinicole, prosa italiana, 20-30 voci, fonti alla fine.
```

---

## 12. MARKET — Mercati

```
Sei un esperto di tradizioni commerciali e prodotti tipici italiani. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei mercati e delle botteghe storiche della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Mercati rionali giornalieri e settimanali
- Mercati coperti e storici
- Mercati del pesce, mercati contadini
- Botteghe storiche e negozi tradizionali
- Gastronomie e salumerie storiche
- Fiere gastronomiche ricorrenti
- Prodotti tipici regionali e dove acquistarli

### Per ogni mercato/bottega descrivi:
- Nome e città/comune
- Cosa si trova, giorni e orari, storia, prodotti tipici

### Struttura: per città (h2), per mercato (h3).
### Linee guida: copri tutta la regione, prosa italiana, 15-20 voci, fonti alla fine.
```

---

## 13. EXPERIENCE_SITE — Esperienze

```
Sei un esperto di turismo esperienziale in Italia. La data di oggi è 05 aprile 2026. Devi creare una guida completa delle esperienze uniche e delle attività da fare nella regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Corsi di cucina tradizionale
- Laboratori artigianali visitabili (ceramica, vetro, tessuti)
- Tour guidati speciali e insoliti
- Esperienze enogastronomiche (degustazioni, pranzi in vigna)
- Attività outdoor: trekking, ciclismo, kayak, vela, sci
- Terme storiche e spa naturali
- Esperienze di raccolta (olive, uva, tartufi)

### Per ogni esperienza descrivi:
- Nome e città/comune
- Cosa si fa, durata, cosa aspettarsi, come prenotare

### Struttura: per zona (h2), per esperienza (h3).
### Linee guida: copri tutta la regione e tutte le stagioni, prosa italiana, 15-25 voci, fonti alla fine.
```

---

## 14. SAGRA — Sagre e Feste Gastronomiche

```
Sei un ricercatore esperto di tradizioni popolari e sagre italiane. La data di oggi è 05 aprile 2026. Devi creare una guida completa delle sagre e delle feste gastronomiche della regione Trentino-Alto Adige.

Le sagre sono una delle tradizioni più autentiche d'Italia — feste di paese dedicate a un prodotto tipico locale. Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Sagre gastronomiche (sagra del pesce, della porchetta, del tartufo, etc.)
- Feste del raccolto, della vendemmia, della trebbiatura
- Fiere enogastronomiche e rassegne
- Sagre famose e sagre piccole di paese
- Calendario: quando si tengono (mese, stagione)

### Per ogni sagra descrivi:
- Nome e città/comune
- Cosa si celebra, cosa si mangia, quando si tiene, storia
- Come arrivarci

### Struttura: per stagione o per zona (h2), per sagra (h3). Introduci con la tradizione delle sagre in Trentino-Alto Adige.
### Linee guida: copri tutta la regione e tutte le stagioni, prosa italiana, 20-30 voci, fonti alla fine.
```

---

## 15. BEACH — Spiagge

```
Sei un ricercatore esperto di turismo balneare e costiero italiano. La data di oggi è 05 aprile 2026. Devi creare una guida completa delle spiagge e delle coste della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Spiagge Bandiera Blu
- Calette nascoste e spiagge segrete
- Stabilimenti balneari storici e rinomati
- Spiagge libere e come raggiungerle
- Coste rocciose, faraglioni, grotte marine
- Spiagge per famiglie, spiagge per sport acquatici
- Isole e arcipelaghi con spiagge
- (Se regione senza costa: laghi balneabili e fiumi)

### Per ogni spiaggia descrivi:
- Nome e localizzazione (comune, costa)
- Tipo (sabbia, ciottoli, scoglio), come arrivarci, servizi
- Cosa la rende speciale

### Struttura: per tratto di costa o comune (h2), per spiaggia (h3).
### Linee guida: copri tutta la costa, prosa italiana, 15-25 voci, fonti alla fine.
```

---

## 16. AGRITURISMO — Agriturismi

```
Sei un ricercatore esperto di turismo rurale e agriturismi italiani. La data di oggi è 05 aprile 2026. Devi creare una guida completa degli agriturismi della regione Trentino-Alto Adige.

L'agriturismo è un'invenzione tutta italiana — aziende agricole che accolgono ospiti e offrono cucina con prodotti propri. Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Agriturismi con ristorazione e/o pernottamento
- Agriturismi con fattoria didattica
- Agriturismi con produzione propria (olio, vino, formaggi, miele)
- Masserie (nel Sud)
- Agriturismi con attività (equitazione, raccolta, corsi)

### Per ogni agriturismo descrivi:
- Nome e città/comune
- Cosa produce, tipo di cucina, esperienza offerta, come prenotare
- Sito web (se disponibile)

### Struttura: per zona (h2), per agriturismo (h3).
### Linee guida: copri collina, montagna, pianura, costa, prosa italiana, 15-25 voci, fonti alla fine.
```

---

## 17. FESTIVAL — Feste e Celebrazioni

```
Sei un ricercatore esperto di tradizioni popolari, feste religiose e celebrazioni italiane. La data di oggi è 05 aprile 2026. Devi creare una guida completa delle feste patronali, dei carnevali, delle processioni e delle rievocazioni storiche della regione Trentino-Alto Adige.

A differenza delle sagre (centrate sul cibo), le feste sono celebrazioni civiche, religiose e storiche. Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Feste patronali delle città e dei borghi
- Carnevali storici e tradizionali
- Palii, giostre e tornei storici
- Processioni religiose (Settimana Santa, Corpus Domini)
- Rievocazioni storiche e medievali
- Infioriate, luminarie, falò tradizionali
- Tradizioni popolari uniche della regione

### Per ogni festa descrivi:
- Nome e città/comune
- Quando si tiene (date, periodo), cosa succede, storia, come partecipare

### Struttura: per stagione o zona (h2), per festa (h3). Introduci con le tradizioni festive di Trentino-Alto Adige.
### Linee guida: copri tutta la regione e tutto l'anno, prosa italiana, 20-30 voci, fonti alla fine.
```

---

## 18. DANCE — Discoteche e Locali da Ballo

```
Sei un ricercatore esperto di vita notturna e clubbing in Italia. La data di oggi è 05 aprile 2026. Devi creare una guida completa delle discoteche, dei club e dei locali da ballo della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Discoteche storiche e iconiche
- Club estivi, beach club e lidi con musica
- Locali di musica elettronica, techno, house
- Locali di musica latina e salsa
- Festival di musica elettronica nella regione
- After-hour e club underground

### Per ogni locale descrivi:
- Nome e città/comune
- Genere musicale, atmosfera, serate principali, quando andare

### Struttura: per città/zona (h2), per locale (h3).
### Linee guida: copri città principali e zone costiere/turistiche, prosa italiana, 10-20 voci, fonti alla fine.
```

---

## 19. STREET_FOOD — Street Food

```
Sei un ricercatore esperto di cibo da strada e gastronomia popolare italiana. La data di oggi è 05 aprile 2026. Devi creare una guida completa dello street food e del cibo da passeggio della regione Trentino-Alto Adige.

Lo street food italiano è una tradizione antichissima — ogni regione ha le sue specialità. Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Specialità da strada tipiche di Trentino-Alto Adige (cosa sono, dove mangiarle)
- Friggitorie, rosticcerie, pizzerie al taglio storiche
- Chioschi e bancarelle famose
- Piadinerie, arrosticinerie, friggitorie di pesce
- Mercati con banchi di street food
- Food truck rinomati
- Tour gastronomici a piedi

### Per ogni specialità/locale descrivi:
- Nome e città/comune
- Cosa si mangia, storia del piatto, dove trovarlo, prezzo indicativo

### Struttura: prima una sezione sulle specialità da strada di Trentino-Alto Adige (h2), poi per città (h2), per locale (h3).
### Linee guida: copri tutta la regione, prosa italiana, 15-25 voci, fonti alla fine.
```

---

## 20. PUB — Pub e Birrerie

```
Sei un ricercatore esperto di cultura birraria e pub in Italia. La data di oggi è 05 aprile 2026. Devi creare una guida completa dei pub, delle birrerie artigianali e dei brewpub della regione Trentino-Alto Adige.

Scrivi un documento markdown esaustivo.

### Cosa coprire:
- Pub, birrerie artigianali e brewpub
- Birrifici artigianali con tap room
- Beer shop e beer garden
- Pub storici e locali con ampia selezione
- Festival della birra artigianale nella regione
- Pub con cucina e abbinamenti birra-cibo
- La scena craft beer della regione

### Per ogni locale descrivi:
- Nome e città/comune
- Birre prodotte o in carta, atmosfera, storia, cosa provare

### Struttura: per città (h2), per locale (h3). Introduci con la scena birraria di Trentino-Alto Adige.
### Linee guida: copri tutta la regione, prosa italiana, 10-20 voci, fonti alla fine.
```

---

## Come usare

1. Scegli una regione e una categoria
2. Copia il prompt corrispondente
3. Sostituisci `Trentino-Alto Adige` con il nome (es. "Puglia") e `trentino-alto-adige` con l'id (es. "puglia")
4. Lancia il prompt con Claude deep research
5. Salva l'output markdown in `kb/trentino-alto-adige/{CATEGORY}/knowledge.md`
6. Lancia la pipeline di chunking e indicizzazione:
   ```bash
   cd api && npx ts-node -r tsconfig-paths/register scripts/chunk-pages.ts
   npx ts-node -r tsconfig-paths/register scripts/upload-to-qdrant.ts
   ```

### Regioni e ID

| Regione               | ID                      |
| --------------------- | ----------------------- |
| Piemonte              | `piemonte`              |
| Valle d'Aosta         | `valle-d-aosta`         |
| Lombardia             | `lombardia`             |
| Trentino-Alto Adige   | `trentino-alto-adige`   |
| Veneto                | `veneto`                |
| Friuli Venezia Giulia | `friuli-venezia-giulia` |
| Liguria               | `liguria`               |
| Emilia-Romagna        | `emilia-romagna`        |
| Toscana               | `toscana`               |
| Umbria                | `umbria`                |
| Marche                | `marche`                |
| Lazio                 | `lazio`                 |
| Abruzzo               | `abruzzo`               |
| Molise                | `molise`                |
| Campania              | `campania`              |
| Puglia                | `puglia`                |
| Basilicata            | `basilicata`            |
| Calabria              | `calabria`              |
| Sicilia               | `sicilia`               |
| Sardegna              | `sardegna`              |
