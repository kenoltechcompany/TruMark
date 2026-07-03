
# Contributing to TruMark

Thanks for your interest in contributing. TruMark is a federated, open-source attendance system, and we welcome contributions from developers, testers, and university IT teams.

---

## Getting Started (Local Development)

1. Fork the repository.
2. Clone your fork:

```
git clone https://github.com/YOUR_USERNAME/trumark.git
cd trumark
```

3. Set up the backend:

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL to point to your local PostgreSQL instance
bun install
bunx prisma migrate dev --name init
bun run start:dev
```

4. In a separate terminal, set up the frontend:

```bash
cd frontend
bun install
bun run dev
```

5. For mobile development:

```bash
cd mobile
bun install
bun start
```

The backend runs on port 4000. The frontend runs on port 5173 and proxies `/api` calls to the backend.

---

## Project Structure

```
trumark/
  backend/         # NestJS REST API
  frontend/        # React + Vite web dashboard
  mobile/          # Expo React Native app
  docker-compose.yml
  .env.example
```

---

## Making a Pull Request

1. Create a feature branch from `main`:

```
git checkout -b feat/my-feature
```

2. Make your changes. Keep commits atomic and descriptive.
3. Ensure both projects build without errors:

```bash
cd backend && bun run build
cd frontend && bun run build
```

4. Push your branch and open a Pull Request.

---

## Code Style

- TypeScript throughout the backend and frontend.
- Use the Shinaa Design System tokens from `DESIGN.md` for any UI work.
- All data tables must use the shared `DataTable` component with search, checkboxes, and bulk actions.
- No em dashes in any documentation or comments.

---

## Reporting Issues

Open a GitHub issue with a clear title and description. Include steps to reproduce, expected behavior, and actual behavior. Screenshots help.
