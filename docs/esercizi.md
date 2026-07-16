# Esercizi

Gli esercizi non sono necessari per far funzionare il progetto. Servono a consolidare i concetti senza modificare il percorso principale. Prima di cambiare i file, osserva il comportamento corrente e prova a prevedere il risultato.

## Fase 1 - Fondamenta

### 1. Esplora La Struttura

Individua quali file vengono eseguiti dal browser e quali da Node.js. Scrivi una breve spiegazione delle differenze tra `public/index.html`, `src/app.js` e `src/server.js`.

Concetto ServiceNow: distinzione tra logica client e logica server.

### 2. Interroga Lo Stato

Apri `http://localhost:3000/api/health` nel browser e osserva il JSON restituito. Usa gli strumenti per sviluppatori del browser per trovare codice HTTP e header della risposta.

Concetto ServiceNow: risposta di una API REST.

### 3. Aggiungi Un Dato Alla Risposta

Come esperimento, aggiungi temporaneamente una proprieta `application` alla risposta di `/api/health`. Aggiorna il test affinche descriva la nuova risposta e verifica che passi.

Obiettivo: comprendere il rapporto tra requisito, implementazione e test.

### 4. Prova Una Variabile D'ambiente

Avvia il server su una porta diversa:

```powershell
$env:PORT=3100
npm.cmd start
```

Al termine puoi rimuovere la variabile dalla sessione:

```powershell
Remove-Item Env:PORT
```

Concetto ServiceNow: separare configurazione e codice.

### 5. Osserva Git

Dopo l'inizializzazione, usa:

```powershell
git status
git log --oneline
```

Individua quali file sono versionati e verifica che `node_modules` non compaia nell'elenco.

## Autovalutazione

Al termine dovresti saper rispondere:

1. Quale responsabilita ha Express?
2. Perche il browser non deve accedere direttamente al database?
3. A cosa serve `.gitignore`?
4. Qual e la differenza tra `npm.cmd run dev` e `npm.cmd start`?
5. Perche un test avvia il server su una porta casuale?

## Fase 2 - Catalogo Statico

### 1. Leggi La Gerarchia HTML

Apri `public/index.html` e scrivi l'albero dei titoli nell'ordine in cui compaiono. Verifica che non si passi da `h1` direttamente a `h3` senza un `h2` di sezione.

Obiettivo: distinguere struttura semantica e dimensione grafica.

### 2. Prova Lo Skip Link

Ricarica la pagina e premi il tasto `Tab` senza usare il mouse. Il collegamento "Vai al contenuto" deve apparire. Premendo `Invio`, il focus logico deve raggiungere il contenuto principale.

Concetto ServiceNow: progettare interfacce utilizzabili anche tramite tastiera.

### 3. Modifica Una Variabile CSS

In `public/styles.css`, cambia temporaneamente il valore di `--orange`. Osserva quanti elementi vengono aggiornati senza modificare le singole regole, poi ripristina il valore originale.

Obiettivo: comprendere variabili, ereditarieta e riutilizzo.

### 4. Simula Uno Schermo Mobile

Apri gli strumenti per sviluppatori del browser e imposta una larghezza di `375px`. Verifica intestazione, titoli, schede prodotto e footer. Ripeti a `768px` e `1440px`.

Annota quali media query sono attive in ogni caso.

### 5. Crea Un Terzo Prodotto Temporaneo

Duplica una scheda `article`, cambia `data-product`, nome, prezzo e descrizione. Esegui i test e osserva perche uno fallisce. Aggiorna temporaneamente l'aspettativa da due a tre prodotti, poi annulla l'esperimento.

Obiettivo: vedere come un test renda esplicito un requisito.

### 6. Ispeziona Una Risorsa Statica

Apri la scheda Network degli strumenti per sviluppatori e ricarica la pagina. Trova la richiesta a `vaso-orbitale.svg` e osserva URL, codice HTTP e content type.

Concetto ServiceNow: ogni risorsa del browser viene ottenuta tramite una richiesta HTTP.

## Autovalutazione Della Fase 2

1. Perche ogni prodotto usa un elemento `article`?
2. Qual e la differenza tra `alt` di un'immagine e testo visibile?
3. Cosa cambia sotto gli `860px`?
4. Perche non sono presenti pulsanti di configurazione ancora inattivi?
5. Quale vantaggio offre una custom property CSS?

## Fase 3 - Database E API

### 1. Ricrea I Dati Iniziali

