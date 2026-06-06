import { getDb, queryAll, queryOne, runWrite, saveDb } from '../index';

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
  total_invoiced?: number;
  total_paid?: number;
}

export interface SupplyInvoiceItem {
  id: number;
  supply_invoice_id: number;
  merchandise_id?: number | null;
  custom_name?: string | null;
  merchandise_name?: string | null;
  quantity: number;
  unit_price: number;
  unit?: string | null;
}

export interface SupplierPayment {
  id: number;
  supply_invoice_id: number;
  amount: number;
  date: string;
  notes?: string | null;
  created_at?: string;
}

export interface SupplyInvoice {
  id: number;
  invoice_number: string;
  supplier_id: number;
  date: string;
  total: number;
  total_paid: number;
  notes?: string | null;
  created_at?: string;
  items?: SupplyInvoiceItem[];
  payments?: SupplierPayment[];
}

export interface SupplierDetail extends Supplier {
  invoices: SupplyInvoice[];
}

export interface CreateSupplyInvoiceData {
  supplier_id: number;
  date: string;
  notes?: string;
  items: {
    merchandise_id?: number | null;
    custom_name?: string | null;
    quantity: number;
    unit_price: number;
    unit?: string | null;
  }[];
}

export interface AddSupplierPaymentData {
  supply_invoice_id: number;
  amount: number;
  date: string;
  notes?: string;
}

/** Shared balance summary SQL — used by getAll and search */
const BALANCE_SELECT = `
  SELECT
    s.*,
    COALESCE(SUM(si.total), 0) as total_invoiced,
    COALESCE((
      SELECT SUM(sp.amount)
      FROM supplier_payments sp
      JOIN supply_invoices siv ON sp.supply_invoice_id = siv.id
      WHERE siv.supplier_id = s.id
    ), 0) as total_paid
  FROM suppliers s
  LEFT JOIN supply_invoices si ON si.supplier_id = s.id
`;

export class SupplierRepository {
  // ─── Suppliers ────────────────────────────────────────────────

  getAll(): Supplier[] {
    return queryAll<Supplier>(`
      ${BALANCE_SELECT}
      GROUP BY s.id
      ORDER BY s.name
    `);
  }

  getById(id: number): SupplierDetail | null {
    const supplier = queryOne<Supplier>(`
      ${BALANCE_SELECT}
      WHERE s.id = ?
      GROUP BY s.id
    `, [id]);

    if (!supplier) return null;

    const invoices = queryAll(`
      SELECT
        si.*,
        COALESCE(SUM(sp.amount), 0) as total_paid
      FROM supply_invoices si
      LEFT JOIN supplier_payments sp ON sp.supply_invoice_id = si.id
      WHERE si.supplier_id = ?
      GROUP BY si.id
      ORDER BY si.date DESC
    `, [id]);

    const invoicesWithDetails = (invoices as any[]).map((inv) => {
      const items = queryAll(`
        SELECT sii.*, m.name as merchandise_name
        FROM supply_invoice_items sii
        LEFT JOIN merchandise m ON m.id = sii.merchandise_id
        WHERE sii.supply_invoice_id = ?
      `, [inv.id]);

      const payments = queryAll(`
        SELECT * FROM supplier_payments WHERE supply_invoice_id = ? ORDER BY date DESC
      `, [inv.id]);

      return { ...inv, items, payments };
    });

    return { ...supplier, invoices: invoicesWithDetails };
  }

  create(data: { name: string; phone?: string | null; address?: string | null; notes?: string | null }): { id: number } {
    const id = runWrite(
      'INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)',
      [data.name, data.phone ?? null, data.address ?? null, data.notes ?? null]
    );
    return { id };
  }

  update(id: number, data: { name: string; phone?: string | null; address?: string | null; notes?: string | null }): { success: boolean } {
    getDb().run(
      'UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?',
      [data.name, data.phone ?? null, data.address ?? null, data.notes ?? null, id]
    );
    saveDb();
    return { success: true };
  }

