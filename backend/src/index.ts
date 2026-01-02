import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db, { DiagramRow, AnnotationRow, UserRow, TerminalRow, LocationRow, InspectionRow, InspectionChecklistRow, InspectionTmlRow, InspectionImageRow, InspectionDocumentRow, IsolationPlanRow, IsolationPointRow, verifyPassword } from './database';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Static file serving for uploaded PDFs
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer configuration for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Kun PDF-filer er tilladt'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Simple session storage (in production, use Redis or database)
const sessions: Map<string, { userId: string; role: string; name: string }> = new Map();

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Ikke autoriseret' });
  }

  (req as any).user = sessions.get(token);
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Ikke autoriseret' });
  }

  const user = sessions.get(token);
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Kun administratorer har adgang' });
  }

  (req as any).user = user;
  next();
}

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Brugernavn og adgangskode er påkrævet' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Forkert brugernavn eller adgangskode' });
    }

    // Create session token
    const token = uuidv4();
    sessions.set(token, { userId: user.id, role: user.role, name: user.name });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fejlede' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    sessions.delete(token);
  }
  res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json(user);
});

// ============ TERMINAL ROUTES ============

// Get all terminals
app.get('/api/terminals', requireAuth, (req, res) => {
  try {
    const terminals = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM locations WHERE terminal_id = t.id) as location_count,
        (SELECT COUNT(*) FROM diagrams d
         JOIN locations l ON d.location_id = l.id
         WHERE l.terminal_id = t.id) as diagram_count
      FROM terminals t
      ORDER BY t.code
    `).all() as (TerminalRow & { location_count: number; diagram_count: number })[];

    res.json(terminals);
  } catch (error) {
    console.error('Error fetching terminals:', error);
    res.status(500).json({ error: 'Kunne ikke hente terminaler' });
  }
});

// Get single terminal with locations
app.get('/api/terminals/:id', requireAuth, (req, res) => {
  try {
    const terminal = db.prepare('SELECT * FROM terminals WHERE id = ?').get(req.params.id) as TerminalRow | undefined;

    if (!terminal) {
      return res.status(404).json({ error: 'Terminal ikke fundet' });
    }

    const locations = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM diagrams WHERE location_id = l.id) as diagram_count
      FROM locations l
      WHERE l.terminal_id = ?
      ORDER BY l.name
    `).all(req.params.id) as (LocationRow & { diagram_count: number })[];

    res.json({
      ...terminal,
      locations,
    });
  } catch (error) {
    console.error('Error fetching terminal:', error);
    res.status(500).json({ error: 'Kunne ikke hente terminal' });
  }
});

// Create terminal (admin only)
app.post('/api/terminals', requireAdmin, (req, res) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Navn og kode er påkrævet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO terminals (id, name, code, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, code.toUpperCase(), description || null, now, now);

    const terminal = db.prepare('SELECT * FROM terminals WHERE id = ?').get(id);
    res.status(201).json(terminal);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Terminal kode findes allerede' });
    }
    console.error('Error creating terminal:', error);
    res.status(500).json({ error: 'Kunne ikke oprette terminal' });
  }
});

// Update terminal (admin only)
app.put('/api/terminals/:id', requireAdmin, (req, res) => {
  try {
    const { name, description } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE terminals SET name = ?, description = ?, updated_at = ? WHERE id = ?
    `).run(name, description || null, now, req.params.id);

    const terminal = db.prepare('SELECT * FROM terminals WHERE id = ?').get(req.params.id);
    res.json(terminal);
  } catch (error) {
    console.error('Error updating terminal:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere terminal' });
  }
});

// ============ LOCATION ROUTES ============

// Get locations for a terminal
app.get('/api/terminals/:terminalId/locations', requireAuth, (req, res) => {
  try {
    const locations = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM diagrams WHERE location_id = l.id) as diagram_count
      FROM locations l
      WHERE l.terminal_id = ?
      ORDER BY l.name
    `).all(req.params.terminalId) as (LocationRow & { diagram_count: number })[];

    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Kunne ikke hente lokationer' });
  }
});

// Get single location with diagrams
app.get('/api/locations/:id', requireAuth, (req, res) => {
  try {
    const location = db.prepare(`
      SELECT l.*, t.name as terminal_name, t.code as terminal_code
      FROM locations l
      JOIN terminals t ON l.terminal_id = t.id
      WHERE l.id = ?
    `).get(req.params.id) as (LocationRow & { terminal_name: string; terminal_code: string }) | undefined;

    if (!location) {
      return res.status(404).json({ error: 'Lokation ikke fundet' });
    }

    const diagrams = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM annotations WHERE diagram_id = d.id) as annotation_count
      FROM diagrams d
      WHERE d.location_id = ?
      ORDER BY d.name
    `).all(req.params.id) as (DiagramRow & { annotation_count: number })[];

    res.json({
      ...location,
      diagrams,
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: 'Kunne ikke hente lokation' });
  }
});

// Create location (admin only)
app.post('/api/terminals/:terminalId/locations', requireAdmin, (req, res) => {
  try {
    const { terminalId } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Navn er påkrævet' });
    }

    // Verify terminal exists
    const terminal = db.prepare('SELECT id FROM terminals WHERE id = ?').get(terminalId);
    if (!terminal) {
      return res.status(404).json({ error: 'Terminal ikke fundet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO locations (id, terminal_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, terminalId, name, description || null, now, now);

    const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
    res.status(201).json(location);
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: 'Kunne ikke oprette lokation' });
  }
});

// Update location (admin only)
app.put('/api/locations/:id', requireAdmin, (req, res) => {
  try {
    const { name, description } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE locations SET name = ?, description = ?, updated_at = ? WHERE id = ?
    `).run(name, description || null, now, req.params.id);

    const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
    res.json(location);
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere lokation' });
  }
});

// Delete location (admin only)
app.delete('/api/locations/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Kunne ikke slette lokation' });
  }
});

// ============ DIAGRAM ROUTES ============

// Get all diagrams (optionally filtered by location)
app.get('/api/diagrams', requireAuth, (req, res) => {
  try {
    const { locationId } = req.query;

    let query = `
      SELECT d.*,
        (SELECT COUNT(*) FROM annotations WHERE diagram_id = d.id) as annotation_count,
        l.name as location_name,
        t.code as terminal_code
      FROM diagrams d
      LEFT JOIN locations l ON d.location_id = l.id
      LEFT JOIN terminals t ON l.terminal_id = t.id
    `;

    const params: any[] = [];
    if (locationId) {
      query += ' WHERE d.location_id = ?';
      params.push(locationId);
    }

    query += ' ORDER BY d.updated_at DESC';

    const diagrams = db.prepare(query).all(...params) as (DiagramRow & { annotation_count: number; location_name: string | null; terminal_code: string | null })[];

    res.json(diagrams);
  } catch (error) {
    console.error('Error fetching diagrams:', error);
    res.status(500).json({ error: 'Kunne ikke hente diagrammer' });
  }
});

// Get single diagram with annotations
app.get('/api/diagrams/:id', requireAuth, (req, res) => {
  try {
    const diagram = db.prepare(`
      SELECT d.*,
        l.name as location_name,
        l.id as location_id,
        t.code as terminal_code,
        t.id as terminal_id
      FROM diagrams d
      LEFT JOIN locations l ON d.location_id = l.id
      LEFT JOIN terminals t ON l.terminal_id = t.id
      WHERE d.id = ?
    `).get(req.params.id) as (DiagramRow & { location_name: string | null; terminal_code: string | null; terminal_id: string | null }) | undefined;

    if (!diagram) {
      return res.status(404).json({ error: 'Diagram ikke fundet' });
    }

    const annotations = db.prepare('SELECT * FROM annotations WHERE diagram_id = ?').all(req.params.id) as AnnotationRow[];

    // Parse points JSON for each annotation
    const parsedAnnotations = annotations.map((a) => ({
      ...a,
      points: JSON.parse(a.points),
    }));

    res.json({
      ...diagram,
      annotations: parsedAnnotations,
    });
  } catch (error) {
    console.error('Error fetching diagram:', error);
    res.status(500).json({ error: 'Kunne ikke hente diagram' });
  }
});

// Create new diagram (upload PDF) - admin only
app.post('/api/diagrams', requireAdmin, upload.single('pdf'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen PDF-fil uploadet' });
    }

    const id = uuidv4();
    const name = req.body.name || req.file.originalname.replace('.pdf', '');
    const locationId = req.body.locationId || null;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO diagrams (id, location_id, name, pdf_filename, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, locationId, name, req.file.filename, now, now);

    const diagram = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(id);

    res.status(201).json(diagram);
  } catch (error) {
    console.error('Error creating diagram:', error);
    res.status(500).json({ error: 'Kunne ikke oprette diagram' });
  }
});

