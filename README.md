# Pixel Print Lab

[![Test](https://github.com/Moffoletta/pixel-print-lab/actions/workflows/test.yml/badge.svg)](https://github.com/Moffoletta/pixel-print-lab/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/Moffoletta/pixel-print-lab)](https://github.com/Moffoletta/pixel-print-lab/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Applicazione personale per raccogliere richieste di stampa 3D da un catalogo o da file STL e 3MF forniti dagli utenti.

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

Il pannello amministrativo e disponibile su `http://localhost:3000/admin.html` dopo aver impostato `ADMIN_USERNAME` e `ADMIN_PASSWORD` nel file locale `.env`.

`db:setup` applica le migrazioni SQLite e inserisce i prodotti e i colori dimostrativi. Il comando puo essere ripetuto senza creare duplicati.

Su questo computer viene usato `npm.cmd` perche PowerShell impedisce l'esecuzione di `npm.ps1`. Non e necessario cambiare la policy di sicurezza.

## Test

```powershell
npm.cmd test
```

## Avvio Con Docker

Sono richiesti Docker Engine con il plugin Compose oppure Docker Desktop.

Creare un file `.env` nella directory del progetto. Compose lo legge automaticamente:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
HOST_PORT=3000
BIND_ADDRESS=127.0.0.1
```

Avviare l'applicazione:

```sh
docker compose up -d --build
docker compose ps
```

Per usare l'immagine gia costruita dalla release anziche compilarla localmente, aggiungere al file `.env`:

```dotenv
IMAGE_NAME=ghcr.io/moffoletta/pixel-print-lab:0.1.0
```

Quindi eseguire:

```sh
docker compose pull app
docker compose up -d --no-build
```

Il primo avvio applica le migrazioni e inserisce il catalogo dimostrativo. L'applicazione e disponibile su `http://localhost:3000`; il pannello amministrativo si trova su `/admin.html`.

Le credenziali Docker predefinite sono `admin` / `admin`. Sono adatte soltanto a una prova locale: modificare `ADMIN_PASSWORD` nel file `.env` o nella sezione `environment` di `compose.yml` prima di rendere il servizio accessibile dalla rete.

`compose.yml` permette di configurare tutte le variabili runtime tramite il file `.env`, l'ambiente della shell oppure una modifica diretta alla sezione `environment`:

| Variabile | Valore predefinito | Uso |
| --- | --- | --- |
| `ADMIN_USERNAME` | `admin` | Nome utente amministrativo |
| `ADMIN_PASSWORD` | `admin` | Password amministrativa da modificare prima della pubblicazione |
| `HOST_PORT` | `3000` | Porta pubblicata dall'host |
| `BIND_ADDRESS` | `127.0.0.1` | Interfaccia di ascolto dell'host |
| `PORT` | `3000` | Porta interna del container |
| `IMAGE_NAME` | `pixel-print-lab:local` | Nome dell'immagine costruita |
| `DATABASE_PATH` | `/app/data/pixel-print-lab.db` | Percorso SQLite nel container |
| `UPLOAD_DIRECTORY` | `/app/storage/uploads` | Upload temporanei |
| `ORDER_FILE_DIRECTORY` | `/app/storage/orders` | Modelli associati agli ordini |
| `EMAIL_OUTBOX_DIRECTORY` | `/app/storage/emails` | Email simulate |
| `CATALOG_DIRECTORY` | `/app/storage/catalog` | Asset amministrativi del catalogo |

I volumi nominati `database` e `storage` conservano i dati durante ricostruzioni e aggiornamenti. `docker compose down` non li elimina; `docker compose down --volumes` cancella invece definitivamente database, ordini e asset.

Il bind predefinito accetta connessioni soltanto dall'host ed e adatto a un reverse proxy locale. Impostare `BIND_ADDRESS=0.0.0.0` soltanto se la porta deve essere raggiungibile direttamente dalla rete. I percorsi runtime devono restare sotto `/app/data` e `/app/storage`, a meno di aggiungere i volumi corrispondenti in Compose.

Per aggiornare il progetto:

```sh
git pull
docker compose up -d --build
```

Per controllare stato e log:

```sh
docker compose ps
docker compose logs -f app
```

Prima di un backup arrestare il servizio e archiviare entrambi i volumi indicati da `docker volume ls`. SQLite e storage devono essere ripristinati insieme. Su Internet, pubblicare l'applicazione dietro un reverse proxy HTTPS e non esporre direttamente la porta del container se non necessario.

## API Locali

- `GET /api/products`: prodotti visibili.
- `GET /api/products/:id`: dettaglio di un prodotto.
- `GET /api/colors`: colori attivi.
- `POST /api/custom-models/upload`: caricamento temporaneo e ispezione di un file STL o 3MF.
- `POST /api/custom-models/link`: validazione di un link esterno.
- `DELETE /api/custom-models/:id`: eliminazione di un upload temporaneo.
- `POST /api/orders`: creazione di una richiesta persistente.
- `GET /api/orders`: elenco pubblico limitato a codice richiesta e stato.
- `/api/admin/*`: autenticazione e gestione protetta di richieste, prodotti, asset e colori.

## Documentazione

- [`docs/ROADMAP.md`](docs/ROADMAP.md): Kanban e avanzamento.
- [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md): schema grafico, componenti e flussi dell'applicazione.
- [`docs/guida-progetto.md`](docs/guida-progetto.md): guida tecnica progressiva.
- [`docs/esercizi.md`](docs/esercizi.md): esercizi didattici separati.
- [`CHANGELOG.md`](CHANGELOG.md): modifiche incluse nelle versioni pubblicate.

## Release E Licenza

Le versioni stabili sono pubblicate nella pagina [Releases](https://github.com/Moffoletta/pixel-print-lab/releases). I tag seguono il versionamento semantico e generano automaticamente l'immagine Docker su `ghcr.io/moffoletta/pixel-print-lab`.

Il progetto e distribuito con licenza [MIT](LICENSE).
