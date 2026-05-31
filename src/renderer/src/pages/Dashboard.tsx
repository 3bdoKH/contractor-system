import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, Wallet, AlertCircle, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../utils';

interface DashboardStats {
  totalCustomers: number;
  totalInvoiced: number;
  totalPaid: number;
  totalRemaining: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalRemaining: 0,
  });
  const [debtors, setDebtors] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const customers = await window.api.customers.getAll();
      const totalInvoiced = customers.reduce((s, c) => s + c.total_invoiced, 0);
      const totalPaid = customers.reduce((s, c) => s + c.total_paid, 0);
      setStats({
        totalCustomers: customers.length,
        totalInvoiced,
        totalPaid,
        totalRemaining: totalInvoiced - totalPaid,
      });

      // Sort by highest remaining balance
      const withBalance = customers
        .map(c => ({ ...c, remaining: c.total_invoiced - c.total_paid }))
        .filter(c => c.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining);

      setDebtors(withBalance);
    } finally {
      setLoading(false);
    }
  }

  const summaryCards = [
    {
      label: 'إجمالي العملاء',
      value: stats.totalCustomers.toLocaleString('ar-EG'),
      icon: Users,
      color: 'bg-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    {
      label: 'إجمالي المبيعات',
      value: `${formatCurrency(stats.totalInvoiced)} ج.م`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
    },
    {
      label: 'إجمالي المحصل',
      value: `${formatCurrency(stats.totalPaid)} ج.م`,
      icon: Wallet,
      color: 'bg-emerald-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
    },
    {
      label: 'إجمالي المتبقي',
      value: `${formatCurrency(stats.totalRemaining)} ج.م`,
      icon: AlertCircle,
      color: 'bg-red-500',
      bg: 'bg-red-50',
      text: 'text-red-700',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">لوحة التحكم</h1>
        <p className="text-slate-500 text-sm mt-1">نظرة عامة على أعمالك</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`${card.bg} rounded-2xl p-5 border border-white shadow-sm`}>
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${card.color} bg-opacity-15`}>
                  <Icon size={20} className={card.text} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-3 leading-tight">{card.value}</p>
              <p className={`text-sm font-medium ${card.text} mt-1`}>{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Debtors list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <Link to="/customers" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
            عرض الكل
            <ArrowLeft size={14} />
          </Link>
          <h2 className="text-base font-bold text-slate-900">المديونيات</h2>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : debtors.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <AlertCircle size={40} className="mx-auto mb-3 text-slate-300" />
            <p>لا توجد مديونيات حالياً 🎉</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {debtors.map((customer: any) => (
              <Link
                key={customer.id}
                to={`/customers/${customer.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-600">{formatCurrency(customer.remaining)} ج.م</span>
                  <span className="text-xs text-slate-400">متبقي</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{customer.name}</p>
                  {customer.phone && <p className="text-xs text-slate-400 mt-0.5">{customer.phone}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