// Update diagram (assign to location, rename) - admin only
app.put('/api/diagrams/:id', requireAdmin, (req, res) => {
  try {
    const { name, locationId } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE diagrams SET name = ?, location_id = ?, updated_at = ? WHERE id = ?
    `).run(name, locationId || null, now, req.params.id);

    const diagram = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(req.params.id);
    res.json(diagram);
  } catch (error) {
    console.error('Error updating diagram:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere diagram' });
  }
});

// Replace PDF for existing diagram - admin only
app.put('/api/diagrams/:id/replace-pdf', requireAdmin, upload.single('pdf'), (req, res) => {
  try {
    const diagram = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(req.params.id) as DiagramRow | undefined;

    if (!diagram) {
      return res.status(404).json({ error: 'Diagram ikke fundet' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Ingen PDF-fil uploadet' });
    }

    // Delete old PDF file
    const oldPdfPath = path.join(uploadsDir, diagram.pdf_filename);
    if (fs.existsSync(oldPdfPath)) {
      fs.unlinkSync(oldPdfPath);
    }

    // Update database with new PDF filename
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE diagrams SET pdf_filename = ?, updated_at = ? WHERE id = ?
    `).run(req.file.filename, now, req.params.id);

    const updatedDiagram = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(req.params.id);
    res.json(updatedDiagram);
  } catch (error) {
    console.error('Error replacing diagram PDF:', error);
    res.status(500).json({ error: 'Kunne ikke erstatte PDF' });
  }
});

// Delete diagram - admin only
app.delete('/api/diagrams/:id', requireAdmin, (req, res) => {
  try {
    const diagram = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(req.params.id) as DiagramRow | undefined;

    if (!diagram) {
      return res.status(404).json({ error: 'Diagram ikke fundet' });
    }

    // Delete PDF file
    const pdfPath = path.join(uploadsDir, diagram.pdf_filename);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    // Delete from database (cascades to annotations)
    db.prepare('DELETE FROM diagrams WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting diagram:', error);
    res.status(500).json({ error: 'Kunne ikke slette diagram' });
  }
});

// ============ ANNOTATION ROUTES ============

