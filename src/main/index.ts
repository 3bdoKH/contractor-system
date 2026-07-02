import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { initializeDb, queryOne } from './db';
import { registerCustomerHandlers } from './ipc/customers';
import { registerInvoiceHandlers } from './ipc/invoices';
import { registerPaymentHandlers } from './ipc/payments';
import { registerMerchandiseHandlers } from './ipc/merchandise';
import { registerPrintHandlers } from './ipc/print';
import { registerSupplierHandlers } from './ipc/suppliers';
import { registerSettingsHandlers } from './ipc/settings';
import { registerInventoryHandlers } from './ipc/inventory';
import { registerExpenseHandlers } from './ipc/expenses';
import { registerIncomeHandlers } from './ipc/incomes';
import { updateElectronApp } from 'update-electron-app';
import { registerBackupHandlers, runAutoBackupIfDue } from './ipc/backup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// This MUST run before anything else — Squirrel fires the exe multiple times during install.
if (started) {
  app.quit();
}

// Required on Linux when chrome-sandbox is not configured
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

async function createWindow(): Promise<BrowserWindow> {
  // Initialize DB before creating the window (sql.js is async)
  await initializeDb();

  console.log('preload path:', path.join(__dirname, 'preload.js'));
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'نظام المقاول',
    autoHideMenuBar: true,
  });

  // Set title from DB settings
  const nameSetting = queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'contractor_name'");
  mainWindow.setTitle(nameSetting?.value || 'نظام المقاول');

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Register IPC handlers
  registerCustomerHandlers();
  registerInvoiceHandlers();
  registerPaymentHandlers();
  registerMerchandiseHandlers();
  registerPrintHandlers();
  registerSupplierHandlers();
  registerSettingsHandlers();
  registerInventoryHandlers();
  registerExpenseHandlers();
  registerIncomeHandlers();
  registerBackupHandlers();

  return mainWindow;
}

app.on('ready', () => {
  createWindow()
    .then((mainWindow) => {
      // Run auto-backup if 24h have passed since last run
      runAutoBackupIfDue().catch(console.error);
      // Always expose current app version to renderer
      ipcMain.handle('updates:getVersion', () => app.getVersion());

      // Only run Squirrel auto-updater on Windows
      if (process.platform === 'win32') {
        const { autoUpdater } = require('electron');

        updateElectronApp({
          repo: '3bdoKH/contractor-system',
          updateInterval: '1 hour',
          logger: require('electron-log'),
        });

        // Push update status events to the renderer
        const sendStatus = (state: string, info?: string) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:status', { state, info });
          }
        };

        autoUpdater.on('checking-for-update',  () => sendStatus('checking'));
        autoUpdater.on('update-available',     () => sendStatus('available'));
        autoUpdater.on('update-not-available', () => sendStatus('not-available'));
        autoUpdater.on('update-downloaded',    () => sendStatus('downloaded'));
        autoUpdater.on('error', (err: Error)   => sendStatus('error', err.message));

        // When the update has been downloaded, prompt the user to restart
        autoUpdater.on('update-downloaded', (_event: any, _releaseNotes: string, releaseName: string) => {
          const { dialog } = require('electron');
          dialog.showMessageBox({
            type: 'info',
            title: 'تحديث جاهز للتثبيت',
            message: `الإصدار الجديد ${releaseName} جاهز.`,
            detail: 'سيتم إعادة تشغيل التطبيق لتثبيت التحديث.',
            buttons: ['إعادة التشغيل الآن', 'لاحقاً'],
            defaultId: 0,
            cancelId: 1,
          }).then(({ response }: { response: number }) => {
            if (response === 0) autoUpdater.quitAndInstall();
          });
        });

        // Manual check trigger from renderer
        ipcMain.handle('updates:checkNow', () => {
          autoUpdater.checkForUpdates();
        });
      } else {
        // Non-Windows: return unsupported signal so the UI can show a note
        ipcMain.handle('updates:checkNow', () => ({ platform: 'unsupported' }));
      }
    })
    .catch((err) => {
      console.error('Failed to create window:', err);
      app.quit();
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(console.error);
  }
});
