
# TruMark

A federated, open-source attendance system using facial recognition, GPS geofencing, and self-sovereign school infrastructure. Students check in from a mobile app. Lecturers manage sessions from a web dashboard. Each school runs its own instance.

---

## Architecture

TruMark has three main components:

**Backend (NestJS + PostgreSQL + Prisma):** REST API handling authentication, session management, student onboarding, Azure Face identity verification, geofence validation via Haversine distance, attendance recording, and CSV export.

**Web Dashboard (React + Vite + Tailwind):** Two interfaces. An admin panel for managing course reps, classes, classrooms, and global student records. A course rep panel for running sessions, toggling self-registration links, syncing face data to Azure, and viewing attendance.

**Mobile App (Expo + React Native):** A school discovery screen fetches the institution list. Students select their school, enter a session ID, and check in with a selfie and GPS position. The app shows a full-screen green confirmation or red error.

**Database (PostgreSQL):** Stores admins, course reps, classes, classrooms, students (with Azure person IDs), sessions, and attendance records.

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
docker compose exec trumark-backend npx prisma migrate dev --name init
```

**Step 5:** Access the dashboard at `http://localhost`. Create an admin account via the API:

```
curl -X POST http://localhost/api/admins \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
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

### Self-Hosting Without the Registry

If you prefer not to register in the central list, you can build your own mobile app pointing to your backend by editing `mobile/src/services/schools.json` before building.

---

## Development Setup (Without Docker)

**Prerequisites:** Node.js 22+, Bun, PostgreSQL running locally.

**Backend:**

```bash
cd backend
cp .env.example .env  # edit DATABASE_URL for your local Postgres
bun install
bunx prisma migrate dev --name init
bun run start:dev
```

**Frontend:**

```bash
cd frontend
bun install
bun run dev
```

The frontend proxies `/api` requests to `http://localhost:4000` by default.

**Mobile:**

```bash
cd mobile
bun install
bun start
```

---

## License

This project is open source. See the LICENSE file for details.