// Create annotation - admin only
app.post('/api/diagrams/:diagramId/annotations', requireAdmin, (req, res) => {
  try {
    const { diagramId } = req.params;
    const { kksNumber, points, color, strokeWidth, description, material, diameter, status, annotationType } = req.body;

    const diagram = db.prepare('SELECT id FROM diagrams WHERE id = ?').get(diagramId);
    if (!diagram) {
      return res.status(404).json({ error: 'Diagram ikke fundet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const type = annotationType || 'pipe';

    db.prepare(`
      INSERT INTO annotations (id, diagram_id, annotation_type, kks_number, points, color, stroke_width, description, material, diameter, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      diagramId,
      type,
      kksNumber,
      JSON.stringify(points),
      color || '#3b82f6',
      strokeWidth || 4,
      description || null,
      material || null,
      diameter || null,
      status || 'not_inspected',
      now,
      now
    );

    // Update diagram's updated_at
    db.prepare('UPDATE diagrams SET updated_at = ? WHERE id = ?').run(now, diagramId);

    const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as AnnotationRow;

    res.status(201).json({
      ...annotation,
      points: JSON.parse(annotation.points),
    });
  } catch (error) {
    console.error('Error creating annotation:', error);
    res.status(500).json({ error: 'Kunne ikke oprette annotation' });
  }
});

// Update annotation - admin only
app.put('/api/annotations/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existing = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as AnnotationRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Annotation ikke fundet' });
    }

    const now = new Date().toISOString();

    // Build update query dynamically
    const allowedFields = ['kks_number', 'points', 'color', 'stroke_width', 'description', 'material', 'diameter', 'last_inspection', 'next_inspection', 'status', 'annotation_type'];
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase(); // camelCase to snake_case
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(dbKey === 'points' ? JSON.stringify(value) : value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Ingen gyldige felter at opdatere' });
    }

    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE annotations SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    // Update diagram's updated_at
    db.prepare('UPDATE diagrams SET updated_at = ? WHERE id = ?').run(now, existing.diagram_id);

    const updated = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as AnnotationRow;

    res.json({
      ...updated,
      points: JSON.parse(updated.points),
    });
  } catch (error) {
    console.error('Error updating annotation:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere annotation' });
  }
});

// Delete annotation - admin only
app.delete('/api/annotations/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT diagram_id FROM annotations WHERE id = ?').get(id) as { diagram_id: string } | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Annotation ikke fundet' });
    }

    db.prepare('DELETE FROM annotations WHERE id = ?').run(id);

    // Update diagram's updated_at
    const now = new Date().toISOString();
    db.prepare('UPDATE diagrams SET updated_at = ? WHERE id = ?').run(now, existing.diagram_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    res.status(500).json({ error: 'Kunne ikke slette annotation' });
  }
});

// ============ SEARCH ROUTE ============

interface SearchResult {
  type: 'annotation' | 'terminal' | 'location' | 'diagram';
  id: string;
  title: string;
  subtitle: string;
  terminal_code?: string;
  status?: string;
  url: string;
}

app.get('/api/search', requireAuth, (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json({ results: [] });
    }

    const searchTerm = `%${q.trim()}%`;
    const results: SearchResult[] = [];

    // Search annotations (KKS numbers, descriptions)
    const annotations = db.prepare(`
      SELECT
        a.id, a.kks_number, a.description, a.status, a.material, a.diameter,
        d.id as diagram_id, d.name as diagram_name,
        l.name as location_name,
        t.code as terminal_code, t.id as terminal_id
      FROM annotations a
      JOIN diagrams d ON a.diagram_id = d.id
      LEFT JOIN locations l ON d.location_id = l.id
      LEFT JOIN terminals t ON l.terminal_id = t.id
      WHERE a.kks_number LIKE ?
        OR a.description LIKE ?
        OR a.material LIKE ?
      ORDER BY a.kks_number
      LIMIT 20
    `).all(searchTerm, searchTerm, searchTerm) as any[];

    for (const a of annotations) {
      results.push({
        type: 'annotation',
        id: a.id,
        title: a.kks_number,
        subtitle: [a.material, a.diameter, a.location_name].filter(Boolean).join(' • '),
        terminal_code: a.terminal_code,
        status: a.status,
        url: `/diagram/${a.diagram_id}?annotation=${a.id}`,
      });
    }

    // Search terminals
    const terminals = db.prepare(`
      SELECT id, name, code, description
      FROM terminals
      WHERE name LIKE ? OR code LIKE ? OR description LIKE ?
      ORDER BY code
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm) as any[];

    for (const t of terminals) {
      results.push({
        type: 'terminal',
        id: t.id,
        title: t.code,
        subtitle: t.name,
        terminal_code: t.code,
        url: `/terminal/${t.id}`,
      });
    }

    // Search locations
    const locations = db.prepare(`
      SELECT l.id, l.name, l.description, t.code as terminal_code, t.id as terminal_id
      FROM locations l
      JOIN terminals t ON l.terminal_id = t.id
      WHERE l.name LIKE ? OR l.description LIKE ?
      ORDER BY l.name
      LIMIT 10
    `).all(searchTerm, searchTerm) as any[];

    for (const l of locations) {
      results.push({
        type: 'location',
        id: l.id,
        title: l.name,
        subtitle: l.description || 'Lokation',
        terminal_code: l.terminal_code,
        url: `/terminal/${l.terminal_id}?location=${l.id}`,
      });
    }

    // Search diagrams
    const diagrams = db.prepare(`
      SELECT d.id, d.name, l.name as location_name, t.code as terminal_code, t.id as terminal_id
      FROM diagrams d
      LEFT JOIN locations l ON d.location_id = l.id
      LEFT JOIN terminals t ON l.terminal_id = t.id
      WHERE d.name LIKE ?
      ORDER BY d.name
      LIMIT 10
    `).all(searchTerm) as any[];

    for (const d of diagrams) {
      results.push({
        type: 'diagram',
        id: d.id,
        title: d.name,
        subtitle: d.location_name || 'Diagram',
        terminal_code: d.terminal_code,
        url: `/diagram/${d.id}`,
      });
    }

    res.json({ results, query: q.trim() });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Søgning fejlede' });
  }
});

// ============ STATS ROUTE ============

app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM terminals) as total_terminals,
        (SELECT COUNT(*) FROM locations) as total_locations,
        (SELECT COUNT(*) FROM diagrams) as total_diagrams,
        (SELECT COUNT(*) FROM annotations) as total_annotations,
        (SELECT COUNT(*) FROM annotations WHERE status = 'ok') as ok_count,
        (SELECT COUNT(*) FROM annotations WHERE status = 'warning') as warning_count,
        (SELECT COUNT(*) FROM annotations WHERE status = 'critical') as critical_count,
        (SELECT COUNT(*) FROM annotations WHERE status = 'not_inspected') as not_inspected_count
    `).get();

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Kunne ikke hente statistik' });
  }
});

// Extended dashboard statistics
interface DashboardBasicStats {
  total_terminals: number;
  total_locations: number;
  total_diagrams: number;
  total_annotations: number;
  total_inspections: number;
}

interface CountResult {
  count: number;
}

app.get('/api/stats/dashboard', requireAuth, (req, res) => {
  try {
    const { annotationType } = req.query;
    const typeFilter = annotationType && ['pipe', 'tank', 'component'].includes(annotationType as string)
      ? annotationType as string
      : null;
    const typeCondition = typeFilter ? `COALESCE(annotation_type, 'pipe') = '${typeFilter}'` : '1=1';

    // Basic counts
    const basicStats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM terminals) as total_terminals,
        (SELECT COUNT(*) FROM locations) as total_locations,
        (SELECT COUNT(*) FROM diagrams) as total_diagrams,
        (SELECT COUNT(*) FROM annotations WHERE ${typeCondition}) as total_annotations,
        (SELECT COUNT(*) FROM inspections i JOIN annotations a ON i.annotation_id = a.id WHERE ${typeCondition}) as total_inspections
    `).get() as DashboardBasicStats | undefined;

    // Annotation status breakdown
    const annotationStatus = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM annotations WHERE status = 'ok' AND ${typeCondition}) as ok_count,
        (SELECT COUNT(*) FROM annotations WHERE status = 'warning' AND ${typeCondition}) as warning_count,
        (SELECT COUNT(*) FROM annotations WHERE status = 'critical' AND ${typeCondition}) as critical_count,
        (SELECT COUNT(*) FROM annotations WHERE status = 'not_inspected' AND ${typeCondition}) as not_inspected_count
    `).get();

    // Inspection status breakdown
    const inspectionStatus = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM inspections i JOIN annotations a ON i.annotation_id = a.id WHERE overall_status = 'approved' AND ${typeCondition}) as approved_count,
        (SELECT COUNT(*) FROM inspections i JOIN annotations a ON i.annotation_id = a.id WHERE overall_status = 'conditional' AND ${typeCondition}) as conditional_count,
        (SELECT COUNT(*) FROM inspections i JOIN annotations a ON i.annotation_id = a.id WHERE overall_status = 'rejected' AND ${typeCondition}) as rejected_count,
        (SELECT COUNT(*) FROM inspections i JOIN annotations a ON i.annotation_id = a.id WHERE overall_status = 'pending' AND ${typeCondition}) as pending_count
    `).get();

    // Upcoming inspections (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const upcomingInspections = db.prepare(`
      SELECT COUNT(*) as count
      FROM annotations
      WHERE next_inspection IS NOT NULL
        AND date(next_inspection) <= date(?)
        AND date(next_inspection) >= date('now')
        AND ${typeCondition}
    `).get(thirtyDaysFromNow.toISOString().split('T')[0]) as CountResult | undefined;

    // Overdue inspections
    const overdueInspections = db.prepare(`
      SELECT COUNT(*) as count
      FROM annotations
      WHERE next_inspection IS NOT NULL
        AND date(next_inspection) < date('now')
        AND ${typeCondition}
    `).get() as CountResult | undefined;

    // Recent inspections (last 7 days)
    const recentInspections = db.prepare(`
      SELECT i.*, a.kks_number, t.code as terminal_code
      FROM inspections i
      JOIN annotations a ON i.annotation_id = a.id
      JOIN diagrams d ON a.diagram_id = d.id
      LEFT JOIN locations l ON d.location_id = l.id
      LEFT JOIN terminals t ON l.terminal_id = t.id
      WHERE date(i.created_at) >= date('now', '-7 days')
        AND ${typeCondition}
      ORDER BY i.created_at DESC
      LIMIT 5
    `).all();

    // Stats per terminal
    const terminalStats = db.prepare(`
      SELECT
        t.id,
        t.code,
        t.name,
        COUNT(DISTINCT CASE WHEN ${typeCondition} THEN a.id END) as annotation_count,
        SUM(CASE WHEN a.status = 'ok' AND ${typeCondition} THEN 1 ELSE 0 END) as ok_count,
        SUM(CASE WHEN a.status = 'warning' AND ${typeCondition} THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN a.status = 'critical' AND ${typeCondition} THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN a.status = 'not_inspected' AND ${typeCondition} THEN 1 ELSE 0 END) as not_inspected_count
      FROM terminals t
      LEFT JOIN locations l ON l.terminal_id = t.id
      LEFT JOIN diagrams d ON d.location_id = l.id
      LEFT JOIN annotations a ON a.diagram_id = d.id
      GROUP BY t.id, t.code, t.name
      ORDER BY t.code
    `).all();

    // TML measurements with alerts (critical measurements)
    const criticalMeasurements = db.prepare(`
      SELECT COUNT(*) as count
      FROM inspection_tml tml
      JOIN inspections i ON tml.inspection_id = i.id
      JOIN annotations a ON i.annotation_id = a.id
      WHERE tml.t_measured IS NOT NULL
        AND tml.t_alert IS NOT NULL
        AND tml.t_measured < tml.t_alert
        AND ${typeCondition}
    `).get() as CountResult | undefined;

    res.json({
      overview: {
        total_terminals: basicStats?.total_terminals || 0,
        total_locations: basicStats?.total_locations || 0,
        total_diagrams: basicStats?.total_diagrams || 0,
        total_annotations: basicStats?.total_annotations || 0,
        total_inspections: basicStats?.total_inspections || 0,
        upcoming_inspections: upcomingInspections?.count || 0,
        overdue_inspections: overdueInspections?.count || 0,
        critical_measurements: criticalMeasurements?.count || 0,
      },
      annotationStatus,
      inspectionStatus,
      terminalStats,
      recentInspections,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Kunne ikke hente dashboard statistik' });
  }
});

// ============ TERMINAL-SPECIFIC STATS ============

app.get('/api/stats/terminal/:terminalId', requireAuth, (req, res) => {
  try {
    const { terminalId } = req.params;
    const { annotationType } = req.query;
    const typeFilter = annotationType && ['pipe', 'tank', 'component'].includes(annotationType as string)
      ? annotationType as string
      : null;
    const typeCondition = typeFilter ? `COALESCE(a.annotation_type, 'pipe') = '${typeFilter}'` : '1=1';

    // Verify terminal exists
    const terminal = db.prepare('SELECT * FROM terminals WHERE id = ?').get(terminalId);
    if (!terminal) {
      return res.status(404).json({ error: 'Terminal ikke fundet' });
    }

    // Basic counts for this terminal
    const basicStats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM locations WHERE terminal_id = ?) as total_locations,
        (SELECT COUNT(*) FROM diagrams d
         JOIN locations l ON d.location_id = l.id
         WHERE l.terminal_id = ?) as total_diagrams,
        (SELECT COUNT(*) FROM annotations a
         JOIN diagrams d ON a.diagram_id = d.id
         JOIN locations l ON d.location_id = l.id
         WHERE l.terminal_id = ? AND ${typeCondition}) as total_annotations,
        (SELECT COUNT(*) FROM inspections i
         JOIN annotations a ON i.annotation_id = a.id
         JOIN diagrams d ON a.diagram_id = d.id
         JOIN locations l ON d.location_id = l.id
         WHERE l.terminal_id = ? AND ${typeCondition}) as total_inspections
    `).get(terminalId, terminalId, terminalId, terminalId) as any;

    // Annotation status breakdown for this terminal
    const annotationStatus = db.prepare(`
      SELECT
        SUM(CASE WHEN a.status = 'ok' AND ${typeCondition} THEN 1 ELSE 0 END) as ok_count,
        SUM(CASE WHEN a.status = 'warning' AND ${typeCondition} THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN a.status = 'critical' AND ${typeCondition} THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN a.status = 'not_inspected' AND ${typeCondition} THEN 1 ELSE 0 END) as not_inspected_count
      FROM annotations a
      JOIN diagrams d ON a.diagram_id = d.id
      JOIN locations l ON d.location_id = l.id
      WHERE l.terminal_id = ?
    `).get(terminalId);

    // Annotation type breakdown for this terminal (only shown when no type filter)
    const annotationTypes = typeFilter ? null : db.prepare(`
      SELECT
        SUM(CASE WHEN COALESCE(a.annotation_type, 'pipe') = 'pipe' THEN 1 ELSE 0 END) as pipe_count,
        SUM(CASE WHEN a.annotation_type = 'tank' THEN 1 ELSE 0 END) as tank_count,
        SUM(CASE WHEN a.annotation_type = 'component' THEN 1 ELSE 0 END) as component_count
      FROM annotations a
      JOIN diagrams d ON a.diagram_id = d.id
      JOIN locations l ON d.location_id = l.id
      WHERE l.terminal_id = ?
    `).get(terminalId);

    // Upcoming inspections for this terminal (next 90 days) - detailed list
    const upcomingInspections = db.prepare(`
      SELECT
        a.id,
        a.kks_number,
        a.next_inspection,
        a.status,
        a.material,
        a.diameter,
        d.id as diagram_id,
        d.name as diagram_name,
        l.name as location_name,
        julianday(a.next_inspection) - julianday('now') as days_until
      FROM annotations a
      JOIN diagrams d ON a.diagram_id = d.id
      JOIN locations l ON d.location_id = l.id
      WHERE l.terminal_id = ?
        AND a.next_inspection IS NOT NULL
        AND date(a.next_inspection) >= date('now')
        AND date(a.next_inspection) <= date('now', '+90 days')
        AND ${typeCondition}
      ORDER BY a.next_inspection ASC
      LIMIT 20
    `).all(terminalId);

    // Overdue inspections for this terminal
    const overdueInspections = db.prepare(`
      SELECT
        a.id,
        a.kks_number,
        a.next_inspection,
        a.status,
        a.material,
        a.diameter,
        d.id as diagram_id,
        d.name as diagram_name,
        l.name as location_name,
        julianday('now') - julianday(a.next_inspection) as days_overdue
      FROM annotations a
      JOIN diagrams d ON a.diagram_id = d.id
      JOIN locations l ON d.location_id = l.id
      WHERE l.terminal_id = ?
        AND a.next_inspection IS NOT NULL
        AND date(a.next_inspection) < date('now')
        AND ${typeCondition}
      ORDER BY a.next_inspection ASC
      LIMIT 20
    `).all(terminalId);

    // Recent inspections for this terminal
    const recentInspections = db.prepare(`
      SELECT
        i.*,
        a.kks_number,
        a.material,
        d.name as diagram_name,
        l.name as location_name
      FROM inspections i
      JOIN annotations a ON i.annotation_id = a.id
      JOIN diagrams d ON a.diagram_id = d.id
      JOIN locations l ON d.location_id = l.id
      WHERE l.terminal_id = ?
        AND ${typeCondition}
      ORDER BY i.created_at DESC
      LIMIT 10
    `).all(terminalId);

    // Stats per location in this terminal
    const locationStats = db.prepare(`
      SELECT
        l.id,
        l.name,
        COUNT(DISTINCT CASE WHEN ${typeCondition} THEN a.id END) as annotation_count,
        SUM(CASE WHEN a.status = 'ok' AND ${typeCondition} THEN 1 ELSE 0 END) as ok_count,
        SUM(CASE WHEN a.status = 'warning' AND ${typeCondition} THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN a.status = 'critical' AND ${typeCondition} THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN a.status = 'not_inspected' AND ${typeCondition} THEN 1 ELSE 0 END) as not_inspected_count
      FROM locations l
      LEFT JOIN diagrams d ON d.location_id = l.id
      LEFT JOIN annotations a ON a.diagram_id = d.id
      WHERE l.terminal_id = ?
      GROUP BY l.id, l.name
      ORDER BY l.name
    `).all(terminalId);

    // Critical TML measurements for this terminal
    const criticalMeasurements = db.prepare(`
      SELECT COUNT(*) as count
      FROM inspection_tml tml
      JOIN inspections i ON tml.inspection_id = i.id
      JOIN annotations a ON i.annotation_id = a.id
      JOIN diagrams d ON a.diagram_id = d.id
      JOIN locations l ON d.location_id = l.id
      WHERE l.terminal_id = ?
        AND tml.t_measured IS NOT NULL
        AND tml.t_alert IS NOT NULL
        AND tml.t_measured < tml.t_alert
        AND ${typeCondition}
    `).get(terminalId) as CountResult | undefined;

    // Inspection timeline summary (group upcoming by month)
    const inspectionTimeline = db.prepare(`
      SELECT
        strftime('%Y-%m', a.next_inspection) as month,
        COUNT(*) as count
      FROM annotations a
      JOIN diagrams d ON a.diagram_id = d.id
      JOIN locations l ON d.location_id = l.id
      WHERE l.terminal_id = ?
        AND a.next_inspection IS NOT NULL
        AND date(a.next_inspection) >= date('now')
        AND date(a.next_inspection) <= date('now', '+12 months')
        AND ${typeCondition}
      GROUP BY strftime('%Y-%m', a.next_inspection)
      ORDER BY month ASC
    `).all(terminalId);

    res.json({
      overview: {
        total_locations: basicStats?.total_locations || 0,
        total_diagrams: basicStats?.total_diagrams || 0,
        total_annotations: basicStats?.total_annotations || 0,
        total_inspections: basicStats?.total_inspections || 0,
        upcoming_count: upcomingInspections.length,
        overdue_count: overdueInspections.length,
        critical_measurements: criticalMeasurements?.count || 0,
      },
      annotationStatus: annotationStatus || { ok_count: 0, warning_count: 0, critical_count: 0, not_inspected_count: 0 },
      annotationTypes: annotationTypes || { pipe_count: 0, tank_count: 0, component_count: 0 },
      upcomingInspections,
      overdueInspections,
      recentInspections,
      locationStats,
      inspectionTimeline,
    });
  } catch (error) {
    console.error('Error fetching terminal stats:', error);
    res.status(500).json({ error: 'Kunne ikke hente terminal statistik' });
  }
});

