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
- Conferma con codice univoco e tracciamento pubblico dello stato.
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

## 19. Fase 6 - Modelli Personali

### Due Flussi Distinti

La sezione fuori catalogo permette di scegliere tra:

- caricamento di un file STL;
- collegamento a una pagina esterna autorizzata.

Le modalita sono alternative. Il form rende obbligatorio soltanto il campo attivo e condivide colore e quantita. I modelli personali entrano nel carrello con la dicitura "Prezzo da definire" e non modificano il totale del catalogo.

### Anteprima Locale Prima Dell'Upload

Quando viene selezionato un file, il pulsante "Visualizza STL" crea un URL temporaneo del browser con `URL.createObjectURL`. Il viewer della fase 5 carica direttamente quel riferimento.

L'anteprima avviene prima dell'upload e non invia ancora il file al server. Al termine del caricamento 3D, `URL.revokeObjectURL` libera il riferimento locale.

Il controllo client verifica estensione e dimensione per fornire un errore immediato, ma non viene considerato una misura di sicurezza sufficiente.

### Upload Multipart

Il file viene inviato a:

```text
POST /api/custom-models/upload
```

La richiesta usa `multipart/form-data`, formato adatto a trasferire file binari. Multer 2.2 gestisce il flusso e impone:

- un solo file;
- nessun campo testuale aggiuntivo;
- massimo due parti multipart;
- dimensione massima di 50 MB.

La versione minima 2.2 e importante: versioni precedenti presentano vulnerabilita note nella gestione di richieste incomplete e campi profondamente annidati.

### Validazione Del File

Il server non si fida di nome o MIME comunicati dal browser. Verifica:

1. estensione `.stl` senza distinzione tra maiuscole e minuscole;
2. dimensione maggiore di zero e non superiore al limite;
3. struttura compatibile con STL ASCII oppure STL binario.

Per un STL binario, i byte da 80 a 83 indicano il numero di triangoli. La dimensione attesa e:

```text
84 + numeroTriangoli * 50
```

Per un STL ASCII, il campione iniziale deve contenere `solid`, `facet` e `vertex`.

Questa validazione riconosce il contenitore STL, ma non garantisce che il modello sia stampabile. Controlli geometrici come manifold, pareti o volume richiederebbero strumenti specifici e non fanno parte di questa fase.

### Nome Casuale E Cartella Privata

Il nome originale non viene usato come nome sul disco. Il server genera un UUID e salva:

```text
storage/uploads/<uuid>.stl
```

Questo evita collisioni e impedisce che parti del nome inviato controllino il percorso. Il nome originale, ridotto a 120 caratteri e privato di eventuali directory, viene restituito soltanto come etichetta del carrello.

Gli upload non entrano in Git. Express li pubblica attraverso `/uploads` con:

- `Content-Type: model/stl`;
- `X-Content-Type-Options: nosniff`;
- cache privata disabilitata.

Il server tratta il file come dato e non lo esegue.

### Durata E Pulizia

Un upload temporaneo scade dopo 24 ore. La pulizia viene eseguita all'avvio e dopo un caricamento riuscito. Sono eliminati soltanto file `.stl` piu vecchi della durata configurata.

Quando un file viene rimosso dal carrello, il browser invia:

```text
DELETE /api/custom-models/:id
```

Al caricamento della pagina, una richiesta `HEAD` controlla che ogni upload salvato nel carrello esista ancora. I riferimenti scaduti vengono rimossi.

Nella futura creazione dell'ordine, i file confermati dovranno essere spostati fuori dall'area temporanea e mantenuti fino all'eliminazione dell'ordine.

### Link Autorizzati

I link vengono inviati a:

```text
POST /api/custom-models/link
```

Il server accetta esclusivamente HTTPS, senza credenziali nell'URL, e confronta l'hostname con:

- `printables.com`;
- `thingiverse.com`;
- `makerworld.com`;
- `cults3d.com`.

