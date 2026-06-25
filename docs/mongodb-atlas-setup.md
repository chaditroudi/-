# MongoDB Atlas Setup

This project requires a reachable MongoDB instance before the API can start.

## 1. Create the Atlas project and cluster

1. Sign in to MongoDB Atlas.
2. Create a project for this application.
3. Create a cluster.
4. Wait until the cluster status becomes ready.

## 2. Create a database user

Create a database user with:

- a username
- a password
- read and write access for the application database

Keep the username and password safe. You will need them for the connection string.

## 3. Allow your IP address

In Atlas network access:

1. Add your current public IP address.
2. If you are testing temporarily from changing networks, update it again when your IP changes.

For development only, you can temporarily allow broad access, but this is not recommended for long-term use.

## 4. Get the connection string

From Atlas:

1. Open the cluster.
2. Click **Connect**.
3. Choose the driver connection option.
4. Copy the `mongodb+srv://...` connection string.

Replace:

- `<username>` with your Atlas database username
- `<password>` with your Atlas database password
- the database name with `date_harvest_hub`

Example:

```env
MONGODB_URI=mongodb+srv://atlas_user:atlas_password@cluster-name.xxxxx.mongodb.net/date_harvest_hub?retryWrites=true&w=majority&appName=DateHarvestHub
MONGODB_DB_NAME=date_harvest_hub
JWT_SECRET=change-me-in-production
PORT=4000
VITE_API_URL=/api
```

## 5. Put the URI in `.env`

Edit the local `.env` file and replace the current local URI with the Atlas one.

Current local value:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/date_harvest_hub
```

Replace it with your Atlas URI.

## 6. Start the app

After saving `.env`:

```powershell
npm run dev
```

The startup script now waits for the API. If Atlas is reachable, it starts:

- Express API on `http://localhost:4000`
- Vite frontend on `http://localhost:8080`

## 7. Quick verification

If the API starts correctly, you should see:

- `Mongoose connected: date_harvest_hub`
- `API listening on http://localhost:4000`

Then open:

- `http://localhost:8080`

## 8. Common issues

### `MongoDB is required for this application`

Cause:

- wrong Atlas URI
- wrong username or password
- IP not allowed in Atlas

### `ECONNREFUSED 127.0.0.1:27017`

Cause:

- `.env` still points to local MongoDB instead of Atlas

### Authentication failure

Cause:

- invalid database username or password
- special characters in the password not encoded correctly in the URI