// ============ USER MANAGEMENT (admin only) ============

app.get('/api/users', requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, name, role, created_at, updated_at FROM users ORDER BY name
    `).all();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Kunne ikke hente brugere' });
  }
});

// ============ INSPECTION IMAGE UPLOAD CONFIG ============

// Create inspection images directory
const inspectionImagesDir = path.join(__dirname, '..', 'uploads', 'inspection-images');
if (!fs.existsSync(inspectionImagesDir)) {
  fs.mkdirSync(inspectionImagesDir, { recursive: true });
}

// Multer config for inspection images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, inspectionImagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Kun billeder er tilladt'));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
  },
});

// Serve inspection images
app.use('/uploads/inspection-images', express.static(inspectionImagesDir));

// ============ INSPECTION DOCUMENT UPLOAD CONFIG ============

// Create inspection documents directory
const inspectionDocsDir = path.join(__dirname, '..', 'uploads', 'inspection-documents');
if (!fs.existsSync(inspectionDocsDir)) {
  fs.mkdirSync(inspectionDocsDir, { recursive: true });
}

// Multer config for inspection PDF documents
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, inspectionDocsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const docUpload = multer({
  storage: docStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Kun PDF-filer er tilladt'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Serve inspection documents
app.use('/uploads/inspection-documents', express.static(inspectionDocsDir));

// ============ INSPECTION ROUTES ============

// Default 19 inspection checklist items based on API RP 2611
const DEFAULT_CHECKLIST_ITEMS = [
  { number: 1, name: 'Overfladebehandling udvendig' },
  { number: 2, name: 'Overfladebehandling indvendig' },
  { number: 3, name: 'Isolering' },
  { number: 4, name: 'Mærkning' },
  { number: 5, name: 'Ophæng/understøtning' },
  { number: 6, name: 'Gevindsamlinger' },
  { number: 7, name: 'Flanger' },
  { number: 8, name: 'Ventiler' },
  { number: 9, name: 'Ekspansionselementer' },
  { number: 10, name: 'Dræn' },
  { number: 11, name: 'Trykaflastning' },
  { number: 12, name: 'Instrumentering' },
  { number: 13, name: 'Svejsninger' },
  { number: 14, name: 'Korrosion udvendig' },
  { number: 15, name: 'Erosion' },
  { number: 16, name: 'Revner' },
  { number: 17, name: 'Deformation' },
  { number: 18, name: 'Lækage' },
  { number: 19, name: 'Diverse' },
];

// Get all inspections for an annotation
app.get('/api/annotations/:annotationId/inspections', requireAuth, (req, res) => {
  try {
    const { annotationId } = req.params;

    const inspections = db.prepare(`
      SELECT i.*
      FROM inspections i
      WHERE i.annotation_id = ?
      ORDER BY i.inspection_date DESC
    `).all(annotationId) as InspectionRow[];

    res.json(inspections);
  } catch (error) {
    console.error('Error fetching inspections:', error);
    res.status(500).json({ error: 'Kunne ikke hente inspektioner' });
  }
});

// Get single inspection with all details
app.get('/api/inspections/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const inspection = db.prepare(`
      SELECT i.*, a.kks_number, a.material, a.diameter
      FROM inspections i
      JOIN annotations a ON i.annotation_id = a.id
      WHERE i.id = ?
    `).get(id) as (InspectionRow & { kks_number: string; material: string | null; diameter: string | null }) | undefined;

    if (!inspection) {
      return res.status(404).json({ error: 'Inspektion ikke fundet' });
    }

    // Get checklist items
    const checklist = db.prepare(`
      SELECT * FROM inspection_checklist WHERE inspection_id = ? ORDER BY item_number
    `).all(id) as InspectionChecklistRow[];

    // Get TML measurements
    const tmlMeasurements = db.prepare(`
      SELECT * FROM inspection_tml WHERE inspection_id = ? ORDER BY tml_number
    `).all(id) as InspectionTmlRow[];

    // Get images
    const images = db.prepare(`
      SELECT * FROM inspection_images WHERE inspection_id = ? ORDER BY image_number
    `).all(id) as InspectionImageRow[];

    // Get documents
    const documents = db.prepare(`
      SELECT * FROM inspection_documents WHERE inspection_id = ? ORDER BY created_at DESC
    `).all(id) as InspectionDocumentRow[];

    res.json({
      ...inspection,
      checklist,
      tmlMeasurements,
      images,
      documents,
    });
  } catch (error) {
    console.error('Error fetching inspection:', error);
    res.status(500).json({ error: 'Kunne ikke hente inspektion' });
  }
});

// Create new inspection - admin only
app.post('/api/annotations/:annotationId/inspections', requireAdmin, (req, res) => {
  try {
    const { annotationId } = req.params;
    const {
      reportNumber,
      inspectionDate,
      nextInspectionDate,
      inspectorName,
      inspectorCert,
      approverName,
      approverCert,
      overallStatus,
      conclusion,
    } = req.body;

    // Verify annotation exists
    const annotation = db.prepare('SELECT id FROM annotations WHERE id = ?').get(annotationId);
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation ikke fundet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Create inspection
    db.prepare(`
      INSERT INTO inspections (id, annotation_id, report_number, inspection_date, next_inspection_date,
        inspector_name, inspector_cert, approver_name, approver_cert, overall_status, conclusion, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      annotationId,
      reportNumber || null,
      inspectionDate,
      nextInspectionDate || null,
      inspectorName,
      inspectorCert || null,
      approverName || null,
      approverCert || null,
      overallStatus || 'pending',
      conclusion || null,
      now,
      now
    );

    // Create default checklist items
    const insertChecklist = db.prepare(`
      INSERT INTO inspection_checklist (id, inspection_id, item_number, item_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'na', ?, ?)
    `);

    for (const item of DEFAULT_CHECKLIST_ITEMS) {
      insertChecklist.run(uuidv4(), id, item.number, item.name, now, now);
    }

    // Update annotation's last_inspection and next_inspection dates
    db.prepare(`
      UPDATE annotations SET last_inspection = ?, next_inspection = ?, updated_at = ? WHERE id = ?
    `).run(inspectionDate, nextInspectionDate || null, now, annotationId);

    // Fetch created inspection with checklist
    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(id) as InspectionRow;
    const checklist = db.prepare('SELECT * FROM inspection_checklist WHERE inspection_id = ? ORDER BY item_number').all(id);

    res.status(201).json({
      id: inspection.id,
      annotation_id: inspection.annotation_id,
      report_number: inspection.report_number,
      inspection_date: inspection.inspection_date,
      next_inspection_date: inspection.next_inspection_date,
      inspector_name: inspection.inspector_name,
      inspector_cert: inspection.inspector_cert,
      approver_name: inspection.approver_name,
      approver_cert: inspection.approver_cert,
      overall_status: inspection.overall_status,
      conclusion: inspection.conclusion,
      created_at: inspection.created_at,
      updated_at: inspection.updated_at,
      checklist,
      tmlMeasurements: [],
      images: [],
      documents: [],
    });
  } catch (error) {
    console.error('Error creating inspection:', error);
    res.status(500).json({ error: 'Kunne ikke oprette inspektion' });
  }
});