Esegui due volte:

```powershell
npm.cmd run db:setup
```

Verifica che entrambi i risultati mostrino sempre due prodotti e quattro colori. Individua in `seedDatabase` l'istruzione che impedisce i duplicati.

Obiettivo: comprendere l'idempotenza.

### 2. Leggi Una Risposta JSON

Con il server avviato, visita:

```text
http://localhost:3000/api/products
```

Individua array, oggetti, stringhe, numeri e valore `null`. Confronta i nomi delle proprieta JSON con le colonne definite in `src/database.js`.

Concetto ServiceNow: trasformare un record prima di esporlo tramite API.

### 3. Osserva I Codici HTTP

Visita questi indirizzi e confronta le risposte nella scheda Network:

```text
/api/products/1
/api/products/999
/api/products/test
```

Spiega perche producono rispettivamente `200`, `404` e `400`.

### 4. Esegui Una Query Di Lettura

In `src/setup-database.js`, aggiungi temporaneamente una query che selezioni nome e prezzo dei prodotti ordinati dal prezzo piu alto al piu basso. Stampa il risultato con `console.table`, quindi annulla la modifica.

La query da costruire inizia con:

```sql
SELECT name, price_cents
FROM products
```

Obiettivo: esercitarsi con `SELECT`, `FROM` e `ORDER BY`.

### 5. Nascondi Un Prodotto

Come esperimento locale, modifica `visible` di un prodotto direttamente nel database usando una query `UPDATE`. Ricarica `/api/products` e verifica che il record non venga restituito. Al termine ripristina il valore.

Concetto ServiceNow: una condizione della query decide quali record sono visibili nell'elenco.

### 6. Segui Il Flusso Di Fetch

Inserisci temporaneamente un breakpoint nella funzione `loadProducts` di `public/app.js`. Osserva in ordine:

1. la risposta HTTP;
2. il corpo JSON;
3. il prodotto passato a `createProductCard`;
4. l'elemento aggiunto al DOM.

Obiettivo: seguire un dato dal server all'interfaccia.

### 7. Simula Un Errore

Modifica temporaneamente l'URL di `fetch` in un indirizzo inesistente. Verifica il messaggio mostrato nella pagina e l'errore nella console, poi ripristina l'URL.

Concetto ServiceNow: ogni chiamata remota deve gestire anche il fallimento.

### 8. Aggiungi Un Colore Di Prova

Aggiungi temporaneamente un quinto colore all'array `colors`, ricrea un database di prova o elimina soltanto il record se gia presente, quindi esegui il setup. Controlla la risposta di `/api/colors` e annulla l'esperimento.

## Autovalutazione Della Fase 3

1. Perche il prezzo viene memorizzato in centesimi?
2. Qual e la differenza tra migrazione e seed?
3. Perche il database dei test usa `:memory:`?
4. Cosa rende una query preparata preferibile alla concatenazione di stringhe?
5. In quale punto un nome SQL viene convertito nel formato JavaScript?
6. Perche il browser non riceve il campo `visible`?

## Fase 4 - Configurazione E Carrello

### 1. Segui Una Configurazione

Scegli colore e quantita, aggiungi il prodotto e apri il carrello. Negli strumenti per sviluppatori osserva l'oggetto salvato in Application, Local Storage.

Verifica che contenga ID e quantita, ma non nome o prezzo.

### 2. Verifica La Chiave Composta

Aggiungi due volte lo stesso prodotto nello stesso colore, poi aggiungilo in un colore diverso. Spiega perche il carrello mostra due righe e non tre.

Obiettivo: comprendere una chiave costruita da piu valori.

### 3. Prova I Limiti

Inserisci `0`, `100`, un numero decimale e infine `99`. Osserva quali valori vengono accettati dal form. Leggi poi `validateSelection` e individua dove la stessa regola viene applicata in JavaScript.

Concetto ServiceNow: la validazione client migliora l'esperienza, ma non sostituisce quella applicativa o server.

### 4. Calcola Manualmente Il Totale

Aggiungi due configurazioni con quantita diverse. Calcola su carta il totale in centesimi e confrontalo con `calculateCartTotal` e con il valore formattato in euro.

### 5. Corrompi Il Dato Locale

Negli strumenti per sviluppatori sostituisci temporaneamente il valore di `pixel-print-lab:cart:v1` con testo non JSON e ricarica. Il sito deve ignorarlo senza interrompersi.

Al termine elimina la chiave o ricrea il carrello.

