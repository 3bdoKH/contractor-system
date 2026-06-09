import { ipcMain } from 'electron';
import { IncomeRepository } from '../db/repositories/IncomeRepository';

export function registerIncomeHandlers() {
  const repository = new IncomeRepository();

  ipcMain.handle('incomes:getAll', () => {
    return repository.getAllCombined();
  });

  ipcMain.handle('incomes:create', (_event, data: { description: string; amount: number; date: string; notes?: string }) => {
    return repository.create(data);
  });

  ipcMain.handle('incomes:delete', (_event, id: number) => {
    return repository.delete(id);
  });
}
