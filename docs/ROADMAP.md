# Roadmap

Questo documento e il Kanban locale del progetto. Ogni scheda passa da **Backlog** a **Da fare**, quindi a **In corso** e infine a **Completato** soltanto dopo la verifica.

Ultimo aggiornamento: 16 luglio 2026.

## In corso

- Nessuna attivita. La fase 9 e conclusa.

## Da fare

- Nessuna fase selezionata. Le funzionalita successive sono nel backlog.

## Backlog

### Supporto 3MF e profili stampante

- [ ] Accettare file 3MF generici e progetti esportati da Bambu Studio, mantenendo il supporto STL esistente.
- [ ] Escludere inizialmente gli archivi `.gcode.3mf` e conservare i metadati originali del progetto.
- [ ] Ispezionare gli archivi 3MF in sicurezza, limitando dimensioni, contenuti e percorsi interni.
- [ ] Estrarre geometrie, unita di misura, piatti, trasformazioni e profilo stampante senza eseguire contenuti incorporati.
- [ ] Mostrare nell'anteprima soltanto il primo piatto tramite `3MFLoader`, con messaggi chiari per file non visualizzabili.
- [ ] Validare il profilo A1 Mini rispetto al volume di stampa di 180x180x180 mm.
- [ ] Validare il profilo X2D rispetto all'ugello usato: 256x256x260 mm per il principale e 235,5x256x256 mm per ausiliario o doppio ugello.
- [ ] Segnalare incompatibilita di volume o profilo senza scartare automaticamente i 3MF generici privi di dati stampante.
- [ ] Conservare il 3MF originale nell'ordine e renderlo scaricabile dal pannello amministrativo.
- [ ] Verificare upload, anteprima, ordini, sicurezza e responsive con fixture 3MF generiche e Bambu Studio.
- [ ] Documentare limiti e compatibilita usando le specifiche ufficiali Bambu Lab.

### Tracciamento pubblico delle richieste

- [ ] Aggiungere agli ordini gli stati `in attesa`, `in lavorazione` e `completato`.
- [ ] Assegnare automaticamente lo stato iniziale `in attesa` e permettere i cambi successivi dal pannello.
- [ ] Aggiungere alla pagina principale una colonna pubblica con codice richiesta e stato.
- [ ] Ordinare le richieste dalla piu recente alla piu vecchia.
- [ ] Mostrare il codice completo senza nome, cognome o dettagli dei modelli.
- [ ] Mantenere visibili anche le richieste completate finche non vengono eliminate manualmente.
- [ ] Aggiungere una piccola animazione pixel art alle richieste `in lavorazione`.
- [ ] Su mobile trasformare la colonna in una sezione posizionata prima del catalogo.
- [ ] Verificare privacy, accessibilita e aggiornamento dell'elenco.

### Altre funzionalita

- [ ] Statistiche anonime senza cookie.
- [ ] Animazioni pixel art legate alla stampa 3D.
- [ ] Preparazione alla pubblicazione.

## Completato

### Fase 9 - Gestione catalogo e colori

- [x] Aggiunta navigazione amministrativa tra ordini e catalogo.
- [x] Gestite creazione, modifica, visibilita ed eliminazione dei prodotti.
- [x] Caricate immagini PNG, JPG o WebP e modelli STL in storage dedicato.
- [x] Gestiti prezzo, descrizione, specifiche, ordinamento e asset.
- [x] Gestite creazione, modifica, ordinamento e disattivazione dei colori globali.
- [x] Impedito il riutilizzo degli ID eliminati tramite migrazione SQLite.
- [x] Conservati invariati gli snapshot degli ordini esistenti.
- [x] Verificati autorizzazione, file, filtri pubblici e layout responsive.
- [x] Aggiornati test, guida tecnica ed esercizi.

### Fase 8 - Accesso amministrativo e ordini

- [x] Configurata autenticazione con nome utente, password e sessione in memoria.
- [x] Aggiunti cookie HttpOnly, SameSite e scadenza.
- [x] Limitati i tentativi di login falliti.
- [x] Create API protette per elenco, dettaglio e download STL.
- [x] Gestite modifica completa e aggiunta/rimozione righe.
- [x] Ricalcolati snapshot, totale ed email dopo il salvataggio.
- [x] Eliminati ordine, file ed email in modo coordinato.
- [x] Creato pannello Control Room responsive.
- [x] Verificati login, gestione e logout su desktop e mobile.
- [x] Aggiornati test, guida tecnica ed esercizi.

### Fase 7 - Invio delle richieste

- [x] Create tabelle per ordini e snapshot storici.
- [x] Aggiunto riepilogo finale con nome e cognome.
- [x] Rivalidati prodotti, prezzi, colori, quantita, link e upload.
- [x] Copiati gli STL in storage permanente con compensazione degli errori.
- [x] Generato un codice richiesta univoco.
- [x] Creata un'email simulata con tutti i dettagli.
- [x] Mostrata conferma con il solo codice.
- [x] Svuotato il carrello soltanto dopo il successo.
- [x] Verificato il flusso misto su desktop e mobile.
- [x] Aggiornati test, guida tecnica ed esercizi.

### Fase 6 - Modelli personali

- [x] Creato il form alternativo per STL o link esterno.
- [x] Aggiunta anteprima locale prima dell'upload.
- [x] Validati estensione, contenuto ASCII/binario e limite di 50 MB.
- [x] Salvati gli upload con UUID e scadenza di 24 ore.
- [x] Limitati i link a quattro domini HTTPS autorizzati.
- [x] Integrati colore e quantita per i modelli personali.
- [x] Esteso il carrello mantenendo il formato precedente.
- [x] Esclusi i modelli personali dal totale economico.
- [x] Gestite verifica, scadenza e cancellazione dei temporanei.
- [x] Verificati file e link su desktop e mobile.
- [x] Aggiornati test, guida tecnica ed esercizi.

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
