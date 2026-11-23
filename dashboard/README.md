# Lifestyle OS usage dashboard

Private, read-only page with aggregate usage numbers. A separate Next.js app, deployed as its own Vercel project (Root Directory `dashboard`).

```bash
npm install
npm run dev     # http://localhost:3001, mock data until DASHBOARD_DATABASE_URL is set
npm test
```

Env: copy `.env.example` to `.env.local` and set `DASHBOARD_DATABASE_URL` (the `dashboard_reader` pooler connection string). On Vercel set the same variable for Production.

What it shows, the privacy model, the one-time database setup and the deploy steps are in the root [README](../README.md#usage-dashboard). The database objects are listed under [Database schema](../README.md#database-schema).
