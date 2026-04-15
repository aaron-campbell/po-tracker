"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Client { id: string; name: string; }
interface LineItem { description: string; quantity: string; unitOfMeasure: string; unitPrice: string; netAmount: string; deliveryDate: string; }

const REVENUE_TYPES = ["SaaS", "Deployment", "Hypercare", "Development", "Training", "Other"];

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>}>
      <NewPurchaseOrderForm />
    </Suspense>
  );
}

function NewPurchaseOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get("clientId") || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitOfMeasure: "", unitPrice: "", netAmount: "", deliveryDate: "" },
  ]);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || []));
  }, []);

  function addLineItem() {
    setLineItems([...lineItems, { description: "", quantity: "1", unitOfMeasure: "", unitPrice: "", netAmount: "", deliveryDate: "" }]);
  }

  function removeLineItem(idx: number) {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  }

  function updateLineItem(idx: number, field: keyof LineItem, value: string) {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-calculate net amount
    if (field === "quantity" || field === "unitPrice") {
      const qty = parseFloat(updated[idx].quantity) || 0;
      const price = parseFloat(updated[idx].unitPrice) || 0;
      updated[idx].netAmount = (qty * price).toFixed(2);
    }
    setLineItems(updated);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const validLineItems = lineItems.filter((li) => li.description && li.netAmount);

    const totalValue = formData.get("totalValue")
      ? parseFloat(formData.get("totalValue") as string)
      : validLineItems.reduce((sum, li) => sum + (parseFloat(li.netAmount) || 0), 0);

    const data = {
      poNumber: formData.get("poNumber"),
      clientId: formData.get("clientId"),
      orderDate: formData.get("orderDate"),
      currency: formData.get("currency") || "USD",
      totalValue,
      paymentTerms: formData.get("paymentTerms"),
      contractReference: formData.get("contractReference"),
      revenueType: formData.get("revenueType") || null,
      rigSiteName: formData.get("rigSiteName"),
      buyerContactName: formData.get("buyerContactName"),
      buyerContactEmail: formData.get("buyerContactEmail"),
      notes: formData.get("notes"),
      lineItems: validLineItems.map((li, idx) => ({
        lineNumber: idx + 1,
        description: li.description,
        quantity: parseFloat(li.quantity) || 1,
        unitOfMeasure: li.unitOfMeasure,
        unitPrice: parseFloat(li.unitPrice) || 0,
        netAmount: parseFloat(li.netAmount) || 0,
        deliveryDate: li.deliveryDate || null,
      })),
    };

    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to create PO");
      setSaving(false);
      return;
    }

    router.push("/purchase-orders");
  }

  const lineTotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.netAmount) || 0), 0);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Add Purchase Order</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">PO Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO Number *</label>
              <input name="poNumber" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <select name="clientId" required value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date *</label>
              <input name="orderDate" type="date" required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select name="currency" defaultValue="USD" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="NOK">NOK</option>
                <option value="DKK">DKK</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Type</label>
              <select name="revenueType" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="">Select type...</option>
                {REVENUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total PO Value (override line items)</label>
              <input name="totalValue" type="number" step="0.01" placeholder={lineTotal > 0 ? `Auto: ${lineTotal.toFixed(2)}` : "0.00"} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <input name="paymentTerms" placeholder="e.g., Net 30 days" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rig / Site Name</label>
              <input name="rigSiteName" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract / Frame Agreement</label>
              <input name="contractReference" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Contact Name</label>
              <input name="buyerContactName" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Contact Email</label>
              <input name="buyerContactEmail" type="email" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Line Items</h2>
            <button type="button" onClick={addLineItem} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700">+ Add Line</button>
          </div>

          {lineItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-3">
              <div className="col-span-4">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                <input value={item.description} onChange={(e) => updateLineItem(idx, "description", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                <input value={item.quantity} onChange={(e) => updateLineItem(idx, "quantity", e.target.value)} type="number" step="any" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">UoM</label>}
                <input value={item.unitOfMeasure} onChange={(e) => updateLineItem(idx, "unitOfMeasure", e.target.value)} placeholder="EA/h" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Unit Price</label>}
                <input value={item.unitPrice} onChange={(e) => updateLineItem(idx, "unitPrice", e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Net Amount</label>}
                <input value={item.netAmount} onChange={(e) => updateLineItem(idx, "netAmount", e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 bg-gray-50" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Del. Date</label>}
                <input value={item.deliveryDate} onChange={(e) => updateLineItem(idx, "deliveryDate", e.target.value)} type="date" className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-gray-900" />
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
            {saving ? "Saving..." : "Create Purchase Order"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
