# Copilot / AI assistant instructions for this repository

Purpose: give AI coding agents the concise, repo-specific context needed to be productive.

- **Big picture**: This is a monorepo with a React + TypeScript frontend (`frontend/`) built with Vite, and an Express + TypeScript backend (`backend/`) using `better-sqlite3` for a single-file SQLite DB. Frontend and backend run separately in development; the root `npm run dev` runs both via `concurrently`.

- **Key files**:
  - `backend/src/index.ts` — Express API routes, auth middleware, file upload handling, and route-level authorization (see `requireAuth` / `requireAdmin`).
  - `backend/src/database.ts` — SQLite schema, migrations, password hashing, and seed data (default `admin` user seeded with password `admin123`).
  - `frontend/src/api/client.ts` — central API client used across UI.
  - `frontend/src/components/` — where UI components (PDF viewer, annotation canvas, toolbar) live.

- **Data flows & important conventions**:
  - Diagrams (PDFs) are uploaded to `backend/uploads` and served statically at `/uploads`.
  - Annotations are persisted in the `annotations` table; the `points` column stores a JSON string of drawing coordinates. Backend code `JSON.parse`/`JSON.stringify` that field when returning/accepting payloads.
  - API uses snake_case column names in the DB; frontend sends/receives camelCase. Note: updates in `index.ts` convert incoming camelCase keys to snake_case before building SQL (see update-annotation logic).
  - Authentication is a simple in-memory session token (Bearer token) stored in `sessions` map — helpful for local dev, not production.

- **Dev / run commands (verified from `package.json`):**
  - Install all deps: `npm run install:all` (root)
  - Start both dev servers: `npm run dev` (root)
  - Frontend dev: `cd frontend && npm run dev` (Vite, default port 5173)
  - Backend dev: `cd backend && npm run dev` (uses `tsx watch src/index.ts`, default API port 3001)
  - Build frontend: `cd frontend && npm run build` (root `npm run build` wraps this)

- **Testing & debugging tips specific to this project**:
  - Inspect or reset the SQLite DB at `backend/data/inspektioner.db` to seed/inspect data; `backend/src/database.ts` contains `seedDefaultData()` and migration logic.
  - File uploads are restricted to PDFs (50MB) by multer config in `backend/src/index.ts` — watch `fileFilter` and `limits`.
  - To reproduce auth issues use seeded users: `admin` / `admin123` and `bruger` / `user123`.

- **Patterns and gotchas for code changes**:
  - When changing DB schema, update `backend/src/database.ts` and consider adding migration checks (pattern already present: `migrateAnnotationType`).
  - When modifying annotation shape, update both backend parsing (stringify/parse `points`) and frontend components that draw/read `points` (see `AnnotationCanvas.tsx` and `IsolationCanvas.tsx`).
  - Keep API route naming consistent: diagram endpoints under `/api/diagrams`, annotations under `/api/annotations` or `/api/diagrams/:diagramId/annotations`.
  - Avoid depending on the in-memory `sessions` for persistent auth; many admin-only checks rely on `requireAdmin`.

- **Integration & external deps to be aware of**:
  - Frontend: `pdfjs-dist`, `jspdf`, `fabric.js`-style canvas usage (see `AnnotationCanvas.tsx`).
  - Backend: `better-sqlite3`, `multer`, `express`, `uuid`.

- **How to modify safely**:
  - For DB migrations: add defensive `PRAGMA table_info(...)` checks like `migrateAnnotationType` before `ALTER TABLE`.
  - For uploads: maintain the multer `fileFilter` and `limits` settings; uploaded filenames are stored as UUID-prefixed names in `uploads/`.

If anything in this summary is unclear or you'd like me to expand examples (e.g., show the exact `POST` payload for creating an annotation, or document the frontend store usage in `frontend/src/store/`), tell me which section to expand and I'll iterate.
