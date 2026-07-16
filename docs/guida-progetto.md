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
