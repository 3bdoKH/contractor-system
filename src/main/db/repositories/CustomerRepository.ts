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
        ), 0) as total_paid
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
        ), 0) as total_paid
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

    return { ...(customer as any), invoices: invoicesWithItems };
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
        ), 0) as total_paid
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
}
