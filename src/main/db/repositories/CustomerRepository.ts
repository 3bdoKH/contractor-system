import { getDb } from '../index';
import type { Database } from 'better-sqlite3';

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
  private db: Database;

  constructor() {
    this.db = getDb();
  }

  getAll(): Customer[] {
    return this.db.prepare(`
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
    `).all() as Customer[];
  }

  getById(id: number): any {
    const customer = this.db.prepare(`
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
    `).get(id);

    if (!customer) return null;

    const invoices = this.db.prepare(`
      SELECT
        i.*,
        COALESCE(SUM(p.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE i.customer_id = ?
      GROUP BY i.id
      ORDER BY i.date DESC
    `).all(id);

    const invoicesWithItems = (invoices as any[]).map((inv) => {
      const items = this.db.prepare(`
        SELECT ii.*, m.name as merchandise_name
        FROM invoice_items ii
        LEFT JOIN merchandise m ON m.id = ii.merchandise_id
        WHERE ii.invoice_id = ?
      `).all(inv.id);

      const payments = this.db.prepare(`
        SELECT * FROM payments WHERE invoice_id = ? ORDER BY date DESC
      `).all(inv.id);

      return { ...inv, items, payments };
    });

    return { ...(customer as any), invoices: invoicesWithItems };
  }

  create(data: { name: string; phone?: string | null; address?: string | null; notes?: string | null }): { id: number | bigint } {
    const result = this.db.prepare(
      'INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)'
    ).run(data.name, data.phone ?? null, data.address ?? null, data.notes ?? null);
    return { id: result.lastInsertRowid };
  }

  update(id: number, data: { name: string; phone?: string | null; address?: string | null; notes?: string | null }): { success: boolean } {
    this.db.prepare(
      'UPDATE customers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?'
    ).run(data.name, data.phone ?? null, data.address ?? null, data.notes ?? null, id);
    return { success: true };
  }

  delete(id: number): { success: boolean } {
    this.db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return { success: true };
  }

  search(query: string): Customer[] {
    return this.db.prepare(`
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
    `).all(`%${query}%`, `%${query}%`) as Customer[];
  }
}