// Update inspection - admin only
app.put('/api/inspections/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const {
      reportNumber,
      inspectionDate,
      nextInspectionDate,
      inspectorName,
      inspectorCert,
      approverName,
      approverCert,
      overallStatus,
      conclusion,
    } = req.body;

    const existing = db.prepare('SELECT * FROM inspections WHERE id = ?').get(id) as InspectionRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Inspektion ikke fundet' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE inspections SET
        report_number = ?,
        inspection_date = ?,
        next_inspection_date = ?,
        inspector_name = ?,
        inspector_cert = ?,
        approver_name = ?,
        approver_cert = ?,
        overall_status = ?,
        conclusion = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      reportNumber || existing.report_number,
      inspectionDate || existing.inspection_date,
      nextInspectionDate !== undefined ? nextInspectionDate : existing.next_inspection_date,
      inspectorName || existing.inspector_name,
      inspectorCert !== undefined ? inspectorCert : existing.inspector_cert,
      approverName !== undefined ? approverName : existing.approver_name,
      approverCert !== undefined ? approverCert : existing.approver_cert,
      overallStatus || existing.overall_status,
      conclusion !== undefined ? conclusion : existing.conclusion,
      now,
      id
    );

    // Update annotation dates if inspection date changed
    if (inspectionDate || nextInspectionDate !== undefined) {
      db.prepare(`
        UPDATE annotations SET last_inspection = ?, next_inspection = ?, updated_at = ? WHERE id = ?
      `).run(
        inspectionDate || existing.inspection_date,
        nextInspectionDate !== undefined ? nextInspectionDate : existing.next_inspection_date,
        now,
        existing.annotation_id
      );
    }

    const updated = db.prepare('SELECT * FROM inspections WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating inspection:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere inspektion' });
  }
});

// Delete inspection - admin only
app.delete('/api/inspections/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM inspections WHERE id = ?').get(id) as InspectionRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Inspektion ikke fundet' });
    }

    // Delete associated images files
    const images = db.prepare('SELECT filename FROM inspection_images WHERE inspection_id = ?').all(id) as { filename: string }[];
    for (const img of images) {
      const imgPath = path.join(inspectionImagesDir, img.filename);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    // Delete associated document files
    const documents = db.prepare('SELECT filename FROM inspection_documents WHERE inspection_id = ?').all(id) as { filename: string }[];
    for (const doc of documents) {
      const docPath = path.join(inspectionDocsDir, doc.filename);
      if (fs.existsSync(docPath)) {
        fs.unlinkSync(docPath);
      }
    }

    // Delete inspection (cascades to checklist, TML, images, documents)
    db.prepare('DELETE FROM inspections WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting inspection:', error);
    res.status(500).json({ error: 'Kunne ikke slette inspektion' });
  }
});

// ============ CHECKLIST ROUTES ============

