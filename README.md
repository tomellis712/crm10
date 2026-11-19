# Orbit CRM

## Run the application

From the repository root, install dependencies and start both the API and frontend:

```sh
npm install
npm run dev
```

The Webpack development server serves the frontend at `http://localhost:5173`,
and proxies `/api` requests to the API at `http://localhost:5000`. Run
`npm run build` from the repository root to create the production frontend in
`frontend/dist/`.

## Run without a backend

1. From `frontend/`, install packages with `npm install`.
2. Start the frontend: `npm run dev:client`.
3. Use a local demo account: Admin `jamie@studionorth.co` / `admin123`, Manager `taylor@studionorth.co` / `manager123`, or Member `alex@studionorth.co` / `member123`.

Standalone mode stores accounts, sessions, and CRM data in this browser. It supports signup, sign-in, profile editing, and Admin user management, but its authentication and role checks are not secure for production. Do not use real credentials.

## MongoDB backend

The Express API lives in `frontend/api/`. Copy `frontend/.env.example` to `frontend/.env`, configure `MONGODB_URI` with your MongoDB connection string, and set a random `SESSION_SECRET` of at least 32 characters. `API_ENABLED=true` makes the frontend use the API; API and network errors are shown rather than silently switching writes to browser storage. Run `npm run seed:admin` from the repository root once to create an Admin account, then run `npm run dev` from the root to start the API and frontend together. The API hashes passwords, stores sessions in MongoDB, sets an HttpOnly cookie, assigns self-registered users the Member role, and enforces Admin-only user-management routes.

The existing `MONGO_URI` variable is also accepted as an alias. For MongoDB Atlas, use the connection string from your cluster, create a database user, and allow your development machine's IP in Network Access. Keep `.env` private; it is excluded from version control.

For production, use HTTPS, a strong private session secret, set `NODE_ENV=production` and `CLIENT_ORIGIN` to the deployed frontend origin, and configure the web server to proxy `/api` to the Node API.
