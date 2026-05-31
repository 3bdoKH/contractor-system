import { ipcMain } from 'electron';
import { getDb } from '../db';

interface AddPaymentData {
  invoice_id: number;
  amount: number;
  date: string;
  notes?: string;
}

export function registerPaymentHandlers() {
  const db = getDb();

  // Add payment
  ipcMain.handle('payments:add', (_event, data: AddPaymentData) => {
    const result = db.prepare(
      'INSERT INTO payments (invoice_id, amount, date, notes) VALUES (?, ?, ?, ?)'
    ).run(data.invoice_id, data.amount, data.date, data.notes ?? null);
    return { id: result.lastInsertRowid };
  });

  // Get payments by invoice
  ipcMain.handle('payments:getByInvoice', (_event, invoiceId: number) => {
    return db.prepare(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY date DESC'
    ).all(invoiceId);
  });

  // Delete payment
  ipcMain.handle('payments:delete', (_event, id: number) => {
    db.prepare('DELETE FROM payments WHERE id = ?').run(id);
    return { success: true };
  });
}
