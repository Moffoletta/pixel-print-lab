# Roadmap

Questo documento e il Kanban locale del progetto. Ogni scheda passa da **Backlog** a **Da fare**, quindi a **In corso** e infine a **Completato** soltanto dopo la verifica.

Ultimo aggiornamento: 17 luglio 2026.

## In corso

- Nessuna attivita. Le impostazioni SMTP sono concluse.

## Da fare

- Nessuna fase selezionata. Le funzionalita successive sono nel backlog.

## Backlog

### Altre funzionalita

- [ ] Statistiche anonime senza cookie.
- [ ] Animazioni pixel art legate alla stampa 3D.
- [ ] Preparazione alla pubblicazione dietro reverse proxy HTTPS.

## Completato

### Impostazioni email SMTP

- [x] Aggiunta configurazione SMTP tramite ambiente e Docker Compose.
- [x] Salvata nel database l'attivazione delle notifiche, disabilitata per default.
- [x] Aggiunte API amministrative protette per lettura e aggiornamento.
- [x] Creata rotella con popup impostazioni responsive e accessibile.
- [x] Reso l'errore SMTP non distruttivo per gli ordini gia salvati.
- [x] Rimossi outbox simulato ed esercizi non piu necessari.

### Release GitHub e distribuzione immagine

- [x] Scelta e aggiunta la licenza MIT.
- [x] Aggiunto changelog versionato.
- [x] Automatizzate verifica, pubblicazione GHCR e creazione della GitHub Release.
- [x] Documentato l'avvio tramite immagine Docker precompilata.

### Distribuzione self-hosted con Docker

- [x] Aggiunta immagine di produzione basata su Node.js 22.
- [x] Configurato un Docker Compose essenziale con variabili commentate.
- [x] Separati database e storage in bind mount persistenti.
- [x] Eseguito il container come utente non-root.
- [x] Aggiunti setup idempotente e riavvio automatico.
- [x] Documentati avvio, aggiornamento, persistenza e backup.
- [x] Aggiunta validazione automatica di Compose e build immagine in GitHub Actions.

### Tracciamento pubblico delle richieste

- [x] Aggiunti gli stati `in attesa`, `in lavorazione` e `completato` con vincolo SQLite.
- [x] Assegnato automaticamente `in attesa` alle richieste nuove ed esistenti.
- [x] Aggiunto aggiornamento stato dedicato nel pannello senza riscrivere gli snapshot.
- [x] Esposta un'API pubblica con i soli campi `code` e `status`.
- [x] Ordinate le richieste dalla piu recente alla piu vecchia.
- [x] Mantenute visibili le richieste completate fino alla cancellazione manuale.
- [x] Creata sezione pubblica con animazione pixel art per `in lavorazione`.
- [x] Posizionato il tracking sotto il catalogo e collegato dalla hero.
- [x] Aggiunti polling controllato, aggiornamento dopo l'invio e supporto reduced motion.
- [x] Verificati privacy, autorizzazione, accessibilita, responsive e migrazione.
- [x] Aggiornati test, guida e architettura.

### Supporto 3MF e piatto standard

- [x] Accettati 3MF generici e progetti Bambu Studio mantenendo il supporto STL.
- [x] Esclusi `.gcode.3mf` e archivi contenenti G-code.
- [x] Ispezionati ZIP, percorsi, XML, geometrie, componenti e trasformazioni con limiti espliciti.
- [x] Estratti unita, piatti, istanze, dimensioni e metadati standard.
- [x] Mostrato soltanto il primo piatto tramite `3MFLoader` dopo il controllo server.
- [x] Usato un unico volume informativo standard di 256x256x256 mm senza distinguere stampanti.
- [x] Accettati anche i modelli fuori volume, lasciando la correzione manuale all'amministratore.
- [x] Conservato il 3MF originale e il riepilogo di ispezione negli ordini.
- [x] Aggiunto download 3MF protetto nel pannello amministrativo.
- [x] Verificati sicurezza, persistenza, compatibilita STL precedente e progetti Bambu multi-piatto.
- [x] Aggiornati test, guida e architettura.

### Fase 9 - Gestione catalogo e colori

- [x] Aggiunta navigazione amministrativa tra ordini e catalogo.
- [x] Gestite creazione, modifica, visibilita ed eliminazione dei prodotti.
- [x] Caricate immagini PNG, JPG o WebP e modelli STL in storage dedicato.
- [x] Gestiti prezzo, descrizione, specifiche, ordinamento e asset.
- [x] Gestite creazione, modifica, ordinamento e disattivazione dei colori globali.
- [x] Impedito il riutilizzo degli ID eliminati tramite migrazione SQLite.
- [x] Conservati invariati gli snapshot degli ordini esistenti.
- [x] Verificati autorizzazione, file, filtri pubblici e layout responsive.
- [x] Aggiornati test e guida tecnica.