Sono consentiti i relativi sottodomini. Un dominio ingannevole come `printables.com.example.org` viene rifiutato, perche non e uguale al dominio consentito e non ne e un sottodominio.

Il link non viene scaricato o incorporato nel viewer. Nel carrello si apre in una nuova pagina con `noopener` e `noreferrer`.

### Modello Del Carrello Esteso

Gli elementi del catalogo hanno `type: "catalog"`. I modelli personali hanno `type: "custom"` e `sourceType` uguale a `file` o `link`.

Un elemento file conserva:

- UUID temporaneo;
- nome originale;
- URL interno del modello;
- scadenza;
- colore e quantita.

Un elemento link conserva:

- UUID del riferimento;
- nome e sito sorgente;
- URL esterno validato;
- colore e quantita.

Il parser del carrello continua ad accettare gli elementi creati nella fase 4, privi del campo `type`, e li normalizza come prodotti di catalogo. Questa compatibilita e necessaria perche il dato e gia persistito in `localStorage`.

### Prezzi E Sicurezza

`calculateCartTotal` ignora gli elementi `custom`. Il riepilogo distingue quindi il totale dei soli prodotti a prezzo noto dalle righe che richiedono una valutazione privata.

Anche i dati del carrello personalizzato possono essere manipolati nel browser. Il parser ricontrolla forma, UUID, URL interno, link HTTPS, dominio, colore e quantita. La futura API degli ordini dovra ripetere tutte le validazioni.

### Gestione Degli Errori

Le API restituiscono codici e messaggi distinti:

- `400` per estensione, contenuto, link o richiesta non validi;
- `404` per un upload gia rimosso o scaduto;
- `413` per un file superiore a 50 MB;
- `500` per un errore interno inatteso.

Se un upload riesce ma l'aggiunta al carrello fallisce, il browser prova a cancellare immediatamente il file appena creato.

### Verifiche

I test automatici e il collaudo browser coprono:

- STL ASCII e binario;
- estensione e contenuto non validi;
- limite reale di 50 MB;
- servizio e cancellazione del file;
- pulizia di un temporaneo scaduto;
- domini consentiti, domini ingannevoli e protocollo HTTP;
- anteprima locale nel viewer;
- aggiunta di file e link al carrello;
- prezzo escluso dal totale;
- apertura 3D e apertura link;
- cancellazione del file alla rimozione;
- compatibilita con il carrello della fase precedente;
- layout desktop e mobile.

## 20. Esito Della Fase 6

La pagina raccoglie ora prodotti del catalogo, STL personali e link esterni nello stesso carrello. I modelli personali non hanno prezzo e i file rimangono temporanei; la fase successiva trasformera il riepilogo in una richiesta persistente identificata da un codice.

## 21. Fase 7 - Invio Delle Richieste

### Dal Carrello Alla Richiesta

Il carrello rimane uno stato locale modificabile. Una richiesta, invece, e un record persistente che deve continuare a rappresentare cio che e stato inviato anche dopo modifiche a prodotti, prezzi o colori.

Il flusso finale e:

1. apertura del carrello;
2. controllo di pezzi, richieste da valutare e totale catalogo;
3. inserimento di nome e cognome;
4. nuova validazione sul server;
5. salvataggio nel database;
6. spostamento logico degli STL nell'area permanente;
7. eventuale invio della notifica SMTP se attivata;
8. risposta con il solo codice di conferma;
9. svuotamento del carrello locale.

### Tabelle Degli Ordini

La migrazione 3 crea `orders` e `order_items`.

`orders` contiene:

- codice univoco;
- nome e cognome;
- totale dei soli prodotti di catalogo;
- data di creazione.

In questa fase iniziale non esisteva ancora uno stato dell'ordine. Il tracciamento viene aggiunto successivamente senza modificare gli snapshot creati qui.

`order_items` contiene una riga per ogni configurazione e distingue:

- `catalog`;
- `custom_file`;
- `custom_link`.

