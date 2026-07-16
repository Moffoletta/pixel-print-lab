# Guida Del Progetto

## 1. Obiettivo

Pixel Print Lab e un'applicazione personale in italiano per raccogliere richieste di stampa 3D. Non e un e-commerce: non gestisce pagamenti, spedizioni, account cliente o preventivi.

La pagina pubblica permettera di scegliere modelli dal catalogo oppure fornire un file STL o un link esterno autorizzato. Il pannello amministrativo permettera a un solo proprietario di gestire catalogo, colori e richieste.

## 2. Requisiti Consolidati

- Catalogo in una singola pagina pubblica.
- Prodotti con nome, descrizione, immagine, prezzo in euro e file STL.
- File personali STL fino a 50 MB oppure link a Printables, Thingiverse, MakerWorld e Cults3D.
- Scelta di un colore globale e di una quantita tra 1 e 99 per elemento.
- Carrello con prodotti del catalogo e modelli personali.
- Nome e cognome come unici dati identificativi.
- Conferma con codice univoco, senza stato dell'ordine.
- Pannello protetto per un solo amministratore.
- Statistiche anonime e senza cookie.
- Interfaccia chiara, responsive e interamente in stile pixel art.

## 3. Scelte Tecniche

### HTML

Definisce il significato e la struttura della pagina. Utilizzare elementi semantici rende l'interfaccia piu accessibile e facile da mantenere.

### CSS

Gestisce presentazione, layout responsive e stile pixel art. Nella prima versione non viene usato un framework, cosi ogni regola rimane leggibile e didattica.

### JavaScript

Gestira interazioni, carrello e comunicazione con il server. Lo stesso linguaggio verra utilizzato lato client e lato server, scelta coerente con lo studio per ServiceNow.

### Node.js Ed Express

Node.js esegue JavaScript fuori dal browser. Express riceve richieste HTTP, espone API e serve i file pubblici.

### SQLite

Entrera nella fase 3. E un database relazionale contenuto in un singolo file e adatto a un'applicazione locale con pochi ordini.

### Three.js

Entrera nella fase dedicata al visualizzatore e verra usato soltanto dove necessario per caricare e mostrare i file STL.

## 4. Architettura Iniziale

```text
browser
   |
   | HTTP
   v
server Express
   |-- file pubblici HTML/CSS/JavaScript
   |-- API REST
   |-- database SQLite (fase 3)
   `-- file catalogo e upload (fasi successive)
```

Il browser non accedera direttamente al database o alle cartelle private. Tutte le operazioni sui dati passeranno dalle API del server.

## 5. Struttura Delle Cartelle

```text
docs/                 documentazione e Kanban
public/               file inviati direttamente al browser
src/                  codice eseguito dal server
test/                 test automatici
data/                 futuro database SQLite
storage/catalog/      futuri file dei prodotti
storage/uploads/      futuri file allegati alle richieste
```

`node_modules` contiene dipendenze installate automaticamente e non viene salvata in Git. `.env` conterra configurazioni private e viene ignorato. `.env.example` documenta invece i nomi delle impostazioni richieste senza includere segreti reali.

## 6. Avvio Locale

Dalla cartella principale:

```powershell
npm.cmd install
npm.cmd run dev
```

L'indirizzo predefinito e `http://localhost:3000`.

Il comando `dev` usa la modalita `--watch` integrata in Node.js: il server viene riavviato quando cambia il codice. In questo ambiente si usa `npm.cmd` per non modificare la policy PowerShell che blocca `npm.ps1`.

## 7. Test

```powershell
npm.cmd test
```

La fase 1 verifica due comportamenti:

- l'endpoint `/api/health` risponde con stato HTTP 200;
- il server rende disponibile la pagina pubblica.

I test usano il modulo `node:test` incluso in Node.js. Non e stata aggiunta una libreria esterna per un'esigenza gia coperta dalla piattaforma.