### 6. Disattiva Un Colore

Imposta temporaneamente `active = 0` per un colore presente nel carrello, ricarica il catalogo e osserva la riconciliazione. Ripristina poi il database.

Obiettivo: comprendere perche i riferimenti locali devono essere confrontati con i record correnti.

### 7. Usa Solo La Tastiera

Senza mouse:

1. raggiungi una scheda con `Tab`;
2. cambia colore con i tasti freccia;
3. imposta la quantita;
4. aggiungi il prodotto;
5. apri e chiudi il carrello con `Invio` ed `Esc`.

Annota eventuali punti in cui il focus non e evidente.

### 8. Aggiungi Un Test

In `test/cart.test.js`, scrivi un test che provi ad aggiungere quantita zero e verifichi un `RangeError`. Esegui la suite, poi conserva o annulla l'esercizio.

## Autovalutazione Della Fase 4

1. Perche il carrello non salva il prezzo?
2. Qual e la differenza tra numero di righe e numero di pezzi?
3. A cosa serve `reconcileCart`?
4. Perche `renderCart` ricostruisce l'intero riepilogo?
5. Quali dati vengono salvati in `localStorage`?
6. Perche la richiesta finale dovra essere validata nuovamente dal server?

## Fase 5 - Visualizzatore 3D

### 1. Osserva Il Caricamento Lazy

Apri gli strumenti per sviluppatori sulla scheda Network e ricarica la pagina. Cerca `three` e `viewer.js`: non devono essere presenti. Premi "Apri 3D" e verifica quali moduli vengono richiesti.

Obiettivo: distinguere risorse iniziali e risorse caricate su richiesta.

### 2. Esplora Un File STL

Apri `public/models/vaso-orbitale.stl` e individua:

- nome del solido;
- una normale;
- i tre vertici di un triangolo;
- inizio e fine di una faccia.

Conta quante volte compare `facet normal` e confronta il risultato con la complessita visiva del modello.

### 3. Prova I Controlli

Ruota il modello, esegui zoom e premi "Ripristina visuale". Verifica anche la chiusura con `Esc` e il comportamento su uno schermo simulato da 375 px.

### 4. Cambia Il Materiale

In `public/viewer.js`, modifica temporaneamente il colore di `MeshStandardMaterial`. Prova anche `roughness` con valori vicini a 0 e 1, osserva le differenze e poi ripristina i valori originali.

### 5. Nascondi Una Luce

Commenta temporaneamente l'aggiunta della luce secondaria blu. Confronta ombre e leggibilita delle facce, quindi ripristina il codice.

Obiettivo: capire che geometria e illuminazione sono responsabilita separate.

### 6. Segui La Normalizzazione

Inserisci breakpoint in `placeModel` dopo rotazione, prima traslazione e dopo traslazione. Osserva `boundingBox.min`, `boundingBox.max` e `size`.

Spiega perche il valore minimo dell'asse verticale deve diventare zero.

### 7. Simula Un Errore STL

Modifica temporaneamente un `modelUrl` nel database con un percorso inesistente. Apri il viewer, verifica lo stato di errore e ripristina il dato.

### 8. Controlla Le Risorse

Apri e chiudi piu volte entrambi i modelli. Nella scheda Network verifica che Three.js venga scaricato una sola volta e che il browser possa riutilizzare le risorse gia ottenute.

## Autovalutazione Della Fase 5

1. Quali informazioni contiene un STL?
2. Perche il modello viene ruotato dopo il caricamento?
3. Come viene scelta la distanza iniziale della camera?
4. A cosa serve `ResizeObserver`?
5. Perche geometria e materiale vengono eliminati con `dispose`?
6. In quale momento viene importato `viewer.js`?

## Fase 6 - Modelli Personali

### 1. Confronta Anteprima E Upload

Seleziona un STL e apri l'anteprima senza aggiungerlo al carrello. Nella scheda Network verifica che non sia ancora presente una richiesta a `/api/custom-models/upload`.

Premi poi "Aggiungi richiesta al carrello" e individua la richiesta multipart.

### 2. Osserva FormData

Inserisci un breakpoint prima della `fetch` di upload e ispeziona `uploadData`. Verifica che contenga un solo campo chiamato `model`.

### 3. Prova Le Validazioni

Prova separatamente:

- un file `.txt`;
- un `.stl` con contenuto testuale casuale;
- un file STL valido;
- un link HTTP;
- `https://printables.com.example.org/model/1`;
- un link HTTPS valido da MakerWorld.