La relazione con `orders` usa una foreign key con cancellazione a cascata. Ogni riga possiede inoltre una posizione stabile nel riepilogo.

### Snapshot Storici

Gli elementi non dipendono dai dati futuri del catalogo. Al momento dell'invio vengono copiati:

- codice e nome del prodotto;
- prezzo unitario in centesimi;
- nome e valore esadecimale del colore;
- quantita;
- nome del file oppure sito e URL esterno.

Gli ID correnti vengono conservati come riferimento, ma non sono foreign key verso prodotti o colori. Eliminare un prodotto dal catalogo non rende invalido lo storico.

### Payload Minimo Del Browser

Il browser non invia prezzi, nomi dei prodotti o colori testuali come valori affidabili. Per un prodotto invia soltanto:

```json
{
  "type": "catalog",
  "productId": 1,
  "colorId": 1,
  "quantity": 2
}
```

Per file e link invia i riferimenti necessari. Il server usa nuovamente database e filesystem per costruire gli snapshot.

Anche se un utente aggiunge manualmente `priceCents: 1` al payload, quel valore viene ignorato. Il prezzo viene letto dalla tabella `products`.

### Rivalidazione Completa

`POST /api/orders` controlla:

- nome e cognome da 1 a 60 caratteri, senza caratteri di controllo;
- presenza di 1-100 righe;
- quantita intera da 1 a 99;
- prodotto ancora visibile;
- colore ancora attivo;
- assenza di configurazioni duplicate;
- UUID e presenza di ogni STL;
- scadenza e contenuto del file;
- HTTPS e allowlist per ogni link.

Questi controlli non riutilizzano come verita i dati gia validati dal browser. Tra aggiunta al carrello e invio, un prodotto potrebbe essere stato nascosto o un file potrebbe essere scaduto.

### Persistenza Degli STL

Gli upload temporanei vivono in `storage/uploads`. Prima del salvataggio dell'ordine, ciascun file unico viene copiato in `storage/orders` con un nome composto da codice richiesta e UUID.

La sequenza protegge i dati:

1. validazione di tutti gli elementi;
2. copia dei file permanenti con divieto di sovrascrittura;
3. transazione SQLite per ordine e righe;
4. eliminazione dei temporanei solo dopo il commit.

Se una copia o la transazione fallisce, le copie gia create vengono eliminate. Se uno stesso STL e usato in piu configurazioni colore, viene copiato una sola volta e condiviso dagli snapshot.

Filesystem e SQLite non possono partecipare alla stessa transazione atomica. La strategia di copia e compensazione riduce il rischio senza cancellare il temporaneo prima che il database abbia confermato il salvataggio.

### Codice Univoco

Il codice usa il formato:

```text
PPL-AAAAMMGG-XXXXXX
```

La prima parte contiene la data UTC e il suffisso contiene tre byte casuali rappresentati in esadecimale. Prima dell'uso viene verificata l'assenza nel database; la colonna `UNIQUE` rimane la protezione definitiva contro collisioni.

La risposta pubblica e intenzionalmente minima:

```json
{
  "data": {
    "code": "PPL-20260716-ABC123"
  }
}
```

### Notifica Email

Il riepilogo testuale contiene codice, nome, cognome, righe, colori, quantita, prezzi noti, file, link e totale catalogo. L'invio reale tramite SMTP viene aggiunto successivamente ed e disattivato per impostazione predefinita.

### Riepilogo Finale

Il pulsante "Invia richiesta" e disabilitato quando il carrello e vuoto. Il dialog finale mostra:

- pezzi complessivi;
- pezzi che richiedono valutazione;
- totale dei prodotti a prezzo noto;
- nome e cognome come unici dati richiesti.

Il submit viene disabilitato durante la chiamata per evitare doppi clic. In caso di errore il carrello rimane disponibile per una correzione.

### Conferma

Dopo HTTP `201` il browser:

- elimina il carrello da `localStorage`;
- aggiorna il contatore a zero;
- nasconde il form;
- mostra conferma e codice univoco.

