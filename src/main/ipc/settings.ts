import { ipcMain } from 'electron';
import { getDb, queryAll, saveDb } from '../db';

export function registerSettingsHandlers() {
  // Returns all settings as a flat { key: value } object
  ipcMain.handle('settings:getAll', () => {
    const rows = queryAll<{ key: string; value: string }>('SELECT key, value FROM settings');
    const cfg: Record<string, string> = {};
    for (const row of rows) {
      cfg[row.key] = row.value;
    }
    return cfg;
  });

  // Accepts a partial Record and upserts each key
  ipcMain.handle('settings:update', (_event, data: Record<string, string>) => {
    const db = getDb();
    for (const [key, value] of Object.entries(data)) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    saveDb();
    return { success: true };
  });
}
