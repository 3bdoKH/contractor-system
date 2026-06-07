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
  unit?: string;
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

// Supplier types
export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  total_invoiced: number;
  total_paid: number;
}

export interface SupplyInvoiceItem {
  id: number;
  supply_invoice_id: number;
  merchandise_id?: number;
  custom_name?: string;
  merchandise_name?: string;
  quantity: number;
  unit_price: number;
  unit?: string;
}

export interface SupplierPayment {
  id: number;
  supply_invoice_id: number;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
}

export interface SupplyInvoice {
  id: number;
  invoice_number: string;
  supplier_id: number;
  date: string;
  total: number;
  total_paid: number;
  notes?: string;
  created_at: string;
  items?: SupplyInvoiceItem[];
  payments?: SupplierPayment[];
}

export interface SupplierDetail extends Supplier {
  invoices: SupplyInvoice[];
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
      items: { merchandise_id?: number; custom_name?: string; quantity: number; unit_price: number; unit?: string }[];
    }) => ipcRenderer.invoke('invoices:create', data),
    getByCustomer: (customerId: number): Promise<Invoice[]> =>
      ipcRenderer.invoke('invoices:getByCustomer', customerId),
    getById: (id: number): Promise<Invoice | null> =>
      ipcRenderer.invoke('invoices:getById', id),
    update: (id: number, data: {
      date: string;
      notes?: string;
      items: { merchandise_id?: number; custom_name?: string; quantity: number; unit_price: number; unit?: string }[];
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
    getAllWithUnits: () => ipcRenderer.invoke('merchandise:getAllWithUnits'),
    getUnits: (merchandiseId: number) => ipcRenderer.invoke('merchandise:getUnits', merchandiseId),
    create: (data: { name: string; units?: { unit: string; is_default?: boolean }[] }) =>
      ipcRenderer.invoke('merchandise:create', data),
    update: (id: number, data: { name: string }) => ipcRenderer.invoke('merchandise:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('merchandise:delete', id),
    addUnit: (merchandiseId: number, unit: string, isDefault: boolean) =>
      ipcRenderer.invoke('merchandise:addUnit', merchandiseId, unit, isDefault),
    setDefaultUnit: (merchandiseId: number, unitId: number) =>
      ipcRenderer.invoke('merchandise:setDefaultUnit', merchandiseId, unitId),
    deleteUnit: (unitId: number) => ipcRenderer.invoke('merchandise:deleteUnit', unitId),
    setUnits: (merchandiseId: number, units: { unit: string; is_default: boolean }[]) =>
      ipcRenderer.invoke('merchandise:setUnits', merchandiseId, units),
  },
  print: {
    customerReport: (customerId: number): Promise<string> =>
      ipcRenderer.invoke('print:customerReport', customerId),
    supplierReport: (supplierId: number): Promise<string> =>
      ipcRenderer.invoke('print:supplierReport', supplierId),
  },
  suppliers: {
    getAll: (): Promise<Supplier[]> => ipcRenderer.invoke('suppliers:getAll'),
    getById: (id: number): Promise<SupplierDetail | null> => ipcRenderer.invoke('suppliers:getById', id),
    create: (data: { name: string; phone?: string; address?: string; notes?: string }) =>
      ipcRenderer.invoke('suppliers:create', data),
    update: (id: number, data: { name: string; phone?: string; address?: string; notes?: string }) =>
      ipcRenderer.invoke('suppliers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('suppliers:delete', id),
    search: (query: string): Promise<Supplier[]> => ipcRenderer.invoke('suppliers:search', query),
  },
  supplyInvoices: {
    create: (data: any) => ipcRenderer.invoke('supplyInvoices:create', data),
    getBySupplier: (supplierId: number) => ipcRenderer.invoke('supplyInvoices:getBySupplier', supplierId),
    delete: (id: number) => ipcRenderer.invoke('supplyInvoices:delete', id),
  },
  supplierPayments: {
    add: (data: any) => ipcRenderer.invoke('supplierPayments:add', data),
    getByInvoice: (invoiceId: number) => ipcRenderer.invoke('supplierPayments:getByInvoice', invoiceId),
    delete: (id: number) => ipcRenderer.invoke('supplierPayments:delete', id),
  },
  settings: {
    getAll: (): Promise<Record<string, string>> => ipcRenderer.invoke('settings:getAll'),
    update: (data: Record<string, string>) => ipcRenderer.invoke('settings:update', data),
  },
  inventory: {
    getReport: (filters?: { from?: string; to?: string }) =>
      ipcRenderer.invoke('inventory:getReport', filters),
    printReport: (filters?: { from?: string; to?: string }, titleLabel?: string) =>
      ipcRenderer.invoke('print:inventoryReport', filters, titleLabel),
    getAdjustments: () =>
      ipcRenderer.invoke('inventory:getAdjustments'),
    setAdjustment: (data: { merchandise_id: number; manual_quantity: number | null; manual_price: number | null; notes?: string }) =>
      ipcRenderer.invoke('inventory:setAdjustment', data),
    removeAdjustment: (merchandise_id: number) =>
      ipcRenderer.invoke('inventory:removeAdjustment', merchandise_id),
    resetAllAdjustments: () =>
      ipcRenderer.invoke('inventory:resetAllAdjustments'),
    resetToZero: () =>
      ipcRenderer.invoke('inventory:resetToZero'),
  },
};

contextBridge.exposeInMainWorld('api', api);

