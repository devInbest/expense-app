# Expense App

Expense tracker monorepo: a React Native (Expo) app for customers, an Express API and a superadmin portal.

- **Personal finance:** expenses and income with categories, monthly and category budgets with alerts, recurring transactions, insights, PDF statement export and receipt photos. Works offline: changes queue locally (SQLite) and sync when the phone is back online.
- **Rooms:** pick the type when creating a room.
  - **Split group:** shared expenses split equally, by exact amount, percent or shares; balances, simplified debts and settle-ups.
  - **Shared budget:** a pooled budget for a trip or household with per-member spending.
- **Admin portal:** usage dashboard, users (activity, devices, block, revoke sessions), rooms, audit log, app event explorer, broadcast push, system categories and a Control Center (theme, minimum app version, maintenance mode, admin accounts).

## Repository layout

```
apps/
  api/      Express 5 + Mongoose 8 (TypeScript), cron jobs, Vitest + Supertest
  admin/    React 19 + Vite + Mantine + Tailwind + TanStack Query
  mobile/   Expo (expo-router), TanStack Query, expo-sqlite outbox
packages/
  shared/        zod schemas, DTO types, enums, money and split math (shared by all three apps)
  api-client/    typed HTTP client with token refresh, query keys
  tsconfig/      base TypeScript configs
  eslint-config/ shared flat ESLint config
```

pnpm workspaces + Turborepo. Node 20+ and pnpm 10.

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env       # set MONGODB_URI (or run `docker compose up mongo`)
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev            # API on :5099 and admin portal on :5199
pnpm dev:mobile     # Expo dev server
```

- Admin portal: http://localhost:5199 (the Vite dev server proxies `/api` to the API)
- API health: http://localhost:5099/api/v1/health
- A superadmin is created on first boot from `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`. Change the password from **Account** after the first login.
- With `SMS_PROVIDER=console` the API logs OTP codes instead of sending SMS.

### Mobile app

Google sign-in and push notifications need native code, so the app runs in a **development build**, not Expo Go:

```bash
cd apps/mobile
npx eas-cli@latest build --profile development --platform android   # or ios / run locally: npx expo run:android
pnpm start
```

On a physical device set `EXPO_PUBLIC_API_URL` to your computer's LAN address (e.g. `http://192.168.1.20:5099/api/v1`). Google sign-in needs OAuth clients from Google Cloud; put the web client ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and in the API's `GOOGLE_CLIENT_IDS`.

EAS profiles (`apps/mobile/eas.json`): `development` (dev client), `preview` (internal APK) and `production` (store builds, auto-incremented version). Run them with `pnpm build:dev|build:preview|build:prod` inside `apps/mobile`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | API + admin portal in watch mode |
| `pnpm typecheck` / `pnpm lint` | All workspaces |
| `pnpm test` | Shared package (money/split math) and API integration tests (in-memory MongoDB) |
| `pnpm build` | API bundle (tsup) and admin static build |
| `pnpm cron` | Run scheduled jobs once locally |

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint, test and build on every push to `main` and on pull requests.

## Backend notes

- Modules live in `apps/api/src/modules/<name>/` (model, schema validation from `@expense/shared`, service, routes) and are mounted in `src/routes.ts`.
- **Auth:** Google ID tokens or phone OTP. Short-lived access JWTs plus rotating refresh tokens stored as sessions (one per device), so users and admins can revoke devices. Admins use a separate JWT secret and login.
- **Money** is stored as integer minor units (paise). The default currency is INR.
- **Offline sync:** the mobile app creates records with client-generated IDs, so retried writes from the outbox are idempotent.
- **Cron** (`src/cron.ts`, every 15 minutes on Render): recurring transactions, budget alerts (each threshold notifies once per period), invite expiry and daily usage stats.
- **Rate limits** (`src/core/rateLimits.ts`): global per IP, stricter limits on sign-in and OTP sends (plus per-phone limits), and per-user limits on writes.
- **Retention:** activity log entries expire after 365 days, app usage events after 90 days, notifications after 180 days (MongoDB TTL indexes).
- **Privacy:** only superadmins can view a user's transactions or room expenses in the portal, and every such view is written to the audit log.
- **Receipts** upload straight from the phone to S3-compatible storage with pre-signed URLs (`STORAGE_*`). Uploads are disabled when storage isn't configured.

## Admin portal notes

- Pages live in `apps/admin/src/pages`, routes in `App.tsx`, paths in `constants/index.ts`, nav items in `components/layout/Sidebar.tsx`.
- Server data goes through TanStack Query hooks using `@expense/api-client`. Redux only stores the color scheme and theme.
- **Themes:** palettes in `constants/themeColors.ts` and `premiumThemes.ts`, chosen in **Control Center → Theme**. Use `primary-*` / `brand-*` classes so new screens follow the theme.
- Roles: `superadmin` (everything, including admin accounts, broadcast and viewing private data) and `support` (read access plus blocking users and revoking sessions).

## Deploying

- **Render:** `render.yaml` defines the API (web service), the admin portal (static site) and the cron job. Set `MONGODB_URI`, `SUPERADMIN_PASSWORD` and the SMS, Google and storage keys in the dashboard, then point `ADMIN_URL` and `VITE_API_URL` at the assigned URLs.
- **Docker:** `docker compose up --build` runs MongoDB, the API (:5099) and the admin portal (:8099).
- **Mobile:** build and submit with EAS. Use Control Center → Mobile app to force updates (minimum app version) or show a maintenance screen.
