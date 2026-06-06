import { ipcMain } from 'electron';
import { getDb, queryAll, saveDb } from '../db';

interface ExpenseFilters {
  from?: string;
  to?: string;
  category_id?: number;
}

interface CreateExpenseData {
  category_id?: number;
  custom_category?: string;
  amount: number;
  date: string;
  notes?: string;
}

export function registerExpenseHandlers() {
  // Get all expenses with optional filters
  ipcMain.handle('expenses:getAll', (_event, filters?: ExpenseFilters) => {
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filters?.from) {
      conditions.push('e.date >= ?');
      params.push(filters.from);
    }
    if (filters?.to) {
      conditions.push('e.date <= ?');
      params.push(filters.to);
    }
    if (filters?.category_id) {
      conditions.push('e.category_id = ?');
      params.push(filters.category_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return queryAll(`
      SELECT
        e.*,
        ec.name as category_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      ${where}
      ORDER BY e.date DESC, e.id DESC
    `, params);
  });

  // Create expense
  ipcMain.handle('expenses:create', (_event, data: CreateExpenseData) => {
    const db = getDb();
    db.run(
      'INSERT INTO expenses (category_id, custom_category, amount, date, notes) VALUES (?, ?, ?, ?, ?)',
      [data.category_id ?? null, data.custom_category ?? null, data.amount, data.date, data.notes ?? null]
    );
    const row = db.exec('SELECT last_insert_rowid() as id');
    const id = row[0]?.values[0]?.[0] as number ?? 0;
    saveDb();
    return { id };
  });

  // Update expense
  ipcMain.handle('expenses:update', (_event, id: number, data: CreateExpenseData) => {
    getDb().run(
      'UPDATE expenses SET category_id = ?, custom_category = ?, amount = ?, date = ?, notes = ? WHERE id = ?',
      [data.category_id ?? null, data.custom_category ?? null, data.amount, data.date, data.notes ?? null, id]
    );
    saveDb();
    return { success: true };
  });

  // Delete expense
  ipcMain.handle('expenses:delete', (_event, id: number) => {
    getDb().run('DELETE FROM expenses WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  // Get total for optional filters
  ipcMain.handle('expenses:getTotal', (_event, filters?: ExpenseFilters) => {
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filters?.from) {
      conditions.push('e.date >= ?');
      params.push(filters.from);
    }
    if (filters?.to) {
      conditions.push('e.date <= ?');
      params.push(filters.to);
    }
    if (filters?.category_id) {
      conditions.push('e.category_id = ?');
      params.push(filters.category_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = getDb().exec(`
      SELECT COALESCE(SUM(e.amount), 0) as total
      FROM expenses e
      ${where}
    `);

    const total = (result[0]?.values[0]?.[0] as number) ?? 0;
    return { total };
  });

  // Get all categories
  ipcMain.handle('expenses:getCategories', () => {
    return queryAll('SELECT * FROM expense_categories ORDER BY id ASC');
  });

  // Create a new category
  ipcMain.handle('expenses:createCategory', (_event, name: string) => {
    const db = getDb();
    db.run('INSERT OR IGNORE INTO expense_categories (name) VALUES (?)', [name.trim()]);
    const row = db.exec('SELECT last_insert_rowid() as id');
    const id = row[0]?.values[0]?.[0] as number ?? 0;
    saveDb();
    return { id };
  });
}
