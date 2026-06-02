import { ipcMain } from 'electron';
import { SupplierRepository } from '../db/repositories/SupplierRepository';

export function registerSupplierHandlers() {
  const repository = new SupplierRepository();

  // ─── Suppliers ────────────────────────────────────────────────

  ipcMain.handle('suppliers:getAll', () => {
    return repository.getAll();
  });

  ipcMain.handle('suppliers:getById', (_event, id: number) => {
    return repository.getById(id);
  });

  ipcMain.handle('suppliers:create', (_event, data: { name: string; phone?: string; address?: string; notes?: string }) => {
    return repository.create(data);
  });

  ipcMain.handle('suppliers:update', (_event, id: number, data: { name: string; phone?: string; address?: string; notes?: string }) => {
    return repository.update(id, data);
  });

  ipcMain.handle('suppliers:delete', (_event, id: number) => {
    return repository.delete(id);
  });

  ipcMain.handle('suppliers:search', (_event, query: string) => {
    return repository.search(query);
  });

  // ─── Supply Invoices ──────────────────────────────────────────

  ipcMain.handle('supplyInvoices:create', (_event, data: any) => {
    return repository.createInvoice(data);
  });

  ipcMain.handle('supplyInvoices:getBySupplier', (_event, supplierId: number) => {
    return repository.getInvoicesBySupplier(supplierId);
  });

  ipcMain.handle('supplyInvoices:delete', (_event, id: number) => {
    return repository.deleteInvoice(id);
  });

  // ─── Supplier Payments ────────────────────────────────────────

  ipcMain.handle('supplierPayments:add', (_event, data: any) => {
    return repository.addPayment(data);
  });

  ipcMain.handle('supplierPayments:getByInvoice', (_event, invoiceId: number) => {
    return repository.getPaymentsByInvoice(invoiceId);
  });

  ipcMain.handle('supplierPayments:delete', (_event, id: number) => {
    return repository.deletePayment(id);
  });
}