  delete(id: number): { success: boolean } {
    const db = getDb();
    const invoices = queryAll<{ id: number }>(
      'SELECT id FROM supply_invoices WHERE supplier_id = ?',
      [id]
    );

    for (const inv of invoices) {
      db.run('DELETE FROM supplier_payments WHERE supply_invoice_id = ?', [inv.id]);
      db.run('DELETE FROM supply_invoice_items WHERE supply_invoice_id = ?', [inv.id]);
    }
    db.run('DELETE FROM supply_invoices WHERE supplier_id = ?', [id]);
    db.run('DELETE FROM suppliers WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  }

  search(query: string): Supplier[] {
    return queryAll<Supplier>(`
      ${BALANCE_SELECT}
      WHERE s.name LIKE ? OR s.phone LIKE ?
      GROUP BY s.id
      ORDER BY s.name
    `, [`%${query}%`, `%${query}%`]);
  }

  // ─── Supply Invoices ──────────────────────────────────────────

  private generateInvoiceNumber(): string {
    const last = queryOne<{ invoice_number: string }>(
      'SELECT invoice_number FROM supply_invoices ORDER BY id DESC LIMIT 1'
    );

    if (!last) return 'SUP-1001';
    const num = parseInt(last.invoice_number.replace('SUP-', ''), 10);
    return `SUP-${num + 1}`;
  }

  createInvoice(data: CreateSupplyInvoiceData): { id: number; invoice_number: string } {
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const invoiceNumber = this.generateInvoiceNumber();
    const db = getDb();

    db.run(
      'INSERT INTO supply_invoices (invoice_number, supplier_id, date, total, notes) VALUES (?, ?, ?, ?, ?)',
      [invoiceNumber, data.supplier_id, data.date, total, data.notes ?? null]
    );
    const invRow = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const invoiceId = invRow!.id;

    for (const item of data.items) {
      db.run(
        'INSERT INTO supply_invoice_items (supply_invoice_id, merchandise_id, custom_name, quantity, unit_price, unit) VALUES (?, ?, ?, ?, ?, ?)',
        [invoiceId, item.merchandise_id ?? null, item.custom_name ?? null, item.quantity, item.unit_price, item.unit ?? null]
      );
    }

    saveDb();
    return { id: invoiceId, invoice_number: invoiceNumber };
  }

  getInvoicesBySupplier(supplierId: number): SupplyInvoice[] {
    const invoices = queryAll(`
      SELECT
        si.*,
        COALESCE(SUM(sp.amount), 0) as total_paid
      FROM supply_invoices si
      LEFT JOIN supplier_payments sp ON sp.supply_invoice_id = si.id
      WHERE si.supplier_id = ?
      GROUP BY si.id
      ORDER BY si.date DESC
    `, [supplierId]);

    return (invoices as any[]).map((inv) => {
      const items = queryAll(`
        SELECT sii.*, m.name as merchandise_name
        FROM supply_invoice_items sii
        LEFT JOIN merchandise m ON m.id = sii.merchandise_id
        WHERE sii.supply_invoice_id = ?
      `, [inv.id]);

      const payments = queryAll(`
        SELECT * FROM supplier_payments WHERE supply_invoice_id = ? ORDER BY date DESC
      `, [inv.id]);

      return { ...inv, items, payments };
    });
  }

  deleteInvoice(id: number): { success: boolean } {
    const db = getDb();
    db.run('DELETE FROM supplier_payments WHERE supply_invoice_id = ?', [id]);
    db.run('DELETE FROM supply_invoice_items WHERE supply_invoice_id = ?', [id]);
    db.run('DELETE FROM supply_invoices WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  }

  // ─── Supplier Payments ────────────────────────────────────────

  addPayment(data: AddSupplierPaymentData): { id: number } {
    const id = runWrite(
      'INSERT INTO supplier_payments (supply_invoice_id, amount, date, notes) VALUES (?, ?, ?, ?)',
      [data.supply_invoice_id, data.amount, data.date, data.notes ?? null]
    );
    return { id };
  }

  getPaymentsByInvoice(invoiceId: number): SupplierPayment[] {
    return queryAll<SupplierPayment>(
      'SELECT * FROM supplier_payments WHERE supply_invoice_id = ? ORDER BY date DESC',
      [invoiceId]
    );
  }

  deletePayment(id: number): { success: boolean } {
    getDb().run('DELETE FROM supplier_payments WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  }
}