Il dialog non mostra nuovamente dati personali o dettagli dell'ordine. Poiche non esiste un account cliente, il codice deve essere annotato prima di chiudere.

### Dati Personali

Nome e cognome sono dati personali e vengono conservati nel database locale fino all'eliminazione manuale della richiesta. Database e file degli ordini non devono essere inseriti nel repository. Se l'email automatica e attiva, gli stessi dettagli vengono trasmessi anche al server SMTP configurato.

Prima di una pubblicazione reale saranno necessari controllo degli accessi, backup, HTTPS e informativa sul trattamento dei dati.

### Verifiche

La fase verifica:

- terza migrazione e vincoli delle tabelle;
- ordine misto con prodotto, STL e link;
- normalizzazione di nome e cognome;
- prezzo riletto dal database e snapshot storico;
- codice nel formato previsto;
- file permanente e rimozione del temporaneo;
- contenuto completo del riepilogo email;
- rifiuto di nome, quantita, link e upload manipolati;
- assenza di record dopo richieste non valide;
- riepilogo e conferma nel browser;
- svuotamento del carrello;
- resa desktop e mobile.

## 22. Esito Della Fase 7

Il percorso pubblico e ora completo fino alla registrazione della richiesta. Ordini, snapshot e file sono persistenti; la fase successiva introduce accesso amministrativo e gestione delle richieste.

## 23. Fase 8 - Accesso Amministrativo E Ordini

### Area Separata

Il pannello e disponibile su:

```text
http://localhost:3000/admin.html
```

HTML, CSS e JavaScript della pagina sono risorse statiche e possono essere scaricati da chi conosce l'indirizzo. Nessun dato amministrativo e pero incluso nella pagina: elenco, dettagli, file e operazioni sono esposti soltanto da API protette.

Nascondere l'URL non sarebbe una misura di sicurezza. La protezione effettiva si trova sul server.

### Configurazione Delle Credenziali