// Update checklist item
app.put('/api/inspection-checklist/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment, reference } = req.body;

    const existing = db.prepare('SELECT * FROM inspection_checklist WHERE id = ?').get(id) as InspectionChecklistRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Checklistepunkt ikke fundet' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE inspection_checklist SET status = ?, comment = ?, reference = ?, updated_at = ? WHERE id = ?
    `).run(
      status || existing.status,
      comment !== undefined ? comment : existing.comment,
      reference !== undefined ? reference : existing.reference,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM inspection_checklist WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere checklistepunkt' });
  }
});

// Bulk update checklist items
app.put('/api/inspections/:inspectionId/checklist', requireAdmin, (req, res) => {
  try {
    const { inspectionId } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items skal være et array' });
    }

    const now = new Date().toISOString();

    const updateStmt = db.prepare(`
      UPDATE inspection_checklist SET status = ?, comment = ?, reference = ?, updated_at = ? WHERE id = ?
    `);

    for (const item of items) {
      updateStmt.run(item.status, item.comment || null, item.reference || null, now, item.id);
    }

    const checklist = db.prepare('SELECT * FROM inspection_checklist WHERE inspection_id = ? ORDER BY item_number').all(inspectionId);
    res.json(checklist);
  } catch (error) {
    console.error('Error updating checklist:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere checkliste' });
  }
});

// ============ TML MEASUREMENT ROUTES ============

// Add TML measurement
app.post('/api/inspections/:inspectionId/tml', requireAdmin, (req, res) => {
  try {
    const { inspectionId } = req.params;
    const { tmlNumber, objectType, activity, dimension, tNom, tRet, tAlert, tMeasured, position, comment } = req.body;

    const inspection = db.prepare('SELECT id FROM inspections WHERE id = ?').get(inspectionId);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspektion ikke fundet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO inspection_tml (id, inspection_id, tml_number, object_type, activity, dimension, t_nom, t_ret, t_alert, t_measured, position, comment, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      inspectionId,
      tmlNumber,
      objectType || null,
      activity || null,
      dimension || null,
      tNom || null,
      tRet || null,
      tAlert || null,
      tMeasured || null,
      position || null,
      comment || null,
      now,
      now
    );

    const tml = db.prepare('SELECT * FROM inspection_tml WHERE id = ?').get(id);
    res.status(201).json(tml);
  } catch (error) {
    console.error('Error creating TML:', error);
    res.status(500).json({ error: 'Kunne ikke oprette TML-måling' });
  }
});

// Update TML measurement
app.put('/api/inspection-tml/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { tmlNumber, objectType, activity, dimension, tNom, tRet, tAlert, tMeasured, position, comment } = req.body;

    const existing = db.prepare('SELECT * FROM inspection_tml WHERE id = ?').get(id) as InspectionTmlRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'TML-måling ikke fundet' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE inspection_tml SET tml_number = ?, object_type = ?, activity = ?, dimension = ?, t_nom = ?, t_ret = ?, t_alert = ?, t_measured = ?, position = ?, comment = ?, updated_at = ? WHERE id = ?
    `).run(
      tmlNumber !== undefined ? tmlNumber : existing.tml_number,
      objectType !== undefined ? objectType : existing.object_type,
      activity !== undefined ? activity : existing.activity,
      dimension !== undefined ? dimension : existing.dimension,
      tNom !== undefined ? tNom : existing.t_nom,
      tRet !== undefined ? tRet : existing.t_ret,
      tAlert !== undefined ? tAlert : existing.t_alert,
      tMeasured !== undefined ? tMeasured : existing.t_measured,
      position !== undefined ? position : existing.position,
      comment !== undefined ? comment : existing.comment,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM inspection_tml WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating TML:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere TML-måling' });
  }
});

// Delete TML measurement
app.delete('/api/inspection-tml/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM inspection_tml WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'TML-måling ikke fundet' });
    }

    db.prepare('DELETE FROM inspection_tml WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting TML:', error);
    res.status(500).json({ error: 'Kunne ikke slette TML-måling' });
  }
});

// ============ INSPECTION IMAGE ROUTES ============

