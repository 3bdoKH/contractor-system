import { getDb, queryAll, runWrite, saveDb } from '../index';

export interface Expense {
  type: 'manual' | 'supplier_payment';
  id: number;
  description: string;
  amount: number;
  date: string;
  notes?: string | null;
  created_at?: string;
}

export interface CreateExpenseData {
  description: string;
  amount: number;
  date: string;
  notes?: string;
}

export class ExpenseRepository {
  getAllCombined(): Expense[] {
    return queryAll<Expense>(`
      SELECT 
        'manual' as type,
        id,
        description,
        amount,
        date,
        notes,
        created_at
      FROM expenses

      UNION ALL

      SELECT 
        'supplier_payment' as type,
        sp.id,
        'دفعة للمورد: ' || s.name || ' (فاتورة: ' || si.invoice_number || ')' as description,
        sp.amount,
        sp.date,
        sp.notes,
        sp.created_at
      FROM supplier_payments sp
      JOIN supply_invoices si ON sp.supply_invoice_id = si.id
      JOIN suppliers s ON si.supplier_id = s.id

      ORDER BY date DESC, created_at DESC
    `);
  }

  create(data: CreateExpenseData): { id: number } {
    const id = runWrite(
      'INSERT INTO expenses (description, amount, date, notes) VALUES (?, ?, ?, ?)',
      [data.description, data.amount, data.date, data.notes ?? null]
    );
    return { id };
  }

  delete(id: number): { success: boolean } {
    getDb().run('DELETE FROM expenses WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  }
}
