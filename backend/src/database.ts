import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(__dirname, '..', 'data', 'inspektioner.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Terminals table (SOT, GOT, EOT, AOT)
  CREATE TABLE IF NOT EXISTS terminals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Locations table (areas within terminals)
  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    terminal_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
  );

  -- Diagrams table (now linked to locations)
  CREATE TABLE IF NOT EXISTS diagrams (
    id TEXT PRIMARY KEY,
    location_id TEXT,
    name TEXT NOT NULL,
    pdf_filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
  );

  -- Annotations table (pipes, tanks, components)
  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    annotation_type TEXT NOT NULL DEFAULT 'pipe' CHECK(annotation_type IN ('pipe', 'tank', 'component')),
    kks_number TEXT NOT NULL,
    points TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    stroke_width INTEGER NOT NULL DEFAULT 4,
    description TEXT,
    material TEXT,
    diameter TEXT,
    last_inspection TEXT,
    next_inspection TEXT,
    status TEXT NOT NULL DEFAULT 'not_inspected' CHECK(status IN ('ok', 'warning', 'critical', 'not_inspected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
  );

  -- Inspections table (hovedinspektion knyttet til rør-markering)
  CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    annotation_id TEXT NOT NULL,
    report_number TEXT,
    inspection_date TEXT NOT NULL,
    next_inspection_date TEXT,
    inspector_name TEXT NOT NULL,
    inspector_cert TEXT,
    approver_name TEXT,
    approver_cert TEXT,
    overall_status TEXT NOT NULL DEFAULT 'pending' CHECK(overall_status IN ('approved', 'conditional', 'rejected', 'pending')),
    conclusion TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
  );

  -- Inspection checklist items (de 19 inspektionspunkter)
  CREATE TABLE IF NOT EXISTS inspection_checklist (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    item_number INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'na' CHECK(status IN ('ok', '1', '2', '3', 'na')),
    comment TEXT,
    reference TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
  );

  -- TML (Thickness Measurement Location) measurements
  CREATE TABLE IF NOT EXISTS inspection_tml (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    tml_number INTEGER NOT NULL,
    object_type TEXT,
    activity TEXT,
    dimension TEXT,
    t_nom REAL,
    t_ret REAL,
    t_alert REAL,
    t_measured REAL,
    position TEXT,
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
  );

  -- Inspection images
  CREATE TABLE IF NOT EXISTS inspection_images (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    comment TEXT,
    image_number INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
  );

  -- Inspection documents (PDF reports)
  CREATE TABLE IF NOT EXISTS inspection_documents (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    document_type TEXT DEFAULT 'report',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
  );

  -- Isolation Plans (Sikringsplaner)
  CREATE TABLE IF NOT EXISTS isolation_plans (
    id TEXT PRIMARY KEY,
    diagram_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    equipment_tag TEXT,
    work_order TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_approval', 'approved', 'active', 'completed', 'cancelled')),
    planned_start TEXT,
    planned_end TEXT,
    actual_start TEXT,
    actual_end TEXT,
    point_size INTEGER NOT NULL DEFAULT 22,
    created_by TEXT NOT NULL,
    approved_by TEXT,
    approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );

  -- Isolation Points (individual isolation items within a plan)
  CREATE TABLE IF NOT EXISTS isolation_points (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    point_type TEXT NOT NULL CHECK(point_type IN ('work_point', 'valve', 'blindflange', 'electrical', 'drain', 'vent', 'lock', 'instrument', 'other')),
    tag_number TEXT NOT NULL,
    description TEXT,
    sequence_number INTEGER NOT NULL,
    normal_position TEXT,
    isolated_position TEXT,
    points TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#ef4444',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'isolated', 'verified', 'restored')),
    isolated_by TEXT,
    isolated_at TEXT,
    verified_by TEXT,
    verified_at TEXT,
    restored_by TEXT,
    restored_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (plan_id) REFERENCES isolation_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (isolated_by) REFERENCES users(id),
    FOREIGN KEY (verified_by) REFERENCES users(id),
    FOREIGN KEY (restored_by) REFERENCES users(id)
  );

  -- Create indexes (except annotation_type which is added by migration)
  CREATE INDEX IF NOT EXISTS idx_locations_terminal ON locations(terminal_id);
  CREATE INDEX IF NOT EXISTS idx_diagrams_location ON diagrams(location_id);
  CREATE INDEX IF NOT EXISTS idx_annotations_diagram ON annotations(diagram_id);
  CREATE INDEX IF NOT EXISTS idx_annotations_kks ON annotations(kks_number);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_inspections_annotation ON inspections(annotation_id);
  CREATE INDEX IF NOT EXISTS idx_inspection_checklist_inspection ON inspection_checklist(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_inspection_tml_inspection ON inspection_tml(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_inspection_images_inspection ON inspection_images(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_inspection_documents_inspection ON inspection_documents(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_isolation_plans_diagram ON isolation_plans(diagram_id);
  CREATE INDEX IF NOT EXISTS idx_isolation_plans_status ON isolation_plans(status);
  CREATE INDEX IF NOT EXISTS idx_isolation_points_plan ON isolation_points(plan_id);
`);

// Migration: Add annotation_type column if it doesn't exist (must run before other code uses it)
function migrateAnnotationType() {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(annotations)").all() as { name: string }[];
    const hasAnnotationType = tableInfo.some(col => col.name === 'annotation_type');

    if (!hasAnnotationType) {
      db.exec(`ALTER TABLE annotations ADD COLUMN annotation_type TEXT DEFAULT 'pipe'`);
      console.log('Migration: Added annotation_type column to annotations table');
    }
    // Always try to create the index (IF NOT EXISTS handles duplicates)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_annotations_type ON annotations(annotation_type)`);
  } catch (error) {
    console.error('Migration error:', error);
  }
}

function migrateIsolationPointTypes() {
  try {
    // SQLite doesn't support ALTER CHECK constraints, so we need to recreate the table
    // But first check if the constraint needs updating
    const checkConstraint = db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='isolation_points'
    `).get() as { sql: string } | undefined;

    if (checkConstraint && checkConstraint.sql && !checkConstraint.sql.includes('work_point')) {
      console.log('Migration: Updating isolation_points table to support work_point type');

      // Begin transaction
      db.exec('BEGIN TRANSACTION');

      try {
        // Create new table with updated constraint
        db.exec(`
          CREATE TABLE isolation_points_new (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            point_type TEXT NOT NULL CHECK(point_type IN ('work_point', 'valve', 'blindflange', 'electrical', 'drain', 'vent', 'lock', 'instrument', 'other')),
            tag_number TEXT NOT NULL,
            description TEXT,
            sequence_number INTEGER NOT NULL,
            normal_position TEXT,
            isolated_position TEXT,
            points TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#ef4444',
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'isolated', 'verified', 'restored')),
            isolated_by TEXT,
            isolated_at TEXT,
            verified_by TEXT,
            verified_at TEXT,
            restored_by TEXT,
            restored_at TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (plan_id) REFERENCES isolation_plans(id) ON DELETE CASCADE,
            FOREIGN KEY (isolated_by) REFERENCES users(id),
            FOREIGN KEY (verified_by) REFERENCES users(id),
            FOREIGN KEY (restored_by) REFERENCES users(id)
          )
        `);

        // Copy data from old table to new
        db.exec(`
          INSERT INTO isolation_points_new
          SELECT * FROM isolation_points
        `);

        // Drop old table
        db.exec('DROP TABLE isolation_points');

        // Rename new table
        db.exec('ALTER TABLE isolation_points_new RENAME TO isolation_points');

        // Commit transaction
        db.exec('COMMIT');

        console.log('Migration: Successfully updated isolation_points table');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  } catch (error) {
    console.error('Migration error for isolation_points:', error);
  }
}

function migrateIsolationPlanPointSize() {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(isolation_plans)").all() as { name: string }[];
    const hasPointSize = tableInfo.some(col => col.name === 'point_size');

    if (!hasPointSize) {
      db.exec(`ALTER TABLE isolation_plans ADD COLUMN point_size INTEGER NOT NULL DEFAULT 22`);
      console.log('Migration: Added point_size column to isolation_plans table');
    }
  } catch (error) {
    console.error('Migration error for isolation_plans point_size:', error);
  }
}

migrateAnnotationType();
migrateIsolationPointTypes();
migrateIsolationPlanPointSize();

// Helper function to hash passwords
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Seed default data if empty
function seedDefaultData() {
  // Check if terminals exist
  const terminalCount = db.prepare('SELECT COUNT(*) as count FROM terminals').get() as { count: number };

  if (terminalCount.count === 0) {
    const insertTerminal = db.prepare(`
      INSERT INTO terminals (id, name, code, description) VALUES (?, ?, ?, ?)
    `);

    const terminals = [
      { id: crypto.randomUUID(), name: 'SOT Terminal', code: 'SOT', description: 'SOT Olieterminal' },
      { id: crypto.randomUUID(), name: 'GOT Terminal', code: 'GOT', description: 'GOT Olieterminal' },
      { id: crypto.randomUUID(), name: 'EOT Terminal', code: 'EOT', description: 'EOT Olieterminal' },
      { id: crypto.randomUUID(), name: 'AOT Terminal', code: 'AOT', description: 'AOT Olieterminal' },
    ];

    for (const terminal of terminals) {
      insertTerminal.run(terminal.id, terminal.name, terminal.code, terminal.description);
    }

    console.log('Seeded 4 default terminals: SOT, GOT, EOT, AOT');
  }

  // Check if admin user exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  if (userCount.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, name) VALUES (?, ?, ?, ?, ?)
    `);

    // Create default admin user (password: admin123)
    const adminId = crypto.randomUUID();
    const adminHash = hashPassword('admin123');
    insertUser.run(adminId, 'admin', adminHash, 'admin', 'Administrator');

    // Create default viewer user (password: user123)
    const userId = crypto.randomUUID();
    const userHash = hashPassword('user123');
    insertUser.run(userId, 'bruger', userHash, 'user', 'Standard Bruger');

    console.log('Seeded default users: admin (password: admin123), bruger (password: user123)');
  }
}

