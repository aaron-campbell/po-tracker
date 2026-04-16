"use client";

import { useEffect, useState, useMemo } from "react";

interface Rig {
  client: string;
  rigContractor: string;
  rigName: string;
  contact: string;
  region: string;
  status: string;
  startDate: string | null;
  pausedCancelledDate: string | null;
  dayRate: number | null;
  poNumber: string | null;
}

interface Section {
  name: string;
  rigs: Rig[];
}

const STATUS_COLORS: Record<string, string> = {
  Live: "bg-green-100 text-green-800",
  "Not Started": "bg-gray-100 text-gray-600",
  Paused: "bg-yellow-100 text-yellow-800",
  Cancelled: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status || "—"}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtContact(c: string) {
  if (!c) return "—";
  if (c.includes("@")) return c.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return c;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function CommercialStatusPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProduct, setActiveProduct] = useState("All");
  const [statusFilter, setStatusFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/commercial-status")
      .then((r) => r.json())
      .then((d) => setSections(d))
      .finally(() => setLoading(false));
  }, []);

  const allRigs: (Rig & { product: string })[] = useMemo(
    () => sections.flatMap((s) => s.rigs.map((r) => ({ ...r, product: s.name }))),
    [sections]
  );

  const products = ["All", ...sections.map((s) => s.name)];

  const regions = useMemo(
    () => ["", ...Array.from(new Set(allRigs.map((r) => r.region).filter(Boolean))).sort()],
    [allRigs]
  );

  const filtered = useMemo(() => {
    return allRigs.filter((r) => {
      if (activeProduct !== "All" && r.product !== activeProduct) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (regionFilter && r.region !== regionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.client.toLowerCase().includes(q) ||
          r.rigName.toLowerCase().includes(q) ||
          r.rigContractor.toLowerCase().includes(q) ||
          (r.poNumber || "").toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allRigs, activeProduct, statusFilter, regionFilter, search]);

  const stats = useMemo(() => {
    const base = activeProduct === "All" ? allRigs : allRigs.filter((r) => r.product === activeProduct);
    return {
      live: base.filter((r) => r.status === "Live").length,
      notStarted: base.filter((r) => r.status === "Not Started").length,
      paused: base.filter((r) => r.status === "Paused").length,
      cancelled: base.filter((r) => r.status === "Cancelled").length,
    };
  }, [allRigs, activeProduct]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Commercial Status</h1>
          <p className="text-sm text-gray-500 mt-1">Monday.com board export — all product lines</p>
        </div>
      </div>

      {/* Product tabs */}
      <div className="flex gap-2">
        {products.map((p) => (
          <button
            key={p}
            onClick={() => { setActiveProduct(p); setStatusFilter(""); setRegionFilter(""); setSearch(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeProduct === p ? "bg-orange-500 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Live" value={stats.live} color="text-green-600" />
        <StatCard label="Not Started" value={stats.notStarted} color="text-gray-500" />
        <StatCard label="Paused" value={stats.paused} color="text-yellow-600" />
        <StatCard label="Cancelled" value={stats.cancelled} color="text-red-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search client, rig, contractor, PO..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Statuses</option>
          {["Live", "Not Started", "Paused", "Cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Regions</option>
          {regions.filter(Boolean).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} rig{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                {activeProduct === "All" && <th className="px-4 py-3 font-medium">Product</th>}
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Contractor</th>
                <th className="px-4 py-3 font-medium">Rig Name</th>
                <th className="px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">Paused/Cancelled</th>
                <th className="px-4 py-3 font-medium text-right">$/day</th>
                <th className="px-4 py-3 font-medium">PO Number</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {activeProduct === "All" && (
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700">{r.product}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-gray-800">{r.client}</td>
                  <td className="px-4 py-3 text-gray-600">{r.rigContractor || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{r.rigName || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.region || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtContact(r.contact)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.startDate)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.pausedCancelledDate)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {r.dayRate != null ? `$${r.dayRate.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{r.poNumber || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={activeProduct === "All" ? 11 : 10} className="px-6 py-8 text-center text-gray-400">
                    No rigs match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
