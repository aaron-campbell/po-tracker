"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PdfUploadField from "@/components/PdfUploadField";

interface PO { id: string; poNumber: string; client: { name: string }; }
interface LineItem { description: string; quantity: string; unitPrice: string; taxPercent: string; amount: string; }

export default function EditInvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const [pos, setPOs] = useState<PO[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPOId, setSelectedPOId] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const [fields, setFields] = useState({
    invoiceNumber: "", invoiceDate: "", dueDate: "", subtotal: "",
    taxAmount: "0", totalAmount: "", paymentStatus: "Sent",
    ourReference: "", notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/purchase-orders").then(r => r.json()),
      fetch(`/api/invoices/${id}`).then(r => r.json()),
    ]).then(([posData, invData]) => {
      setPOs(posData.purchaseOrders || []);
      const inv = invData.invoice;
      if (!inv) return;
      setSelectedPOId(inv.purchaseOrderId);
      setPdfUrl(inv.pdfPath ?? null);
      setFields({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate?.slice(0, 10) ?? "",
        dueDate: inv.dueDate?.slice(0, 10) ?? "",
        subtotal: String(inv.subtotal),
        taxAmount: String(inv.taxAmount),
        totalAmount: String(inv.totalAmount),
        paymentStatus: inv.paymentStatus,
        ourReference: inv.ourReference ?? "",
        notes: inv.notes ?? "",
      });
      setLineItems(
        (inv.lineItems ?? []).map((li: { description: string; quantity: number; unitPrice: number; taxPercent: number; amount: number }) => ({
          description: li.description,
          quantity: String(li.quantity),
          unitPrice: String(li.unitPrice),
          taxPercent: String(li.taxPercent),
          amount: String(li.amount),
        }))
      );
    }).finally(() => setLoading(false));
  }, [id]);

  function setField(key: string, value: string) {
    setFields(f => ({ ...f, [key]: value }));
  }

  function addLineItem() {
    setLineItems(li => [...li, { description: "", quantity: "1", unitPrice: "", taxPercent: "0", amount: "" }]);
  }

  function removeLineItem(idx: number) {
    setLineItems(li => li.filter((_, i) => i !== idx));
  }

  function updateLineItem(idx: number, field: keyof LineItem, value: string) {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      const qty = parseFloat(updated[idx].quantity) || 0;
      const price = parseFloat(updated[idx].unitPrice) || 0;
      updated[idx].amount = (qty * price).toFixed(2);
    }
    setLineItems(updated);
  }

  const lineTotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const validLineItems = lineItems.filter(li => li.description);

    const res = await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber: fields.invoiceNumber,
        purchaseOrderId: selectedPOId,
        invoiceDate: fields.invoiceDate,
        dueDate: fields.dueDate,
        subtotal: parseFloat(fields.subtotal) || lineTotal,
        taxAmount: parseFloat(fields.taxAmount) || 0,
        totalAmount: parseFloat(fields.totalAmount) || lineTotal,
        paymentStatus: fields.paymentStatus,
        ourReference: fields.ourReference || null,
        notes: fields.notes || null,
        pdfPath: pdfUrl,
        lineItems: validLineItems.map(li => ({
          description: li.description,
          quantity: parseFloat(li.quantity) || 1,
          unitPrice: parseFloat(li.unitPrice) || 0,
          taxPercent: parseFloat(li.taxPercent) || 0,
          amount: parseFloat(li.amount) || 0,
        })),
      }),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to update invoice");
      setSaving(false);
      return;
    }

    router.push(`/invoices/${id}`);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href={`/invoices/${id}`} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Invoice</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">Edit Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number (from IFS10) *</label>
              <input required value={fields.invoiceNumber} onChange={e => setField("invoiceNumber", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order *</label>
              <select required value={selectedPOId} onChange={e => setSelectedPOId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="">Select PO...</option>
                {pos.map(po => <option key={po.id} value={po.id}>{po.poNumber} - {po.client.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
              <input required type="date" value={fields.invoiceDate} onChange={e => setField("invoiceDate", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input required type="date" value={fields.dueDate} onChange={e => setField("dueDate", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount *</label>
              <input required type="number" step="0.01" value={fields.totalAmount} onChange={e => setField("totalAmount", e.target.value)} placeholder={lineTotal > 0 ? String(lineTotal.toFixed(2)) : "0.00"} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
              <input type="number" step="0.01" value={fields.taxAmount} onChange={e => setField("taxAmount", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
              <select value={fields.paymentStatus} onChange={e => setField("paymentStatus", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="Sent">Sent</option>
                <option value="Received">Received</option>
                <option value="Overdue">Overdue</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Our Reference</label>
              <input value={fields.ourReference} onChange={e => setField("ourReference", e.target.value)} placeholder="e.g., License Fee - December 2024" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={fields.notes} onChange={e => setField("notes", e.target.value)} rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
          </div>
        </div>

        {/* PDF Upload */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Invoice Document</h2>
          <PdfUploadField existingUrl={pdfUrl} onUpload={setPdfUrl} />
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Line Items (optional)</h2>
            <button type="button" onClick={addLineItem} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700">+ Add Line</button>
          </div>
          {lineItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-3">
              <div className="col-span-5">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                <input value={item.description} onChange={e => updateLineItem(idx, "description", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                <input value={item.quantity} onChange={e => updateLineItem(idx, "quantity", e.target.value)} type="number" step="any" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Unit Price</label>}
                <input value={item.unitPrice} onChange={e => updateLineItem(idx, "unitPrice", e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Amount</label>}
                <input value={item.amount} onChange={e => updateLineItem(idx, "amount", e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 bg-gray-50" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Tax %</label>}
                <input value={item.taxPercent} onChange={e => updateLineItem(idx, "taxPercent", e.target.value)} type="number" step="0.1" className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-1 flex justify-center">
                <button type="button" onClick={() => removeLineItem(idx)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
              </div>
            </div>
          ))}
          {lineItems.length > 0 && (
            <div className="text-right text-sm text-gray-600">
              Line Items Total: <span className="font-semibold text-gray-800">${lineTotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium text-sm">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/invoices/${id}`} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
