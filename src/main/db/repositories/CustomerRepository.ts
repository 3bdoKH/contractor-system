import { getDb, queryAll, queryOne, runWrite, saveDb } from '../index';

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
  total_invoiced?: number;
  total_paid?: number;
  advance_balance?: number;
}

export interface CustomerAdvance {
  id: number;
  customer_id: number;
  amount: number;
  used_amount: number;
  date: string;
  notes?: string | null;
  created_at: string;
}

export class CustomerRepository {
  // ─── Reads ───────────────────────────────────────────────────────────────

  getAll(): Customer[] {
    return queryAll<Customer>(`
      SELECT
        c.*,
        COALESCE(SUM(i.total), 0) as total_invoiced,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN invoices inv ON p.invoice_id = inv.id
          WHERE inv.customer_id = c.id
        ), 0) as total_paid,
        COALESCE((
          SELECT SUM(ca.amount - ca.used_amount)
          FROM customer_advances ca
          WHERE ca.customer_id = c.id
        ), 0) as advance_balance
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
  }

  getById(id: number): any {
    const customer = queryOne(`
      SELECT
        c.*,
        COALESCE(SUM(i.total), 0) as total_invoiced,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN invoices inv ON p.invoice_id = inv.id
          WHERE inv.customer_id = c.id
        ), 0) as total_paid,
        COALESCE((
          SELECT SUM(ca.amount - ca.used_amount)
          FROM customer_advances ca
          WHERE ca.customer_id = c.id
        ), 0) as advance_balance
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      WHERE c.id = ?
      GROUP BY c.id
    `, [id]);

    if (!customer) return null;

    const invoices = queryAll(`
      SELECT
        i.*,
        COALESCE(SUM(p.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE i.customer_id = ?
      GROUP BY i.id
      ORDER BY i.date DESC
    `, [id]);

    const invoicesWithItems = (invoices as any[]).map((inv) => {
      const items = queryAll(`
        SELECT ii.*, m.name as merchandise_name
        FROM invoice_items ii
        LEFT JOIN merchandise m ON m.id = ii.merchandise_id
        WHERE ii.invoice_id = ?
      `, [inv.id]);

      const payments = queryAll(`
        SELECT * FROM payments WHERE invoice_id = ? ORDER BY date DESC
      `, [inv.id]);

      return { ...inv, items, payments };
    });

    const advances = this.getAdvances(id);

    return { ...(customer as any), invoices: invoicesWithItems, advances };
  }

  search(query: string): Customer[] {
    return queryAll<Customer>(`
      SELECT
        c.*,
        COALESCE(SUM(i.total), 0) as total_invoiced,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN invoices inv ON p.invoice_id = inv.id
          WHERE inv.customer_id = c.id
        ), 0) as total_paid,
        COALESCE((
          SELECT SUM(ca.amount - ca.used_amount)
          FROM customer_advances ca
          WHERE ca.customer_id = c.id
        ), 0) as advance_balance
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      WHERE c.name LIKE ? OR c.phone LIKE ?
      GROUP BY c.id
      ORDER BY c.name
    `, [`%${query}%`, `%${query}%`]);
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  create(data: { name: string; phone?: string | null; address?: string | null; notes?: string | null }): { id: number } {
    const id = runWrite(
      'INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)',
      [data.name, data.phone ?? null, data.address ?? null, data.notes ?? null]
    );
    return { id };
  }

  update(id: number, data: { name: string; phone?: string | null; address?: string | null; notes?: string | null }): { success: boolean } {
    getDb().run(
      'UPDATE customers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?',
      [data.name, data.phone ?? null, data.address ?? null, data.notes ?? null, id]
    );
    saveDb();
    return { success: true };
  }

  delete(id: number): { success: boolean } {
    getDb().run('DELETE FROM customers WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  }

  // ─── Advance Payments ────────────────────────────────────────────────────

  addAdvance(data: { customer_id: number; amount: number; date: string; notes?: string }): { id: number } {
    const id = runWrite(
      'INSERT INTO customer_advances (customer_id, amount, used_amount, date, notes) VALUES (?, ?, 0, ?, ?)',
      [data.customer_id, data.amount, data.date, data.notes ?? null]
    );
    return { id };
  }

  getAdvances(customerId: number): CustomerAdvance[] {
    return queryAll<CustomerAdvance>(
      'SELECT * FROM customer_advances WHERE customer_id = ? ORDER BY created_at DESC',
      [customerId]
    );
  }

  deleteAdvance(id: number): { success: boolean } {
    // Only delete if not yet consumed
    const row = queryOne<{ used_amount: number }>('SELECT used_amount FROM customer_advances WHERE id = ?', [id]);
    if (!row) return { success: false };
    if (row.used_amount > 0) throw new Error('لا يمكن حذف دفعة مقدمة تم استخدامها جزئياً أو كلياً في فواتير');
    getDb().run('DELETE FROM customer_advances WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  }

  getAvailableBalance(customerId: number): number {
    const row = queryOne<{ balance: number }>(
      'SELECT COALESCE(SUM(amount - used_amount), 0) as balance FROM customer_advances WHERE customer_id = ?',
      [customerId]
    );
    return row?.balance ?? 0;
  }

  /**
   * FIFO drain: consume `amount` from oldest advances first.
   * Call this INSIDE the same DB operation as invoice create (no separate saveDb here).
   */
  consumeBalance(customerId: number, amount: number): void {
    const db = getDb();
    const rows = queryAll<{ id: number; amount: number; used_amount: number }>(
      'SELECT id, amount, used_amount FROM customer_advances WHERE customer_id = ? AND amount > used_amount ORDER BY created_at ASC',
      [customerId]
    );
    let remaining = amount;
    for (const row of rows) {
      if (remaining <= 0) break;
      const available = row.amount - row.used_amount;
      const consume = Math.min(available, remaining);
      db.run('UPDATE customer_advances SET used_amount = used_amount + ? WHERE id = ?', [consume, row.id]);
      remaining -= consume;
    }
  }

  /**
   * LIFO restore: reverse `amount` from most-recently-consumed advances first.
   * Call this when an invoice with advance payments is deleted.
   */
  reverseBalance(customerId: number, amount: number): void {
    const db = getDb();
    const rows = queryAll<{ id: number; used_amount: number }>(
      'SELECT id, used_amount FROM customer_advances WHERE customer_id = ? AND used_amount > 0 ORDER BY created_at DESC',
      [customerId]
    );
    let remaining = amount;
    for (const row of rows) {
      if (remaining <= 0) break;
      const restore = Math.min(row.used_amount, remaining);
      db.run('UPDATE customer_advances SET used_amount = used_amount - ? WHERE id = ?', [restore, row.id]);
      remaining -= restore;
    }
  }
}