// Upload inspection image
app.post('/api/inspections/:inspectionId/images', requireAdmin, imageUpload.single('image'), (req, res) => {
  try {
    const { inspectionId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Intet billede uploadet' });
    }

    const inspection = db.prepare('SELECT id FROM inspections WHERE id = ?').get(inspectionId);
    if (!inspection) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Inspektion ikke fundet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Get next image number
    const lastImage = db.prepare(`
      SELECT MAX(image_number) as max_num FROM inspection_images WHERE inspection_id = ?
    `).get(inspectionId) as { max_num: number | null };
    const imageNumber = (lastImage.max_num || 0) + 1;

    db.prepare(`
      INSERT INTO inspection_images (id, inspection_id, filename, original_name, comment, image_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      inspectionId,
      req.file.filename,
      req.file.originalname,
      req.body.comment || null,
      imageNumber,
      now
    );

    const image = db.prepare('SELECT * FROM inspection_images WHERE id = ?').get(id);
    res.status(201).json(image);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Kunne ikke uploade billede' });
  }
});

// Update image comment
app.put('/api/inspection-images/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { comment, imageNumber } = req.body;

    const existing = db.prepare('SELECT * FROM inspection_images WHERE id = ?').get(id) as InspectionImageRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Billede ikke fundet' });
    }

    db.prepare(`
      UPDATE inspection_images SET comment = ?, image_number = ? WHERE id = ?
    `).run(
      comment !== undefined ? comment : existing.comment,
      imageNumber !== undefined ? imageNumber : existing.image_number,
      id
    );

    const updated = db.prepare('SELECT * FROM inspection_images WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere billede' });
  }
});

// Delete inspection image
app.delete('/api/inspection-images/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM inspection_images WHERE id = ?').get(id) as InspectionImageRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Billede ikke fundet' });
    }

    // Delete file
    const imgPath = path.join(inspectionImagesDir, existing.filename);
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }

    db.prepare('DELETE FROM inspection_images WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Kunne ikke slette billede' });
  }
});

// ============ INSPECTION DOCUMENT ROUTES ============

// Upload inspection document (PDF)
app.post('/api/inspections/:inspectionId/documents', requireAdmin, docUpload.single('document'), (req, res) => {
  try {
    const { inspectionId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Ingen PDF-fil uploadet' });
    }

    const inspection = db.prepare('SELECT id FROM inspections WHERE id = ?').get(inspectionId);
    if (!inspection) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Inspektion ikke fundet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO inspection_documents (id, inspection_id, filename, original_name, document_type, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      inspectionId,
      req.file.filename,
      req.file.originalname,
      req.body.documentType || 'report',
      req.body.description || null,
      now
    );

    const document = db.prepare('SELECT * FROM inspection_documents WHERE id = ?').get(id);
    res.status(201).json(document);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Kunne ikke uploade dokument' });
  }
});

// Update document description
app.put('/api/inspection-documents/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { description, documentType } = req.body;

    const existing = db.prepare('SELECT * FROM inspection_documents WHERE id = ?').get(id) as InspectionDocumentRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Dokument ikke fundet' });
    }

    db.prepare(`
      UPDATE inspection_documents SET description = ?, document_type = ? WHERE id = ?
    `).run(
      description !== undefined ? description : existing.description,
      documentType !== undefined ? documentType : existing.document_type,
      id
    );

    const updated = db.prepare('SELECT * FROM inspection_documents WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere dokument' });
  }
});

// Delete inspection document
app.delete('/api/inspection-documents/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM inspection_documents WHERE id = ?').get(id) as InspectionDocumentRow | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Dokument ikke fundet' });
    }

    // Delete file
    const docPath = path.join(inspectionDocsDir, existing.filename);
    if (fs.existsSync(docPath)) {
      fs.unlinkSync(docPath);
    }

    db.prepare('DELETE FROM inspection_documents WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Kunne ikke slette dokument' });
  }
});

// ============ ISOLATION PLANS (SIKRINGSPLANER) ============

// Get all isolation plans for a diagram
app.get('/api/diagrams/:diagramId/isolation-plans', requireAuth, (req, res) => {
  try {
    const { diagramId } = req.params;

    const plans = db.prepare(`
      SELECT ip.*,
        u1.name as created_by_name,
        u2.name as approved_by_name,
        (SELECT COUNT(*) FROM isolation_points WHERE plan_id = ip.id) as point_count,
        (SELECT COUNT(*) FROM isolation_points WHERE plan_id = ip.id AND status = 'isolated') as isolated_count,
        (SELECT COUNT(*) FROM isolation_points WHERE plan_id = ip.id AND status = 'verified') as verified_count
      FROM isolation_plans ip
      LEFT JOIN users u1 ON ip.created_by = u1.id
      LEFT JOIN users u2 ON ip.approved_by = u2.id
      WHERE ip.diagram_id = ?
      ORDER BY ip.created_at DESC
    `).all(diagramId);

    res.json(plans);
  } catch (error) {
    console.error('Error fetching isolation plans:', error);
    res.status(500).json({ error: 'Kunne ikke hente sikringsplaner' });
  }
});

// Get single isolation plan with points
app.get('/api/isolation-plans/:planId', requireAuth, (req, res) => {
  try {
    const { planId } = req.params;

    const plan = db.prepare(`
      SELECT ip.*,
        u1.name as created_by_name,
        u2.name as approved_by_name,
        d.name as diagram_name,
        l.name as location_name,
        t.code as terminal_code
      FROM isolation_plans ip
      LEFT JOIN users u1 ON ip.created_by = u1.id
      LEFT JOIN users u2 ON ip.approved_by = u2.id
      LEFT JOIN diagrams d ON ip.diagram_id = d.id
      LEFT JOIN locations l ON d.location_id = l.id
      LEFT JOIN terminals t ON l.terminal_id = t.id
      WHERE ip.id = ?
    `).get(planId) as IsolationPlanRow | undefined;

    if (!plan) {
      return res.status(404).json({ error: 'Sikringsplan ikke fundet' });
    }

    const pointsRaw = db.prepare(`
      SELECT ipt.*,
        u1.name as isolated_by_name,
        u2.name as verified_by_name,
        u3.name as restored_by_name
      FROM isolation_points ipt
      LEFT JOIN users u1 ON ipt.isolated_by = u1.id
      LEFT JOIN users u2 ON ipt.verified_by = u2.id
      LEFT JOIN users u3 ON ipt.restored_by = u3.id
      WHERE ipt.plan_id = ?
      ORDER BY ipt.sequence_number
    `).all(planId) as any[];

    // Parse points JSON for each isolation point and convert to camelCase
    const points = pointsRaw.map((p) => {
      const coords = JSON.parse(p.points);
      return {
        ...p,
        pointType: p.point_type,
        tagNumber: p.tag_number,
        sequenceNumber: p.sequence_number,
        normalPosition: p.normal_position,
        isolatedPosition: p.isolated_position,
        isolatedBy: p.isolated_by,
        isolatedAt: p.isolated_at,
        isolatedByName: p.isolated_by_name,
        verifiedBy: p.verified_by,
        verifiedAt: p.verified_at,
        verifiedByName: p.verified_by_name,
        restoredBy: p.restored_by,
        restoredAt: p.restored_at,
        restoredByName: p.restored_by_name,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        x: coords.x,
        y: coords.y,
        points: undefined,
        point_type: undefined,
        tag_number: undefined,
        sequence_number: undefined,
        normal_position: undefined,
        isolated_position: undefined,
        isolated_by: undefined,
        isolated_at: undefined,
        isolated_by_name: undefined,
        verified_by: undefined,
        verified_at: undefined,
        verified_by_name: undefined,
        restored_by: undefined,
        restored_at: undefined,
        restored_by_name: undefined,
        created_at: undefined,
        updated_at: undefined,
      };
    });

    res.json({ ...plan, points });
  } catch (error) {
    console.error('Error fetching isolation plan:', error);
    res.status(500).json({ error: 'Kunne ikke hente sikringsplan' });
  }
});

// Create isolation plan
app.post('/api/diagrams/:diagramId/isolation-plans', requireAuth, (req, res) => {
  try {
    const { diagramId } = req.params;
    const user = (req as any).user;
    const { name, description, equipment_tag, work_order, planned_start, planned_end, point_size } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Navn er påkrævet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const pointSize = point_size || 22; // Default to 22 if not provided

    db.prepare(`
      INSERT INTO isolation_plans (id, diagram_id, name, description, equipment_tag, work_order, planned_start, planned_end, point_size, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, diagramId, name, description || null, equipment_tag || null, work_order || null, planned_start || null, planned_end || null, pointSize, user.userId, now, now);

    const plan = db.prepare('SELECT * FROM isolation_plans WHERE id = ?').get(id);
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating isolation plan:', error);
    res.status(500).json({ error: 'Kunne ikke oprette sikringsplan' });
  }
});

// Update isolation plan
app.put('/api/isolation-plans/:planId', requireAuth, (req, res) => {
  try {
    const { planId } = req.params;
    const { name, description, equipment_tag, work_order, status, planned_start, planned_end, actual_start, actual_end, point_size } = req.body;

    const plan = db.prepare('SELECT * FROM isolation_plans WHERE id = ?').get(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Sikringsplan ikke fundet' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE isolation_plans SET
        name = COALESCE(?, name),
        description = ?,
        equipment_tag = ?,
        work_order = ?,
        status = COALESCE(?, status),
        planned_start = ?,
        planned_end = ?,
        actual_start = ?,
        actual_end = ?,
        point_size = COALESCE(?, point_size),
        updated_at = ?
      WHERE id = ?
    `).run(name, description, equipment_tag, work_order, status, planned_start, planned_end, actual_start, actual_end, point_size, now, planId);

    const updated = db.prepare('SELECT * FROM isolation_plans WHERE id = ?').get(planId);
    res.json(updated);
  } catch (error) {
    console.error('Error updating isolation plan:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere sikringsplan' });
  }
});

// Approve isolation plan
app.post('/api/isolation-plans/:planId/approve', requireAdmin, (req, res) => {
  try {
    const { planId } = req.params;
    const user = (req as any).user;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE isolation_plans SET
        status = 'approved',
        approved_by = ?,
        approved_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(user.userId, now, now, planId);

    const plan = db.prepare('SELECT * FROM isolation_plans WHERE id = ?').get(planId);
    res.json(plan);
  } catch (error) {
    console.error('Error approving isolation plan:', error);
    res.status(500).json({ error: 'Kunne ikke godkende sikringsplan' });
  }
});

// Delete isolation plan
app.delete('/api/isolation-plans/:planId', requireAdmin, (req, res) => {
  try {
    const { planId } = req.params;

    db.prepare('DELETE FROM isolation_plans WHERE id = ?').run(planId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting isolation plan:', error);
    res.status(500).json({ error: 'Kunne ikke slette sikringsplan' });
  }
});

// ============ ISOLATION POINTS ============

// Add isolation point to plan
app.post('/api/isolation-plans/:planId/points', requireAuth, (req, res) => {
  try {
    const { planId } = req.params;
    const { point_type, tag_number, description, sequence_number, normal_position, isolated_position, points, color } = req.body;

    if (!point_type || !tag_number || !points) {
      return res.status(400).json({ error: 'Type, tag-nummer og punkter er påkrævet' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Get next sequence number if not provided
    let seq = sequence_number;
    if (!seq) {
      const maxSeq = db.prepare('SELECT MAX(sequence_number) as max FROM isolation_points WHERE plan_id = ?').get(planId) as { max: number | null };
      seq = (maxSeq.max || 0) + 1;
    }

    db.prepare(`
      INSERT INTO isolation_points (id, plan_id, point_type, tag_number, description, sequence_number, normal_position, isolated_position, points, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, planId, point_type, tag_number, description || null, seq, normal_position || null, isolated_position || null, points, color || '#ef4444', now, now);

    const pointRaw = db.prepare('SELECT * FROM isolation_points WHERE id = ?').get(id) as any;
    const coords = JSON.parse(pointRaw.points);
    const point = {
      ...pointRaw,
      pointType: pointRaw.point_type,
      tagNumber: pointRaw.tag_number,
      sequenceNumber: pointRaw.sequence_number,
      normalPosition: pointRaw.normal_position,
      isolatedPosition: pointRaw.isolated_position,
      x: coords.x,
      y: coords.y,
      points: undefined,
      point_type: undefined,
      tag_number: undefined,
      sequence_number: undefined,
      normal_position: undefined,
      isolated_position: undefined,
    };
    res.status(201).json(point);
  } catch (error) {
    console.error('Error creating isolation point:', error);
    res.status(500).json({ error: 'Kunne ikke oprette isolationspunkt' });
  }
});

// Update isolation point
app.put('/api/isolation-points/:pointId', requireAuth, (req, res) => {
  try {
    const { pointId } = req.params;
    const { point_type, tag_number, description, sequence_number, normal_position, isolated_position, points, color, notes } = req.body;

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE isolation_points SET
        point_type = COALESCE(?, point_type),
        tag_number = COALESCE(?, tag_number),
        description = ?,
        sequence_number = COALESCE(?, sequence_number),
        normal_position = ?,
        isolated_position = ?,
        points = COALESCE(?, points),
        color = COALESCE(?, color),
        notes = ?,
        updated_at = ?
      WHERE id = ?
    `).run(point_type, tag_number, description, sequence_number, normal_position, isolated_position, points, color, notes, now, pointId);

    const pointRaw = db.prepare('SELECT * FROM isolation_points WHERE id = ?').get(pointId) as any;
    const coords = JSON.parse(pointRaw.points);
    const point = {
      ...pointRaw,
      pointType: pointRaw.point_type,
      tagNumber: pointRaw.tag_number,
      sequenceNumber: pointRaw.sequence_number,
      normalPosition: pointRaw.normal_position,
      isolatedPosition: pointRaw.isolated_position,
      x: coords.x,
      y: coords.y,
      points: undefined,
      point_type: undefined,
      tag_number: undefined,
      sequence_number: undefined,
      normal_position: undefined,
      isolated_position: undefined,
    };
    res.json(point);
  } catch (error) {
    console.error('Error updating isolation point:', error);
    res.status(500).json({ error: 'Kunne ikke opdatere isolationspunkt' });
  }
});

// Mark point as isolated
app.post('/api/isolation-points/:pointId/isolate', requireAuth, (req, res) => {
  try {
    const { pointId } = req.params;
    const user = (req as any).user;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE isolation_points SET
        status = 'isolated',
        isolated_by = ?,
        isolated_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(user.userId, now, now, pointId);

    const pointRaw = db.prepare(`
      SELECT ipt.*, u.name as isolated_by_name
      FROM isolation_points ipt
      LEFT JOIN users u ON ipt.isolated_by = u.id
      WHERE ipt.id = ?
    `).get(pointId) as any;
    const coords = JSON.parse(pointRaw.points);
    const point = {
      ...pointRaw,
      pointType: pointRaw.point_type,
      tagNumber: pointRaw.tag_number,
      sequenceNumber: pointRaw.sequence_number,
      normalPosition: pointRaw.normal_position,
      isolatedPosition: pointRaw.isolated_position,
      isolatedBy: pointRaw.isolated_by,
      isolatedAt: pointRaw.isolated_at,
      isolatedByName: pointRaw.isolated_by_name,
      x: coords.x,
      y: coords.y,
      points: undefined,
      point_type: undefined,
      tag_number: undefined,
      sequence_number: undefined,
      normal_position: undefined,
      isolated_position: undefined,
      isolated_by: undefined,
      isolated_at: undefined,
      isolated_by_name: undefined,
    };
    res.json(point);
  } catch (error) {
    console.error('Error isolating point:', error);
    res.status(500).json({ error: 'Kunne ikke markere punkt som isoleret' });
  }
});

// Verify isolated point
app.post('/api/isolation-points/:pointId/verify', requireAuth, (req, res) => {
  try {
    const { pointId } = req.params;
    const user = (req as any).user;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE isolation_points SET
        status = 'verified',
        verified_by = ?,
        verified_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(user.userId, now, now, pointId);

    const pointRaw = db.prepare(`
      SELECT ipt.*, u1.name as isolated_by_name, u2.name as verified_by_name
      FROM isolation_points ipt
      LEFT JOIN users u1 ON ipt.isolated_by = u1.id
      LEFT JOIN users u2 ON ipt.verified_by = u2.id
      WHERE ipt.id = ?
    `).get(pointId) as any;
    const coords = JSON.parse(pointRaw.points);
    const point = {
      ...pointRaw,
      pointType: pointRaw.point_type,
      tagNumber: pointRaw.tag_number,
      sequenceNumber: pointRaw.sequence_number,
      normalPosition: pointRaw.normal_position,
      isolatedPosition: pointRaw.isolated_position,
      isolatedBy: pointRaw.isolated_by,
      isolatedAt: pointRaw.isolated_at,
      isolatedByName: pointRaw.isolated_by_name,
      verifiedBy: pointRaw.verified_by,
      verifiedAt: pointRaw.verified_at,
      verifiedByName: pointRaw.verified_by_name,
      x: coords.x,
      y: coords.y,
      points: undefined,
      point_type: undefined,
      tag_number: undefined,
      sequence_number: undefined,
      normal_position: undefined,
      isolated_position: undefined,
      isolated_by: undefined,
      isolated_at: undefined,
      isolated_by_name: undefined,
      verified_by: undefined,
      verified_at: undefined,
      verified_by_name: undefined,
    };
    res.json(point);
  } catch (error) {
    console.error('Error verifying point:', error);
    res.status(500).json({ error: 'Kunne ikke verificere punkt' });
  }
});

// Restore point
app.post('/api/isolation-points/:pointId/restore', requireAuth, (req, res) => {
  try {
    const { pointId } = req.params;
    const user = (req as any).user;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE isolation_points SET
        status = 'restored',
        restored_by = ?,
        restored_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(user.userId, now, now, pointId);

    const pointRaw = db.prepare(`
      SELECT ipt.*, u1.name as isolated_by_name, u2.name as verified_by_name, u3.name as restored_by_name
      FROM isolation_points ipt
      LEFT JOIN users u1 ON ipt.isolated_by = u1.id
      LEFT JOIN users u2 ON ipt.verified_by = u2.id
      LEFT JOIN users u3 ON ipt.restored_by = u3.id
      WHERE ipt.id = ?
    `).get(pointId) as any;
    const coords = JSON.parse(pointRaw.points);
    const point = {
      ...pointRaw,
      pointType: pointRaw.point_type,
      tagNumber: pointRaw.tag_number,
      sequenceNumber: pointRaw.sequence_number,
      normalPosition: pointRaw.normal_position,
      isolatedPosition: pointRaw.isolated_position,
      isolatedBy: pointRaw.isolated_by,
      isolatedAt: pointRaw.isolated_at,
      isolatedByName: pointRaw.isolated_by_name,
      verifiedBy: pointRaw.verified_by,
      verifiedAt: pointRaw.verified_at,
      verifiedByName: pointRaw.verified_by_name,
      restoredBy: pointRaw.restored_by,
      restoredAt: pointRaw.restored_at,
      restoredByName: pointRaw.restored_by_name,
      x: coords.x,
      y: coords.y,
      points: undefined,
      point_type: undefined,
      tag_number: undefined,
      sequence_number: undefined,
      normal_position: undefined,
      isolated_position: undefined,
      isolated_by: undefined,
      isolated_at: undefined,
      isolated_by_name: undefined,
      verified_by: undefined,
      verified_at: undefined,
      verified_by_name: undefined,
      restored_by: undefined,
      restored_at: undefined,
      restored_by_name: undefined,
    };
    res.json(point);
  } catch (error) {
    console.error('Error restoring point:', error);
    res.status(500).json({ error: 'Kunne ikke genetablere punkt' });
  }
});

// Delete isolation point
app.delete('/api/isolation-points/:pointId', requireAuth, (req, res) => {
  try {
    const { pointId } = req.params;

    db.prepare('DELETE FROM isolation_points WHERE id = ?').run(pointId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting isolation point:', error);
    res.status(500).json({ error: 'Kunne ikke slette isolationspunkt' });
  }
});

// Get all isolation plans (for dashboard)
app.get('/api/isolation-plans', requireAuth, (req, res) => {
  try {
    const plans = db.prepare(`
      SELECT ip.*,
        u1.name as created_by_name,
        d.name as diagram_name,
        l.name as location_name,
        t.code as terminal_code,
        (SELECT COUNT(*) FROM isolation_points WHERE plan_id = ip.id) as point_count,
        (SELECT COUNT(*) FROM isolation_points WHERE plan_id = ip.id AND status = 'verified') as verified_count,
        (SELECT COUNT(*) FROM isolation_points WHERE plan_id = ip.id AND status IN ('isolated', 'verified')) as isolated_count
      FROM isolation_plans ip
      LEFT JOIN users u1 ON ip.created_by = u1.id
      LEFT JOIN diagrams d ON ip.diagram_id = d.id
      LEFT JOIN locations l ON d.location_id = l.id
      LEFT JOIN terminals t ON l.terminal_id = t.id
      ORDER BY ip.created_at DESC
    `).all();

    res.json(plans);
  } catch (error) {
    console.error('Error fetching isolation plans:', error);
    res.status(500).json({ error: 'Kunne ikke hente sikringsplaner' });
  }
});

// Get active isolation plans (for dashboard)
app.get('/api/isolation-plans/active', requireAuth, (req, res) => {
  try {
    const plans = db.prepare(`
      SELECT ip.*,
        u1.name as created_by_name,
        d.name as diagram_name,
        l.name as location_name,
        t.code as terminal_code,
        (SELECT COUNT(*) FROM isolation_points WHERE plan_id = ip.id) as point_count,
        (SELECT COUNT(*) FROM isolation_points WHERE plan_id = ip.id AND status IN ('isolated', 'verified')) as active_count
      FROM isolation_plans ip
      LEFT JOIN users u1 ON ip.created_by = u1.id
      LEFT JOIN diagrams d ON ip.diagram_id = d.id
      LEFT JOIN locations l ON d.location_id = l.id
      LEFT JOIN terminals t ON l.terminal_id = t.id
      WHERE ip.status IN ('approved', 'active')
      ORDER BY ip.planned_start ASC
    `).all();

    res.json(plans);
  } catch (error) {
    console.error('Error fetching active isolation plans:', error);
    res.status(500).json({ error: 'Kunne ikke hente aktive sikringsplaner' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server kører på port ${PORT}`);
  console.log(`Uploads mappe: ${uploadsDir}`);
});
