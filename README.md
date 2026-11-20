# Orbit CRM — React + Express + MongoDB + Vercel

## Stack
- React 18
- React Router
- Webpack
- Node.js / Express 5
- MongoDB Atlas / Mongoose
- Express sessions stored in MongoDB
- Vercel

## Deploy to Vercel

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Keep the project root as the folder containing `package.json` and `vercel.json`.
4. In **Vercel → Project → Settings → Environment Variables**, add:

   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `SESSION_SECRET` = a long random secret
   - `API_ENABLED` = `true`
   - `NODE_ENV` = `production`

   If you use the optional admin seed script, also add `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` locally when running the seed.

5. In MongoDB Atlas, make sure the deployed Vercel function can reach the cluster. For a simple test deployment, Atlas Network Access can allow `0.0.0.0/0`; use a strong database password and tighten network access for production when appropriate.
6. Redeploy the Vercel project.

The frontend and API use the same Vercel domain. Browser requests such as `/api/auth/login` are rewritten to `api/index.js`, so the frontend does not need a hard-coded API URL.

## Test after deployment

Open:

`https://YOUR-VERCEL-DOMAIN/api/health`

Expected response:

```json
{"status":"ok","database":"connected"}
```

If the response says `database: "disconnected"` or returns `Database connection failed.`, check `MONGODB_URI` and MongoDB Atlas Network Access.

## Local development

Create `.env` from `.env.example`, then run:

```bash
npm install
npm run dev
```

The React development server runs on port 5173 and proxies `/api` to the Express server on port 5000.

## Security

- Do not commit `.env`.
- Do not put `MONGODB_URI` or `SESSION_SECRET` into React source code.
- If a real MongoDB password was previously committed or shared, rotate that password in MongoDB Atlas.
