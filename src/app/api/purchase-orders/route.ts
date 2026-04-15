import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { orderDate: "desc" },
      include: {
        client: { select: { name: true } },
        invoices: { select: { totalAmount: true, paymentStatus: true } },
        _count: { select: { lineItems: true, invoices: true } },
      },
    });

    const enriched = purchaseOrders.map((po) => {
      const invoicedAmount = po.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const remainingBalance = po.totalValue - invoicedAmount;
      const consumedPercent = po.totalValue > 0 ? (invoicedAmount / po.totalValue) * 100 : 0;
      return { ...po, invoicedAmount, remainingBalance, consumedPercent };
    });

    return Response.json({ purchaseOrders: enriched });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const data = await request.json();

    if (!data.poNumber || !data.clientId || !data.orderDate || data.totalValue === undefined) {
      return Response.json({ error: "PO number, client, order date, and total value are required" }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: data.poNumber,
        clientId: data.clientId,
        orderDate: new Date(data.orderDate),
        currency: data.currency || "USD",
        totalValue: parseFloat(data.totalValue),
        paymentTerms: data.paymentTerms || null,
        contractReference: data.contractReference || null,
        rigSiteName: data.rigSiteName || null,
        deliveryAddress: data.deliveryAddress || null,
        invoiceAddress: data.invoiceAddress || null,
        buyerContactName: data.buyerContactName || null,
        buyerContactEmail: data.buyerContactEmail || null,
        revenueType: data.revenueType || null,
        notes: data.notes || null,
        lineItems: data.lineItems?.length > 0 ? {
          create: data.lineItems.map((item: { lineNumber: number; description: string; quantity?: number; unitOfMeasure?: string; unitPrice: number; netAmount: number; deliveryDate?: string }, idx: number) => ({
            lineNumber: item.lineNumber || idx + 1,
            description: item.description,
            quantity: parseFloat(String(item.quantity || 1)),
            unitOfMeasure: item.unitOfMeasure || null,
            unitPrice: parseFloat(String(item.unitPrice)),
            netAmount: parseFloat(String(item.netAmount)),
            deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
          })),
        } : undefined,
      },
      include: { client: true, lineItems: true },
    });

    return Response.json({ purchaseOrder: po }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create PO error:", error);
    return Response.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}
