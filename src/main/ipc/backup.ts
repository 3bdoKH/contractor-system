import { ipcMain, app, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { queryOne, getDb, saveDb, reloadDbFromFile } from '../db';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

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

// ─── S3 / Supabase / R2 Helpers ───────────────────────────────────────────────

export interface S3Config {
  endpoint: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

function getS3Config(): S3Config {
  let endpoint = getSetting('s3_endpoint') || process.env.S3_ENDPOINT || '';
  const r2AccountId = getSetting('r2_account_id') || process.env.R2_ACCOUNT_ID || '';
  if (!endpoint && r2AccountId) {
    endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;
  }

  return {
    endpoint,
    bucketName: getSetting('s3_bucket') || getSetting('r2_bucket_name') || process.env.S3_BUCKET || process.env.R2_BUCKET_NAME || '',
    accessKeyId: getSetting('s3_access_key') || getSetting('r2_access_key_id') || process.env.S3_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: getSetting('s3_secret_key') || getSetting('r2_secret_access_key') || process.env.S3_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
    region: getSetting('s3_region') || process.env.S3_REGION || 'us-east-1',
  };
}

function getS3Client(config: S3Config): S3Client {
  if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey) {
    throw new Error('بيانات السحابة S3 / Supabase غير مكتملة');
  }

  let endpoint = config.endpoint.trim();
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`;
  }

  return new S3Client({
    region: config.region || 'us-east-1',
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId.trim(),
      secretAccessKey: config.secretAccessKey.trim(),
    },
    forcePathStyle: true, // Enabled for Supabase / S3 compatibility
  });
}

// ─── Local Backup Logic ───────────────────────────────────────────────────────

const BACKUP_DIR_NAME = 'ContractorBackups';
const MAX_BACKUPS = 10;
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

function pruneOldLocalBackups(): void {
  const dir = getBackupDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('contractor_backup_') && f.endsWith('.db'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const file of files.slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(dir, file.name));
    } catch {
      /* ignore */
    }
  }
}

// ─── Core Backup Operations ───────────────────────────────────────────────────

export async function performLocalBackup(): Promise<{ success: boolean; message: string; backupPath?: string }> {
  try {
    const backupPath = createLocalBackupFile();
    const now = new Date();
    const dateLabel = now.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setSetting('backup_last_run', now.toISOString());
    pruneOldLocalBackups();

    return { success: true, message: `تمت النسخة الاحتياطية المحلية بنجاح — ${dateLabel}`, backupPath };
  } catch (err: unknown) {
    return { success: false, message: getErrorMessage(err, 'فشل إجراء النسخة الاحتياطية المحلية') };
  }
}

export async function performS3CloudBackup(localFilePath?: string): Promise<{ success: boolean; message: string }> {
  const config = getS3Config();
  if (!config.endpoint || !config.bucketName || !config.accessKeyId || !config.secretAccessKey) {
    return { success: false, message: 'لم يتم إعداد السحابة (Supabase / S3) بعد' };
  }

  try {
    const filePath = localFilePath || createLocalBackupFile();
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    const s3 = getS3Client(config);

    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: `backups/${fileName}`,
        Body: fileContent,
        ContentType: 'application/x-sqlite3',
      })
    );

    const now = new Date();
    const dateLabel = now.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setSetting('backup_last_cloud_run', now.toISOString());
    return { success: true, message: `تم الرفع للسحابة بنجاح — ${dateLabel}` };
  } catch (err: unknown) {
    return { success: false, message: getErrorMessage(err, 'فشل رفع النسخة الاحتياطية للسحابة') };
  }
}

export async function runAutoBackupIfDue(): Promise<void> {
  const lastRun = getSetting('backup_last_run');
  if (!lastRun || Date.now() - new Date(lastRun).getTime() >= MS_PER_DAY) {
    const res = await performLocalBackup();
    if (res.success && res.backupPath) {
      const config = getS3Config();
      if (config.endpoint && config.bucketName && config.accessKeyId && config.secretAccessKey) {
        await performS3CloudBackup(res.backupPath).catch(console.error);
      }
    }
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

export function registerBackupHandlers() {
  // Run manual backup (both local + S3/Supabase if configured)
  ipcMain.handle('backup:runNow', async () => {
    const localRes = await performLocalBackup();
    if (!localRes.success) return localRes;

    const config = getS3Config();
    const isCloudConnected = !!(config.endpoint && config.bucketName && config.accessKeyId && config.secretAccessKey);

    if (isCloudConnected) {
      const cloudRes = await performS3CloudBackup(localRes.backupPath);
      if (cloudRes.success) {
        return { success: true, message: 'تم الحفظ محلياً وعلى السحابة بنجاح ✅' };
      } else {
        return { success: true, message: `تم الحفظ محلياً ✅ (تحذير السحابة: ${cloudRes.message})` };
      }
    }

    return localRes;
  });

  // Export database backup to a user-chosen file path
  ipcMain.handle('backup:exportLocal', async () => {
    try {
      const defaultName = `contractor_backup_${new Date().toISOString().slice(0, 10)}.db`;
      const saveResult = await dialog.showSaveDialog({
        title: 'تصدير نسخة احتياطية',
        defaultPath: defaultName,
        filters: [{ name: 'ملف قاعدة بيانات SQLite', extensions: ['db', 'sqlite'] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, message: 'تم إلغاء التصدير' };
      }

      const dbPath = path.join(app.getPath('userData'), 'contractor.db');
      fs.copyFileSync(dbPath, saveResult.filePath);
      return { success: true, message: 'تم تصدير ملف قاعدة البيانات بنجاح' };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err, 'فشل تصدير الملف') };
    }
  });

  // Restore database backup from a user-chosen file path
  ipcMain.handle('backup:restoreLocal', async () => {
    try {
      const openResult = await dialog.showOpenDialog({
        title: 'اختر ملف النسخة الاحتياطية لـ الاستعادة',
        filters: [{ name: 'ملف قاعدة بيانات SQLite', extensions: ['db', 'sqlite'] }],
        properties: ['openFile'],
      });

      if (openResult.canceled || openResult.filePaths.length === 0) {
        return { success: false, message: 'تم إلغاء الاستعادة' };
      }

      const selectedPath = openResult.filePaths[0];

      // Validate SQLite file header
      const buffer = Buffer.alloc(16);
      const fd = fs.openSync(selectedPath, 'r');
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);

      if (buffer.toString('utf8', 0, 15) !== 'SQLite format 3') {
        return { success: false, message: 'الملف المختار ليس ملف قاعدة بيانات SQLite صالحة' };
      }

      await reloadDbFromFile(selectedPath);
      const nowStr = new Date().toLocaleString('ar-EG');
      return { success: true, message: `تمت استعادة قاعدة البيانات بنجاح ✅ (${nowStr})` };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err, 'فشل استعادة قاعدة البيانات') };
    }
  });

  // Get current backup & cloud configuration state
  ipcMain.handle('backup:getConfig', async () => {
    const config = getS3Config();
    const isCloudConnected = !!(
      config.endpoint &&
      config.bucketName &&
      config.accessKeyId &&
      config.secretAccessKey
    );

    return {
      isCloudConnected,
      lastRun: getSetting('backup_last_run'),
      lastCloudRun: getSetting('backup_last_cloud_run'),
      s3Endpoint: config.endpoint,
      s3BucketName: config.bucketName,
      s3AccessKeyId: config.accessKeyId,
      s3Region: config.region,
      hasSecretKey: !!config.secretAccessKey,
    };
  });

  // Save S3 / Supabase credentials
  ipcMain.handle(
    'backup:saveS3Config',
    async (_event, credentials: { endpoint: string; bucketName: string; accessKeyId: string; secretAccessKey: string; region?: string }) => {
      try {
        setSetting('s3_endpoint', credentials.endpoint.trim());
        setSetting('s3_bucket', credentials.bucketName.trim());
        setSetting('s3_access_key', credentials.accessKeyId.trim());
        if (credentials.secretAccessKey.trim()) {
          setSetting('s3_secret_key', credentials.secretAccessKey.trim());
        }
        if (credentials.region) {
          setSetting('s3_region', credentials.region.trim());
        }
        return { success: true, message: 'تم حفظ إعدادات السحابة (Supabase / S3) بنجاح' };
      } catch (err: unknown) {
        return { success: false, message: getErrorMessage(err, 'فشل حفظ الإعدادات') };
      }
    }
  );

  // Test S3 / Supabase Connection
  ipcMain.handle('backup:testS3', async () => {
    const config = getS3Config();
    if (!config.endpoint || !config.bucketName || !config.accessKeyId || !config.secretAccessKey) {
      return { success: false, message: 'يرجى إدخال جميع بيانات السحابة أولاً' };
    }

    try {
      const s3 = getS3Client(config);
      await s3.send(new ListObjectsV2Command({ Bucket: config.bucketName, MaxKeys: 1 }));
      return { success: true, message: 'تم الاتصال بالسحابة بنجاح! ✅' };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err, 'فشل الاتصال بالسحابة (تأكد من إنشاء البكت وبيانات S3)') };
    }
  });

  // Disconnect / Clear S3 Config
  ipcMain.handle('backup:disconnectS3', async () => {
    setSetting('s3_endpoint', '');
    setSetting('s3_bucket', '');
    setSetting('s3_access_key', '');
    setSetting('s3_secret_key', '');
    setSetting('r2_account_id', '');
    setSetting('r2_bucket_name', '');
    setSetting('r2_access_key_id', '');
    setSetting('r2_secret_access_key', '');
    setSetting('backup_last_cloud_run', '');
    return { success: true };
  });

  // List S3 / Supabase backups
  ipcMain.handle('backup:listS3Backups', async () => {
    const config = getS3Config();
    if (!config.endpoint || !config.bucketName || !config.accessKeyId || !config.secretAccessKey) {
      return { success: false, files: [], message: 'غير مرتبط بالسحابة' };
    }

    try {
      const s3 = getS3Client(config);
      const output = await s3.send(new ListObjectsV2Command({ Bucket: config.bucketName, Prefix: 'backups/' }));
      const files = (output.Contents || []).map((item) => ({
        key: item.Key || '',
        name: path.basename(item.Key || ''),
        size: item.Size || 0,
        lastModified: item.LastModified ? item.LastModified.toISOString() : '',
      }));
      return { success: true, files };
    } catch (err: unknown) {
      return { success: false, files: [], message: getErrorMessage(err, 'فشل جلب النسخ من السحابة') };
    }
  });

  // Restore directly from S3 / Supabase
  ipcMain.handle('backup:restoreFromS3', async (_event, key: string) => {
    const config = getS3Config();
    if (!config.endpoint || !config.bucketName || !config.accessKeyId || !config.secretAccessKey) {
      return { success: false, message: 'غير مرتبط بالسحابة' };
    }

    try {
      const s3 = getS3Client(config);
      const data = await s3.send(new GetObjectCommand({ Bucket: config.bucketName, Key: key }));
      const bytes = await data.Body?.transformToByteArray();
      if (!bytes) return { success: false, message: 'الملف السحابي فارغ' };

      const tempPath = path.join(app.getPath('temp'), `s3_restore_${Date.now()}.db`);
      fs.writeFileSync(tempPath, Buffer.from(bytes));

      await reloadDbFromFile(tempPath);
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* ignore */
      }

      return { success: true, message: 'تمت استعادة قاعدة البيانات من السحابة بنجاح ✅' };
    } catch (err: unknown) {
      return { success: false, message: getErrorMessage(err, 'فشل استعادة النسخة من السحابة') };
    }
  });
}
