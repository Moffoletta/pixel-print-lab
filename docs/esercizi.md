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
