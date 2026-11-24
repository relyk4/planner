# Planner

An offline dependency planner: objectives, features and tasks laid out by typed
dependencies (FS, SS, FF, SF), with milestones, external team dependencies,
releases, dates, a Grid view and a Gantt view. Plans, every saved version and a
change log live in one SQLite file on disk.

Nothing is downloaded at install or run time. The server uses only the Python 3
standard library (3.8 or newer), and the page uses system fonts and no outside
scripts.

## Run it

```sh
python3 server.py            # or ./start.sh, or double-click start.bat on Windows
```

Then open http://localhost:8080. Data goes to `data/planner.db` next to `server.py`.

Options (each also has an environment variable):

| Flag | Variable | Default | What it does |
|---|---|---|---|
| `--port` | `PLANNER_PORT` | `8080` | Port to listen on |
| `--host` | `PLANNER_HOST` | `127.0.0.1` | `0.0.0.0` lets other machines connect |
| `--data` | `PLANNER_DATA` | `./data` | Folder that holds `planner.db` |
| `--coalesce` | `PLANNER_COALESCE_SECONDS` | `120` | Autosaves from one person within this many seconds are grouped into one version |

Opening `static/index.html` straight from disk also works, but then plans are
kept only in that browser and there is no version history.

## Run it in Docker

```sh
docker compose up -d --build     # http://localhost:8080
```

Data lives in the `planner-data` volume. On an air-gapped network:

1. On a connected machine: `docker build -t planner:1.0.0 .` then `docker save planner:1.0.0 -o planner.tar`.
2. Carry `planner.tar` across and run `docker load -i planner.tar`.
3. `docker run -d -p 127.0.0.1:8080:8080 -v planner-data:/data --name planner planner:1.0.0`

If your registry already has an approved Python image, build against it instead:
`docker build --build-arg BASE_IMAGE=<your-python-image> -t planner:1.0.0 .`

## What it keeps

- **Plans**: listed in the left sidebar. New, duplicate, archive and restore.
- **Versions**: every save. One person's autosaves within two minutes merge into
  one version. *Save version* makes a named one. Any version can be restored
  (the state before the restore is kept too) or downloaded.
- **Change log**: one line per changed field, with who and when. Each item's
  editor has its own *Change history*.
- **Names**: set *Your name* at the bottom left. It is sent with each save and
  shown in history.

## Import and export

- *Import* takes `.csv` or `.xlsx` (Jira and Smartsheet exports work), and maps
  columns to fields: name, ticket key, type, epic/feature, owner, status, dates,
  dependencies and notes. Epics become features; stories and tasks go under
  their epic. Dependencies can be ticket keys (Jira "Inward issue link (Blocks)")
  or row numbers (Smartsheet "Predecessors").
- It also takes a plan `.json` or a full backup `.json` from this app.
- *More* > *Download backup of every plan* saves everything to one JSON file.

## Backups

Copy `planner.db` while the server is stopped, or use the backup download while
it runs. In Docker: `docker cp planner:/data/planner.db ./planner-backup.db`.

## Moving to a team server later

The data already records who made each change, and saves check for conflicts:
if someone else saved first, you choose to load their copy or keep yours (both
stay in history). To share it:

1. Run with `--host 0.0.0.0` (or change the compose port to `"8080:8080"`).
2. Put it behind your usual reverse proxy for TLS and sign-in. Planner has no
   login of its own yet; it trusts the name each person enters.

## Development

Start with [AGENTS.md](AGENTS.md); it's the guide for people and coding
agents alike. Then read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/DECISIONS.md](docs/DECISIONS.md) and [docs/BACKLOG.md](docs/BACKLOG.md).

```sh
python3 server.py --port 8090 --data .data-dev   # a dev copy that never touches data/
python3 -m unittest discover -s tests -v         # API tests, no installs
cd tests/ui && npm install && npm test           # optional UI smoke test (Node 18+)
```

## API

All JSON. Send `X-User: <name>` to attribute changes.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server check |
| GET | `/api/plans?archived=1` | List plans (archived ones with the flag) |
| POST | `/api/plans` | Create `{name, data}` or copy `{copy_from}` |
| GET | `/api/plans/{id}` | Plan with data and `rev` |
| PUT | `/api/plans/{id}` | Save `{data, base_rev}`; 409 if someone saved first |
| PATCH | `/api/plans/{id}` | `{name}` or `{archived: true/false}` |
| DELETE | `/api/plans/{id}` | Delete an archived plan for good |
| GET | `/api/plans/{id}/versions` | Version list |
| POST | `/api/plans/{id}/versions` | Named version `{note}` |
| GET | `/api/plans/{id}/versions/{vid}` | One version's data |
| POST | `/api/plans/{id}/restore` | Restore `{version_id}` |
| GET | `/api/plans/{id}/changes?item=&limit=&before=` | Change log |
| GET | `/api/export` | Every plan, for backup |
