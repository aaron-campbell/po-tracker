"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PO {
  id: string;
  poNumber: string;
  client: { name: string };
  orderDate: string;
  currency: string;
  totalValue: number;
  revenueType: string | null;
  status: string;
  rigSiteName: string | null;
  invoicedAmount: number;
  remainingBalance: number;
  consumedPercent: number;
  _count: { invoices: number };
}

const REVENUE_TYPES = ["SaaS", "Deployment", "Hypercare", "Development", "Training", "Other"];
const PAGE_SIZE = 25;

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
      {!isUSD && <div className="text-xs text-gray-400 mt-0.5">≈ {formatCurrency(toUSD(amount, currency))}</div>}
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const [pos, setPOs] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [revenueFilter, setRevenueFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const url = params.size ? `/api/purchase-orders?${params}` : "/api/purchase-orders";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setPOs(d.purchaseOrders || []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = pos.filter((po) => {
    if (revenueFilter && po.revenueType !== revenueFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        po.poNumber.toLowerCase().includes(q) ||
        po.client.name.toLowerCase().includes(q) ||
        (po.rigSiteName || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSearch(val: string) { setSearch(val); setPage(1); }
  function handleStatus(val: string) { setStatusFilter(val); setLoading(true); setPage(1); }
  function handleRevenue(val: string) { setRevenueFilter(val); setPage(1); }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Purchase Orders</h1>
        <Link href="/purchase-orders/new" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium">
          Add Purchase Order
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by PO number, client, rig/site..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
        />
        <span className="text-sm text-gray-400 whitespace-nowrap">{filtered.length} PO{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "Open", "Revised", "90% Used", "Exceeded", "Closed"].map((s) => (
          <button key={s} onClick={() => handleStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm ${statusFilter === s ? "bg-orange-500 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
            {s || "All"}
          </button>
        ))}
        <span className="w-px bg-gray-200 mx-1" />
        {["", ...REVENUE_TYPES].map((t) => (
          <button key={t} onClick={() => handleRevenue(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${revenueFilter === t ? "bg-gray-700 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
            {t || "All Types"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">PO Number</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Rig/Site</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium text-right">PO Value <span className="font-normal text-gray-400">(+ USD)</span></th>
                <th className="px-6 py-3 font-medium text-right">Invoiced</th>
                <th className="px-6 py-3 font-medium text-right">Remaining</th>
                <th className="px-6 py-3 font-medium text-right">Consumed</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/purchase-orders/${po.id}`} className="text-orange-600 hover:underline font-medium">{po.poNumber}</Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{po.client.name}</td>
                  <td className="px-6 py-4 text-gray-600">{po.rigSiteName || "-"}</td>
                  <td className="px-6 py-4">
                    {po.revenueType
                      ? <span className={`px-2 py-1 rounded text-xs font-medium ${getRevenueTypeColor(po.revenueType)}`}>{po.revenueType}</span>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{fmtDate(po.orderDate)}</td>
                  <td className="px-6 py-4"><AmountCell amount={po.totalValue} currency={po.currency} /></td>
                  <td className="px-6 py-4"><AmountCell amount={po.invoicedAmount} currency={po.currency} /></td>
                  <td className="px-6 py-4"><AmountCell amount={po.remainingBalance} currency={po.currency} /></td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${po.consumedPercent >= 100 ? "bg-red-100 text-red-700" : po.consumedPercent >= 90 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                      {po.consumedPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(po.status)}`}>{po.status}</span></td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={10} className="px-6 py-8 text-center text-gray-400">No purchase orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
    </div>
  );
}

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
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

function Pagination({ page, totalPages, onChange, total, pageSize }: { page: number; totalPages: number; onChange: (p: number) => void; total: number; pageSize: number }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between text-sm text-gray-500">
      <span>Showing {start}–{end} of {total}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2).reduce<(number | "...")[]>((acc, p, i, arr) => {
          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
          acc.push(p);
          return acc;
        }, []).map((p, i) =>
          p === "..." ? <span key={`e${i}`} className="px-2 py-1.5">…</span> :
          <button key={p} onClick={() => onChange(p as number)} className={`px-3 py-1.5 border rounded-lg ${page === p ? "bg-orange-500 text-white border-orange-500" : "border-gray-300 hover:bg-gray-50"}`}>{p}</button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
      </div>
    </div>
  );
}