## 8. Sicurezza Iniziale

- Express non comunica l'header `X-Powered-By`.
- I segreti non devono entrare nel repository Git.
- Database e file caricati sono esclusi dal controllo versione.
- Il limite JSON iniziale e 1 MB; l'upload STL avra una gestione separata e un limite di 50 MB.
- Il server dovra convalidare ogni dato anche quando il browser lo ha gia controllato.

## 9. Collegamenti Con ServiceNow

- Le route Express sono analoghe, a livello concettuale, a endpoint e risorse REST.
- SQLite introduce tabelle, record, chiavi e relazioni, concetti centrali anche in ServiceNow.
- La separazione tra browser e server richiama la distinzione tra script client e script server.
- La validazione lato server e paragonabile alle regole che proteggono l'integrita dei record.
- Le future sessioni amministrative introdurranno autenticazione e autorizzazione, concetti collegati a ruoli e ACL.

## 10. Esito Della Fase 1

La base e deliberatamente piccola ma funzionante. Il server puo essere avviato, la pagina viene servita e i comportamenti essenziali sono verificati automaticamente. La fase 2 sostituira la schermata temporanea con la prima versione statica del catalogo.

## 11. Fase 2 - Catalogo Statico

### Obiettivo

La fase 2 definisce la struttura e il linguaggio visivo della pagina pubblica senza introdurre ancora dati dinamici. Separare presentazione e logica permette di verificare prima gerarchia, contenuti e adattamento agli schermi.

La pagina contiene:

- intestazione con navigazione e indicatore del futuro carrello;
- presentazione del servizio con una stampante pixel art animata;
- catalogo con due prodotti dimostrativi;
- introduzione alla futura richiesta di un modello personale;
- footer con versione corrente del prototipo.

### HTML Semantico

Gli elementi descrivono il ruolo del contenuto:

- `header` identifica intestazioni di pagina o sezione;
- `nav` raccoglie i collegamenti principali;
- `main` contiene il contenuto unico della pagina;
- `section` divide aree tematiche;
- `article` rappresenta un prodotto autonomo;
- `h1`, `h2` e `h3` costruiscono una gerarchia ordinata;
- `data` associa il prezzo leggibile al valore numerico che verra usato in futuro.

Questa struttura aiuta browser, motori di ricerca e tecnologie assistive. Le classi CSS descrivono invece l'aspetto e non sostituiscono il significato HTML.

### Accessibilita Di Base

Il collegamento "Vai al contenuto" permette a chi usa la tastiera di saltare la navigazione. Le immagini hanno testi alternativi che descrivono il modello, mentre l'animazione della stampante espone un'unica descrizione ed evita che i suoi elementi decorativi vengano letti separatamente.

La pagina mantiene colori ad alto contrasto, collegamenti riconoscibili e una gerarchia di titoli. Nessuna scheda simula un pulsante: configurazione e carrello non sono ancora implementati e quindi non vengono presentati come interattivi.

### Layout Responsive

Il layout usa CSS Grid. Su schermi ampi hero e prodotti occupano due colonne; sotto `860px` diventano una singola colonna. Sotto `540px` vengono ridotti spazi, illustrazione e composizioni interne.

`clamp()` rende fluide le dimensioni dei titoli tra un minimo e un massimo. La variabile `--page` mantiene la stessa larghezza massima per intestazione, hero e footer.

### Immagini Dimostrative

Le anteprime in `public/images` sono SVG creati con forme geometriche. SVG e un formato vettoriale: rimane nitido a diverse risoluzioni e, in questa fase, evita fotografie o risorse esterne. `shape-rendering="crispEdges"` e la proprieta CSS `image-rendering: pixelated` rafforzano il linguaggio pixel art.

Nella fase amministrativa queste immagini statiche verranno sostituite da file gestiti dal proprietario del sito.

### Stile Pixel Art

Il linguaggio grafico usa:

- bordi spessi e ombre senza sfocatura;
- griglia tecnica sullo sfondo;
- tipografia monospaziata per etichette e dati;
- titoli sans-serif molto compatti;
- arancione e blu come colori funzionali;
- animazioni a scatti tramite `steps()`.

Le custom properties definite in `:root`, come `--ink` e `--orange`, centralizzano i valori ricorrenti. Modificare una variabile aggiorna tutti i componenti che la utilizzano.

### Test Della Pagina

I test verificano ora che:

- il documento dichiari la lingua italiana;
- esistano contenuto principale, titolo e skip link;
- siano presenti esattamente due prodotti dimostrativi;
- entrambe le immagini SVG siano raggiungibili dal server.

Il controllo non sostituisce una prova visiva in browser, ma protegge la struttura essenziale da modifiche accidentali.

### Collegamenti Con ServiceNow

- La semantica HTML e la struttura CSS sono applicabili a Service Portal e UI personalizzate.
- I componenti visuali ripetuti anticipano il concetto di template riutilizzabile.
- Gli attributi `data-*` consentono di collegare elementi del DOM a identificatori, analogamente a come un'interfaccia collega una vista a un record.
- Le media query mostrano come la stessa interfaccia possa adattarsi senza duplicare il contenuto.

## 12. Esito Della Fase 2

La pagina pubblica ha ora una struttura completa e responsive. I prodotti restano scritti direttamente nell'HTML: nella fase 3 verranno trasferiti in SQLite e caricati attraverso API REST.

## 13. Fase 3 - Database E API

### Dal Contenuto Statico Ai Record

Nella fase 2 ogni prodotto era scritto direttamente in `index.html`. Questo approccio e semplice, ma richiederebbe di modificare il codice per aggiungere un prodotto o cambiare un prezzo.

La fase 3 sposta prodotti e colori in SQLite. L'HTML contiene ora un solo `template` di scheda; JavaScript richiede i record al server e crea una scheda per ciascun prodotto ricevuto.

Il flusso e:

```text
SQLite -> query SQL -> API Express -> JSON -> fetch -> DOM
```

Questa separazione prepara il futuro pannello amministrativo: modificare un record nel database aggiornera il catalogo senza riscrivere la pagina.

### Perche SQLite

SQLite e un database relazionale salvato in un file locale. Non richiede un servizio separato e risponde bene alle esigenze di un progetto personale con pochi utenti.

Il file predefinito e `data/pixel-print-lab.db`. Non entra in Git perche contiene dati locali modificabili. Codice, migrazioni e seed sono invece versionati e permettono di ricreare una base coerente.

Il progetto usa `better-sqlite3`, una libreria che espone query SQL dirette. Le operazioni sono sincrone: per il volume previsto rendono il codice lineare senza rappresentare un limite pratico.

### Tabelle Del Catalogo

`products` contiene:

- identificativo numerico e codice leggibile;
- `slug` univoco usato dall'interfaccia;
- nome, categoria e descrizione;
- prezzo espresso in centesimi;
- percorsi e testo alternativo dell'immagine;
- dimensione e materiale;
- futuro percorso del modello 3D;
- visibilita e ordine di presentazione;
- date di creazione e aggiornamento.

`colors` contiene nome, valore esadecimale, disponibilita e ordine.

`schema_migrations` registra quali modifiche strutturali sono state applicate. Gli indici su visibilita e ordinamento aiutano SQLite a trovare velocemente i record che devono essere mostrati.

### Vincoli Del Database

Lo schema protegge i dati anche se una futura operazione dimentica una validazione applicativa:

- `NOT NULL` impedisce valori obbligatori mancanti;
- `UNIQUE` impedisce codici, slug e nomi duplicati;
- `CHECK` impedisce prezzi negativi e valori booleani diversi da 0 o 1;
- il controllo su `hex_value` richiede un colore nel formato `#RRGGBB`;
- le chiavi primarie identificano un solo record.

