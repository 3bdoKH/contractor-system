import { ipcMain } from 'electron';
import { ExpenseRepository } from '../db/repositories/ExpenseRepository';

export function registerExpenseHandlers() {
  const repository = new ExpenseRepository();

  ipcMain.handle('expenses:getAll', () => {
    return repository.getAllCombined();
  });

  ipcMain.handle('expenses:create', (_event, data: { description: string; amount: number; date: string; notes?: string }) => {
    return repository.create(data);
  });

  ipcMain.handle('expenses:delete', (_event, id: number) => {
    return repository.delete(id);
  });
}
