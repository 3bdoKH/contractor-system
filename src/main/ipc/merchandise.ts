import { ipcMain } from 'electron';
import { getDb, queryAll, saveDb } from '../db';

export function registerMerchandiseHandlers() {
  ipcMain.handle('merchandise:getAll', () => {
    return queryAll('SELECT * FROM merchandise ORDER BY name');
  });
}