Conservare il prezzo in centesimi evita gli errori di approssimazione dei numeri decimali. Per esempio, 12 euro vengono salvati come `1200`.

### Migrazioni

Una migrazione e una modifica numerata allo schema. All'apertura, `migrateDatabase` legge `schema_migrations` e applica soltanto le versioni mancanti all'interno di transazioni.

La transazione rende atomica ogni migrazione: o tutte le istruzioni vengono completate, oppure nessuna modifica parziale viene conservata.

In futuro non si modifichera una migrazione gia applicata. Si aggiungera una nuova versione, in modo che database creati in momenti diversi possano raggiungere lo stesso stato.

### Seed Idempotente

Il seed inserisce i due prodotti dimostrativi e quattro colori:

```powershell
npm.cmd run db:setup
```

`ON CONFLICT DO NOTHING` rende il comando idempotente: eseguirlo piu volte non duplica i record e non sovrascrive eventuali modifiche esistenti.

Il seed e esplicito e non viene eseguito a ogni avvio. In questo modo una futura eliminazione intenzionale dal pannello amministrativo non viene annullata al riavvio del server.

### API REST

Le API disponibili sono:

```text
GET /api/products       elenco dei prodotti visibili
GET /api/products/:id   singolo prodotto visibile
GET /api/colors         elenco dei colori attivi
```

Una risposta di elenco usa questa forma:

```json
{
  "data": [],
  "count": 0
}
```

Il server converte i nomi SQL come `price_cents` in proprieta JavaScript come `priceCents`. Questa funzione di serializzazione impedisce di esporre accidentalmente campi interni quali `visible` e `sort_order`.

Un identificativo non numerico restituisce HTTP `400`, mentre un prodotto inesistente restituisce `404`. Gli errori contengono un codice stabile e un messaggio italiano.

### Rendering Nel Browser

`public/app.js` usa `fetch("/api/products")`. Dopo aver verificato il codice HTTP, legge il JSON e clona `#product-template` per ogni record.

I valori vengono assegnati con `textContent` e proprieta DOM invece di costruire HTML da stringhe. Questa scelta riduce il rischio che dati non affidabili vengano interpretati come markup eseguibile.

`Intl.NumberFormat` trasforma i centesimi nel formato italiano in euro. Il contenitore usa `aria-busy` durante il caricamento e un elemento con `role="status"` comunica caricamento, catalogo vuoto o errore.

### Connessione E Chiusura

`server.js` apre una connessione all'avvio e la passa a `createApp`. L'applicazione non crea quindi connessioni nascoste ed e possibile sostituire il database reale con uno in memoria nei test.

Quando il processo riceve `SIGINT` o `SIGTERM`, prima chiude il server HTTP e poi il database. Questo evita di interrompere operazioni ancora in corso.

### Test Isolati

I test usano `:memory:`: SQLite crea un database temporaneo in memoria, applica la stessa migrazione e inserisce lo stesso seed. Alla fine il database scompare senza modificare i dati locali.

La suite verifica:

- endpoint di salute e risorse statiche;
- struttura della pagina e collegamento allo script;
- elenco e dettaglio prodotti;
- ordine e trasformazione dei campi;
- risposte `400` e `404`;
- elenco colori;
- idempotenza del seed.

### Collegamenti Con ServiceNow

- Una tabella SQLite corrisponde concettualmente a una tabella ServiceNow.
- Una riga e un record; una colonna e un campo.
- `id` identifica il record come un `sys_id`, pur usando un formato diverso.
- I vincoli ricordano Dictionary e Data Policies, anche se non sono equivalenti.
- Le query preparate separano istruzione e valori, concetto importante anche quando si costruiscono query con GlideRecord.
- La serializzazione controlla quali campi una API espone, come avviene in una Scripted REST API.
- I codici HTTP distinguono successo, input errato e record assente.
- `fetch` rappresenta il lato client che consuma una API, analogo a una chiamata asincrona da un'interfaccia ServiceNow.

