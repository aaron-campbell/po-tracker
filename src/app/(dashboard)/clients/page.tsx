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

const PAGE_SIZE = 25;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.country || "").toLowerCase().includes(q) ||
      (c.legalEntity || "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
        <Link href="/clients/new" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium">
          Add Client
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, country, legal entity..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
        />
        <span className="text-sm text-gray-400 whitespace-nowrap">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</span>
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
            {paginated.map((client) => (
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
            {paginated.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                {search ? "No clients match your search." : "No clients yet. Add your first client to get started."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
    </div>
  );
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
