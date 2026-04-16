"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PdfUploadField from "@/components/PdfUploadField";

interface PO { id: string; poNumber: string; client: { name: string }; totalValue: number; currency: string; }
interface LineItem { description: string; quantity: string; unitPrice: string; taxPercent: string; amount: string; }

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>}>
      <NewInvoiceForm />
    </Suspense>
  );
}

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pos, setPOs] = useState<PO[]>([]);
  const [selectedPOId, setSelectedPOId] = useState(searchParams.get("purchaseOrderId") || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "", taxPercent: "0", amount: "" },
  ]);

  useEffect(() => {
    fetch("/api/purchase-orders")
      .then((r) => r.json())
      .then((d) => setPOs(d.purchaseOrders || []));
  }, []);

  function addLineItem() {
    setLineItems([...lineItems, { description: "", quantity: "1", unitPrice: "", taxPercent: "0", amount: "" }]);
  }

  function removeLineItem(idx: number) {
    setLineItems(lineItems.filter((_, i) => i !== idx));
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const validLineItems = lineItems.filter((li) => li.description && li.amount);
    const lineTotal = validLineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);

    const data = {
      invoiceNumber: formData.get("invoiceNumber"),
      purchaseOrderId: formData.get("purchaseOrderId"),
      invoiceDate: formData.get("invoiceDate"),
      dueDate: formData.get("dueDate"),
      subtotal: formData.get("subtotal") || lineTotal,
      taxAmount: formData.get("taxAmount") || "0",
      totalAmount: formData.get("totalAmount") || lineTotal,
      paymentStatus: formData.get("paymentStatus") || "Sent",
      ourReference: formData.get("ourReference"),
      notes: formData.get("notes"),
      pdfPath: pdfUrl,
      lineItems: validLineItems.map((li) => ({
        description: li.description,
        quantity: parseFloat(li.quantity) || 1,
        unitPrice: parseFloat(li.unitPrice) || 0,
        taxPercent: parseFloat(li.taxPercent) || 0,
        amount: parseFloat(li.amount) || 0,
      })),
    };

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to create invoice");
      setSaving(false);
      return;
    }

    router.push("/invoices");
  }

  const lineTotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Add Invoice</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number (from IFS10) *</label>
              <input name="invoiceNumber" required placeholder="e.g., II2000841" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order *</label>
              <select name="purchaseOrderId" required value={selectedPOId} onChange={(e) => setSelectedPOId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="">Select PO...</option>
                {pos.map((po) => <option key={po.id} value={po.id}>{po.poNumber} - {po.client.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
              <input name="invoiceDate" type="date" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input name="dueDate" type="date" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount *</label>
              <input name="totalAmount" type="number" step="0.01" required placeholder={lineTotal > 0 ? lineTotal.toFixed(2) : "0.00"} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
              <input name="taxAmount" type="number" step="0.01" defaultValue="0" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
              <select name="paymentStatus" defaultValue="Sent" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="Sent">Sent</option>
                <option value="Received">Received</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Our Reference</label>
              <input name="ourReference" placeholder="e.g., License Fee - December 2024" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
          </div>
        </div>

        {/* PDF Upload */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Invoice Document</h2>
          <PdfUploadField onUpload={setPdfUrl} />
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
                <input value={item.description} onChange={(e) => updateLineItem(idx, "description", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                <input value={item.quantity} onChange={(e) => updateLineItem(idx, "quantity", e.target.value)} type="number" step="any" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Unit Price</label>}
                <input value={item.unitPrice} onChange={(e) => updateLineItem(idx, "unitPrice", e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Amount</label>}
                <input value={item.amount} onChange={(e) => updateLineItem(idx, "amount", e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50 text-gray-900" />
              </div>
              <div className="col-span-1 flex justify-center">
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLineItem(idx)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
                )}
              </div>
            </div>
          ))}
          <div className="text-right text-sm text-gray-600">
            Line Items Total: <span className="font-semibold text-gray-800">${lineTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium text-sm">
            {saving ? "Saving..." : "Create Invoice"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