## 14. Esito Della Fase 3

Catalogo e colori hanno ora una sorgente dati persistente. Il browser costruisce le schede usando l'API e il server valida gli identificativi richiesti. Le operazioni restano in sola lettura: creazione e modifica entreranno nel pannello amministrativo.

## 15. Fase 4 - Configurazione E Carrello

### Obiettivo

Ogni prodotto puo ora essere configurato scegliendo uno dei colori attivi e una quantita da 1 a 99. L'utente puo aggiungere la configurazione al carrello, modificarne la quantita, rimuoverla e vedere i totali.

Il carrello riguarda per ora i prodotti del catalogo. I modelli personali verranno integrati in una fase successiva.

### Separare Regole E Interfaccia

`public/cart.js` contiene funzioni pure: ricevono dati, restituiscono nuovi dati e non modificano HTML, database o memoria del browser.

Le operazioni principali sono:

- `addCartItem` aggiunge o unisce una configurazione;
- `updateCartQuantity` cambia una quantita;
- `removeCartItem` elimina una riga;
- `getCartItemCount` somma tutti i pezzi;
- `calculateCartTotal` calcola il totale corrente;
- `parseStoredCart` valida dati recuperati dal browser;
- `reconcileCart` elimina prodotti o colori non piu disponibili.

Separare queste regole rende i test semplici e impedisce che calcoli importanti dipendano dalla struttura grafica della pagina.

### Modello Dei Dati Del Carrello

Ogni elemento memorizza soltanto:

```json
{
  "key": "1:2",
  "productId": 1,
  "colorId": 2,
  "quantity": 3
}
```

La chiave combina prodotto e colore. Aggiungere due volte lo stesso prodotto nello stesso colore aggiorna la quantita; scegliere un colore diverso crea una riga distinta.

Nome e prezzo non vengono copiati nel carrello locale. Sono recuperati dalle API a ogni caricamento, evitando di mostrare a lungo un prezzo obsoleto. Quando verranno creati gli ordini, il server dovra comunque ricalcolare e validare tutto: i dati del browser non sono affidabili.

### Limite Della Quantita

HTML usa `min="1"` e `max="99"`, ma la stessa regola viene applicata anche nelle funzioni JavaScript. Il controllo grafico aiuta l'utente; la regola applicativa protegge il dato.

Se una configurazione viene aggiunta piu volte, la somma viene limitata a 99. Quantita decimali, negative, uguali a zero o superiori al massimo vengono rifiutate.

### Colori Globali

Il browser richiede prodotti e colori in parallelo con `Promise.all`. Per ogni prodotto crea un gruppo di radio button con lo stesso `name`: il browser garantisce che si possa selezionare un solo colore alla volta.

Il campione usa `hexValue` ricevuto dall'API. Il nome rimane sempre visibile, quindi la scelta non dipende soltanto dalla percezione del colore.

### Map Per Le Ricerche

Prodotti e colori vengono trasformati in `Map` indicizzate per ID:

```text
productId -> prodotto
colorId   -> colore
```

Quando viene renderizzata una riga del carrello non e necessario scorrere ogni volta l'intero catalogo. La chiave permette di recuperare direttamente il record desiderato.

### Totali In Centesimi

Il totale di riga e:

```text
priceCents * quantity
```

Il totale complessivo e la somma delle righe. Tutti i calcoli rimangono interi; la conversione in euro avviene soltanto per la visualizzazione con `Intl.NumberFormat`.

### Persistenza Locale

Il carrello viene salvato in `localStorage` con la chiave `pixel-print-lab:cart:v1`. Sopravvive alla ricarica e alla chiusura del browser sullo stesso dispositivo.

Non vengono salvati nome, cognome o altri dati personali. Il contenuto puo essere modificato manualmente dall'utente, quindi viene analizzato e validato prima dell'uso. JSON corrotto, forme errate e quantita non valide vengono ignorati.

