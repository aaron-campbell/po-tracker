"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  summary: {
    totalPOs: number;
    totalInvoices: number;
    totalPOValue: number;
    totalInvoiced: number;
    totalRemaining: number;
    totalClients: number;
  };
  statusCounts: Record<string, number>;
  paymentStatusCounts: Record<string, number>;
  revenueTypeCounts: Record<string, { count: number; value: number }>;
  unclassifiedCount: number;
  unclassifiedValue: number;
  nearExhaustion: Array<{
    id: string;
    poNumber: string;
    client: { name: string };
    totalValue: number;
    invoicedAmount: number;
    remainingBalance: number;
    consumedPercent: number;
    ageInDays: number;
  }>;
  agingInvoices: Array<{
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    paymentStatus: string;
    ageInDays: number;
    daysUntilDue: number;
    isOverdue: boolean;
    purchaseOrder: { poNumber: string; client: { name: string } };
  }>;
  dsoByClient: Array<{
    clientName: string;
    totalPOs: number;
    totalInvoices: number;
    outstandingInvoices: number;
    outstandingAmount: number;
    avgDSO: number;
    estimatedDSO: number;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Loading dashboard...</div></div>;
  if (!data) return <div className="text-red-500">Failed to load dashboard</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex gap-3">
          <a href="/api/export?type=purchase-orders" className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Export POs (CSV)</a>
          <a href="/api/export?type=invoices" className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Export Invoices (CSV)</a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total PO Value" value={formatCurrency(data.summary.totalPOValue)} subtitle={`${data.summary.totalPOs} purchase orders`} color="blue" />
        <KPICard title="Total Invoiced" value={formatCurrency(data.summary.totalInvoiced)} subtitle={`${data.summary.totalInvoices} invoices`} color="green" />
        <KPICard title="Remaining Balance" value={formatCurrency(data.summary.totalRemaining)} subtitle="Unconsumed PO value" color="orange" />
        <KPICard title="Clients" value={String(data.summary.totalClients)} subtitle={`${data.summary.totalPOs} active POs`} color="purple" />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">PO Status</h2>
          <div className="space-y-3">
            {Object.entries(data.statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>{status}</span>
                <span className="text-lg font-semibold text-gray-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Invoice Payment Status</h2>
          <div className="space-y-3">
            {Object.entries(data.paymentStatusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentColor(status)}`}>{status}</span>
                <span className="text-lg font-semibold text-gray-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Revenue by Type</h2>
          <div className="space-y-3">
            {Object.entries(data.revenueTypeCounts).filter(([, v]) => v.count > 0).map(([type, { count, value }]) => (
              <div key={type} className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRevenueTypeColor(type)}`}>{type}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-700">{count} PO{count !== 1 ? "s" : ""}</span>
                  {value > 0 && <span className="text-xs text-gray-400 ml-2">{formatCurrency(value)}</span>}
                </div>
              </div>
            ))}
            {data.unclassifiedCount > 0 && (
              <div className="flex items-center justify-between border-t pt-2 mt-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Unclassified</span>
                <span className="text-sm font-semibold text-gray-400">{data.unclassifiedCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Near Exhaustion POs */}
      {data.nearExhaustion.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">POs Near Exhaustion (&ge;80% consumed)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">PO Number</th>
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium text-right">PO Value</th>
                  <th className="pb-3 font-medium text-right">Invoiced</th>
                  <th className="pb-3 font-medium text-right">Remaining</th>
                  <th className="pb-3 font-medium text-right">Consumed</th>
                  <th className="pb-3 font-medium text-right">Age (Days)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.nearExhaustion.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="py-3"><a href={`/purchase-orders/${po.id}`} className="text-orange-600 hover:underline font-medium">{po.poNumber}</a></td>
                    <td className="py-3 text-gray-700">{po.client.name}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(po.totalValue)}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(po.invoicedAmount)}</td>
                    <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(po.remainingBalance)}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${po.consumedPercent >= 100 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {po.consumedPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-500">{po.ageInDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aging Invoices */}
      {data.agingInvoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Aging Invoices (Unpaid)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Invoice #</th>
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium">PO</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium text-right">Age (Days)</th>
                  <th className="pb-3 font-medium text-right">Days Until Due</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.agingInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="py-3"><a href={`/invoices/${inv.id}`} className="text-orange-600 hover:underline font-medium">{inv.invoiceNumber}</a></td>
                    <td className="py-3 text-gray-700">{inv.purchaseOrder.client.name}</td>
                    <td className="py-3 text-gray-700">{inv.purchaseOrder.poNumber}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(inv.totalAmount)}</td>
                    <td className="py-3 text-right text-gray-500">{inv.ageInDays}</td>
                    <td className={`py-3 text-right font-medium ${inv.isOverdue ? "text-red-600" : "text-gray-700"}`}>{inv.daysUntilDue}</td>
                    <td className="py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentColor(inv.paymentStatus)}`}>{inv.paymentStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DSO by Client */}
      {data.dsoByClient.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">DSO by Client</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium text-right">POs</th>
                  <th className="pb-3 font-medium text-right">Invoices</th>
                  <th className="pb-3 font-medium text-right">Outstanding</th>
                  <th className="pb-3 font-medium text-right">Outstanding Amt</th>
                  <th className="pb-3 font-medium text-right">Avg DSO (Paid)</th>
                  <th className="pb-3 font-medium text-right">Est DSO (Open)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.dsoByClient.map((c) => (
                  <tr key={c.clientName} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-800">{c.clientName}</td>
                    <td className="py-3 text-right text-gray-700">{c.totalPOs}</td>
                    <td className="py-3 text-right text-gray-700">{c.totalInvoices}</td>
                    <td className="py-3 text-right text-gray-700">{c.outstandingInvoices}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(c.outstandingAmount)}</td>
                    <td className="py-3 text-right font-medium text-gray-900">{c.avgDSO || "-"}</td>
                    <td className="py-3 text-right text-orange-600 font-medium">{c.estimatedDSO || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, subtitle, color }: { title: string; value: string; subtitle: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "border-l-blue-500",
    green: "border-l-green-500",
    orange: "border-l-orange-500",
    purple: "border-l-purple-500",
  };
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-l-4 ${colors[color]} p-6`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function getRevenueTypeColor(t: string) {
  const m: Record<string, string> = {
    SaaS: "bg-purple-100 text-purple-800",
    Deployment: "bg-blue-100 text-blue-800",
    Hypercare: "bg-cyan-100 text-cyan-800",
    Development: "bg-indigo-100 text-indigo-800",
    Training: "bg-teal-100 text-teal-800",
    Other: "bg-gray-100 text-gray-600",
  };
  return m[t] || "bg-gray-100 text-gray-600";
}

function getStatusColor(status: string) {
  switch (status) {
    case "Open": return "bg-green-100 text-green-800";
    case "Revised": return "bg-blue-100 text-blue-800";
    case "90% Used": return "bg-yellow-100 text-yellow-800";
    case "Exceeded": return "bg-red-100 text-red-800";
    case "Closed": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getPaymentColor(status: string) {
  switch (status) {
    case "Sent": return "bg-blue-100 text-blue-800";
    case "Received": return "bg-yellow-100 text-yellow-800";
    case "Overdue": return "bg-red-100 text-red-800";
    case "Paid": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}