Confronta i messaggi client e le risposte HTTP.

### 4. Leggi Un UUID

Dopo un upload, apri `storage/uploads` e confronta il nome su disco con il nome mostrato nel carrello. Spiega perche non coincidono e quale problema evita il nome casuale.

### 5. Verifica La Scadenza

Leggi `expiresAt` nel valore del carrello salvato in `localStorage`. Individua nel server la costante che stabilisce la durata e la funzione che elimina i file vecchi.

### 6. Analizza Un STL Binario

Apri un STL binario con un visualizzatore esadecimale. Individua gli 80 byte iniziali e i 4 byte che contengono il numero di triangoli. Calcola la dimensione attesa con la formula documentata.

### 7. Confronta I Tipi Del Carrello

Aggiungi un prodotto, un file e un link. Ispeziona i tre oggetti in `localStorage` e annota quali campi sono condivisi e quali dipendono da `type` e `sourceType`.

### 8. Controlla Il Totale

Aggiungi un prodotto a prezzo noto con quantita 2 e un modello personale con quantita 5. Verifica che il numero di pezzi sia 7 ma che il totale economico includa soltanto il prodotto.

### 9. Verifica La Cancellazione

Aggiungi un file, annota il suo URL, poi rimuovilo dal carrello. Apri nuovamente l'URL e verifica la risposta `404`.

### 10. Usa Il Form Da Tastiera

Passa tra File STL e Link esterno, seleziona colore, modifica quantita e invia il form usando soltanto tastiera e tasti freccia.

## Autovalutazione Della Fase 6

1. Perche la validazione client non e sufficiente?
2. Come viene riconosciuto un STL binario?
3. Perche il nome originale non viene usato sul disco?
4. Cosa impedisce a un dominio ingannevole di superare l'allowlist?
5. Quando viene cancellato un upload temporaneo?
6. Perche un modello personale non modifica il totale?
7. Quale compatibilita viene mantenuta per il vecchio carrello?

## Fase 7 - Invio Delle Richieste

### 1. Confronta Carrello E Snapshot

Invia una richiesta con un prodotto del catalogo. Modifica poi il prezzo nella tabella `products` e confrontalo con `unit_price_cents` in `order_items`.

Spiega perche il valore storico non cambia.

### 2. Prova Un Prezzo Manipolato

Negli strumenti Network copia il payload di `/api/orders`, aggiungi un prezzo inventato e ripeti la richiesta. Controlla nel database quale prezzo viene salvato.

### 3. Segui Un File

Prima dell'invio individua lo STL in `storage/uploads`. Dopo la conferma verifica:

- assenza nella cartella temporanea;
- presenza in `storage/orders`;
- nome salvato in `order_items.model_filename`.

### 4. Leggi L'Email Simulata

Apri il file in `storage/emails` corrispondente al codice ricevuto. Confronta ogni riga con database e riepilogo mostrato nel browser.

### 5. Nascondi Un Prodotto

Aggiungi un prodotto al carrello, imposta temporaneamente `visible = 0` nel database e prova a inviare. Osserva l'errore, poi ripristina il prodotto.

Obiettivo: vedere perche la validazione deve avvenire nel momento dell'operazione definitiva.

### 6. Disattiva Un Colore

Ripeti l'esperimento con `active = 0` nella tabella `colors`. Verifica che la richiesta non venga creata e che il carrello non venga svuotato.

### 7. Analizza La Transazione

Leggi `saveOrder` in `src/order-routes.js`. Individua inserimento della testata, inserimento delle righe e punto in cui Better SQLite racchiude le operazioni nella stessa transazione.

### 8. Esamina Il Codice

Genera piu richieste e confronta data e suffisso. Verifica nel database che la colonna `code` abbia un vincolo univoco.

### 9. Controlla Il Payload

Invia una richiesta mista e osserva il JSON. Elenca quali valori vengono inviati dal browser e quali vengono invece ricavati dal server.

### 10. Verifica La Privacy Locale

Usa `git status` dopo aver creato richieste. Database, email e STL permanenti non devono apparire tra i file da versionare.

## Autovalutazione Della Fase 7

1. Perche l'ordine salva snapshot invece di leggere sempre il catalogo?
2. Quali valori del payload non vengono considerati affidabili?
3. Perche il file temporaneo viene eliminato dopo la transazione?
4. Cosa succede alle copie se il database rifiuta l'ordine?
5. Quali dati contiene il codice richiesta?
6. Dove vengono conservati nome e cognome?
7. Perche un errore di invio non deve svuotare il carrello?

