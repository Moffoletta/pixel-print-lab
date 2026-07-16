# Roadmap

Questo documento e il Kanban locale del progetto. Ogni scheda passa da **Backlog** a **Da fare**, quindi a **In corso** e infine a **Completato** soltanto dopo la verifica.

Ultimo aggiornamento: 16 luglio 2026.

## In corso

- Nessuna attivita. La fase 5 e conclusa.

## Da fare

### Fase 6 - Modelli personali

- [ ] Creare il form alternativo per file STL o link esterno.
- [ ] Validare file STL fino a 50 MB lato client e server.
- [ ] Limitare i link ai domini autorizzati.
- [ ] Mostrare nel viewer il file caricato.
- [ ] Aggiungere colore e quantita al modello personale.
- [ ] Integrare i modelli personali nel carrello senza prezzo.
- [ ] Gestire file temporanei e relativi errori.

## Backlog

- [ ] Integrare i modelli personali nel carrello.
- [ ] Richieste con nome, cognome e codice univoco.
- [ ] Upload STL fino a 50 MB.
- [ ] Link esterni da domini autorizzati.
- [ ] Visualizzare nel viewer i file STL caricati dagli utenti.
- [ ] Accesso amministratore con sessione.
- [ ] Gestione di prodotti, colori e ordini.
- [ ] Statistiche anonime senza cookie.
- [ ] Email di notifica simulate.
- [ ] Animazioni pixel art legate alla stampa 3D.
- [ ] Preparazione alla pubblicazione.

## Completato

### Fase 5 - Visualizzatore 3D

- [x] Aggiunti due file STL dimostrativi.
- [x] Associati i file ai prodotti tramite seed e migrazione.
- [x] Integrati Three.js, STLLoader e OrbitControls.
- [x] Centrati i modelli su un piano di stampa proporzionato.
- [x] Aggiunti rotazione, zoom e ripristino visuale.
- [x] Caricato il viewer soltanto dopo la richiesta dell'utente.
- [x] Gestiti caricamento, errore, ridimensionamento e rilascio risorse.
- [x] Verificati entrambi i modelli su desktop e mobile.
- [x] Aggiornati test, guida tecnica ed esercizi.

### Fase 4 - Configurazione e carrello

- [x] Mostrati i colori globali su ogni prodotto.
- [x] Aggiunta quantita con limite da 1 a 99.
- [x] Gestite aggiunta, unione, modifica e rimozione delle configurazioni.
- [x] Calcolati totale di riga, totale complessivo e numero di pezzi.
- [x] Salvato il carrello senza dati personali in `localStorage`.
- [x] Riconciliato il carrello con prodotti e colori correnti.
- [x] Creato un dialog responsive e accessibile per il riepilogo.
- [x] Verificato il flusso completo in un browser reale.
- [x] Aggiunti test, guida tecnica ed esercizi.

### Fase 3 - Database e API

- [x] Create tabelle SQLite per prodotti, colori e migrazioni.
- [x] Creato un seed esplicito e idempotente.
- [x] Esposte API REST in sola lettura per prodotti e colori.
- [x] Aggiunte validazione degli identificativi e risposte di errore.
- [x] Collegato il catalogo pubblico alle API tramite `fetch`.
- [x] Usato un database isolato in memoria nei test.
- [x] Verificate interfaccia, API, setup ripetuto e dipendenze.
- [x] Aggiornati README, guida tecnica ed esercizi.

### Fase 2 - Catalogo statico

- [x] Definita la struttura completa della pagina pubblica.
- [x] Creati due prodotti dimostrativi con immagini SVG.
- [x] Costruita la griglia responsive del catalogo.
- [x] Definiti i componenti visuali pixel art di base.
- [x] Aggiunte navigazione semantica e scorciatoia al contenuto.
- [x] Verificate le viste desktop e a larghezza ridotta.
- [x] Aggiornati test, guida tecnica ed esercizi.

### Fase 1 - Fondamenta

- [x] Verificati Node.js, npm e Git.
- [x] Definita la struttura iniziale delle cartelle.
- [x] Creato un server Express minimo.
- [x] Creata una pagina pubblica temporanea.
- [x] Aggiunto un endpoint di controllo dello stato.
- [x] Aggiunti test automatici di base.
- [x] Create guida tecnica ed esercizi separati.
- [x] Documentati avvio locale e vincoli del progetto.

## Regole Del Kanban

- Una scheda entra in **In corso** prima di essere sviluppata.
- Deve esserci una sola fase principale in corso.
- Una scheda e completata solo dopo test e aggiornamento della documentazione.
- Nuove idee non urgenti entrano nel **Backlog**.
- Le modifiche che cambiano i requisiti vengono chiarite prima dell'implementazione.
