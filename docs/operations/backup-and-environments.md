# Environments, backup and restore

## Environments

The API declares what it is with `APP_ENV`, and reports it at `/api/health`.

| `APP_ENV` | Use | Database | Demo data | Ribbon |
|---|---|---|---|---|
| `production` | Live | Remote | Never | None |
| `staging` | Hosted test | Its own | Never | Préproduction |
| `live-dev` | The `:8080` stack on real data | Remote allowed | Never | Développement sur la base réelle |
| `dev` | Isolated development | Local only | Yes | Développement : données fictives |
| `test` | Automated runs | Local only | Yes | Environnement de test |
| not set | Existing stacks | Any | Local only | Environnement non déclaré |

Startup refuses `dev` or `test` on a remote database, an unknown value, and a production label that does not match `NODE_ENV`. `NODE_ENV=production` with no `APP_ENV` counts as production.

Before writing, scripts ask the API what it is: `assertTestStack` refuses anything but `test` or `dev` on a local database, including an older API that does not say.

A Vite server on any port but `8080` must set `VITE_API_PROXY_TARGET`, and may not point at `:4000`. Set `VITE_CACHE_DIR` for a test server beside `:8080`, so it cannot rewrite the running server's cache.

### Isolated development with hot reload

Hot reload for the API needs `npm run server:dev`; the commands below run the built server.

```bash
APP_ENV=dev PORT=4090 API_HOST=127.0.0.1 MONGODB_URI="mongodb://127.0.0.1:27327/?replicaSet=rs-reception" MONGODB_DB_NAME=dhh_dev JWT_SECRET=local-dev-secret-of-any-value node server-dist/index.js
```

```bash
VITE_DEV_PORT=8090 VITE_API_PROXY_TARGET=http://127.0.0.1:4090 VITE_CACHE_DIR=node_modules/.vite-dhh-dev npx vite
```

## Backup

`scripts/backup-db.mjs` uses the driver, so it needs no MongoDB tools. It writes one gzipped EJSON file per collection and a `manifest.json` with counts, indexes, content hashes and file checksums. It only reads the source.

```bash
MONGODB_URI="mongodb://127.0.0.1:27327/?replicaSet=rs-reception" MONGODB_DB_NAME=dhh_dev node scripts/backup-db.mjs
```

Backups hold password hashes and business records. `backups/` is git-ignored; store copies encrypted and off the machine. A remote source needs `--i-know --confirm-db=<name>`, and only its owner should decide that.

**This does not replace Atlas backups.** Confirm the cluster's backup tier and retention separately. It is not a point-in-time backup: documents written while it runs may or may not be included, so run it with writes stopped.

## Restore

Restores only into an empty database. It checks file checksums first, and the result against the manifest afterwards.

```bash
MONGODB_URI="mongodb://127.0.0.1:27327/?replicaSet=rs-reception" MONGODB_DB_NAME=dhh_restored node scripts/restore-db.mjs backups/<folder>
```

## Rehearsal

A backup nobody restored proves nothing. The rehearsal backs up a local database, restores into a throwaway copy, compares contents and indexes, confirms a damaged backup and a non-empty target are refused, reports the time, and removes its copy.

```bash
MONGODB_URI="mongodb://127.0.0.1:27327/?replicaSet=rs-reception" MONGODB_DB_NAME=<local database> node scripts/restore-rehearsal.mjs
```

Run one on a sanitized copy before a pilot and record the recovery time.

## Realtime

Events carry ids, never records, so a client reads through the API, where its role is checked. External accounts receive only what is addressed to them. A stream opens with a single-use ticket from `POST /api/realtime/ticket`, valid 30 seconds, and closes after 15 minutes so the next ticket proves the session still holds. Tickets and streams live in one API process: several instances would need sticky routing.