seedDefaultData();

export default db;

// Types
export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TerminalRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationRow {
  id: string;
  terminal_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiagramRow {
  id: string;
  location_id: string | null;
  name: string;
  pdf_filename: string;
  created_at: string;
  updated_at: string;
}

export type AnnotationType = 'pipe' | 'tank' | 'component';

export interface AnnotationRow {
  id: string;
  diagram_id: string;
  annotation_type: AnnotationType;
  kks_number: string;
  points: string;
  color: string;
  stroke_width: number;
  description: string | null;
  material: string | null;
  diameter: string | null;
  last_inspection: string | null;
  next_inspection: string | null;
  status: 'ok' | 'warning' | 'critical' | 'not_inspected';
  created_at: string;
  updated_at: string;
}

export interface InspectionRow {
  id: string;
  annotation_id: string;
  report_number: string | null;
  inspection_date: string;
  next_inspection_date: string | null;
  inspector_name: string;
  inspector_cert: string | null;
  approver_name: string | null;
  approver_cert: string | null;
  overall_status: 'approved' | 'conditional' | 'rejected' | 'pending';
  conclusion: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionChecklistRow {
  id: string;
  inspection_id: string;
  item_number: number;
  item_name: string;
  status: 'ok' | '1' | '2' | '3' | 'na';
  comment: string | null;
  reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionTmlRow {
  id: string;
  inspection_id: string;
  tml_number: number;
  object_type: string | null;
  activity: string | null;
  dimension: string | null;
  t_nom: number | null;
  t_ret: number | null;
  t_alert: number | null;
  t_measured: number | null;
  position: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionImageRow {
  id: string;
  inspection_id: string;
  filename: string;
  original_name: string;
  comment: string | null;
  image_number: number | null;
  created_at: string;
}

export interface InspectionDocumentRow {
  id: string;
  inspection_id: string;
  filename: string;
  original_name: string;
  document_type: string;
  description: string | null;
  created_at: string;
}

export type IsolationPlanStatus = 'draft' | 'pending_approval' | 'approved' | 'active' | 'completed' | 'cancelled';
export type IsolationPointType = 'valve' | 'blindflange' | 'electrical' | 'drain' | 'vent' | 'lock' | 'instrument' | 'other';
export type IsolationPointStatus = 'pending' | 'isolated' | 'verified' | 'restored';

export interface IsolationPlanRow {
  id: string;
  diagram_id: string;
  name: string;
  description: string | null;
  equipment_tag: string | null;
  work_order: string | null;
  status: IsolationPlanStatus;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IsolationPointRow {
  id: string;
  plan_id: string;
  point_type: IsolationPointType;
  tag_number: string;
  description: string | null;
  sequence_number: number;
  normal_position: string | null;
  isolated_position: string | null;
  points: string;
  color: string;
  status: IsolationPointStatus;
  isolated_by: string | null;
  isolated_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  restored_by: string | null;
  restored_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
