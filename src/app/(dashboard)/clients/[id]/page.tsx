"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  legalEntity: string | null;
  country: string | null;
  invoiceEmail: string | null;
  notes: string | null;
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    orderDate: string;
    totalValue: number;
    status: string;
    invoices: Array<{ totalAmount: number; paymentStatus: string }>;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((d) => setClient(d.client))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      legalEntity: formData.get("legalEntity"),
      country: formData.get("country"),
      invoiceEmail: formData.get("invoiceEmail"),
      notes: formData.get("notes"),
    };

    const res = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const d = await res.json();
      setClient({ ...client!, ...d.client });
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this client? This will also delete all associated POs and invoices.")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.push("/clients");
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!client) return <div className="text-red-500">Client not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/clients" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Clients</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{client.name}</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setEditing(!editing)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
            {editing ? "Cancel" : "Edit"}
          </button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm border border-red-300 rounded-lg hover:bg-red-50 text-red-600">Delete</button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
            <input name="name" defaultValue={client.name} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Entity</label>
            <input name="legalEntity" defaultValue={client.legalEntity || ""} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input name="country" defaultValue={client.country || ""} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Email</label>
              <input name="invoiceEmail" defaultValue={client.invoiceEmail || ""} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" defaultValue={client.notes || ""} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900" />
          </div>
          <button type="submit" className="px-6 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium text-sm">Save Changes</button>
        </form>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">Legal Entity</dt><dd className="text-gray-800 font-medium mt-1">{client.legalEntity || "-"}</dd></div>
            <div><dt className="text-gray-500">Country</dt><dd className="text-gray-800 font-medium mt-1">{client.country || "-"}</dd></div>
            <div><dt className="text-gray-500">Invoice Email</dt><dd className="text-gray-800 font-medium mt-1">{client.invoiceEmail || "-"}</dd></div>
            <div><dt className="text-gray-500">Notes</dt><dd className="text-gray-800 font-medium mt-1">{client.notes || "-"}</dd></div>
          </dl>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Purchase Orders ({client.purchaseOrders.length})</h2>
          <Link href={`/purchase-orders/new?clientId=${client.id}`} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium">Add PO</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 font-medium">PO Number</th>
              <th className="pb-3 font-medium text-right">PO Value</th>
              <th className="pb-3 font-medium text-right">Invoiced</th>
              <th className="pb-3 font-medium text-right">Remaining</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {client.purchaseOrders.map((po) => {
              const invoiced = po.invoices.reduce((s, i) => s + i.totalAmount, 0);
              return (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="py-3"><Link href={`/purchase-orders/${po.id}`} className="text-orange-600 hover:underline font-medium">{po.poNumber}</Link></td>
                  <td className="py-3 text-right text-gray-700">{formatCurrency(po.totalValue)}</td>
                  <td className="py-3 text-right text-gray-700">{formatCurrency(invoiced)}</td>
                  <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(po.totalValue - invoiced)}</td>
                  <td className="py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(po.status)}`}>{po.status}</span></td>
                </tr>
              );
            })}
            {client.purchaseOrders.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-400">No purchase orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
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
