import { getDb, queryAll, runWrite, saveDb } from '../index';

export interface Income {
  type: 'manual' | 'customer_payment';
  id: number;
  description: string;
  amount: number;
  date: string;
  notes?: string | null;
  created_at?: string;
}

export interface CreateIncomeData {
  description: string;
  amount: number;
  date: string;
  notes?: string;
}

export class IncomeRepository {
  getAllCombined(): Income[] {
    return queryAll<Income>(`
      SELECT 
        'manual' as type,
        id,
        description,
        amount,
        date,
        notes,
        created_at
      FROM incomes

      UNION ALL

      SELECT 
        'customer_payment' as type,
        p.id,
        'دفعة من العميل: ' || c.name || ' (فاتورة: ' || inv.invoice_number || ')' as description,
        p.amount,
        p.date,
        p.notes,
        p.created_at
      FROM payments p
      JOIN invoices inv ON p.invoice_id = inv.id
      JOIN customers c ON inv.customer_id = c.id

      ORDER BY date DESC, created_at DESC
    `);
  }

  create(data: CreateIncomeData): { id: number } {
    const id = runWrite(
      'INSERT INTO incomes (description, amount, date, notes) VALUES (?, ?, ?, ?)',
      [data.description, data.amount, data.date, data.notes ?? null]
    );
    return { id };
  }

  delete(id: number): { success: boolean } {
    getDb().run('DELETE FROM incomes WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  }
}
