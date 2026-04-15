import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const [purchaseOrders, invoices, clients] = await Promise.all([
      prisma.purchaseOrder.findMany({
        include: {
          client: { select: { name: true } },
          invoices: { select: { totalAmount: true, paymentStatus: true, invoiceDate: true, dueDate: true, paymentDate: true } },
        },
      }),
      prisma.invoice.findMany({
        include: {
          purchaseOrder: { select: { poNumber: true, client: { select: { name: true } } } },
        },
      }),
      prisma.client.findMany({
        include: { purchaseOrders: { include: { invoices: true } } },
      }),
    ]);

    const now = new Date();

    // PO summary
    const totalPOValue = purchaseOrders.reduce((sum, po) => sum + po.totalValue, 0);
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalRemaining = totalPOValue - totalInvoiced;

    // POs near exhaustion (>= 80% consumed)
    const nearExhaustion = purchaseOrders
      .map((po) => {
        const invoicedAmount = po.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const consumedPercent = po.totalValue > 0 ? (invoicedAmount / po.totalValue) * 100 : 0;
        const ageInDays = Math.floor((now.getTime() - new Date(po.orderDate).getTime()) / (1000 * 60 * 60 * 24));
        return { ...po, invoicedAmount, consumedPercent, remainingBalance: po.totalValue - invoicedAmount, ageInDays };
      })
      .filter((po) => po.consumedPercent >= 80 && po.status !== "Closed")
      .sort((a, b) => b.consumedPercent - a.consumedPercent);

    // Aging invoices (unpaid, sorted by age)
    const agingInvoices = invoices
      .filter((inv) => inv.paymentStatus !== "Paid")
      .map((inv) => {
        const ageInDays = Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilDue = Math.floor((new Date(inv.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...inv, ageInDays, daysUntilDue, isOverdue: daysUntilDue < 0 };
      })
      .sort((a, b) => b.ageInDays - a.ageInDays);

    // DSO by client
    const dsoByClient = clients.map((client) => {
      const clientInvoices = client.purchaseOrders.flatMap((po) => po.invoices);
      const paidInvoices = clientInvoices.filter((inv) => inv.paymentStatus === "Paid" && inv.paymentDate);

      let avgDSO = 0;
      if (paidInvoices.length > 0) {
        const totalDays = paidInvoices.reduce((sum, inv) => {
          const days = Math.floor((new Date(inv.paymentDate!).getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgDSO = Math.round(totalDays / paidInvoices.length);
      }

      const outstandingInvoices = clientInvoices.filter((inv) => inv.paymentStatus !== "Paid");
      const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

      // Estimate DSO for outstanding invoices
      const estimatedDSO = outstandingInvoices.length > 0
        ? Math.round(outstandingInvoices.reduce((sum, inv) => {
            return sum + Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / outstandingInvoices.length)
        : 0;

      return {
        clientName: client.name,
        totalPOs: client.purchaseOrders.length,
        totalInvoices: clientInvoices.length,
        paidInvoices: paidInvoices.length,
        outstandingInvoices: outstandingInvoices.length,
        outstandingAmount,
        avgDSO,
        estimatedDSO,
      };
    }).filter((c) => c.totalInvoices > 0);

    // Revenue type breakdown (by PO value)
    const revenueTypes = ["SaaS", "Deployment", "Hypercare", "Development", "Training", "Other"];
    const revenueTypeCounts = Object.fromEntries(
      revenueTypes.map((t) => [
        t,
        {
          count: purchaseOrders.filter((po) => po.revenueType === t).length,
          value: purchaseOrders.filter((po) => po.revenueType === t).reduce((sum, po) => sum + po.totalValue, 0),
        },
      ])
    );
    const unclassifiedCount = purchaseOrders.filter((po) => !po.revenueType).length;
    const unclassifiedValue = purchaseOrders.filter((po) => !po.revenueType).reduce((sum, po) => sum + po.totalValue, 0);

    // Status counts
    const statusCounts = {
      Open: purchaseOrders.filter((po) => po.status === "Open").length,
      Revised: purchaseOrders.filter((po) => po.status === "Revised").length,
      "90% Used": purchaseOrders.filter((po) => po.status === "90% Used").length,
      Exceeded: purchaseOrders.filter((po) => po.status === "Exceeded").length,
      Closed: purchaseOrders.filter((po) => po.status === "Closed").length,
    };

    const paymentStatusCounts = {
      Sent: invoices.filter((inv) => inv.paymentStatus === "Sent").length,
      Received: invoices.filter((inv) => inv.paymentStatus === "Received").length,
      Overdue: invoices.filter((inv) => inv.paymentStatus === "Overdue").length,
      Paid: invoices.filter((inv) => inv.paymentStatus === "Paid").length,
    };

    return Response.json({
      summary: {
        totalPOs: purchaseOrders.length,
        totalInvoices: invoices.length,
        totalPOValue,
        totalInvoiced,
        totalRemaining,
        totalClients: clients.length,
      },
      statusCounts,
      paymentStatusCounts,
      revenueTypeCounts,
      unclassifiedCount,
      unclassifiedValue,
      nearExhaustion: nearExhaustion.slice(0, 10),
      agingInvoices: agingInvoices.slice(0, 10),
      dsoByClient,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dashboard error:", error);
    return Response.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
