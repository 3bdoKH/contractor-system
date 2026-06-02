import { ipcMain } from 'electron';
import { getDb } from '../db';

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
  const db = getDb();

  // Get all expenses with optional filters
  ipcMain.handle('expenses:getAll', (_event, filters?: ExpenseFilters) => {
    const conditions: string[] = [];
    const params: any[] = [];

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

    return db.prepare(`
      SELECT
        e.*,
        ec.name as category_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      ${where}
      ORDER BY e.date DESC, e.id DESC
    `).all(...params);
  });

  // Create expense
  ipcMain.handle('expenses:create', (_event, data: CreateExpenseData) => {
    const result = db.prepare(
      'INSERT INTO expenses (category_id, custom_category, amount, date, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(
      data.category_id ?? null,
      data.custom_category ?? null,
      data.amount,
      data.date,
      data.notes ?? null
    );
    return { id: result.lastInsertRowid };
  });

  // Update expense
  ipcMain.handle('expenses:update', (_event, id: number, data: CreateExpenseData) => {
    db.prepare(
      'UPDATE expenses SET category_id = ?, custom_category = ?, amount = ?, date = ?, notes = ? WHERE id = ?'
    ).run(
      data.category_id ?? null,
      data.custom_category ?? null,
      data.amount,
      data.date,
      data.notes ?? null,
      id
    );
    return { success: true };
  });

  // Delete expense
  ipcMain.handle('expenses:delete', (_event, id: number) => {
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return { success: true };
  });

  // Get total for optional filters
  ipcMain.handle('expenses:getTotal', (_event, filters?: ExpenseFilters) => {
    const conditions: string[] = [];
    const params: any[] = [];

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

    const row = db.prepare(`
      SELECT COALESCE(SUM(e.amount), 0) as total
      FROM expenses e
      ${where}
    `).get(...params) as { total: number };

    return { total: row.total };
  });

  // Get all categories
  ipcMain.handle('expenses:getCategories', () => {
    return db.prepare('SELECT * FROM expense_categories ORDER BY id ASC').all();
  });

  // Create a new category
  ipcMain.handle('expenses:createCategory', (_event, name: string) => {
    const result = db.prepare(
      'INSERT OR IGNORE INTO expense_categories (name) VALUES (?)'
    ).run(name.trim());
    return { id: result.lastInsertRowid };
  });
}
