import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "purchase-orders";

    if (type === "purchase-orders") {
      const purchaseOrders = await prisma.purchaseOrder.findMany({
        include: {
          client: { select: { name: true } },
          invoices: { select: { totalAmount: true } },
        },
        orderBy: { orderDate: "desc" },
      });

      const headers = ["PO Number", "Client", "Order Date", "Currency", "Total Value", "Invoiced Amount", "Remaining Balance", "Consumed %", "Status", "Revenue Type", "Rig/Site", "Payment Terms", "Contract Ref", "PO Age (Days)"];
      const now = new Date();
      const rows = purchaseOrders.map((po) => {
        const invoicedAmount = po.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const remaining = po.totalValue - invoicedAmount;
        const consumed = po.totalValue > 0 ? ((invoicedAmount / po.totalValue) * 100).toFixed(1) : "0";
        const age = Math.floor((now.getTime() - new Date(po.orderDate).getTime()) / (1000 * 60 * 60 * 24));
        return [po.poNumber, po.client.name, po.orderDate.toISOString().split("T")[0], po.currency, po.totalValue, invoicedAmount, remaining, consumed, po.status, po.revenueType || "", po.rigSiteName || "", po.paymentTerms || "", po.contractReference || "", age];
      });

      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=purchase-orders-${new Date().toISOString().split("T")[0]}.csv`,
        },
      });
    }

    if (type === "invoices") {
      const invoices = await prisma.invoice.findMany({
        include: {
          purchaseOrder: { select: { poNumber: true, client: { select: { name: true } } } },
        },
        orderBy: { invoiceDate: "desc" },
      });

      const headers = ["Invoice Number", "Client", "PO Number", "Invoice Date", "Due Date", "Currency", "Subtotal", "Tax", "Total", "Payment Status", "Payment Date", "Age (Days)", "Days Until Due", "Our Reference"];
      const now = new Date();
      const rows = invoices.map((inv) => {
        const age = Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilDue = Math.floor((new Date(inv.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return [inv.invoiceNumber, inv.purchaseOrder.client.name, inv.purchaseOrder.poNumber, inv.invoiceDate.toISOString().split("T")[0], inv.dueDate.toISOString().split("T")[0], inv.currency, inv.subtotal, inv.taxAmount, inv.totalAmount, inv.paymentStatus, inv.paymentDate?.toISOString().split("T")[0] || "", age, daysUntilDue, inv.ourReference || ""];
      });

      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=invoices-${new Date().toISOString().split("T")[0]}.csv`,
        },
      });
    }

    return Response.json({ error: "Invalid export type" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}
