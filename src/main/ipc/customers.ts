import { ipcMain } from 'electron';
import { CustomerRepository } from '../db/repositories/CustomerRepository';

export function registerCustomerHandlers() {
  const repository = new CustomerRepository();

  // Get all customers with balance summary
  ipcMain.handle('customers:getAll', () => {
    return repository.getAll();
  });

  // Get customer by ID with all invoices, payments, and advances
  ipcMain.handle('customers:getById', (_event, id: number) => {
    return repository.getById(id);
  });

  // Create customer
  ipcMain.handle('customers:create', (_event, data: { name: string; phone?: string; address?: string; notes?: string }) => {
    return repository.create(data);
  });

  // Update customer
  ipcMain.handle('customers:update', (_event, id: number, data: { name: string; phone?: string; address?: string; notes?: string }) => {
    return repository.update(id, data);
  });

  // Delete customer (cascade)
  ipcMain.handle('customers:delete', (_event, id: number) => {
    return repository.delete(id);
  });

  // Search customers
  ipcMain.handle('customers:search', (_event, query: string) => {
    return repository.search(query);
  });

  // ─── Advance Payments ────────────────────────────────────────────────────

  // Record a new advance deposit
  ipcMain.handle('customers:addAdvance', (_event, data: { customer_id: number; amount: number; date: string; notes?: string }) => {
    return repository.addAdvance(data);
  });

  // Get all advance records for a customer
  ipcMain.handle('customers:getAdvances', (_event, customerId: number) => {
    return repository.getAdvances(customerId);
  });

  // Delete an advance (only if not yet consumed)
  ipcMain.handle('customers:deleteAdvance', (_event, id: number) => {
    return repository.deleteAdvance(id);
  });
}
