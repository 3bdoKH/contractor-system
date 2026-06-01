import { ipcMain } from 'electron';
import { CustomerRepository } from '../db/repositories/CustomerRepository';

export function registerCustomerHandlers() {
  const repository = new CustomerRepository();

  // Get all customers with balance summary
  ipcMain.handle('customers:getAll', () => {
    return repository.getAll();
  });

  // Get customer by ID with all invoices and payments
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
}
