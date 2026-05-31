import { ipcMain } from 'electron';
import { getDb } from '../db';

export function registerMerchandiseHandlers() {
  const db = getDb();

  ipcMain.handle('merchandise:getAll', () => {
    return db.prepare('SELECT * FROM merchandise ORDER BY name').all();
  });
}
