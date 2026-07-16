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
