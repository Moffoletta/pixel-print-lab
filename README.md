# Pixel Print Lab

Applicazione personale per raccogliere richieste di stampa 3D da un catalogo o da file STL forniti dagli utenti.

## Requisiti

- Node.js 22 o successivo
- npm
- Git

## Avvio locale

```powershell
npm.cmd install
npm.cmd run db:setup
npm.cmd run dev
```

Aprire `http://localhost:3000`. Per verificare il server aprire `http://localhost:3000/api/health`.

`db:setup` applica le migrazioni SQLite e inserisce i prodotti e i colori dimostrativi. Il comando puo essere ripetuto senza creare duplicati.

Su questo computer viene usato `npm.cmd` perche PowerShell impedisce l'esecuzione di `npm.ps1`. Non e necessario cambiare la policy di sicurezza.

## Test

```powershell
npm.cmd test
```

## API Locali

- `GET /api/products`: prodotti visibili.
- `GET /api/products/:id`: dettaglio di un prodotto.
- `GET /api/colors`: colori attivi.

## Documentazione

- [`docs/ROADMAP.md`](docs/ROADMAP.md): Kanban e avanzamento.
- [`docs/guida-progetto.md`](docs/guida-progetto.md): guida tecnica progressiva.
- [`docs/esercizi.md`](docs/esercizi.md): esercizi didattici separati.
