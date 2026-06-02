import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, Wallet, AlertCircle, ArrowLeft, ShoppingCart, Truck, Receipt } from 'lucide-react';
import { formatCurrency } from '../utils';

interface DashboardStats {
  totalCustomers: number;
  totalInvoiced: number;
  totalPaid: number;
  totalRemaining: number;
  totalPurchases: number;
  totalOwedToSuppliers: number;
  totalExpenses: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalRemaining: 0,
    totalPurchases: 0,
    totalOwedToSuppliers: 0,
    totalExpenses: 0,
  });
  const [debtors, setDebtors] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [customers, suppliers, expensesRes] = await Promise.all([
        window.api.customers.getAll(),
        window.api.suppliers.getAll(),
        window.api.expenses.getTotal(),
      ]);
      const totalInvoiced = customers.reduce((s, c) => s + c.total_invoiced, 0);
      const totalPaid = customers.reduce((s, c) => s + c.total_paid, 0);
      const totalPurchases = suppliers.reduce((s, sup) => s + sup.total_invoiced, 0);
      const totalSupplierPaid = suppliers.reduce((s, sup) => s + sup.total_paid, 0);
      setStats({
        totalCustomers: customers.length,
        totalInvoiced,
        totalPaid,
        totalRemaining: totalInvoiced - totalPaid,
        totalPurchases,
        totalOwedToSuppliers: totalPurchases - totalSupplierPaid,
        totalExpenses: expensesRes?.total || 0,
      });

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
    {
      label: 'إجمالي المشتريات',
      value: `${formatCurrency(stats.totalPurchases)} ج.م`,
      icon: ShoppingCart,
      color: 'bg-orange-500',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
    },
    {
      label: 'إجمالي المستحق للموردين',
      value: `${formatCurrency(stats.totalOwedToSuppliers)} ج.م`,
      icon: Truck,
      color: stats.totalOwedToSuppliers > 0 ? 'bg-red-500' : 'bg-emerald-500',
      bg: stats.totalOwedToSuppliers > 0 ? 'bg-red-50' : 'bg-emerald-50',
      text: stats.totalOwedToSuppliers > 0 ? 'text-red-700' : 'text-emerald-700',
    },
    {
      label: 'إجمالي المصروفات',
      value: `${formatCurrency(stats.totalExpenses)} ج.م`,
      icon: Receipt,
      color: 'bg-amber-500',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">لوحة التحكم</h1>
        <p className="text-slate-500 text-sm mt-1">نظرة عامة على أعمالك</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? [...Array(7)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm animate-pulse h-32"></div>
            ))
          : summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`${card.bg} rounded-2xl p-5 border border-white shadow-sm`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${card.color} bg-opacity-15`}>
                      <Icon size={20} className={card.text} />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900 mt-3 leading-tight">{card.value}</p>
                  <p className={`text-xs font-bold ${card.text} mt-1 uppercase tracking-wider`}>{card.label}</p>
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
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse"></div>
            ))}
          </div>
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
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                <div className="text-right">
                  <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{customer.name}</p>
                  {customer.phone && <p className="text-xs text-slate-400 mt-0.5">{customer.phone}</p>}
                </div>
                <div className="text-left">
                  <span className="text-sm font-black text-red-600">{formatCurrency(customer.remaining)}</span>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">متبقي</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