### Fase 8 - Accesso amministrativo e ordini

- [x] Configurata autenticazione con nome utente, password e sessione in memoria.
- [x] Aggiunti cookie HttpOnly, SameSite e scadenza.
- [x] Limitati i tentativi di login falliti.
- [x] Create API protette per elenco, dettaglio e download STL.
- [x] Resi consultabili in sola lettura cliente, righe, snapshot e totale.
- [x] Limitate le modifiche dell'ordine a stato pubblico e cancellazione definitiva.
- [x] Eliminati ordine e file in modo coordinato.
- [x] Creato pannello Control Room responsive.
- [x] Verificati login, gestione e logout su desktop e mobile.
- [x] Aggiornati test e guida tecnica.

### Fase 7 - Invio delle richieste

- [x] Create tabelle per ordini e snapshot storici.
- [x] Aggiunto riepilogo finale con nome e cognome.
- [x] Rivalidati prodotti, prezzi, colori, quantita, link e upload.
- [x] Copiati gli STL in storage permanente con compensazione degli errori.
- [x] Generato un codice richiesta univoco.
- [x] Preparato il riepilogo testuale dell'ordine per le notifiche.
- [x] Mostrata conferma con il solo codice.
- [x] Svuotato il carrello soltanto dopo il successo.
- [x] Verificato il flusso misto su desktop e mobile.
- [x] Aggiornati test e guida tecnica.

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
- [x] Aggiornati test e guida tecnica.

### Fase 5 - Visualizzatore 3D

- [x] Aggiunti due file STL dimostrativi.
- [x] Associati i file ai prodotti tramite seed e migrazione.
- [x] Integrati Three.js, STLLoader e OrbitControls.
- [x] Centrati i modelli su un piano di stampa proporzionato.
- [x] Aggiunti rotazione, zoom e ripristino visuale.
- [x] Caricato il viewer soltanto dopo la richiesta dell'utente.
- [x] Gestiti caricamento, errore, ridimensionamento e rilascio risorse.
- [x] Verificati entrambi i modelli su desktop e mobile.
- [x] Aggiornati test e guida tecnica.

### Fase 4 - Configurazione e carrello

- [x] Mostrati i colori globali su ogni prodotto.
- [x] Aggiunta quantita con limite da 1 a 99.
- [x] Gestite aggiunta, unione, modifica e rimozione delle configurazioni.
- [x] Calcolati totale di riga, totale complessivo e numero di pezzi.
- [x] Salvato il carrello senza dati personali in `localStorage`.
- [x] Riconciliato il carrello con prodotti e colori correnti.
- [x] Creato un dialog responsive e accessibile per il riepilogo.
- [x] Verificato il flusso completo in un browser reale.
- [x] Aggiunti test e guida tecnica.

### Fase 3 - Database e API

- [x] Create tabelle SQLite per prodotti, colori e migrazioni.
- [x] Creato un seed esplicito e idempotente.
- [x] Esposte API REST in sola lettura per prodotti e colori.
- [x] Aggiunte validazione degli identificativi e risposte di errore.
- [x] Collegato il catalogo pubblico alle API tramite `fetch`.
- [x] Usato un database isolato in memoria nei test.
- [x] Verificate interfaccia, API, setup ripetuto e dipendenze.
- [x] Aggiornati README e guida tecnica.

### Fase 2 - Catalogo statico

- [x] Definita la struttura completa della pagina pubblica.
- [x] Creati due prodotti dimostrativi con immagini SVG.
- [x] Costruita la griglia responsive del catalogo.
- [x] Definiti i componenti visuali pixel art di base.
- [x] Aggiunte navigazione semantica e scorciatoia al contenuto.
- [x] Verificate le viste desktop e a larghezza ridotta.
- [x] Aggiornati test e guida tecnica.

### Fase 1 - Fondamenta

- [x] Verificati Node.js, npm e Git.
- [x] Definita la struttura iniziale delle cartelle.
- [x] Creato un server Express minimo.
- [x] Creata una pagina pubblica temporanea.
- [x] Aggiunto un endpoint di controllo dello stato.
- [x] Aggiunti test automatici di base.
- [x] Creata la guida tecnica progressiva.
- [x] Documentati avvio locale e vincoli del progetto.

## Regole Del Kanban

- Una scheda entra in **In corso** prima di essere sviluppata.
- Deve esserci una sola fase principale in corso.
- Una scheda e completata solo dopo test e aggiornamento della documentazione.
- Ogni modifica strutturale aggiorna anche `docs/ARCHITETTURA.md`.
- Nuove idee non urgenti entrano nel **Backlog**.
- Le modifiche che cambiano i requisiti vengono chiarite prima dell'implementazione.