Dopo aver ricevuto il catalogo, `reconcileCart` rimuove riferimenti a prodotti nascosti o colori disattivati.

### Dialog Del Carrello

Il riepilogo usa l'elemento HTML nativo `dialog`. `showModal()`:

- porta il focus dentro il carrello;
- impedisce di interagire accidentalmente con la pagina sottostante;
- consente la chiusura con `Esc`;
- comunica al browser la natura modale del contenuto.

Il pulsante nell'intestazione mostra il numero totale di pezzi e aggiorna anche la propria etichetta accessibile. Il dialog presenta righe modificabili, totale e stato vuoto. Non include ancora un pulsante di invio, perche la creazione delle richieste non e stata implementata.

### Rendering Dichiarativo Semplice

Ogni cambiamento del carrello richiama `renderCart`. La funzione svuota il riepilogo e lo ricostruisce a partire dallo stato corrente.

Per il numero ridotto di righe previsto, questa soluzione e piu leggibile di un aggiornamento parziale complesso. L'interfaccia e una conseguenza dello stato, principio utile anche nei framework moderni.

### Test

I test aggiunti verificano:

- unione di configurazioni uguali;
- separazione dei colori;
- limite massimo di 99;
- modifica e rimozione;
- conteggio dei pezzi e calcolo del totale;
- recupero sicuro da `localStorage`;
- rimozione dei riferimenti non piu disponibili;
- presenza della struttura accessibile del dialog.

### Collegamenti Con ServiceNow

- Lo stato del carrello ricorda una collezione di record temporanei lato client.
- Le funzioni pure separano Business Logic e presentazione.
- Gli ID collegano record come reference field, anche se qui la relazione vive nel browser.
- La doppia validazione richiama la distinzione tra Client Script e regole lato server.
- `localStorage` e esclusivamente client-side e non equivale a una tabella ServiceNow.
- Il rendering da stato mostra lo stesso principio con cui una UI aggiorna la vista dopo una modifica ai dati.

## 16. Esito Della Fase 4

Il catalogo e ora configurabile e il carrello funziona localmente. La pagina non crea ancora una richiesta persistente: prima verranno aggiunti visualizzatore 3D e gestione dei modelli personali.

## 17. Fase 5 - Visualizzatore 3D

### Obiettivo

I prodotti dimostrativi dispongono ora di un file STL apribile direttamente dalla scheda. Il visualizzatore mostra il modello su un piano di stampa e permette rotazione, zoom e ripristino della visuale.

Il colore del materiale 3D rimane arancione e non cambia con il colore scelto per l'ordine, come stabilito nei requisiti.

### File STL Dimostrativi

I file in `public/models` sono STL ASCII a basso numero di triangoli. Un file STL descrive la superficie di un oggetto come una sequenza di triangoli; non contiene normalmente colore, materiale o unita di misura affidabili.

I due esempi sono volutamente geometrici:

- `vaso-orbitale.stl` e un tronco di piramide;
- `supporto-controller.stl` e un supporto inclinato.

Questi asset servono a verificare il flusso. In futuro saranno sostituiti dai file caricati dal pannello amministrativo.

### Aggiornamento Dei Dati

La colonna `model_url` esisteva gia nella tabella `products`. La migrazione 2 assegna i file STL ai due record presenti nel database locale.

Il seed include gli stessi percorsi per le nuove installazioni. Sono necessari entrambi i meccanismi:

- la migrazione aggiorna database gia creati;
- il seed crea correttamente database nuovi.

L'API espone il percorso come `modelUrl`.

### Three.js

Three.js gestisce scena, camera, luci e rendering WebGL. Il progetto usa inoltre:

- `STLLoader` per trasformare un file STL in geometria;
- `OrbitControls` per rotazione e zoom tramite mouse o touch.

Express pubblica soltanto le directory necessarie del pacchetto attraverso `/vendor/three`. Una import map nell'HTML associa i nomi dei moduli ai relativi URL locali.

