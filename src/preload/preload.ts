import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for window.api
export interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  total_invoiced: number;
  total_paid: number;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  merchandise_id?: number;
  custom_name?: string;
  merchandise_name?: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  date: string;
  total: number;
  total_paid: number;
  notes?: string;
  created_at: string;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface CustomerDetail extends Customer {
  invoices: Invoice[];
}

export interface Merchandise {
  id: number;
  name: string;
}

const api = {
  customers: {
    getAll: (): Promise<Customer[]> => ipcRenderer.invoke('customers:getAll'),
    getById: (id: number): Promise<CustomerDetail | null> => ipcRenderer.invoke('customers:getById', id),
    create: (data: { name: string; phone?: string; address?: string; notes?: string }) =>
      ipcRenderer.invoke('customers:create', data),
    update: (id: number, data: { name: string; phone?: string; address?: string; notes?: string }) =>
      ipcRenderer.invoke('customers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('customers:delete', id),
    search: (query: string): Promise<Customer[]> => ipcRenderer.invoke('customers:search', query),
  },
  invoices: {
    create: (data: {
      customer_id: number;
      date: string;
      notes?: string;
      items: { merchandise_id?: number; custom_name?: string; quantity: number; unit_price: number }[];
    }) => ipcRenderer.invoke('invoices:create', data),
    getByCustomer: (customerId: number): Promise<Invoice[]> =>
      ipcRenderer.invoke('invoices:getByCustomer', customerId),
    getById: (id: number): Promise<Invoice | null> =>
      ipcRenderer.invoke('invoices:getById', id),
    update: (id: number, data: {
      date: string;
      notes?: string;
      items: { merchandise_id?: number; custom_name?: string; quantity: number; unit_price: number }[];
    }) => ipcRenderer.invoke('invoices:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('invoices:delete', id),
  },
  payments: {
    add: (data: { invoice_id: number; amount: number; date: string; notes?: string }) =>
      ipcRenderer.invoke('payments:add', data),
    getByInvoice: (invoiceId: number): Promise<Payment[]> =>
      ipcRenderer.invoke('payments:getByInvoice', invoiceId),
    delete: (id: number) => ipcRenderer.invoke('payments:delete', id),
  },
  merchandise: {
    getAll: (): Promise<Merchandise[]> => ipcRenderer.invoke('merchandise:getAll'),
  },
  print: {
    customerReport: (customerId: number): Promise<string> =>
      ipcRenderer.invoke('print:customerReport', customerId),
  },
};

contextBridge.exposeInMainWorld('api', api);