## Fase 8 - Accesso Amministrativo E Ordini

### 1. Configura La Password

Crea `.env` con un nome utente e una password personali, riavvia il server e visita `/admin.html`. Verifica con `git status` che il file non venga proposto per il commit.

### 2. Ispeziona Il Cookie

Dopo il login apri Application, Cookies negli strumenti del browser. Individua `ppl_admin_session` e annota `HttpOnly`, `SameSite`, percorso e scadenza.

Prova a leggere il cookie con `document.cookie` e spiega perche il token non compare.

### 3. Chiama Una API Senza Sessione

Apri `/api/admin/orders` in una finestra privata non autenticata e osserva HTTP `401`. Ripeti dopo il login.

### 4. Verifica Il Riavvio

Accedi, riavvia Node.js e ricarica il pannello. La sessione deve essere persa perche lo store e in memoria.

### 5. Modifica Uno Snapshot

Cambia prodotto, colore e quantita di una richiesta. Confronta prima e dopo:

- `orders.catalog_total_cents`;
- righe in `order_items`;
- email simulata.

### 6. Osserva Gli ID Delle Righe

Annota gli ID di `order_items`, salva una modifica e rileggili. Spiega perche possono cambiare e quale campo mantiene l'ordine visivo.

### 7. Prova Un Download Protetto

Copia l'URL "Apri STL", esegui logout e aprilo nuovamente. Deve essere rifiutato.

### 8. Rimuovi Una Riga File

Elimina una riga STL da un ordine, salva e controlla `storage/orders`. Verifica che il file venga cancellato soltanto dopo la modifica riuscita.

### 9. Prova Il Limite Login

In un ambiente di prova inserisci cinque volte un nome utente o una password errati. Osserva il passaggio da `401` a `429`. Riavvia il server per azzerare il contatore locale.

### 10. Verifica La Cancellazione

Crea una richiesta di prova, annota record, file ed email, quindi eliminala dal pannello. Tutte le risorse collegate devono scomparire.

## Autovalutazione Della Fase 8

1. Perche proteggere soltanto `admin.html` non sarebbe sufficiente?
2. Quali attributi proteggono il cookie?
3. Dove vengono conservate le sessioni?
4. Perche il server rivalida anche le modifiche amministrative?
5. Come viene aggiornato un ordine in una transazione?
6. Quando viene eliminato un file STL permanente?
7. Quali limiti ha l'autenticazione attuale?

## Fase 9 - Gestione Catalogo E Colori

### 1. Confronta Le API

Nascondi un prodotto e disattiva un colore. Confronta `/api/products` e `/api/colors` con `/api/admin/catalog` e spiega la differenza.

### 2. Ispeziona Gli Asset

Crea un prodotto con immagine e STL. Controlla URL, nomi UUID, header `Content-Type` e `X-Content-Type-Options`, quindi individua i file in `storage/catalog`.

### 3. Prova Un File Non Valido

Rinomina un file di testo con estensione `.png` o `.stl` e prova a caricarlo. Verifica che il server rifiuti il contenuto e non lasci file orfani.

### 4. Sostituisci Un Asset

Carica una nuova immagine per un prodotto esistente. Verifica che il database punti al nuovo URL e che il vecchio file gestito venga eliminato.

### 5. Proteggi Gli Asset Dimostrativi

Modifica o elimina un prodotto dimostrativo che usa `/images` e `/models`. Spiega perche il server non prova a cancellare quei file dalla cartella `public`.

### 6. Verifica Gli Snapshot

Crea un ordine, poi rinomina e nascondi il prodotto usato e disattiva il colore. Riapri l'ordine e controlla che nome, prezzo e colore originali siano ancora visibili.

### 7. Controlla Gli ID

Crea un prodotto, annota il suo ID, eliminalo e creane un altro. Verifica che SQLite non riutilizzi l'ID precedente.

### 8. Riordina La Palette

Sposta i colori dal pannello e confronta `sort_order` prima e dopo. Verifica che l'API pubblica segua il nuovo ordinamento.

### 9. Verifica Il Responsive

Prova Ordini e Catalogo sopra e sotto 900 px e 560 px. Controlla navigazione, sidebar, campi prodotto e righe colore.

## Autovalutazione Della Fase 9