Il nome utente e la password vengono letti da `ADMIN_USERNAME` e `ADMIN_PASSWORD`. Per lo sviluppo locale si crea un file `.env` non versionato:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=una-password-personale-lunga
```

Se una variabile manca, il login restituisce HTTP `503` con un messaggio di configurazione. Non esistono credenziali predefinite o scritte nel codice.

`.env` e escluso da Git. `.env.example` documenta soltanto i nomi delle variabili e contiene segnaposto.

### Verifica Delle Credenziali

Il server calcola SHA-256 per i valori ricevuti e quelli configurati, ottenendo buffer della stessa lunghezza. I confronti usano `crypto.timingSafeEqual` e un errore generico non rivela quale credenziale sia errata.

Questo non trasforma la variabile d'ambiente in un archivio password: la password e gia fornita come segreto al processo. Il confronto a tempo costante riduce informazioni ricavabili dalla durata della verifica.

### Limitazione Dei Tentativi

Ogni indirizzo IP puo fallire al massimo cinque accessi in una finestra di 15 minuti. Ulteriori tentativi ricevono HTTP `429`. Un login riuscito azzera il contatore.

Il limite vive in memoria ed e adatto al progetto locale. In un'applicazione distribuita dovrebbe essere condiviso tra processi e considerare correttamente proxy e bilanciatori.

### Sessione

Dopo il login il server genera 32 byte casuali e li invia in un cookie:

- `HttpOnly`, quindi JavaScript non puo leggerlo;
- `SameSite=Strict`, per limitarne l'invio da altri siti;
- `Path=/`, per autorizzare tutte le API amministrative;
- durata massima di otto ore;
- `Secure` quando la richiesta avviene tramite HTTPS.

Le sessioni sono conservate in memoria e scadono anche lato server. Il riavvio del processo le elimina, richiedendo un nuovo login. Il logout invalida il token e cancella il cookie.

### Middleware Di Autorizzazione

Ogni route sotto `/api/admin` che espone dati usa `requireAdmin`. Il middleware:

1. elimina sessioni scadute;
2. legge il cookie;
3. verifica il token;
4. rinnova la scadenza server;
5. imposta `Cache-Control: no-store`;
6. restituisce `401` se l'accesso non e valido.

Scaricare direttamente un STL permanente senza cookie produce quindi `401` come qualsiasi altra API protetta.

### API Amministrative

Le operazioni disponibili sono:

```text
POST   /api/admin/login
POST   /api/admin/logout
GET    /api/admin/session
GET    /api/admin/orders
GET    /api/admin/orders/:id
PATCH  /api/admin/orders/:id/status
DELETE /api/admin/orders/:id
GET    /api/admin/orders/:orderId/items/:itemId/model
```

Nomi, righe e file permanenti non hanno API pubbliche. L'endpoint di tracking aggiunto successivamente espone soltanto codice completo e stato.

### Elenco E Dettaglio

L'elenco mostra codice, cliente, data, numero di righe e pezzi. Una query aggregata usa `COUNT` e `SUM`, mantenendo una sola riga per ordine.

Il dettaglio restituisce snapshot completi. L'interfaccia presenta archivio a sinistra e dettaglio a destra su desktop; su schermi stretti le sezioni diventano verticali.

### Dettaglio In Sola Lettura

Il pannello permette di consultare:

- nome e cognome del cliente;
- prodotti, colori e quantita delle righe di catalogo;
- file e link delle righe personali;
- snapshot dei prezzi e totale del catalogo.

Questi dati non sono modificabili dal pannello e non esiste un endpoint di aggiornamento completo. In questo modo la richiesta resta una fotografia fedele di cio che il cliente ha inviato.

L'amministratore puo cambiare soltanto lo stato pubblico tramite l'endpoint dedicato oppure eliminare definitivamente l'ordine. Il download dei modelli resta protetto dalla sessione.

### Snapshot Immutabili

Gli snapshot dell'ordine sono separati dal catalogo corrente. Le successive modifiche a prodotti, prezzi e colori non riscrivono:

- nome e cognome;
- righe e relativi snapshot;
- totale noto;
- file originali associati.

### Rimozione Dei File

Eliminando un intero ordine:

- la foreign key cancella le righe;
- vengono eliminati gli STL permanenti associati;
- l'ordine scompare dall'archivio.

La cancellazione non usa un cestino ed e definitiva. L'interfaccia richiede una conferma esplicita.

### Interfaccia Control Room

Il pannello conserva bordi netti, ombre a blocchi e tipografia monospaziata, ma usa un archivio scuro e un'area editor chiara per distinguere navigazione e lavoro.

La pagina gestisce:

- ripristino automatico di una sessione valida;
- ritorno al login dopo `401`;
- selezione della prima richiesta;
- feedback di aggiornamento stato ed errore;
- stato vuoto;
- layout a una colonna sotto i 900 px.

### Limiti Attuali

- Le sessioni non sopravvivono al riavvio.
- Esiste un solo amministratore configurato tramite variabili d'ambiente.
- Non esiste recupero password.
- Gli ordini eliminati non sono recuperabili senza backup.
- Prima della pubblicazione saranno necessari HTTPS e configurazione corretta del proxy.

### Verifiche

La fase verifica:

- rifiuto delle API senza sessione;
- nome utente o password errati e login corretto;
- attributi `HttpOnly` e `SameSite=Strict`;
- controllo della sessione;
- elenco e dettaglio;
- protezione del download STL;
- immutabilita di cliente, prodotti, colori, quantita e totale;
- rifiuto dell'endpoint di modifica completa rimosso;
- aggiornamento separato del solo stato pubblico;
- eliminazione di ordine, file ed email;
- invalidazione al logout;
- flusso reale desktop e mobile.

## 24. Esito Della Fase 8

Le richieste possono ora essere consultate da un pannello protetto, con stato modificabile e cancellazione definitiva. La fase successiva estende la stessa area amministrativa a prodotti, immagini, STL di catalogo e colori globali.

## 25. Fase 9 - Gestione Catalogo E Colori

### Navigazione Amministrativa

La Control Room contiene due viste, Ordini e Catalogo, accessibili dalla stessa sessione. Il cambio sezione avviene nel browser senza duplicare autenticazione o pagina.

La vista Catalogo usa API protette e mostra anche prodotti nascosti e colori inattivi, che le API pubbliche continuano invece a filtrare.

### Prodotti

L'amministratore puo creare, modificare, nascondere ed eliminare un prodotto. Ogni scheda gestisce:

- codice e slug univoci;
- nome, categoria e descrizione;
- prezzo in centesimi;
- dimensione e materiale;
- posizione nel catalogo e visibilita;
- immagine obbligatoria e STL facoltativo.

Gli aggiornamenti impostano anche `updated_at`. Un prodotto nascosto resta disponibile nel pannello ma scompare dal catalogo pubblico e viene rimosso dai carrelli quando vengono riconciliati.

### Asset Gestiti

Gli upload amministrativi vengono salvati nella directory configurata da `CATALOG_DIRECTORY`, normalmente `storage/catalog`, e pubblicati sotto `/catalog-assets` con nomi UUID.

Le immagini ammesse sono PNG, JPG e WebP fino a 5 MB. Il server confronta il formato dichiarato e decodifica realmente il file con `sharp`, limitando anche il numero di pixel ed evitando SVG attivi. Gli STL riutilizzano la validazione ASCII/binaria e il limite di 50 MB dei modelli personali.

La sostituzione elimina il vecchio file gestito soltanto dopo l'aggiornamento del database. La cancellazione non tocca mai gli asset dimostrativi presenti in `public/images` e `public/models`.

### Colori Globali

I colori possono essere creati, rinominati, modificati, ordinati e disattivati. Il riordino riceve l'elenco completo degli ID, lo valida e assegna posizioni normalizzate in una transazione.

Solo i colori attivi vengono restituiti da `/api/colors` e possono essere selezionati per nuove righe d'ordine.

### Snapshot Storici

Modificare o eliminare catalogo e colori non aggiorna `order_items`. Se una riga amministrativa mantiene gli stessi ID, il server conserva nome, codice, prezzo e colore dello snapshot originale anche quando la voce corrente e nascosta, inattiva o eliminata.

L'interfaccia distingue queste opzioni con la dicitura `(ordine)`. Per nuove selezioni accetta soltanto prodotti visibili e colori attivi.

La migrazione 4 ricrea `products` e `colors` con `AUTOINCREMENT`: un ID eliminato non puo quindi essere assegnato in seguito a una voce diversa.

### API Amministrative Del Catalogo

```text
GET    /api/admin/catalog
POST   /api/admin/products
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
POST   /api/admin/colors
PUT    /api/admin/colors/:id
PUT    /api/admin/colors/order
```

Creazione e modifica dei prodotti usano `multipart/form-data`; colori e ordinamento usano JSON.

### Verifiche

I test coprono autorizzazione, CRUD dei prodotti, servizio e rimozione degli asset, filtri pubblici, colori, ordinamento, conservazione degli snapshot e mancato riutilizzo degli ID. Il pannello mantiene due colonne su desktop e dispone sidebar, editor e form in verticale sugli schermi stretti.

## 26. Esito Della Fase 9

Catalogo, file e palette globale sono ora gestibili dalla Control Room. Gli ordini storici restano indipendenti dalle modifiche successive e lo storage distingue asset dimostrativi, upload temporanei, file degli ordini e file amministrativi del catalogo.

La vista aggiornata dei componenti e dei flussi e mantenuta in [`ARCHITETTURA.md`](ARCHITETTURA.md). Ogni fase che modifica la struttura dell'applicazione deve aggiornare anche quel documento.

## 27. Supporto Ai File 3MF

### Ambito

I modelli personali accettano ora file `.stl` e `.3mf`. I modelli del catalogo amministrativo restano STL: questa separazione mantiene invariato il flusso degli asset di prodotto.

I progetti `.gcode.3mf` e gli archivi che contengono `Metadata/plate_N.gcode` vengono rifiutati. Il sito non interpreta ne esegue G-code.

### Ispezione Prima Dell'Anteprima

Un STL puo ancora essere mostrato localmente. Un 3MF viene invece caricato e controllato dal server prima di raggiungere `3MFLoader`, perche il formato e un archivio ZIP e puo espandersi molto oltre la dimensione compressa.

Il modulo `src/model-files.js` verifica:

- dimensione compressa massima di 50 MB;
- massimo 256 parti e 30 MB complessivi dopo l'espansione;
- massimo 25 MB per parte e rapporto di compressione 250:1;
- percorsi relativi, univoci e senza attraversamento di directory;
- assenza di cifratura e metodi ZIP non supportati;
- relazione OPC verso un solo modello principale;
- XML UTF-8 senza DTD o entita;
- massimo 200.000 vertici, 400.000 triangoli, 100.000 componenti e 10.000 elementi di build;
- riferimenti, triangoli, trasformazioni e grafi di componenti;
- massimo 100 piatti e 10.000 istanze Bambu.

I 3MF possono contenere piu parti `.model` anche quando mostrano un solo pezzo. Tutte le parti vengono ispezionate con limiti globali; ID oggetto duplicati o unita discordanti vengono rifiutati perche produrrebbero riferimenti ambigui nel viewer.

### Primo Piatto

Un 3MF generico non definisce piatti separati: la sua build viene trattata come primo piatto. Nei progetti Bambu Studio vengono letti `Metadata/model_settings.config`, `plater_id`, `object_id` e `instance_id`.

La selezione usa le istanze esatte, quindi lo stesso oggetto puo comparire su piatti differenti senza essere mostrato due volte. Il viewer rimuove gli altri elementi della build e presenta soltanto il primo piatto.

### Piatto Standard

Non vengono riconosciute o confrontate stampanti specifiche. Il primo piatto viene confrontato soltanto con un volume informativo standard:

```text
256 x 256 x 256 mm
```

Il controllo considera unita, trasformazioni, componenti e posizione. Un modello fuori volume viene comunque accettato: l'avviso serve soltanto a indicare che potrebbe essere necessario correggerlo prima della stampa.

### Viewer 3MF

`public/viewer.js` seleziona `STLLoader` o `ThreeMFLoader` in base al formato. Per il 3MF:

1. carica soltanto un archivio gia approvato dal server;
2. conserva gli elementi indicati da `previewBuildItemIndexes`;
3. converte l'unita del progetto in millimetri;
4. centra il gruppo sul piano;
5. conserva materiali supportati da Three.js;
6. libera geometrie, materiali e texture alla chiusura.

L'anteprima e uno strumento visivo, non una garanzia di stampabilita. Estensioni 3MF non supportate da Three.js possono apparire in modo semplificato.

### Persistenza E Amministrazione

La migrazione 5 aggiunge a `order_items`:

```text
model_format
model_metadata_json
```

Gli ordini precedenti vengono marcati come STL. Per i nuovi 3MF il server ripete l'ispezione durante l'invio, conserva un riepilogo normalizzato nel database e copia il file originale senza modificarne i byte.

Il pannello amministrativo mostra il formato e fornisce un download protetto con MIME e nome originali. Modificare una richiesta conserva formato e metadati del modello.

### Verifiche

I test coprono 3MF generici, Bambu multi-piatto, riuso dello stesso oggetto tra piatti, volume standard, limiti non arrotondati, grafi ciclici, XML errato, G-code, ordine persistente, download amministrativo e carrelli STL precedenti.

## 28. Esito Del Supporto 3MF

Il flusso dei modelli personali gestisce STL e 3MF dall'upload al download amministrativo. I file originali vengono conservati, il primo piatto e visualizzato dopo un'ispezione limitata e il confronto dimensionale resta volutamente indipendente dalla stampante usata.

## 29. Tracciamento Pubblico Delle Richieste

### Stato Persistente

La migrazione 6 aggiunge a `orders` il campo `status`, con valore iniziale `in_attesa` e vincolo SQLite limitato a:

```text
in_attesa
in_lavorazione
completato
```

Anche gli ordini esistenti ricevono `in_attesa`. Il database rifiuta valori mancanti o non previsti.

### API Pubblica Minima

`GET /api/orders` restituisce tutte le richieste ancora presenti, dalla piu recente alla piu vecchia, usando una selezione esplicita:

```json
{
  "data": [
    { "code": "PPL-20260717-ABC123", "status": "in_lavorazione" }
  ]
}
```

Non vengono esposti ID interni, nomi, date, totali, quantita, colori, modelli o file. Il codice completo e intenzionalmente pubblico e non deve essere considerato una password o un token di autenticazione.

Le richieste completate restano nell'elenco. La cancellazione amministrativa elimina la riga dal database e quindi anche dal tracking pubblico.

### Aggiornamento Amministrativo

Il pannello usa un endpoint dedicato:

```text
PATCH /api/admin/orders/:id/status
```

Rendere il dettaglio in sola lettura e separare lo stato evita di riscrivere elementi, snapshot o file. L'endpoint richiede la sessione admin, valida esattamente l'ID e accetta soltanto i tre valori previsti.

### Interfaccia Pubblica

La pagina mostra sotto il catalogo una sezione con codice completo e descrizione testuale dello stato. `in_lavorazione` aggiunge una piccola stampante a blocchi decorativa; il testo resta sufficiente anche senza colore o animazione.

La hero contiene un pulsante diretto a `#stato-richieste`. Su desktop l'elenco usa piu colonne; sotto 860 px passa a una colonna mantenendo il tracking dopo i prodotti.

