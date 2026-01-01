# Olieterminal Rørinspektioner

En webapplikation til at administrere rørinspektioner på en olieterminal med interaktive P&ID tegninger.

## Funktioner

- **PDF Upload**: Upload P&ID procesdiagrammer som PDF
- **Interaktiv tegning**: Marker rør direkte på tegningen
- **KKS Nummerering**: Tildel KKS-numre til hvert rør
- **Status tracking**: Marker rør som OK, Advarsel, Kritisk eller Ikke inspiceret
- **Metadata**: Gem materiale, diameter, inspektionsdatoer m.m.

## Teknologier

- **Frontend**: React + TypeScript + Vite
- **PDF Rendering**: PDF.js
- **Canvas/Tegning**: Fabric.js
- **State Management**: Zustand
- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)

## Installation

```bash
# Installer alle dependencies
npm run install:all
```

## Udvikling

```bash
# Start både frontend og backend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Produktion

```bash
# Byg frontend
npm run build
```

## API Endpoints

### Diagrams
- `GET /api/diagrams` - Hent alle diagrammer
- `GET /api/diagrams/:id` - Hent et diagram med annotations
- `POST /api/diagrams` - Upload nyt diagram (multipart/form-data med 'pdf' felt)
- `DELETE /api/diagrams/:id` - Slet diagram

### Annotations
- `POST /api/diagrams/:diagramId/annotations` - Opret annotation
- `PUT /api/annotations/:id` - Opdater annotation
- `DELETE /api/annotations/:id` - Slet annotation

### Stats
- `GET /api/stats` - Hent statistik over alle inspektioner

## Deployment (Webdock)

1. Klon repository til server
2. Kør `npm run install:all`
3. Byg frontend: `npm run build`
4. Start backend med process manager (PM2): `pm2 start backend/dist/index.js`
5. Konfigurer nginx til at serve frontend static filer og proxy API requests

## Mappestruktur

```
inspektioner/
├── frontend/           # React frontend
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/# React komponenter
│   │   ├── store/     # Zustand state
│   │   └── types/     # TypeScript types
│   └── ...
├── backend/            # Express backend
│   ├── src/
│   │   ├── database.ts # SQLite setup
│   │   └── index.ts    # Express server
│   ├── uploads/        # Uploadede PDF'er
│   └── data/           # SQLite database
└── package.json        # Root scripts
```
