# Architettura Di Pixel Print Lab

Questo documento rappresenta la struttura generale dell'applicazione. Deve essere aggiornato insieme al codice quando cambiano componenti, dipendenze, API, database, directory di storage o flussi principali.

Ultimo aggiornamento: 17 luglio 2026, supporto 3MF.

## Diagramma Di Flusso

![Diagramma di flusso generale di Pixel Print Lab](images/flusso-applicazione.svg)

Il file SVG puo essere aperto direttamente dal percorso [`docs/images/flusso-applicazione.svg`](images/flusso-applicazione.svg) e mantiene la qualita a qualsiasi dimensione.

## Vista Generale

```mermaid
flowchart LR
  Cliente[Cliente]
  Admin[Amministratore]

  subgraph Browser
    Pubblica[Interfaccia pubblica]
    Pannello[Pannello Control Room]
    Pubblica --> CatalogoUI[Catalogo e viewer STL/3MF]
    Pubblica --> Carrello[Carrello locale]
    Pannello --> OrdiniUI[Gestione ordini]
    Pannello --> CatalogoAdmin[Gestione prodotti e colori]
  end

  subgraph Server[Node.js ed Express]
    API[API pubbliche]
    APIAdmin[API amministrative protette]
    Sessioni[Sessioni admin in memoria]
    Validazione[Validazione dati, STL e archivi 3MF]
    Asset[Servizio asset statici]
    APIAdmin <--> Sessioni
    API --> Validazione
    APIAdmin --> Validazione
  end

  subgraph Persistenza
    DB[(SQLite)]
    Storage[(Storage locale)]
    DB --> Tabelle[Prodotti, colori, ordini e snapshot]
    Storage --> Upload[Upload STL/3MF temporanei]
    Storage --> FileOrdini[STL/3MF degli ordini]
    Storage --> FileCatalogo[Immagini e STL del catalogo]
    Storage --> Email[Email simulate]
  end

  Cliente --> Pubblica
  Admin --> Pannello
  CatalogoUI --> API
  Carrello --> API
  OrdiniUI --> APIAdmin
  CatalogoAdmin --> APIAdmin
  API --> DB
  APIAdmin --> DB
  Validazione --> Storage
  Asset --> Storage
```

## Componenti Applicativi

```mermaid
flowchart TB
  subgraph FrontendPubblico[Frontend pubblico]
    Index[index.html]
    AppPub[app.js]
    Cart[cart.js]
    Viewer[viewer.js e Three.js]
    Index --> AppPub
    AppPub --> Cart
    AppPub --> Viewer
  end

  subgraph FrontendAdmin[Frontend amministrativo]
    AdminHTML[admin.html]
    AdminJS[admin.js]
    AdminCSS[admin.css]
    AdminHTML --> AdminJS
    AdminHTML --> AdminCSS
  end

  subgraph Backend[src]
    ServerJS[server.js]
    AppJS[app.js]
    CatalogRoutes[catalog-routes.js]
    CustomRoutes[custom-model-routes.js]
    OrderRoutes[order-routes.js]
    AdminRoutes[admin-routes.js]
    CatalogAssets[catalog-assets.js]
    ModelFiles[model-files.js]
    Database[database.js]
    ServerJS --> AppJS
    AppJS --> CatalogRoutes
    AppJS --> CustomRoutes
    AppJS --> OrderRoutes
    AppJS --> AdminRoutes
    AppJS --> CatalogAssets
    CustomRoutes --> ModelFiles
    OrderRoutes --> ModelFiles
    CatalogRoutes --> Database
    OrderRoutes --> Database
    AdminRoutes --> Database
    AdminRoutes --> CatalogAssets
  end

  FrontendPubblico --> CatalogRoutes
  FrontendPubblico --> CustomRoutes
  FrontendPubblico --> OrderRoutes
  FrontendAdmin --> AdminRoutes
```

## Flusso Di Una Richiesta