1. Perche gli asset caricati non vengono salvati in `public`?
2. Perche non vengono accettate immagini SVG?
3. Quando viene eliminato un asset sostituito?
4. Perche un prodotto nascosto compare ancora nelle API amministrative?
5. Come vengono conservati gli snapshot degli ordini?
6. Quale problema evita `AUTOINCREMENT`?
7. Perche il riordino dei colori usa una transazione?

## Supporto Ai File 3MF

### 1. Confronta STL E 3MF

Carica prima un STL e poi un 3MF. Confronta la risposta di `/api/custom-models/upload`, in particolare `modelFormat` e `inspection`.

### 2. Osserva Un Archivio 3MF

Apri una copia di un 3MF come archivio ZIP e individua `_rels/.rels`, il modello `.model` e gli eventuali file sotto `Metadata`. Non modificare il file originale usato per la stampa.

### 3. Verifica Il Primo Piatto

Usa un progetto Bambu con due piatti. Confronta `plateCount`, `previewPlate` e `previewBuildItemIndexes`, quindi controlla che il viewer mostri soltanto il primo.

### 4. Prova Il Volume Standard

Crea due progetti, uno entro e uno oltre 256x256x256 mm. Entrambi devono essere accettati, ma il secondo deve restituire un avviso informativo.

### 5. Prova Un G-code 3MF

Tenta di caricare un file `.gcode.3mf`. Verifica il codice di errore e spiega perche il sito non deve eseguire contenuti di stampa gia affettati.

### 6. Controlla La Persistenza

Invia un ordine 3MF e confronta il file temporaneo con quello in `storage/orders`. Verifica che i byte siano identici e osserva `model_format` e `model_metadata_json`.

### 7. Scarica Dal Pannello

Apri la richiesta dalla Control Room e scarica il 3MF. Controlla `Content-Type`, `Content-Disposition` e comportamento dopo il logout.

### 8. Verifica Un Carrello Precedente

Inserisci in `localStorage` un elemento STL senza `modelFormat`. Ricarica la pagina e verifica che venga interpretato come STL senza perdere il carrello.

## Autovalutazione 3MF

1. Perche il 3MF viene ispezionato prima dell'anteprima?
2. Quale relazione identifica il modello principale?
3. Come viene individuato il primo piatto Bambu?
4. Perche il controllo 256x256x256 mm e soltanto informativo?
5. Quali dati vengono salvati oltre al file originale?
6. Perche `.gcode.3mf` e escluso?
7. Quali limiti proteggono server e browser?

## Tracciamento Pubblico Delle Richieste

### 1. Verifica Lo Stato Iniziale

Invia una richiesta e controlla che `orders.status` sia `in_attesa` senza che il browser lo invii esplicitamente.

### 2. Ispeziona L'API Pubblica

Apri `/api/orders` e verifica che ogni record contenga soltanto `code` e `status`. Cerca nomi, ID interni, date, prezzi e dettagli dei modelli: non devono comparire.

### 3. Cambia Stato Dal Pannello

Porta una richiesta da `in_attesa` a `in_lavorazione` e poi a `completato`. Controlla database, API pubblica e pagina principale dopo ogni passaggio.

### 4. Prova Un Valore Non Valido

Invia manualmente uno stato non previsto al PATCH amministrativo. Confronta l'errore API con il vincolo `CHECK` del database.

### 5. Verifica L'Ordinamento

Crea due richieste nello stesso secondo e controlla che quella con ID maggiore appaia prima. Spiega il ruolo del secondo criterio di ordinamento.

### 6. Controlla La Cancellazione

Completa una richiesta e verifica che resti pubblica. Eliminala dal pannello e controlla che scompaia dal tracking.

### 7. Prova Il Responsive

Confronta la pagina a 1051, 1050, 861 e 860 px. Il tracking deve restare leggibile e precedere sempre il catalogo su mobile.

### 8. Riduci Le Animazioni

Attiva `prefers-reduced-motion` negli strumenti del browser. La stampante pixel art deve restare comprensibile tramite il testo senza continuare ad animarsi.

## Autovalutazione Tracking

1. Perche l'API pubblica non usa `SELECT *`?
2. Perche il codice richiesta non deve essere considerato segreto?
3. Perche lo stato usa un endpoint separato dalla modifica dell'ordine?
4. Come vengono scartate risposte di polling obsolete?
5. Quando una richiesta completata scompare dall'elenco?
6. Quali informazioni possono essere dedotte osservando tutti i codici pubblici?
