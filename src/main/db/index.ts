import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

let db: Database;
let dbPath: string;

/**
 * Persist the in-memory database to disk.
 * Call this after every write operation.
 */
export function saveDb(): void {
  if (db && dbPath) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

/**
 * Returns the initialized sql.js Database instance.
 * Must be called after initializeDb() has been awaited.
 */
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDb() first.');
  }
  return db;
}

/**
 * Async initialization — must be awaited before the window is created.
 */
export async function initializeDb(): Promise<void> {
  if (db) return; // already initialized

  dbPath = path.join(app.getPath('userData'), 'contractor.db');

  // Resolve WASM path — works in dev (from node_modules) and prod (extraResources)
  let wasmPath: string;
  if (app.isPackaged) {
    wasmPath = path.join(process.resourcesPath, 'sql-wasm.wasm');
  } else {
    wasmPath = path.join(__dirname, '../../public/sql-wasm.wasm');
  }

  // Fallback: try node_modules dist
  if (!fs.existsSync(wasmPath)) {
    wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
  }

  const SQL: SqlJsStatic = await initSqlJs({
    locateFile: () => wasmPath,
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  initDb();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Run a SELECT query and return all rows as an array of plain objects.
 */
export function queryAll<T = Record<string, unknown>>(sql: string, params: (string | number | null | Uint8Array)[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/**
 * Run a SELECT query and return the first row, or undefined.
 */
export function queryOne<T = Record<string, unknown>>(sql: string, params: (string | number | null | Uint8Array)[] = []): T | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row: T | undefined;
  if (stmt.step()) {
    row = stmt.getAsObject() as T;
  }
  stmt.free();
  return row;
}

/**
 * Run a write statement and return lastInsertRowid.
 */
export function runWrite(sql: string, params: (string | number | null | Uint8Array)[] = []): number {
  db.run(sql, params);
  const result = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  saveDb();
  return result?.id ?? 0;
}

// ─── Schema Init ────────────────────────────────────────────────────────────

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchandise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      merchandise_id INTEGER REFERENCES merchandise(id),
      custom_name TEXT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supply_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supply_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supply_invoice_id INTEGER NOT NULL REFERENCES supply_invoices(id) ON DELETE CASCADE,
      merchandise_id INTEGER REFERENCES merchandise(id),
      custom_name TEXT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supply_invoice_id INTEGER NOT NULL REFERENCES supply_invoices(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchandise_id INTEGER NOT NULL UNIQUE REFERENCES merchandise(id) ON DELETE CASCADE,
      manual_quantity REAL,
      manual_price REAL,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merchandise_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchandise_id INTEGER NOT NULL REFERENCES merchandise(id) ON DELETE CASCADE,
      unit TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      conversion_factor REAL NOT NULL DEFAULT 1,
      UNIQUE(merchandise_id, unit)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_advances (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      amount      REAL    NOT NULL,
      used_amount REAL    NOT NULL DEFAULT 0,
      date        TEXT    NOT NULL,
      notes       TEXT,
      created_at  TEXT    DEFAULT (datetime('now'))
    );
  `);

  // Migrate existing databases to add the new 'unit' column
  try {
    db.run('ALTER TABLE invoice_items ADD COLUMN unit TEXT');
  } catch (_err) {
    // Column already exists
  }
  try {
    db.run('ALTER TABLE supply_invoice_items ADD COLUMN unit TEXT');
  } catch (_err) {
    // Column already exists
  }

  // Migrate: add unique index on merchandise.name for safe incremental seeding
  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_merchandise_name ON merchandise(name)');
  } catch (_err) {
    // Index already exists
  }

  // Migrate: create merchandise_units table if it doesn't exist on older DBs
  try {
    db.run(`CREATE TABLE IF NOT EXISTS merchandise_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchandise_id INTEGER NOT NULL REFERENCES merchandise(id) ON DELETE CASCADE,
      unit TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      conversion_factor REAL NOT NULL DEFAULT 1,
      UNIQUE(merchandise_id, unit)
    )`);
  } catch (_err) {
    // Already exists
  }

  // Migrate: add conversion_factor column to existing merchandise_units rows
  try {
    db.run('ALTER TABLE merchandise_units ADD COLUMN conversion_factor REAL NOT NULL DEFAULT 1');
  } catch (_err) {
    // Column already exists
  }

  // Migrate: create expenses table if it doesn't exist on older DBs
  try {
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch (_err) {
    // Already exists
  }

  // Migrate: create incomes table if it doesn't exist on older DBs
  try {
    db.run(`CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch (_err) {
    // Already exists
  }

  // Migrate: add is_advance flag to existing payments rows
  try {
    db.run('ALTER TABLE payments ADD COLUMN is_advance INTEGER NOT NULL DEFAULT 0');
  } catch (_err) {
    // Column already exists
  }

  // Migrate: create customer_advances table if it doesn't exist on older DBs
  try {
    db.run(`CREATE TABLE IF NOT EXISTS customer_advances (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      amount      REAL    NOT NULL,
      used_amount REAL    NOT NULL DEFAULT 0,
      date        TEXT    NOT NULL,
      notes       TEXT,
      created_at  TEXT    DEFAULT (datetime('now'))
    )`);
  } catch (_err) {
    // Already exists
  }

  seedSettings();
  // Persist initial schema to disk
  saveDb();
}

function seedSettings() {
  const defaults = [
    { key: 'contractor_name', value: 'نظام المقاول' },
    { key: 'contractor_phone', value: '' },
    { key: 'contractor_address', value: '' },
    { key: 'pdf_header_title', value: 'كشف حساب' },
    { key: 'pdf_footer_note', value: '' },
  ];
  for (const { key, value } of defaults) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

