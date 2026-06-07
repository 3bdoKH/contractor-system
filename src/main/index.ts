import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { initializeDb, getDb, queryOne } from './db';
import { registerCustomerHandlers } from './ipc/customers';
import { registerInvoiceHandlers } from './ipc/invoices';
import { registerPaymentHandlers } from './ipc/payments';
import { registerMerchandiseHandlers } from './ipc/merchandise';
import { registerPrintHandlers } from './ipc/print';
import { registerSupplierHandlers } from './ipc/suppliers';
import { registerSettingsHandlers } from './ipc/settings';
import { registerInventoryHandlers } from './ipc/inventory';
import { updateElectronApp } from 'update-electron-app';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// This MUST run before anything else — Squirrel fires the exe multiple times during install.
if (started) {
  app.quit();
}

// Required on Linux when chrome-sandbox is not configured
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

async function createWindow() {
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
}

app.on('ready', () => {
  createWindow().catch((err) => {
    console.error('Failed to create window:', err);
    app.quit();
  });

  // Only run Squirrel auto-updater on Windows (it's not supported on Linux/macOS with Squirrel)
  if (process.platform === 'win32') {
    const { autoUpdater } = require('electron');

    updateElectronApp({
      repo: '3bdoKH/contractor-system',
      updateInterval: '1 hour',
      logger: require('electron-log'),
    });

    // When the update has been downloaded, prompt the user to restart
    autoUpdater.on('update-downloaded', (_event: any, releaseNotes: string, releaseName: string) => {
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
  }
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