`prefers-reduced-motion` disattiva le animazioni non essenziali. Un live region separato annuncia gli aggiornamenti senza rendere parlante l'intero elenco.

### Aggiornamento Periodico

Il browser aggiorna il tracking dopo l'invio di una richiesta, ogni 45 secondi mentre la scheda e visibile e quando la pagina torna in primo piano. Un contatore scarta risposte obsolete e impedisce che richieste sovrapposte ripristinino stati precedenti.

L'elenco viene ricostruito soltanto quando la firma dei dati cambia. Un errore del tracking non blocca catalogo, carrello o invio.

### Limiti

Il requisito mantiene tutte le richieste visibili fino alla cancellazione. Di conseguenza l'elenco puo crescere nel tempo e rende pubblici volume e avanzamento delle richieste. Per un uso piu ampio saranno utili paginazione, alias pubblici o un sistema di ricerca individuale.

## 30. Esito Del Tracciamento

Ogni richiesta dispone ora di uno stato controllato dal pannello e visibile nella pagina principale. La serializzazione pubblica resta separata dai dati amministrativi e il codice completo e trattato esplicitamente come identificatore pubblico.

## 31. Notifiche SMTP Opzionali

La migrazione 7 crea la riga unica `app_settings`, con `email_notifications_enabled` inizialmente disattivato. Il valore viene letto alla creazione di ogni ordine, quindi non serve riavviare il server dopo una modifica.

La rotella nella testata amministrativa apre un dialog nativo. Le API protette sono:

```text
GET /api/admin/settings
PUT /api/admin/settings
```

Il browser riceve soltanto stato di configurazione, destinatario e valore del toggle. Host, utente e password SMTP restano nelle variabili d'ambiente. L'attivazione viene rifiutata finche `SMTP_HOST`, `SMTP_FROM` e `SMTP_TO` non sono validi; utente e password devono essere forniti insieme.

Quando l'opzione e attiva, il server invia dopo il commit un messaggio testuale con oggetto `Nuova richiesta <codice>`. SMTP non puo partecipare alla transazione SQLite: un errore viene registrato senza cancellare l'ordine o i file gia salvati.
