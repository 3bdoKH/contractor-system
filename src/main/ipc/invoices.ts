import { ipcMain } from 'electron';
import { getDb, queryAll, queryOne, saveDb } from '../db';

interface InvoiceItem {
  merchandise_id?: number | null;
  custom_name?: string | null;
  quantity: number;
  unit_price: number;
  unit?: string | null;
}

interface CreateInvoiceData {
  customer_id: number;
  date: string;
  notes?: string;
  items: InvoiceItem[];
}

interface UpdateInvoiceData {
  date: string;
  notes?: string;
  items: InvoiceItem[];
}

export function registerInvoiceHandlers() {
  // Generate next invoice number
  function generateInvoiceNumber(): string {
    const last = queryOne<{ invoice_number: string }>(
      'SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1'
    );
    if (!last) return 'INV-1001';
    const num = parseInt(last.invoice_number.replace('INV-', ''), 10);
    return `INV-${num + 1}`;
  }

  // Create invoice with items
  ipcMain.handle('invoices:create', (_event, data: CreateInvoiceData) => {
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const invoiceNumber = generateInvoiceNumber();
    const db = getDb();

    db.run(
      'INSERT INTO invoices (invoice_number, customer_id, date, total, notes) VALUES (?, ?, ?, ?, ?)',
      [invoiceNumber, data.customer_id, data.date, total, data.notes ?? null]
    );
    const invRow = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const invoiceId = invRow!.id;

    for (const item of data.items) {
      db.run(
        'INSERT INTO invoice_items (invoice_id, merchandise_id, custom_name, quantity, unit_price, unit) VALUES (?, ?, ?, ?, ?, ?)',
        [invoiceId, item.merchandise_id ?? null, item.custom_name ?? null, item.quantity, item.unit_price, item.unit ?? null]
      );
    }

    saveDb();
    return { id: invoiceId, invoice_number: invoiceNumber };
  });

  // Get invoices by customer
  ipcMain.handle('invoices:getByCustomer', (_event, customerId: number) => {
    const invoices = queryAll(`
      SELECT
        i.*,
        COALESCE(SUM(p.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE i.customer_id = ?
      GROUP BY i.id
      ORDER BY i.date DESC
    `, [customerId]);

    return (invoices as any[]).map((inv) => {
      const items = queryAll(`
        SELECT ii.*, m.name as merchandise_name
        FROM invoice_items ii
        LEFT JOIN merchandise m ON m.id = ii.merchandise_id
        WHERE ii.invoice_id = ?
      `, [inv.id]);

      const payments = queryAll(
        'SELECT * FROM payments WHERE invoice_id = ? ORDER BY date DESC',
        [inv.id]
      );

      return { ...inv, items, payments };
    });
  });

  // Get single invoice by id (with items)
  ipcMain.handle('invoices:getById', (_event, id: number) => {
    const inv = queryOne('SELECT * FROM invoices WHERE id = ?', [id]) as any;
    if (!inv) return null;

    const items = queryAll(`
      SELECT ii.*, m.name as merchandise_name
      FROM invoice_items ii
      LEFT JOIN merchandise m ON m.id = ii.merchandise_id
      WHERE ii.invoice_id = ?
    `, [id]);

    return { ...inv, items };
  });

  // Update invoice (replace items, recalculate total)
  ipcMain.handle('invoices:update', (_event, id: number, data: UpdateInvoiceData) => {
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const db = getDb();

    db.run(
      'UPDATE invoices SET date = ?, notes = ?, total = ? WHERE id = ?',
      [data.date, data.notes ?? null, total, id]
    );
    db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

    for (const item of data.items) {
      db.run(
        'INSERT INTO invoice_items (invoice_id, merchandise_id, custom_name, quantity, unit_price, unit) VALUES (?, ?, ?, ?, ?, ?)',
        [id, item.merchandise_id ?? null, item.custom_name ?? null, item.quantity, item.unit_price, item.unit ?? null]
      );
    }

    saveDb();
    return { success: true };
  });

  // Delete invoice (cascade items and payments)
  ipcMain.handle('invoices:delete', (_event, id: number) => {
    const db = getDb();
    db.run('DELETE FROM payments WHERE invoice_id = ?', [id]);
    db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
    db.run('DELETE FROM invoices WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });
}