```mermaid
sequenceDiagram
  actor C as Cliente
  participant B as Browser
  participant E as Express
  participant D as SQLite
  participant S as Storage

  C->>B: Seleziona prodotto, colore e quantita
  B->>E: Richiede catalogo e colori attivi
  E->>D: Legge dati pubblici
  D-->>E: Prodotti e colori
  E-->>B: JSON validato
  C->>B: Aggiunge STL, 3MF o link facoltativo
  B->>E: Carica il modello
  E->>E: Ispeziona ZIP, XML e primo piatto
  E->>S: Salva upload temporaneo
  C->>B: Invia nome, cognome e carrello
  B->>E: POST /api/orders
  E->>D: Rivalida e salva ordine e snapshot
  E->>S: Rende permanenti i file e genera email
  E-->>B: Restituisce il codice richiesta
```

## Flusso Amministrativo

```mermaid
sequenceDiagram
  actor A as Amministratore
  participant P as Control Room
  participant E as API admin
  participant D as SQLite
  participant S as Storage catalogo

  A->>P: Inserisce nome utente e password
  P->>E: POST /api/admin/login
  E-->>P: Cookie HttpOnly di sessione
  P->>E: Richiede ordini o catalogo
  E->>D: Legge dati protetti
  D-->>E: Ordini, prodotti e colori
  E-->>P: Dati amministrativi
  A->>P: Modifica prodotto o colore
  P->>E: Invia dati e asset
  E->>S: Valida e salva i nuovi file
  E->>D: Aggiorna il catalogo
  E->>S: Elimina gli asset sostituiti
  Note over E,D: Gli snapshot degli ordini restano invariati
```

## Mappa Delle Directory

```text
Pixel Print Lab/
|-- public/                 Interfacce e asset inclusi nel progetto
|   |-- index.html          Pagina pubblica
|   |-- app.js              Catalogo e modelli personali
|   |-- cart.js             Stato e regole del carrello
|   |-- viewer.js           Anteprima STL/3MF con Three.js
|   |-- admin.html          Control Room
|   |-- admin.js            Ordini, prodotti e colori
|   `-- images/ e models/   Asset dimostrativi
|-- src/                    Server e regole applicative
|   |-- server.js           Avvio e configurazione ambiente
|   |-- app.js              Composizione Express
|   |-- database.js         Migrazioni e seed SQLite
|   |-- catalog-routes.js   API pubbliche del catalogo
|   |-- custom-model-routes.js
|   |-- model-files.js      Ispezione sicura STL/3MF e primo piatto
|   |-- order-routes.js
|   |-- admin-routes.js     Sessioni e API protette
|   `-- catalog-assets.js   Upload e servizio asset catalogo
|-- storage/                File runtime esclusi da Git
|   |-- uploads/            STL/3MF temporanei
|   |-- orders/             STL/3MF permanenti degli ordini
|   |-- catalog/            Immagini e STL amministrativi
|   `-- emails/             Email simulate
|-- data/                   Database SQLite runtime
|-- test/                   Test automatici
|-- docs/                   Roadmap, guida, esercizi e diagrammi
|-- .env                    Configurazione locale esclusa da Git
`-- package.json            Script e dipendenze
```

## Confini Di Sicurezza

- Le pagine statiche non contengono dati amministrativi.
- Tutte le API `/api/admin/*` richiedono una sessione valida.
- Le credenziali sono lette da `.env`, che e escluso da Git.
- I dati inviati dal browser vengono rivalidati dal server.
- Gli upload usano nomi UUID, limiti di dimensione e verifica del contenuto.
- I 3MF vengono ispezionati lato server prima dell'anteprima e confrontati con un volume standard 256x256x256 mm.
- I file degli ordini sono accessibili soltanto tramite API protette.
- Gli asset del catalogo sono pubblici, ma possono essere caricati soltanto dall'amministratore.
- Gli ordini conservano snapshot indipendenti dalle modifiche al catalogo.

## Regola Di Manutenzione

Questo documento fa parte della definizione di completamento del progetto. Una modifica strutturale non e conclusa finche non sono aggiornati:

1. i diagrammi interessati;
2. la mappa delle directory, se cambia;
3. la data e la fase indicate in apertura;
4. i riferimenti nella guida tecnica e nella roadmap.
