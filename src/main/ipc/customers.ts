import { ipcMain } from 'electron';
import { getDb } from '../db';

export function registerCustomerHandlers() {
  const db = getDb();

  // Get all customers with balance summary
  ipcMain.handle('customers:getAll', () => {
    return db.prepare(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.address,
        c.notes,
        c.created_at,
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
    `).all();
  });

  // Get customer by ID with all invoices and payments
  ipcMain.handle('customers:getById', (_event, id: number) => {
    const customer = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.address,
      c.notes,
      c.created_at,
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

    const invoices = db.prepare(`
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
      const items = db.prepare(`
        SELECT ii.*, m.name as merchandise_name
        FROM invoice_items ii
        LEFT JOIN merchandise m ON m.id = ii.merchandise_id
        WHERE ii.invoice_id = ?
      `).all(inv.id);

      const payments = db.prepare(`
        SELECT * FROM payments WHERE invoice_id = ? ORDER BY date DESC
      `).all(inv.id);

      return { ...inv, items, payments };
    });

    return { ...customer, invoices: invoicesWithItems };
  });

  // Create customer
  ipcMain.handle('customers:create', (_event, data: { name: string; phone?: string; address?: string; notes?: string }) => {
    const result = db.prepare(
      'INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)'
    ).run(data.name, data.phone ?? null, data.address ?? null, data.notes ?? null);
    return { id: result.lastInsertRowid };
  });

  // Update customer
  ipcMain.handle('customers:update', (_event, id: number, data: { name: string; phone?: string; address?: string; notes?: string }) => {
    db.prepare(
      'UPDATE customers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?'
    ).run(data.name, data.phone ?? null, data.address ?? null, data.notes ?? null, id);
    return { success: true };
  });

  // Delete customer (cascade)
  ipcMain.handle('customers:delete', (_event, id: number) => {
    const deletePayments = db.prepare(`
      DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id = ?)
    `);
    const deleteItems = db.prepare(`
      DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id = ?)
    `);
    const deleteInvoices = db.prepare('DELETE FROM invoices WHERE customer_id = ?');
    const deleteCustomer = db.prepare('DELETE FROM customers WHERE id = ?');

    const cascade = db.transaction(() => {
      deletePayments.run(id);
      deleteItems.run(id);
      deleteInvoices.run(id);
      deleteCustomer.run(id);
    });
    cascade();
    return { success: true };
  });

  // Search customers
  ipcMain.handle('customers:search', (_event, query: string) => {
    return db.prepare(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.address,
        c.notes,
        c.created_at,
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
    `).all(`%${query}%`, `%${query}%`);
  });
}
