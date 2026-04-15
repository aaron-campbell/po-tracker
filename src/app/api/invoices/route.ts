import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const purchaseOrderId = searchParams.get("purchaseOrderId");
    const paymentStatus = searchParams.get("paymentStatus");

    const where: Record<string, unknown> = {};
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      include: {
        purchaseOrder: {
          select: { poNumber: true, client: { select: { name: true } } },
        },
        _count: { select: { lineItems: true } },
      },
    });

    // Auto-mark overdue invoices
    const now = new Date();
    for (const invoice of invoices) {
      if (invoice.paymentStatus === "Sent" && invoice.dueDate < now) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { paymentStatus: "Overdue" },
        });
        invoice.paymentStatus = "Overdue";
      }
    }

    return Response.json({ invoices });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const data = await request.json();

    if (!data.invoiceNumber || !data.purchaseOrderId || !data.invoiceDate || !data.dueDate || data.totalAmount === undefined) {
      return Response.json({ error: "Invoice number, PO, dates, and total are required" }, { status: 400 });
    }

    // Verify PO exists
    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId } });
    if (!po) return Response.json({ error: "Purchase order not found" }, { status: 404 });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        purchaseOrderId: data.purchaseOrderId,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        currency: data.currency || po.currency,
        subtotal: parseFloat(data.subtotal || data.totalAmount),
        taxAmount: parseFloat(data.taxAmount || "0"),
        totalAmount: parseFloat(data.totalAmount),
        paymentStatus: data.paymentStatus || "Sent",
        ourReference: data.ourReference || null,
        customerOrderNo: data.customerOrderNo || po.poNumber,
        notes: data.notes || null,
        lineItems: data.lineItems?.length > 0 ? {
          create: data.lineItems.map((item: { description: string; quantity?: number; unitPrice: number; taxPercent?: number; amount: number }) => ({
            description: item.description,
            quantity: parseFloat(String(item.quantity || 1)),
            unitPrice: parseFloat(String(item.unitPrice)),
            taxPercent: parseFloat(String(item.taxPercent || 0)),
            amount: parseFloat(String(item.amount)),
          })),
        } : undefined,
      },
      include: { purchaseOrder: { select: { poNumber: true } }, lineItems: true },
    });

    return Response.json({ invoice }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create invoice error:", error);
    return Response.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