In questo modo il progetto continua a funzionare senza CDN e senza introdurre un bundler nella fase didattica corrente.

### Caricamento Lazy

`public/app.js` non importa subito il visualizzatore. Al primo clic su "Apri 3D" esegue:

```js
import("./viewer.js")
```

Soltanto in quel momento il browser scarica viewer, Three.js, controlli e loader. Il catalogo iniziale rimane quindi leggero per chi non usa l'anteprima.

La Promise del modulo viene conservata e riutilizzata. Aprire un secondo prodotto non scarica nuovamente la libreria.

### Preparazione Della Geometria

STL usa comunemente l'asse Z come verticale, mentre la scena usa Y. Dopo il caricamento la geometria viene:

1. ruotata di 90 gradi;
2. misurata con una bounding box;
3. centrata sugli assi orizzontali;
4. spostata affinche il punto piu basso tocchi il piano;
5. dotata di normali aggiornate per l'illuminazione.

Questo procedimento non dipende dalle dimensioni specifiche dei due esempi e verra riutilizzato per file futuri.

### Camera E Piano Di Stampa

La dimensione massima del modello determina:

- estensione della griglia;
- posizione iniziale della camera;
- distanza minima e massima dello zoom;
- piani di clipping vicino e lontano.

Il viewer puo quindi inquadrare oggetti di scale differenti senza usare coordinate fisse. Il pulsante "Ripristina visuale" copia nuovamente posizione e punto osservato calcolati all'apertura.

### Luci E Materiale

La scena usa una luce emisferica, una luce principale bianca e una luce secondaria blu. Il materiale arancione ha `flatShading`, che rende visibili le facce e mantiene il carattere geometrico dell'interfaccia.

Il renderer non usa antialiasing e il canvas applica `image-rendering: pixelated`, scelte coerenti con il linguaggio visivo del sito.

### Ciclo Di Rendering

WebGL deve ridisegnare la scena mentre i controlli si muovono. `setAnimationLoop` viene avviato quando il dialog si apre e fermato alla chiusura.

Non lasciare il loop attivo in background riduce il lavoro di CPU e GPU. `ResizeObserver` aggiorna dimensioni del renderer e rapporto della camera quando cambia lo spazio disponibile.

Quando viene sostituito un modello, geometria e materiale precedenti vengono rimossi e liberati con `dispose`.

### Stati Ed Errori

Durante il caricamento il viewer mostra un messaggio e una barra animata a strati. Il reset resta disabilitato finche la geometria non e pronta.

Se manca `modelUrl` oppure la richiesta STL fallisce, il dialog mostra un errore leggibile senza interrompere il resto della pagina. Un contatore interno impedisce che un caricamento precedente sovrascriva un modello aperto successivamente.

### Accessibilita E Responsive

Il viewer usa un secondo `dialog` nativo con titolo associato. L'area WebGL ha un'etichetta che include il nome del prodotto, mentre caricamento ed errore sono annunciati tramite `role="status"`.

I controlli testuali spiegano trascinamento e zoom. Su schermi stretti il dialog usa quasi tutta la viewport, riduce gli spazi e porta il pulsante di reset su una riga separata.

### Verifiche

La fase verifica automaticamente e in browser reale che:

- import map, viewer, STL e moduli Three.js siano serviti;
- l'API restituisca `modelUrl`;
- la seconda migrazione venga registrata;
- Three.js non venga scaricato prima del clic;
- entrambi i modelli aprano un canvas WebGL;
- caricamento termini senza stato di errore;
- reset e sostituzione del modello siano disponibili;
- il dialog sia leggibile su desktop e mobile.

## 18. Esito Della Fase 5

Il catalogo offre ora anteprime 3D interattive caricate su richiesta. Lo stesso viewer e pronto per mostrare i file STL personali che verranno introdotti nella fase successiva.
