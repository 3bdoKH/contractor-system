import { ipcMain } from 'electron';
import { getDb, queryAll, saveDb } from '../db';

export function registerMerchandiseHandlers() {
  // ── Read ──────────────────────────────────────────────────────────────────

  /** Return all merchandise items (flat list, for dropdowns). */
  ipcMain.handle('merchandise:getAll', () => {
    return queryAll('SELECT * FROM merchandise ORDER BY name');
  });

  /**
   * Return all merchandise items with their associated units.
   * Each row: { id, name, units: [{id, unit, is_default}] }
   */
  ipcMain.handle('merchandise:getAllWithUnits', () => {
    const items = queryAll<{ id: number; name: string }>(
      'SELECT id, name FROM merchandise ORDER BY name'
    );
    const units = queryAll<{ id: number; merchandise_id: number; unit: string; is_default: number }>(
      'SELECT id, merchandise_id, unit, is_default FROM merchandise_units ORDER BY is_default DESC, unit ASC'
    );

    return items.map(item => ({
      ...item,
      units: units.filter(u => u.merchandise_id === item.id),
    }));
  });

  /** Return units for a single merchandise item. */
  ipcMain.handle('merchandise:getUnits', (_event, merchandiseId: number) => {
    return queryAll(
      'SELECT id, unit, is_default FROM merchandise_units WHERE merchandise_id = ? ORDER BY is_default DESC, unit ASC',
      [merchandiseId]
    );
  });

  // ── Create ────────────────────────────────────────────────────────────────

  /** Create a new merchandise item (optionally with initial units). */
  ipcMain.handle('merchandise:create', (_event, data: { name: string; units?: { unit: string; is_default?: boolean }[] }) => {
    const db = getDb();
    db.run('INSERT INTO merchandise (name) VALUES (?)', [data.name.trim()]);
    const row = db.exec('SELECT last_insert_rowid() as id');
    const id = row[0]?.values[0]?.[0] as number;

    if (data.units?.length) {
      for (const u of data.units) {
        db.run(
          'INSERT OR IGNORE INTO merchandise_units (merchandise_id, unit, is_default) VALUES (?, ?, ?)',
          [id, u.unit.trim(), u.is_default ? 1 : 0]
        );
      }
    }

    saveDb();
    return { id };
  });

  // ── Update ────────────────────────────────────────────────────────────────

  /** Rename a merchandise item. */
  ipcMain.handle('merchandise:update', (_event, id: number, data: { name: string }) => {
    getDb().run('UPDATE merchandise SET name = ? WHERE id = ?', [data.name.trim(), id]);
    saveDb();
    return { success: true };
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  /** Delete a merchandise item (cascades to units + inventory_adjustments). */
  ipcMain.handle('merchandise:delete', (_event, id: number) => {
    getDb().run('DELETE FROM merchandise WHERE id = ?', [id]);
    saveDb();
    return { success: true };
  });

  // ── Units CRUD ────────────────────────────────────────────────────────────

  /** Add a unit to a merchandise item. */
  ipcMain.handle('merchandise:addUnit', (_event, merchandiseId: number, unit: string, isDefault: boolean) => {
    const db = getDb();
    if (isDefault) {
      // Clear existing default first
      db.run('UPDATE merchandise_units SET is_default = 0 WHERE merchandise_id = ?', [merchandiseId]);
    }
    db.run(
      'INSERT OR IGNORE INTO merchandise_units (merchandise_id, unit, is_default) VALUES (?, ?, ?)',
      [merchandiseId, unit.trim(), isDefault ? 1 : 0]
    );
    const row = db.exec('SELECT last_insert_rowid() as id');
    const id = row[0]?.values[0]?.[0] as number;
    saveDb();
    return { id };
  });

  /** Set a unit as the default for its merchandise item. */
  ipcMain.handle('merchandise:setDefaultUnit', (_event, merchandiseId: number, unitId: number) => {
    const db = getDb();
    db.run('UPDATE merchandise_units SET is_default = 0 WHERE merchandise_id = ?', [merchandiseId]);
    db.run('UPDATE merchandise_units SET is_default = 1 WHERE id = ?', [unitId]);
    saveDb();
    return { success: true };
  });

  /** Delete a unit from a merchandise item. */
  ipcMain.handle('merchandise:deleteUnit', (_event, unitId: number) => {
    getDb().run('DELETE FROM merchandise_units WHERE id = ?', [unitId]);
    saveDb();
    return { success: true };
  });

  /** Replace all units for a merchandise item (used when saving the full unit list). */
  ipcMain.handle('merchandise:setUnits', (_event, merchandiseId: number, units: { unit: string; is_default: boolean }[]) => {
    const db = getDb();
    db.run('DELETE FROM merchandise_units WHERE merchandise_id = ?', [merchandiseId]);
    for (const u of units) {
      db.run(
        'INSERT INTO merchandise_units (merchandise_id, unit, is_default) VALUES (?, ?, ?)',
        [merchandiseId, u.unit.trim(), u.is_default ? 1 : 0]
      );
    }
    saveDb();
    return { success: true };
  });
}
