"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Client { id: string; name: string; }
interface LineItem { description: string; quantity: string; unitOfMeasure: string; unitPrice: string; netAmount: string; deliveryDate: string; }

const REVENUE_TYPES = ["SaaS", "Deployment", "Hypercare", "Development", "Training", "Other"];

export default function EditPurchaseOrderPage() {
  const { id } = useParams();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Header fields
  const [fields, setFields] = useState({
    poNumber: "", orderDate: "", currency: "USD", totalValue: "",
    revenueType: "", paymentTerms: "", contractReference: "", rigSiteName: "",
    buyerContactName: "", buyerContactEmail: "", notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then(r => r.json()),
      fetch(`/api/purchase-orders/${id}`).then(r => r.json()),
    ]).then(([clientsData, poData]) => {
      setClients(clientsData.clients || []);
      const po = poData.purchaseOrder;
      if (!po) return;
      setSelectedClientId(po.clientId);
      setFields({
        poNumber: po.poNumber,
        orderDate: po.orderDate?.slice(0, 10) ?? "",
        currency: po.currency,
        totalValue: po.totalValue > 0 ? String(po.totalValue) : "",
        revenueType: po.revenueType ?? "",
        paymentTerms: po.paymentTerms ?? "",
        contractReference: po.contractReference ?? "",
        rigSiteName: po.rigSiteName ?? "",
        buyerContactName: po.buyerContactName ?? "",
        buyerContactEmail: po.buyerContactEmail ?? "",
        notes: po.notes ?? "",
      });
      setLineItems(
        (po.lineItems ?? []).map((li: { description: string; quantity: number; unitOfMeasure: string | null; unitPrice: number; netAmount: number; deliveryDate: string | null }) => ({
          description: li.description,
          quantity: String(li.quantity),
          unitOfMeasure: li.unitOfMeasure ?? "",
          unitPrice: String(li.unitPrice),
          netAmount: String(li.netAmount),
          deliveryDate: li.deliveryDate?.slice(0, 10) ?? "",
        }))
      );
    }).finally(() => setLoading(false));
  }, [id]);

  function setField(key: string, value: string) {
    setFields(f => ({ ...f, [key]: value }));
  }

  function addLineItem() {
    setLineItems(li => [...li, { description: "", quantity: "1", unitOfMeasure: "", unitPrice: "", netAmount: "", deliveryDate: "" }]);
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
      updated[idx].netAmount = (qty * price).toFixed(2);
    }
    setLineItems(updated);
  }

  const lineTotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.netAmount) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const validLineItems = lineItems.filter(li => li.description);
    const totalValue = fields.totalValue
      ? parseFloat(fields.totalValue)
      : validLineItems.reduce((sum, li) => sum + (parseFloat(li.netAmount) || 0), 0);

    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poNumber: fields.poNumber,
        clientId: selectedClientId,
        orderDate: fields.orderDate,
        currency: fields.currency,
        totalValue,
        revenueType: fields.revenueType || null,
        paymentTerms: fields.paymentTerms || null,
        contractReference: fields.contractReference || null,
        rigSiteName: fields.rigSiteName || null,
        buyerContactName: fields.buyerContactName || null,
        buyerContactEmail: fields.buyerContactEmail || null,
        notes: fields.notes || null,
        lineItems: validLineItems.map((li, idx) => ({
          lineNumber: idx + 1,
          description: li.description,
          quantity: parseFloat(li.quantity) || 1,
          unitOfMeasure: li.unitOfMeasure || null,
          unitPrice: parseFloat(li.unitPrice) || 0,
          netAmount: parseFloat(li.netAmount) || 0,
          deliveryDate: li.deliveryDate || null,
        })),
      }),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed to update PO");
      setSaving(false);
      return;
    }

    router.push(`/purchase-orders/${id}`);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href={`/purchase-orders/${id}`} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to PO</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">Edit Purchase Order</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">PO Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO Number *</label>
              <input required value={fields.poNumber} onChange={e => setField("poNumber", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <select required value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date *</label>
              <input required type="date" value={fields.orderDate} onChange={e => setField("orderDate", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={fields.currency} onChange={e => setField("currency", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="NOK">NOK</option>
                <option value="DKK">DKK</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Type</label>
              <select value={fields.revenueType} onChange={e => setField("revenueType", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900">
                <option value="">Select type...</option>
                {REVENUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total PO Value (override line items)</label>
              <input type="number" step="0.01" value={fields.totalValue} onChange={e => setField("totalValue", e.target.value)} placeholder={lineTotal > 0 ? `Auto: ${lineTotal.toFixed(2)}` : "0.00"} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <input value={fields.paymentTerms} onChange={e => setField("paymentTerms", e.target.value)} placeholder="e.g., Net 30 days" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rig / Site Name</label>
              <input value={fields.rigSiteName} onChange={e => setField("rigSiteName", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract / Frame Agreement</label>
              <input value={fields.contractReference} onChange={e => setField("contractReference", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Contact Name</label>
              <input value={fields.buyerContactName} onChange={e => setField("buyerContactName", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Contact Email</label>
              <input type="email" value={fields.buyerContactEmail} onChange={e => setField("buyerContactEmail", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={fields.notes} onChange={e => setField("notes", e.target.value)} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Line Items</h2>
            <button type="button" onClick={addLineItem} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700">+ Add Line</button>
          </div>
          {lineItems.length === 0 && <p className="text-sm text-gray-400">No line items — click &quot;Add Line&quot; to add one.</p>}
          {lineItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-3">
              <div className="col-span-4">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                <input value={item.description} onChange={e => updateLineItem(idx, "description", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                <input value={item.quantity} onChange={e => updateLineItem(idx, "quantity", e.target.value)} type="number" step="any" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">UoM</label>}
                <input value={item.unitOfMeasure} onChange={e => updateLineItem(idx, "unitOfMeasure", e.target.value)} placeholder="EA/h" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Unit Price</label>}
                <input value={item.unitPrice} onChange={e => updateLineItem(idx, "unitPrice", e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Net Amount</label>}
                <input value={item.netAmount} onChange={e => updateLineItem(idx, "netAmount", e.target.value)} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 bg-gray-50" />
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Del. Date</label>}
                <input value={item.deliveryDate} onChange={e => updateLineItem(idx, "deliveryDate", e.target.value)} type="date" className="w-full px-2 py-2 border border-gray-300 rounded text-sm text-gray-900" />
              </div>
              <div className="col-span-1 flex justify-center">
                <button type="button" onClick={() => removeLineItem(idx)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
              </div>
            </div>
          ))}
          {lineItems.length > 0 && (
            <div className="text-right text-sm text-gray-600">
              Line Items Total: <span className="font-semibold text-gray-800">{lineTotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium text-sm">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/purchase-orders/${id}`} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
