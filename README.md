# Pixel Print Lab

[![Test](https://github.com/Moffoletta/pixel-print-lab/actions/workflows/test.yml/badge.svg)](https://github.com/Moffoletta/pixel-print-lab/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/Moffoletta/pixel-print-lab)](https://github.com/Moffoletta/pixel-print-lab/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Applicazione personale per raccogliere richieste di stampa 3D da un catalogo o da file STL e 3MF forniti dagli utenti.

Gli utenti possono inviare richieste come ospiti oppure creare un account per ritrovare il proprio storico. L'amministratore usa lo stesso accesso e, dopo il login con le credenziali configurate sul server, puo aprire la Control Room direttamente dall'area account.

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

Dal menu con la rotella della Control Room l'amministratore puo cambiare nome utente e password. Le credenziali personalizzate sono salvate nel database e hanno la precedenza su quelle d'ambiente; dopo il cambio e richiesto un nuovo accesso. Per ripristinare le credenziali delle variabili d'ambiente:

```powershell
npm.cmd run admin:reset
```

Con Docker il ripristino si esegue nel container: `docker compose exec app node src/reset-admin.js`.

`db:setup` applica le migrazioni SQLite e inserisce i prodotti e i colori dimostrativi. Il comando puo essere ripetuto senza creare duplicati.

Su questo computer viene usato `npm.cmd` perche PowerShell impedisce l'esecuzione di `npm.ps1`. Non e necessario cambiare la policy di sicurezza.

## Test

```powershell
npm.cmd test
```

## Avvio Con Docker

Sono richiesti Docker Engine con il plugin Compose oppure Docker Desktop.

Avviare l'applicazione:

```sh
docker compose pull
docker compose up -d
docker compose ps
```

Il primo avvio applica le migrazioni e inserisce il catalogo dimostrativo. L'applicazione e disponibile su `http://localhost:3000`; il pannello amministrativo si trova su `/admin.html`.

### Configurazione

Il file Compose usa l'immagine pubblica `ghcr.io/moffoletta/pixel-print-lab:latest` e configura porta e persistenza. Le variabili sono presenti come commenti: scommentare la sezione `environment` e soltanto le righe necessarie. Per accedere alla Control Room sono indispensabili `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

| Variabile | Valore predefinito | Uso |
| --- | --- | --- |
| `ADMIN_USERNAME` | nessuno | Nome utente amministrativo iniziale |
| `ADMIN_PASSWORD` | nessuno | Password amministrativa iniziale |
| `TRUST_PROXY` | `false` | Impostare `true` dietro un reverse proxy HTTPS fidato |
| `PORT` | `3000` | Porta interna del container |
| `DATABASE_PATH` | `/app/data/pixel-print-lab.db` | Percorso SQLite nel container |
| `UPLOAD_DIRECTORY` | `/app/storage/uploads` | Upload temporanei |
| `ORDER_FILE_DIRECTORY` | `/app/storage/orders` | Modelli associati agli ordini |
| `CATALOG_DIRECTORY` | `/app/storage/catalog` | Asset amministrativi del catalogo |
| `SMTP_HOST` | vuoto | Host del server SMTP |
| `SMTP_PORT` | `587` | Porta SMTP |
| `SMTP_SECURE` | `false` | `true` per TLS diretto, normalmente sulla porta 465 |
| `SMTP_USER` | vuoto | Utente SMTP facoltativo |
| `SMTP_PASSWORD` | vuoto | Password SMTP, richiesta insieme all'utente |
| `SMTP_FROM` | vuoto | Mittente delle notifiche |
| `SMTP_TO` | vuoto | Destinatario delle notifiche ordine |

Se si cambia `PORT`, aggiornare anche il lato destro della mappatura in `ports`. Utente e password SMTP devono essere configurati entrambi oppure lasciati entrambi vuoti. Per TLS diretto, normalmente sulla porta 465, usare `SMTP_SECURE: true`; sulla porta 587 usare normalmente `false` per STARTTLS.

L'invio email e disattivato per impostazione predefinita. Dopo aver configurato SMTP, aprire il pannello admin, selezionare la rotella e attivare "Email nuovi ordini". Un errore SMTP viene registrato ma non annulla un ordine gia salvato.

### Persistenza E Backup

I named volumes `pixel-print-lab-data` e `pixel-print-lab-storage` conservano database, ordini e asset senza richiedere la configurazione dei permessi delle directory host. I dati persistono dopo `docker compose down` o la ricostruzione del container. Il comando `docker compose down -v`, invece, elimina anche i volumi e deve essere usato soltanto quando si vogliono cancellare definitivamente tutti i dati.

Per un backup coerente:

```sh
docker compose stop
docker compose run --rm --no-deps --entrypoint tar app -czf - -C /app data storage > pixel-print-lab-backup.tar.gz
docker compose start
```

Il backup contiene il database SQLite e tutti i file runtime presenti nei due volumi.

#### Migrazione Dai Bind Mount

Le installazioni precedenti alla migrazione ai named volumes usavano le directory host `./data` e `./storage`. Prima di aggiornare il Compose, arrestare il vecchio container e creare un archivio:

```sh
docker compose stop
tar -czf pixel-print-lab-bind-backup.tar.gz data storage
```

Dopo aver installato il nuovo `compose.yml`, inizializzare i volumi e importarvi l'archivio prima del primo avvio dell'applicazione:

```sh
docker compose run --rm --no-deps \
  -v "$PWD/pixel-print-lab-bind-backup.tar.gz:/tmp/backup.tar.gz:ro" \
  --entrypoint tar app -xzf /tmp/backup.tar.gz -C /app
docker compose up -d
```

Verificare ordini e catalogo prima di eliminare le vecchie directory. Senza questa importazione Docker crea un database vuoto nei nuovi volumi, mentre i dati precedenti restano nelle directory host ma non vengono montati.

### Immagine Docker

Il Compose usa l'immagine pubblicata con il tag `latest`:

```yaml
image: ghcr.io/moffoletta/pixel-print-lab:latest
```

Il tag `latest` viene aggiornato quando viene pubblicata una nuova release. Per installare l'immagine aggiornata, eseguire `docker compose pull` e `docker compose up -d`.

Per aggiornare il progetto:

```sh
git pull
docker compose pull
docker compose up -d
```

Per controllare stato e log:

```sh
docker compose ps
docker compose logs -f app
```

Su Internet, pubblicare l'applicazione dietro un reverse proxy HTTPS, impostare `TRUST_PROXY: "true"` e proteggere la porta 3000 con il firewall quando non deve essere raggiunta direttamente. Non attivare `TRUST_PROXY` quando client non fidati possono raggiungere direttamente la porta applicativa.

### Pubblicazione Con Cloudflare Tunnel

`compose.cloudflare.yml` pubblica l'applicazione tramite Cloudflare Tunnel senza associare la porta applicativa a una porta del NAS. I container comunicano sulla rete privata Compose e `TRUST_PROXY` viene attivato automaticamente.

1. Aggiungere un dominio a Cloudflare e creare un tunnel da **Zero Trust > Networks > Tunnels**.
2. Nella configurazione del tunnel aggiungere un hostname pubblico HTTPS con servizio di origine `http://app:3000`.
3. Copiare `.env.cloudflare.example` in `.env`, scegliere credenziali amministrative uniche e robuste e inserire il token del tunnel in `TUNNEL_TOKEN`. Non versionare `.env`.
4. Arrestare lo stack esistente senza eliminare i volumi e avviare il Compose dedicato:

```sh
docker compose stop
docker compose -f compose.cloudflare.yml pull
docker compose -f compose.cloudflare.yml up -d
docker compose -f compose.cloudflare.yml ps
```

Non usare `docker compose down -v`: l'opzione `-v` elimina database e storage. Se il progetto Compose o il nome dello stack vengono cambiati nell'interfaccia del NAS, verificare prima dell'avvio che i due named volume esistenti vengano riutilizzati. Dopo la verifica del dominio pubblico, rimuovere dal NAS l'eventuale regola firewall o port forwarding per la porta host precedentemente associata all'applicazione.

Per controllare il tunnel e l'applicazione:

```sh
docker compose -f compose.cloudflare.yml logs -f cloudflared app
```

## API Locali

- `GET /api/products`: prodotti visibili.
- `GET /api/products/:id`: dettaglio di un prodotto.
- `GET /api/colors`: colori attivi.
- `POST /api/custom-models/upload`: caricamento temporaneo e ispezione di un file STL o 3MF.
- `POST /api/custom-models/link`: validazione di un link esterno.
- `DELETE /api/custom-models/:id`: eliminazione di un upload temporaneo.
- `POST /api/orders`: creazione di una richiesta persistente.
- `GET /api/orders`: elenco pubblico limitato a codice richiesta e stato.
- `/api/account/*`: registrazione, login, logout, sessione e storico personale.
- `/api/admin/*`: autenticazione e gestione protetta di richieste, prodotti, asset, colori, impostazioni e credenziali amministrative.

## Documentazione

- [`docs/ROADMAP.md`](docs/ROADMAP.md): Kanban e avanzamento.
- [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md): schema grafico, componenti e flussi dell'applicazione.
- [`docs/guida-progetto.md`](docs/guida-progetto.md): guida tecnica progressiva.
- [`CHANGELOG.md`](CHANGELOG.md): modifiche incluse nelle versioni pubblicate.

## Release E Licenza

Le versioni stabili sono pubblicate nella pagina [Releases](https://github.com/Moffoletta/pixel-print-lab/releases). I tag seguono il versionamento semantico e generano automaticamente l'immagine Docker su `ghcr.io/moffoletta/pixel-print-lab`.

Il progetto e distribuito con licenza [MIT](LICENSE).
