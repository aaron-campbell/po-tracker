"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";


interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: string;
  paymentDate: string | null;
  ourReference: string | null;
  customerOrderNo: string | null;
  notes: string | null;
  pdfPath: string | null;
  purchaseOrder: { poNumber: string; totalValue: number; client: { name: string } };
  lineItems: Array<{ id: string; description: string; quantity: number; unitPrice: number; taxPercent: number; amount: number }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount);
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((d) => setInvoice(d.invoice))
      .finally(() => setLoading(false));
  }, [id]);

  async function updatePaymentStatus(status: string) {
    const body: Record<string, unknown> = { paymentStatus: status };
    if (status === "Paid") body.paymentDate = new Date().toISOString();
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setInvoice({ ...invoice!, paymentStatus: status, paymentDate: status === "Paid" ? new Date().toISOString() : invoice!.paymentDate });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this invoice?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    router.push("/invoices");
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!invoice) return <div className="text-red-500">Invoice not found</div>;

  const now = new Date();
  const age = Math.floor((now.getTime() - new Date(invoice.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilDue = Math.floor((new Date(invoice.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/invoices" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Invoices</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Invoice {invoice.invoiceNumber}</h1>
          <p className="text-gray-500">{invoice.purchaseOrder.client.name} - PO {invoice.purchaseOrder.poNumber}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/invoices/${invoice.id}/edit`} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Edit</Link>
          <select value={invoice.paymentStatus} onChange={(e) => updatePaymentStatus(e.target.value)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700">
            <option value="Sent">Sent</option>
            <option value="Received">Received</option>
            <option value="Overdue">Overdue</option>
            <option value="Paid">Paid</option>
          </select>
          <button onClick={handleDelete} className="px-4 py-2 text-sm border border-red-300 rounded-lg hover:bg-red-50 text-red-600">Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(invoice.totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-gray-500">Invoice Age</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{age} days</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-gray-500">{daysUntilDue < 0 ? "Days Overdue" : "Days Until Due"}</p>
          <p className={`text-2xl font-bold mt-1 ${daysUntilDue < 0 && invoice.paymentStatus !== "Paid" ? "text-red-600" : "text-gray-800"}`}>
            {Math.abs(daysUntilDue)} days
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><dt className="text-gray-500">Invoice Date</dt><dd className="text-gray-800 font-medium mt-1">{fmtDate(invoice.invoiceDate)}</dd></div>
          <div><dt className="text-gray-500">Due Date</dt><dd className="text-gray-800 font-medium mt-1">{fmtDate(invoice.dueDate)}</dd></div>
          <div><dt className="text-gray-500">Status</dt><dd className="mt-1"><span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentColor(invoice.paymentStatus)}`}>{invoice.paymentStatus}</span></dd></div>
          <div><dt className="text-gray-500">Subtotal</dt><dd className="text-gray-800 font-medium mt-1">{formatCurrency(invoice.subtotal)}</dd></div>
          <div><dt className="text-gray-500">Tax</dt><dd className="text-gray-800 font-medium mt-1">{formatCurrency(invoice.taxAmount)}</dd></div>
          <div><dt className="text-gray-500">Currency</dt><dd className="text-gray-800 font-medium mt-1">{invoice.currency}</dd></div>
          <div><dt className="text-gray-500">Our Reference</dt><dd className="text-gray-800 font-medium mt-1">{invoice.ourReference || "-"}</dd></div>
          <div><dt className="text-gray-500">Payment Date</dt><dd className="text-gray-800 font-medium mt-1">{invoice.paymentDate ? fmtDate(invoice.paymentDate) : "-"}</dd></div>
        </dl>
        {invoice.notes && <div className="mt-4 text-sm"><span className="text-gray-500">Notes:</span> <span className="text-gray-700">{invoice.notes}</span></div>}
      </div>

      {invoice.pdfPath && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Invoice Document</h2>
            <a href={invoice.pdfPath} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline">Open in new tab</a>
          </div>
          <iframe src={invoice.pdfPath} className="w-full border rounded" style={{ height: "700px" }} />
        </div>
      )}

      {invoice.lineItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Line Items</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium text-right">Qty</th>
                <th className="pb-3 font-medium text-right">Unit Price</th>
                <th className="pb-3 font-medium text-right">Tax %</th>
                <th className="pb-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="py-2 text-gray-800">{li.description}</td>
                  <td className="py-2 text-right text-gray-700">{li.quantity}</td>
                  <td className="py-2 text-right text-gray-700">{formatCurrency(li.unitPrice)}</td>
                  <td className="py-2 text-right text-gray-600">{li.taxPercent}%</td>
                  <td className="py-2 text-right font-medium text-gray-800">{formatCurrency(li.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={4} className="py-2 text-right font-medium text-gray-700">Total</td>
                <td className="py-2 text-right font-bold text-gray-800">{formatCurrency(invoice.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
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
