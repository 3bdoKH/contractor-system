/** Format a number with Arabic-style thousand separators */
export function formatCurrency(n: number): string {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ar-EG');
}

/** Calculate invoice payment status */
export function getInvoiceStatus(total: number, paid: number): 'paid' | 'partial' | 'unpaid' {
  if (paid >= total && total > 0) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

export const STATUS_LABELS = {
  paid: 'مدفوع بالكامل',
  partial: 'مدفوع جزئياً',
  unpaid: 'غير مدفوع',
} as const;

export const STATUS_CLASSES = {
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-200',
  unpaid: 'bg-red-100 text-red-800 border-red-200',
} as const;
