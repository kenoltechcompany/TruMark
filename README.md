# TruMark

A federated, open-source attendance system using facial recognition, GPS geofencing, and self-sovereign school infrastructure. Students check in from a mobile app. Lecturers manage sessions from a web dashboard. Each school runs its own instance.

---

## Architecture

TruMark has three main components:

**Backend (NestJS + PostgreSQL + Prisma):** REST API handling authentication, dual-role access control (Admin and Course Rep), session management, student onboarding, Azure Face identity verification, geofence validation via Haversine distance, attendance recording, and CSV export. Course Representatives are linked to enrolled Student profiles so their own attendance is tracked seamlessly.

**Web Dashboard (React + Vite + Tailwind):** Full CRUD interfaces styled following the Primer-inspired Shinaa design system:
- Admin panel for managing course reps, academic classes, classrooms (with geolocation capture), and a global student roster audit.
- Course rep panel for managing class sessions, viewing live attendance, toggleable self-registration links, generating session QR codes, syncing face data to Azure, and CSV export.

**Mobile App (Expo + React Native):** A school discovery screen fetches the institution registry. Students select their school, scan the lecturer's session QR code (or enter the session ID), and verify attendance with a front-camera selfie and high-accuracy GPS coordinates.

**Database (PostgreSQL):** Stores admins, course reps (with optional student links), classes, classrooms, students (with Azure person IDs), sessions, and attendance records.

---

## Docker Quickstart

The fastest way to deploy your own instance is via Docker Compose.

**Prerequisites:** Docker and Docker Compose installed on your server.

**Step 1:** Clone the repository.

```
git clone https://github.com/your-org/trumark.git
cd trumark
```

**Step 2:** Configure environment variables.

```
cp .env.example .env
```

Edit `.env` and set a secure `JWT_SECRET` and database password. Azure Face is optional (face check-in will be skipped if not configured).

**Step 3:** Start all services.

```
docker compose up -d
```

**Step 4:** Run the database migration.

```
docker compose exec trumark-backend bunx prisma migrate dev --name init
```

**Step 5:** Access the dashboard at `http://localhost`. Create an admin account via the CLI tool:

```
docker compose exec trumark-backend bun run create:admin admin password123
```

**Stopping:**

```
docker compose down
```

Add `-v` to also remove the database volume.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_DB` | Yes | `trumark` | PostgreSQL database name |
| `POSTGRES_USER` | Yes | `trumark` | PostgreSQL user |
| `POSTGRES_PASSWORD` | Yes | `trumark_secret` | PostgreSQL password (change for production) |
| `JWT_SECRET` | Yes | `change-me-in-production` | Secret key for signing auth tokens |
| `AZURE_FACE_ENDPOINT` | No | -- | Azure Face API endpoint URL |
| `AZURE_FACE_KEY` | No | -- | Azure Face API key |

---

## Federated Network Guide

TruMark is designed as a federated system. Each school hosts its own backend and database. The mobile app discovers schools from a central registry.

### How It Works

The mobile app fetches a JSON file listing all participating schools. This file lives at:

```
https://raw.githubusercontent.com/trumark/schools/main/schools.json
```

The app also bundles a local fallback copy at `mobile/src/services/schools.json` so it works offline during development.

### Adding Your School

1. Fork the `trumark/schools` repository (or open a PR to this repo's `mobile/src/services/schools.json` for the built-in list).
2. Add an entry with your school's unique ID, display name, and the public URL of your backend server.

Example entry:

```json
{
  "id": "my-university",
  "name": "My University",
  "backendUrl": "https://attendance.myuni.edu"
}
```

3. Submit a Pull Request. Once merged, your school will appear in the mobile app's school picker for all users.

---

## Development & Testing Setup

**Prerequisites:** Node.js 22+, Bun, PostgreSQL running locally.

**Backend:**

```bash
cd backend
cp .env.example .env  # edit DATABASE_URL for local Postgres
bun install
bunx prisma generate
bun run test         # runs Jest unit test suite
bun run build        # builds production NestJS bundle
bun run start:dev
```

**Frontend:**

```bash
cd frontend
bun install
bun test             # runs frontend unit test suite
bun run build        # builds production Vite assets
bun run dev
```

The frontend proxies `/api` requests to `http://localhost:3000` by default.

**Mobile:**

```bash
cd mobile
bun install
bun run typecheck    # typechecks TypeScript sources
bun start
```

---

## License

This project is open source. See the LICENSE file for details.
