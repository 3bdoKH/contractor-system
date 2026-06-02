import { ipcMain } from 'electron';
import { getDb } from '../db';

export function registerSettingsHandlers() {
  const db = getDb();

  // Returns all settings as a flat { key: value } object
  ipcMain.handle('settings:getAll', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const cfg: Record<string, string> = {};
    for (const row of rows) {
      cfg[row.key] = row.value;
    }
    return cfg;
  });

  // Accepts a partial Record and upserts each key
  ipcMain.handle('settings:update', (_event, data: Record<string, string>) => {
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const doUpdate = db.transaction(() => {
      for (const [key, value] of Object.entries(data)) {
        upsert.run(key, String(value));
      }
    });
    doUpdate();
    return { success: true };
  });
}
