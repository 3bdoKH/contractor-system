import { ipcMain } from 'electron';
import { getDb } from '../db';

interface InvoiceItem {
  merchandise_id?: number | null;
  custom_name?: string | null;
  quantity: number;
  unit_price: number;
}

interface CreateInvoiceData {
  customer_id: number;
  date: string;
  notes?: string;
  items: InvoiceItem[];
}

export function registerInvoiceHandlers() {
  const db = getDb();

  // Generate next invoice number
  function generateInvoiceNumber(): string {
    const last = db.prepare(`
      SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1
    `).get() as { invoice_number: string } | undefined;

    if (!last) return 'INV-1001';
    const num = parseInt(last.invoice_number.replace('INV-', ''), 10);
    return `INV-${num + 1}`;
  }

  // Create invoice with items
  ipcMain.handle('invoices:create', (_event, data: CreateInvoiceData) => {
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const invoiceNumber = generateInvoiceNumber();

    const createInvoice = db.transaction(() => {
      const inv = db.prepare(
        'INSERT INTO invoices (invoice_number, customer_id, date, total, notes) VALUES (?, ?, ?, ?, ?)'
      ).run(invoiceNumber, data.customer_id, data.date, total, data.notes ?? null);

      const invoiceId = inv.lastInsertRowid;

      const insertItem = db.prepare(
        'INSERT INTO invoice_items (invoice_id, merchandise_id, custom_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)'
      );

      for (const item of data.items) {
        insertItem.run(
          invoiceId,
          item.merchandise_id ?? null,
          item.custom_name ?? null,
          item.quantity,
          item.unit_price
        );
      }

      return { id: invoiceId, invoice_number: invoiceNumber };
    });

    return createInvoice();
  });

  // Get invoices by customer
  ipcMain.handle('invoices:getByCustomer', (_event, customerId: number) => {
    const invoices = db.prepare(`
      SELECT
        i.*,
        COALESCE(SUM(p.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE i.customer_id = ?
      GROUP BY i.id
      ORDER BY i.date DESC
    `).all(customerId);

    return (invoices as any[]).map((inv) => {
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
  });

  // Delete invoice (cascade items and payments)
  ipcMain.handle('invoices:delete', (_event, id: number) => {
    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM payments WHERE invoice_id = ?').run(id);
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    });
    deleteAll();
    return { success: true };
  });
}
