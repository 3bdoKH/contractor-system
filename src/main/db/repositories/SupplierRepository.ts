import { getDb } from '../index';
import type { Database } from 'better-sqlite3';

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
  private db: Database;

  constructor() {
    this.db = getDb();
  }

  // ─── Suppliers ────────────────────────────────────────────────

  getAll(): Supplier[] {
    return this.db.prepare(`
      ${BALANCE_SELECT}
      GROUP BY s.id
      ORDER BY s.name
    `).all() as Supplier[];
  }

  getById(id: number): SupplierDetail | null {
    const supplier = this.db.prepare(`
      ${BALANCE_SELECT}
      WHERE s.id = ?
      GROUP BY s.id
    `).get(id);

    if (!supplier) return null;

    const invoices = this.db.prepare(`
      SELECT
        si.*,
        COALESCE(SUM(sp.amount), 0) as total_paid
      FROM supply_invoices si
      LEFT JOIN supplier_payments sp ON sp.supply_invoice_id = si.id
      WHERE si.supplier_id = ?
      GROUP BY si.id
      ORDER BY si.date DESC
    `).all(id);

    const invoicesWithDetails = (invoices as any[]).map((inv) => {
      const items = this.db.prepare(`
        SELECT sii.*, m.name as merchandise_name
        FROM supply_invoice_items sii
        LEFT JOIN merchandise m ON m.id = sii.merchandise_id
        WHERE sii.supply_invoice_id = ?
      `).all(inv.id);

      const payments = this.db.prepare(`
        SELECT * FROM supplier_payments WHERE supply_invoice_id = ? ORDER BY date DESC
      `).all(inv.id);

      return { ...inv, items, payments };
    });

    return { ...(supplier as Supplier), invoices: invoicesWithDetails };
  }

  create(data: { name: string; phone?: string | null; address?: string | null; notes?: string | null }): { id: number | bigint } {
    const result = this.db.prepare(
      'INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)'
    ).run(data.name, data.phone ?? null, data.address ?? null, data.notes ?? null);
    return { id: result.lastInsertRowid };
  }

  update(id: number, data: { name: string; phone?: string | null; address?: string | null; notes?: string | null }): { success: boolean } {
    this.db.prepare(
      'UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?'
    ).run(data.name, data.phone ?? null, data.address ?? null, data.notes ?? null, id);
    return { success: true };
  }

  delete(id: number): { success: boolean } {
    const doDelete = this.db.transaction(() => {
      const invoices = this.db.prepare(
        'SELECT id FROM supply_invoices WHERE supplier_id = ?'
      ).all(id) as { id: number }[];

      for (const inv of invoices) {
        this.db.prepare('DELETE FROM supplier_payments WHERE supply_invoice_id = ?').run(inv.id);
        this.db.prepare('DELETE FROM supply_invoice_items WHERE supply_invoice_id = ?').run(inv.id);
      }
      this.db.prepare('DELETE FROM supply_invoices WHERE supplier_id = ?').run(id);
      this.db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    });
    doDelete();
    return { success: true };
  }

  search(query: string): Supplier[] {
    return this.db.prepare(`
      ${BALANCE_SELECT}
      WHERE s.name LIKE ? OR s.phone LIKE ?
      GROUP BY s.id
      ORDER BY s.name
    `).all(`%${query}%`, `%${query}%`) as Supplier[];
  }

  // ─── Supply Invoices ──────────────────────────────────────────

  private generateInvoiceNumber(): string {
    const last = this.db.prepare(
      'SELECT invoice_number FROM supply_invoices ORDER BY id DESC LIMIT 1'
    ).get() as { invoice_number: string } | undefined;

    if (!last) return 'SUP-1001';
    const num = parseInt(last.invoice_number.replace('SUP-', ''), 10);
    return `SUP-${num + 1}`;
  }

  createInvoice(data: CreateSupplyInvoiceData): { id: number | bigint; invoice_number: string } {
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const invoiceNumber = this.generateInvoiceNumber();

    const result = this.db.transaction(() => {
      const inv = this.db.prepare(
        'INSERT INTO supply_invoices (invoice_number, supplier_id, date, total, notes) VALUES (?, ?, ?, ?, ?)'
      ).run(invoiceNumber, data.supplier_id, data.date, total, data.notes ?? null);

      const invoiceId = inv.lastInsertRowid;

      const insertItem = this.db.prepare(
        'INSERT INTO supply_invoice_items (supply_invoice_id, merchandise_id, custom_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)'
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
    })();

    return result;
  }

  getInvoicesBySupplier(supplierId: number): SupplyInvoice[] {
    const invoices = this.db.prepare(`
      SELECT
        si.*,
        COALESCE(SUM(sp.amount), 0) as total_paid
      FROM supply_invoices si
      LEFT JOIN supplier_payments sp ON sp.supply_invoice_id = si.id
      WHERE si.supplier_id = ?
      GROUP BY si.id
      ORDER BY si.date DESC
    `).all(supplierId);

    return (invoices as any[]).map((inv) => {
      const items = this.db.prepare(`
        SELECT sii.*, m.name as merchandise_name
        FROM supply_invoice_items sii
        LEFT JOIN merchandise m ON m.id = sii.merchandise_id
        WHERE sii.supply_invoice_id = ?
      `).all(inv.id);

      const payments = this.db.prepare(`
        SELECT * FROM supplier_payments WHERE supply_invoice_id = ? ORDER BY date DESC
      `).all(inv.id);

      return { ...inv, items, payments };
    });
  }

  deleteInvoice(id: number): { success: boolean } {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM supplier_payments WHERE supply_invoice_id = ?').run(id);
      this.db.prepare('DELETE FROM supply_invoice_items WHERE supply_invoice_id = ?').run(id);
      this.db.prepare('DELETE FROM supply_invoices WHERE id = ?').run(id);
    })();
    return { success: true };
  }

  // ─── Supplier Payments ────────────────────────────────────────

  addPayment(data: AddSupplierPaymentData): { id: number | bigint } {
    const result = this.db.prepare(
      'INSERT INTO supplier_payments (supply_invoice_id, amount, date, notes) VALUES (?, ?, ?, ?)'
    ).run(data.supply_invoice_id, data.amount, data.date, data.notes ?? null);
    return { id: result.lastInsertRowid };
  }

  getPaymentsByInvoice(invoiceId: number): SupplierPayment[] {
    return this.db.prepare(
      'SELECT * FROM supplier_payments WHERE supply_invoice_id = ? ORDER BY date DESC'
    ).all(invoiceId) as SupplierPayment[];
  }

  deletePayment(id: number): { success: boolean } {
    this.db.prepare('DELETE FROM supplier_payments WHERE id = ?').run(id);
    return { success: true };
  }
}
