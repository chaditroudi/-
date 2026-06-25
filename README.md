# Date Harvest Hub

Date Harvest Hub is a Vite + React factory operations app for purchasing, reception, production, stock, logistics, alerts, and traceability.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn-ui
- Backend: Express + Mongoose
- Database: MongoDB
- Auth: JWT

## Run locally

1. Install dependencies.
2. Make sure MongoDB is running locally, or set `MONGODB_URI` in `.env` to your MongoDB Atlas connection string.
3. Start the API and frontend together.

```sh
npm install
npm run dev:full
```

Frontend runs on `http://localhost:8080`.
API runs on `http://localhost:4000`.

Local development behavior:

- Frontend changes under `src/` are picked up by Vite automatically.
- Backend changes under `server/` are picked up by `node --watch`.

The API keeps a dynamic collection layer, so the existing frontend modules can continue reading and writing the app's collections through the same generic endpoints.
MongoDB is required for app data. If Atlas is unavailable, the API still starts and `/health` reports `database_unavailable` while it retries.

For MongoDB Atlas setup, see [docs/mongodb-atlas-setup.md](/c:/Users/DELL/Desktop/date-harvest-hub-main/docs/mongodb-atlas-setup.md:1).

## Environment

The project now uses MongoDB-related variables:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/date_harvest_hub
MONGODB_DB_NAME=date_harvest_hub
JWT_SECRET=change-me-in-production
PORT=4000
VITE_API_URL=/api
```

Atlas example:

```env
MONGODB_URI=mongodb+srv://atlas_user:atlas_password@cluster-name.xxxxx.mongodb.net/date_harvest_hub?retryWrites=true&w=majority&appName=DateHarvestHub
MONGODB_DB_NAME=date_harvest_hub
JWT_SECRET=change-me-in-production
PORT=4000
VITE_API_URL=/api
```

## Default seeded admin

When the API starts on an empty database, it seeds this user:

- Email: `admin@ecodatte.local`
- Password: `Admin123!`

## Scripts

- `npm run dev`: API + frontend together
- `npm run server`: Express API only
- `npm run server:dev`: Express API only
- `npm run dev:full`: alias of `npm run dev`
- `npm run build`: production build

## Docker

Use Docker when you want the frontend and backend to run together with live reload.

1. Start the stack:

```sh
docker compose up --build
```

2. Open the app:

- Frontend: `http://localhost:8080`
- API: `http://localhost:4000/health`

In this mode:

- frontend changes under `src/` reload through Vite
- backend changes under `server/` restart the API automatically
- MongoDB Atlas is used from `MONGODB_URI` in `.env`
- the frontend container proxies `/api` to `http://api:4000` inside Docker

Stop the stack:

```sh
docker compose down
```

Stop the stack and remove Docker volumes too:

```sh
docker compose down -v
```

### Docker services

- `web`: Vite dev server with `/api` proxied to the backend
- `api`: Express + Mongoose backend connected to `MONGODB_URI` from `.env`
- `Dockerfile.dev`: shared dev image for both `api` and `web`

### Docker environment

The compose file uses these defaults:

```env
MONGODB_URI=mongodb+srv://atlas_user:atlas_password@cluster-name.xxxxx.mongodb.net/date_harvest_hub?retryWrites=true&w=majority&appName=DateHarvestHub
MONGODB_DB_NAME=date_harvest_hub
JWT_SECRET=change-me-in-production
DOCKER_API_HOST=0.0.0.0
DOCKER_API_PORT=4000
DOCKER_WEB_PORT=8080
DOCKER_VITE_API_URL=/api
```

Docker Compose reuses the app's `MONGODB_URI` by default so the API container connects to the same Atlas database as local development.
For production, use a long random `JWT_SECRET`.
# -
