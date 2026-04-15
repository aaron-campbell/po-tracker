"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PODetail {
  id: string;
  poNumber: string;
  client: { id: string; name: string };
  orderDate: string;
  currency: string;
  totalValue: number;
  revenueType: string | null;
  paymentTerms: string | null;
  contractReference: string | null;
  rigSiteName: string | null;
  buyerContactName: string | null;
  buyerContactEmail: string | null;
  status: string;
  revisionNumber: number;
  notes: string | null;
  pdfPath: string | null;
  invoicedAmount: number;
  remainingBalance: number;
  consumedPercent: number;
  lineItems: Array<{ id: string; lineNumber: number; description: string; quantity: number; unitOfMeasure: string | null; unitPrice: number; netAmount: number; deliveryDate: string | null }>;
  revisions: Array<{ id: string; revisionNumber: number; previousValue: number; newValue: number; changeNotes: string | null; createdAt: string }>;
  invoices: Array<{ id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; totalAmount: number; paymentStatus: string }>;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
}

export default function PODetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [po, setPO] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRevise, setShowRevise] = useState(false);
  const [reviseValue, setReviseValue] = useState("");
  const [reviseNotes, setReviseNotes] = useState("");

  useEffect(() => {
    fetch(`/api/purchase-orders/${id}`)
      .then((r) => r.json())
      .then((d) => setPO(d.purchaseOrder))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRevise() {
    if (!reviseValue) return;
    const res = await fetch(`/api/purchase-orders/${id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newValue: reviseValue, changeNotes: reviseNotes }),
    });
    if (res.ok) {
      const d = await res.json();
      setPO({ ...po!, ...d.purchaseOrder, invoicedAmount: po!.invoicedAmount, remainingBalance: parseFloat(reviseValue) - po!.invoicedAmount, consumedPercent: po!.invoicedAmount / parseFloat(reviseValue) * 100 });
      setShowRevise(false);
      setReviseValue("");
      setReviseNotes("");
    }
  }

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setPO({ ...po!, status });
  }

  async function handleDelete() {
    if (!confirm("Delete this PO and all associated data?")) return;
    await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
    router.push("/purchase-orders");
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!po) return <div className="text-red-500">Purchase order not found</div>;

  const consumedBarWidth = Math.min(po.consumedPercent, 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/purchase-orders" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Purchase Orders</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">PO {po.poNumber}</h1>
          <p className="text-gray-500">{po.client.name}{po.rigSiteName ? ` - ${po.rigSiteName}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/purchase-orders/${po.id}/edit`} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Edit</Link>
          <button onClick={() => setShowRevise(!showRevise)} className="px-4 py-2 text-sm border border-blue-300 rounded-lg hover:bg-blue-50 text-blue-600">Revise PO</button>
          <select value={po.status} onChange={(e) => handleStatusChange(e.target.value)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700">
            <option value="Open">Open</option>
            <option value="Revised">Revised</option>
            <option value="90% Used">90% Used</option>
            <option value="Exceeded">Exceeded</option>
            <option value="Closed">Closed</option>
          </select>
          <button onClick={handleDelete} className="px-4 py-2 text-sm border border-red-300 rounded-lg hover:bg-red-50 text-red-600">Delete</button>
        </div>
      </div>

      {/* Consumption Bar */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">PO Consumption</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(po.status)}`}>{po.status}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
          <div className={`h-4 rounded-full transition-all ${po.consumedPercent >= 100 ? "bg-red-500" : po.consumedPercent >= 90 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${consumedBarWidth}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">PO Value</span><p className="font-semibold text-gray-800 text-lg">{formatCurrency(po.totalValue, po.currency)}</p></div>
          <div><span className="text-gray-500">Invoiced</span><p className="font-semibold text-gray-800 text-lg">{formatCurrency(po.invoicedAmount, po.currency)}</p></div>
          <div><span className="text-gray-500">Remaining</span><p className={`font-semibold text-lg ${po.remainingBalance < 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(po.remainingBalance, po.currency)}</p></div>
          <div><span className="text-gray-500">Consumed</span><p className="font-semibold text-gray-800 text-lg">{po.consumedPercent.toFixed(1)}%</p></div>
        </div>
      </div>

      {/* Revise Modal */}
      {showRevise && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-blue-800">Revise PO Value</h3>
          <p className="text-sm text-blue-600">Current value: {formatCurrency(po.totalValue, po.currency)} (Revision {po.revisionNumber})</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">New Total Value *</label>
              <input type="number" step="0.01" value={reviseValue} onChange={(e) => setReviseValue(e.target.value)} className="w-full px-4 py-2.5 border border-blue-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">Change Notes</label>
              <input value={reviseNotes} onChange={(e) => setReviseNotes(e.target.value)} className="w-full px-4 py-2.5 border border-blue-300 rounded-lg text-gray-900" placeholder="Reason for revision" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRevise} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Submit Revision</button>
            <button onClick={() => setShowRevise(false)} className="px-4 py-2 border border-blue-300 rounded-lg text-blue-600 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* PO Details */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><dt className="text-gray-500">Order Date</dt><dd className="text-gray-800 font-medium mt-1">{fmtDate(po.orderDate)}</dd></div>
          <div><dt className="text-gray-500">Currency</dt><dd className="text-gray-800 font-medium mt-1">{po.currency}</dd></div>
          <div><dt className="text-gray-500">Revenue Type</dt><dd className="mt-1">{po.revenueType ? <span className={`px-2 py-1 rounded text-xs font-medium ${getRevenueTypeColor(po.revenueType)}`}>{po.revenueType}</span> : <span className="text-gray-400">-</span>}</dd></div>
          <div><dt className="text-gray-500">Payment Terms</dt><dd className="text-gray-800 font-medium mt-1">{po.paymentTerms || "-"}</dd></div>
          <div><dt className="text-gray-500">Contract / Frame Agreement</dt><dd className="text-gray-800 font-medium mt-1">{po.contractReference || "-"}</dd></div>
          <div><dt className="text-gray-500">Buyer</dt><dd className="text-gray-800 font-medium mt-1">{po.buyerContactName || "-"}{po.buyerContactEmail ? ` (${po.buyerContactEmail})` : ""}</dd></div>
          <div><dt className="text-gray-500">Revision</dt><dd className="text-gray-800 font-medium mt-1">{po.revisionNumber}</dd></div>
        </dl>
        {po.notes && <div className="mt-4 text-sm"><span className="text-gray-500">Notes:</span> <span className="text-gray-700">{po.notes}</span></div>}
      </div>

      {/* Line Items */}
      {po.lineItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Line Items</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium text-right">Qty</th>
                <th className="pb-3 font-medium">UoM</th>
                <th className="pb-3 font-medium text-right">Unit Price</th>
                <th className="pb-3 font-medium text-right">Net Amount</th>
                <th className="pb-3 font-medium">Del. Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {po.lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="py-2 text-gray-500">{li.lineNumber}</td>
                  <td className="py-2 text-gray-800">{li.description}</td>
                  <td className="py-2 text-right text-gray-700">{li.quantity}</td>
                  <td className="py-2 text-gray-600">{li.unitOfMeasure || "-"}</td>
                  <td className="py-2 text-right text-gray-700">{formatCurrency(li.unitPrice, po.currency)}</td>
                  <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(li.netAmount, po.currency)}</td>
                  <td className="py-2 text-gray-600">{li.deliveryDate ? fmtDate(li.deliveryDate) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revision History */}
      {po.revisions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Revision History</h2>
          <div className="space-y-3">
            {po.revisions.map((rev) => (
              <div key={rev.id} className="flex items-center gap-4 text-sm border-b pb-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Rev {rev.revisionNumber}</span>
                <span className="text-gray-500">{formatCurrency(rev.previousValue, po.currency)} &rarr;</span>
                <span className="font-medium text-gray-800">{formatCurrency(rev.newValue, po.currency)}</span>
                {rev.changeNotes && <span className="text-gray-500">- {rev.changeNotes}</span>}
                <span className="text-gray-400 ml-auto">{fmtDate(rev.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {po.pdfPath && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Purchase Order Document</h2>
            <a
              href={`/api/slack-pdf?url=${encodeURIComponent(po.pdfPath)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              Open in new tab
            </a>
          </div>
          <iframe
            src={`/api/slack-pdf?url=${encodeURIComponent(po.pdfPath)}`}
            className="w-full rounded-lg border border-gray-200"
            style={{ height: "700px" }}
            title="Purchase Order PDF"
          />
        </div>
      )}

      {/* Invoices */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Invoices ({po.invoices.length})</h2>
          <Link href={`/invoices/new?purchaseOrderId=${po.id}`} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium">Add Invoice</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 font-medium">Invoice #</th>
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 font-medium">Due Date</th>
              <th className="pb-3 font-medium text-right">Amount</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {po.invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="py-3"><Link href={`/invoices/${inv.id}`} className="text-orange-600 hover:underline font-medium">{inv.invoiceNumber}</Link></td>
                <td className="py-3 text-gray-600">{fmtDate(inv.invoiceDate)}</td>
                <td className="py-3 text-gray-600">{fmtDate(inv.dueDate)}</td>
                <td className="py-3 text-right font-medium text-gray-800">{formatCurrency(inv.totalAmount, po.currency)}</td>
                <td className="py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentColor(inv.paymentStatus)}`}>{inv.paymentStatus}</span></td>
              </tr>
            ))}
            {po.invoices.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-400">No invoices yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
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

function getStatusColor(s: string) {
  const m: Record<string, string> = { Open: "bg-green-100 text-green-800", Revised: "bg-blue-100 text-blue-800", "90% Used": "bg-yellow-100 text-yellow-800", Exceeded: "bg-red-100 text-red-800", Closed: "bg-gray-100 text-gray-800" };
  return m[s] || "bg-gray-100 text-gray-800";
}
function getPaymentColor(s: string) {
  const m: Record<string, string> = { Sent: "bg-blue-100 text-blue-800", Received: "bg-yellow-100 text-yellow-800", Overdue: "bg-red-100 text-red-800", Paid: "bg-green-100 text-green-800" };
  return m[s] || "bg-gray-100 text-gray-800";
}
