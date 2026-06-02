import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import NewInvoice from './pages/NewInvoice';
import EditInvoice from './pages/EditInvoice';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import NewSupplyInvoice from './pages/NewSupplyInvoice';
import Settings from './pages/Settings';
import Expenses from './pages/Expenses';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="customers/:id/new-invoice" element={<NewInvoice />} />
          <Route path="customers/:id/edit-invoice/:invoiceId" element={<EditInvoice />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierDetail />} />
          <Route path="suppliers/:id/new-supply-invoice" element={<NewSupplyInvoice />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

