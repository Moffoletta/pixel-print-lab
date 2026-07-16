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
