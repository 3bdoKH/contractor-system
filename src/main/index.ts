import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { getDb } from './db';
import { registerCustomerHandlers } from './ipc/customers';
import { registerInvoiceHandlers } from './ipc/invoices';
import { registerPaymentHandlers } from './ipc/payments';
import { registerMerchandiseHandlers } from './ipc/merchandise';
import { registerPrintHandlers } from './ipc/print';
import { registerSupplierHandlers } from './ipc/suppliers';
import { registerSettingsHandlers } from './ipc/settings';
import { registerExpenseHandlers } from './ipc/expenses';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Required on Linux when chrome-sandbox is not configured
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}


const createWindow = () => {
  // Initialize DB on startup
  getDb();
  console.log('preload path:', path.join(__dirname, 'preload.js'))
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: 'نظام المقاول',
    autoHideMenuBar: true,
  });

  // Set title from DB settings
  const db = getDb();
  const nameSetting = db.prepare("SELECT value FROM settings WHERE key = 'contractor_name'").get() as any;
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
  registerExpenseHandlers();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
