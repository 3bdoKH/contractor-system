import { ipcMain } from 'electron';
import { getDb, queryAll, saveDb } from '../db';

interface AddPaymentData {
  invoice_id: number;
  amount: number;
  date: string;
  notes?: string;
}

export function registerPaymentHandlers() {
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

  // Delete payment
  ipcMain.handle('payments:delete', (_event, id: number) => {
    getDb().run('DELETE FROM payments WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });
}
