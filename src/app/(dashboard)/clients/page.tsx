"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  legalEntity: string | null;
  country: string | null;
  invoiceEmail: string | null;
  _count: { purchaseOrders: number };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
        <Link href="/clients/new" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium">
          Add Client
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Legal Entity</th>
              <th className="px-6 py-3 font-medium">Country</th>
              <th className="px-6 py-3 font-medium">Invoice Email</th>
              <th className="px-6 py-3 font-medium text-right">POs</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link href={`/clients/${client.id}`} className="text-orange-600 hover:underline font-medium">{client.name}</Link>
                </td>
                <td className="px-6 py-4 text-gray-600">{client.legalEntity || "-"}</td>
                <td className="px-6 py-4 text-gray-600">{client.country || "-"}</td>
                <td className="px-6 py-4 text-gray-600">{client.invoiceEmail || "-"}</td>
                <td className="px-6 py-4 text-right text-gray-700 font-medium">{client._count.purchaseOrders}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No clients yet. Add your first client to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
