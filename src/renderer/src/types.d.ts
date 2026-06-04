// Type declarations for window.api (mirrors preload/index.ts)
export { };

declare global {
  interface Window {
    api: {
      customers: {
        getAll: () => Promise<Customer[]>;
        getById: (id: number) => Promise<CustomerDetail | null>;
        create: (data: { name: string; phone?: string; address?: string; notes?: string }) => Promise<{ id: number }>;
        update: (id: number, data: { name: string; phone?: string; address?: string; notes?: string }) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
        search: (query: string) => Promise<Customer[]>;
      };
      invoices: {
        create: (data: {
          customer_id: number;
          date: string;
          notes?: string;
          items: { merchandise_id?: number; custom_name?: string; quantity: number; unit_price: number; unit?: string }[];
        }) => Promise<{ id: number; invoice_number: string }>;
        getByCustomer: (customerId: number) => Promise<Invoice[]>;
        getById: (id: number) => Promise<Invoice | null>;
        update: (id: number, data: {
          date: string;
          notes?: string;
          items: { merchandise_id?: number; custom_name?: string; quantity: number; unit_price: number; unit?: string }[];
        }) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      payments: {
        add: (data: { invoice_id: number; amount: number; date: string; notes?: string }) => Promise<{ id: number }>;
        getByInvoice: (invoiceId: number) => Promise<Payment[]>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      merchandise: {
        getAll: () => Promise<Merchandise[]>;
      };
      print: {
        customerReport: (customerId: number) => Promise<string>;
        supplierReport: (supplierId: number) => Promise<string>;
      };
      suppliers: {
        getAll: () => Promise<Supplier[]>;
        getById: (id: number) => Promise<SupplierDetail | null>;
        create: (data: { name: string; phone?: string; address?: string; notes?: string }) => Promise<{ id: number }>;
        update: (id: number, data: { name: string; phone?: string; address?: string; notes?: string }) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
        search: (query: string) => Promise<Supplier[]>;
      };
      supplyInvoices: {
        create: (data: {
          supplier_id: number;
          date: string;
          notes?: string;
          items: { merchandise_id?: number; custom_name?: string; quantity: number; unit_price: number; unit?: string }[];
        }) => Promise<{ id: number; invoice_number: string }>;
        getBySupplier: (supplierId: number) => Promise<SupplyInvoice[]>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      supplierPayments: {
        add: (data: { supply_invoice_id: number; amount: number; date: string; notes?: string }) => Promise<{ id: number }>;
        getByInvoice: (invoiceId: number) => Promise<SupplierPayment[]>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      settings: {
        getAll: () => Promise<Record<string, string>>;
        update: (data: Record<string, string>) => Promise<{ success: boolean }>;
      };
      expenses: {
        getAll: (filters?: { from?: string; to?: string; category_id?: number }) => Promise<Expense[]>;
        create: (data: { category_id?: number; custom_category?: string; amount: number; date: string; notes?: string }) => Promise<{ id: number }>;
        update: (id: number, data: any) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
        getTotal: (filters?: any) => Promise<{ total: number }>;
        getCategories: () => Promise<ExpenseCategory[]>;
        createCategory: (name: string) => Promise<{ id: number }>;
      };
      inventory: {
        getReport: (filters?: { from?: string; to?: string }) => Promise<InventoryReport>;
        printReport: (filters?: { from?: string; to?: string }, titleLabel?: string) => Promise<string>;
      };
    };
  }

  interface Customer {
    id: number;
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
    created_at: string;
    total_invoiced: number;
    total_paid: number;
  }

  interface InvoiceItem {
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

  interface Payment {
    id: number;
    invoice_id: number;
    amount: number;
    date: string;
    notes?: string;
    created_at: string;
  }

  interface Invoice {
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

  interface CustomerDetail extends Customer {
    invoices: Invoice[];
  }

  interface Merchandise {
    id: number;
    name: string;
  }

  // Supplier interfaces
  interface Supplier {
    id: number;
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
    created_at: string;
    total_invoiced: number;
    total_paid: number;
  }

  interface SupplyInvoiceItem {
    id: number;
    supply_invoice_id: number;
    merchandise_id?: number;
    custom_name?: string;
    merchandise_name?: string;
    quantity: number;
    unit_price: number;
    unit?: string;
  }

  interface SupplierPayment {
    id: number;
    supply_invoice_id: number;
    amount: number;
    date: string;
    notes?: string;
    created_at: string;
  }

  interface SupplyInvoice {
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

  interface SupplierDetail extends Supplier {
    invoices: SupplyInvoice[];
  }

  interface ExpenseCategory {
    id: number;
    name: string;
  }

  interface Expense {
    id: number;
    category_id?: number;
    category_name?: string;
    custom_category?: string;
    amount: number;
    date: string;
    notes?: string;
    created_at: string;
  }

  interface InventoryReportItem {
    id: number;
    name: string;
    opening_stock: number;
    incoming: number;
    outgoing: number;
    closing_stock: number;
    latest_price: number;
    valuation: number;
  }

  interface InventoryReport {
    items: InventoryReportItem[];
    summary: {
      total_items: number;
      total_stock_qty: number;
      total_valuation: number;
    };
  }
}
