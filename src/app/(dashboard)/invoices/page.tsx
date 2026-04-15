"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  totalAmount: number;
  paymentStatus: string;
  ourReference: string | null;
  purchaseOrder: { poNumber: string; client: { name: string } };
}

// Approximate FX rates to USD — update periodically
const FX_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, NOK: 0.093, DKK: 0.145,
};

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
}

function toUSD(amount: number, currency: string): number {
  return amount * (FX_TO_USD[currency] ?? 1);
}

function AmountCell({ amount, currency }: { amount: number; currency: string }) {
  const isUSD = currency === "USD";
  return (
    <div className="text-right">
      <div className="font-medium text-gray-800">{formatCurrency(amount, currency)}</div>
      {!isUSD && (
        <div className="text-xs text-gray-400 mt-0.5">≈ {formatCurrency(toUSD(amount, currency))}</div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const url = statusFilter ? `/api/invoices?paymentStatus=${statusFilter}` : "/api/invoices";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices || []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Invoices</h1>
        <Link href="/invoices/new" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium">
          Add Invoice
        </Link>
      </div>

      <div className="flex gap-2">
        {["", "Sent", "Received", "Overdue", "Paid"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-sm ${statusFilter === s ? "bg-orange-500 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Invoice #</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">PO</th>
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Due Date</th>
                <th className="px-6 py-3 font-medium text-right">Amount <span className="font-normal text-gray-400">(+ USD)</span></th>
                <th className="px-6 py-3 font-medium text-right">Age</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => {
                const age = Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
                const daysUntilDue = Math.floor((new Date(inv.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/invoices/${inv.id}`} className="text-orange-600 hover:underline font-medium">{inv.invoiceNumber}</Link>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{inv.purchaseOrder.client.name}</td>
                    <td className="px-6 py-4 text-gray-600">{inv.purchaseOrder.poNumber}</td>
                    <td className="px-6 py-4 text-gray-600">{inv.ourReference || "-"}</td>
                    <td className="px-6 py-4 text-gray-600">{fmtDate(inv.invoiceDate)}</td>
                    <td className={`px-6 py-4 ${daysUntilDue < 0 && inv.paymentStatus !== "Paid" ? "text-red-600 font-medium" : "text-gray-600"}`}>
                      {fmtDate(inv.dueDate)}
                    </td>
                    <td className="px-6 py-4"><AmountCell amount={inv.totalAmount} currency={inv.currency} /></td>
                    <td className="px-6 py-4 text-right text-gray-500">{age}d</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentColor(inv.paymentStatus)}`}>{inv.paymentStatus}</span></td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-400">No invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

function getPaymentColor(s: string) {
  const m: Record<string, string> = { Sent: "bg-blue-100 text-blue-800", Received: "bg-yellow-100 text-yellow-800", Overdue: "bg-red-100 text-red-800", Paid: "bg-green-100 text-green-800" };
  return m[s] || "bg-gray-100 text-gray-800";
}
