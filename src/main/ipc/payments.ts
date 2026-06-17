import { ipcMain } from 'electron';
import { getDb, queryAll, queryOne, saveDb } from '../db';
import { CustomerRepository } from '../db/repositories/CustomerRepository';

interface AddPaymentData {
  invoice_id: number;
  amount: number;
  date: string;
  notes?: string;
}

export function registerPaymentHandlers() {
  const customerRepo = new CustomerRepository();

  // Add payment
  ipcMain.handle('payments:add', (_event, data: AddPaymentData) => {
    const db = getDb();
    db.run(
      'INSERT INTO payments (invoice_id, amount, date, notes) VALUES (?, ?, ?, ?)',
      [data.invoice_id, data.amount, data.date, data.notes ?? null]
    );
    const row = db.exec('SELECT last_insert_rowid() as id');
    const id = row[0]?.values[0]?.[0] as number ?? 0;
    saveDb();
    return { id };
  });

  // Get payments by invoice
  ipcMain.handle('payments:getByInvoice', (_event, invoiceId: number) => {
    return queryAll(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY date DESC',
      [invoiceId]
    );
  });

  // Delete payment — reverses advance balance if the payment was auto-applied
  ipcMain.handle('payments:delete', (_event, id: number) => {
    const db = getDb();

    // Check if this is an advance payment and get its invoice's customer
    const pmtRow = queryOne<{ amount: number; is_advance: number; invoice_id: number }>(
      'SELECT amount, is_advance, invoice_id FROM payments WHERE id = ?',
      [id]
    );

    if (pmtRow?.is_advance) {
      const invRow = queryOne<{ customer_id: number }>(
        'SELECT customer_id FROM invoices WHERE id = ?',
        [pmtRow.invoice_id]
      );
      if (invRow) {
        customerRepo.reverseBalance(invRow.customer_id, pmtRow.amount);
      }
    }

    db.run('DELETE FROM payments WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });
}
