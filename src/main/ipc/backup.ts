import { ipcMain, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import { queryOne, getDb, saveDb } from '../db';

const BOT_TOKEN = process.env.BOT_TOKEN;

// ─── DB helpers ───────────────────────────────────────────────────────────────

function getSetting(key: string): string {
  const row = queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? '';
}

function setSetting(key: string, value: string): void {
  const db = getDb();
  const existing = queryOne('SELECT key FROM settings WHERE key = ?', [key]);
  if (existing) {
    db.run('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
  } else {
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
  saveDb();
}

// ─── Telegram API helpers ─────────────────────────────────────────────────────

function telegramRequest(apiPath: string, method: 'GET' | 'POST', body?: Buffer, contentType?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}${apiPath}`,
      method,
      headers: body ? {
        'Content-Type': contentType!,
        'Content-Length': body.length,
      } : {},
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) resolve(json);
          else reject(new Error(json.description || 'Telegram API error'));
        } catch {
          reject(new Error('Invalid Telegram response'));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Fetch the chat ID of the last person who messaged the bot.
 * The user must send /start to the bot first.
 */
function fetchChatIdFromTelegram(): Promise<string | null> {
  return telegramRequest('/getUpdates?limit=10&timeout=0', 'GET').then((json) => {
    const updates: any[] = json.result ?? [];
    if (updates.length === 0) return null;
    // Walk updates newest-first to find the first real chat ID
    for (let i = updates.length - 1; i >= 0; i--) {
      const u = updates[i];
      const chatId = u?.message?.chat?.id ?? u?.channel_post?.chat?.id ?? null;
      if (chatId != null) return String(chatId);
    }
    return null;
  });
}

/** Send the DB file as a Telegram document. */
function sendTelegramDocument(chatId: string, filePath: string, caption: string): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const boundary = `----FormBoundary${Date.now()}`;

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return telegramRequest('/sendDocument', 'POST', body, `multipart/form-data; boundary=${boundary}`)
    .then((): void => undefined);
}

/** Send a plain text message. */
function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const body = Buffer.from(JSON.stringify({ chat_id: chatId, text }));
  return telegramRequest('/sendMessage', 'POST', body, 'application/json').then((): void => undefined);
}

// ─── Core Backup Logic ────────────────────────────────────────────────────────

const BACKUP_DIR_NAME = 'ContractorBackups';
const MAX_BACKUPS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getBackupDir(): string {
  const dir = path.join(app.getPath('documents'), BACKUP_DIR_NAME);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createLocalBackupFile(): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const dbPath = path.join(app.getPath('userData'), 'contractor.db');
  const backupPath = path.join(getBackupDir(), `contractor_backup_${dateStr}.db`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function pruneOldBackups(): void {
  const dir = getBackupDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('contractor_backup_') && f.endsWith('.db'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  for (const file of files.slice(MAX_BACKUPS)) {
    try { fs.unlinkSync(path.join(dir, file.name)); } catch { /* ignore */ }
  }
}

export async function performBackup(isManual = false): Promise<{ success: boolean; message: string }> {
  const chatId = getSetting('telegram_chat_id');
  if (!chatId) return { success: false, message: 'لم يتم ربط Telegram بعد' };

  try {
    const backupPath = createLocalBackupFile();
    const now = new Date();
    const dateLabel = now.toLocaleString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const contractorName = getSetting('contractor_name') || 'نظام المقاول';
    const caption = `${isManual ? '📦 نسخة احتياطية يدوية' : '📦 نسخة احتياطية تلقائية'}\n🏢 ${contractorName}\n📅 ${dateLabel}`;

    await sendTelegramDocument(chatId, backupPath, caption);

    setSetting('backup_last_run', now.toISOString());
    pruneOldBackups();

    return { success: true, message: `تم الإرسال بنجاح — ${dateLabel}` };
  } catch (err: any) {
    return { success: false, message: err?.message ?? 'فشل إرسال النسخة الاحتياطية' };
  }
}

export async function runAutoBackupIfDue(): Promise<void> {
  const chatId = getSetting('telegram_chat_id');
  if (!chatId) return; // Not connected yet — skip silently

  const lastRun = getSetting('backup_last_run');
  if (lastRun && Date.now() - new Date(lastRun).getTime() < MS_PER_DAY) return; // Not due

  performBackup(false).catch(console.error);
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

export function registerBackupHandlers() {
  // Manual backup
  ipcMain.handle('backup:runNow', async () => performBackup(true));

  // Get config state (no token exposure — only chat ID and last run)
  ipcMain.handle('backup:getConfig', async () => {
    const chatId = getSetting('telegram_chat_id');
    const lastRun = getSetting('backup_last_run');
    return { isConnected: !!chatId, lastRun };
  });

  // Fetch chat ID using the hardcoded bot token — user just needs to have sent /start
  ipcMain.handle('backup:connect', async () => {
    try {
      const chatId = await fetchChatIdFromTelegram();
      if (!chatId) return { success: false, message: 'لم يتم العثور على رسائل — أرسل /start للبوت أولاً ثم حاول مجدداً' };
      setSetting('telegram_chat_id', chatId);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'فشل الاتصال بـ Telegram' };
    }
  });

  // Disconnect (clear chat ID)
  ipcMain.handle('backup:disconnect', async () => {
    setSetting('telegram_chat_id', '');
    setSetting('backup_last_run', '');
    return { success: true };
  });

  // Test connection by sending a simple message
  ipcMain.handle('backup:sendTest', async () => {
    const chatId = getSetting('telegram_chat_id');
    if (!chatId) return { success: false, message: 'لم يتم ربط Telegram' };
    try {
      await sendTelegramMessage(chatId, 'الاتصال يعمل بشكل صحيح ✅');
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message ?? 'فشل الإرسال' };
    }
  });
}
