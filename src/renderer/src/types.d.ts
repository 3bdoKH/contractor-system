// Type declarations for window.api (mirrors preload/index.ts)
export {};

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
          items: { merchandise_id?: number; custom_name?: string; quantity: number; unit_price: number }[];
        }) => Promise<{ id: number; invoice_number: string }>;
        getByCustomer: (customerId: number) => Promise<Invoice[]>;
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
}
