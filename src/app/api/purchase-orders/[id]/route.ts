import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { calculatePOStatus } from "@/lib/po-status";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        client: true,
        lineItems: { orderBy: { lineNumber: "asc" } },
        revisions: { orderBy: { revisionNumber: "desc" } },
        invoices: {
          orderBy: { invoiceDate: "desc" },
          include: { lineItems: true },
        },
      },
    });

    if (!po) return Response.json({ error: "Purchase order not found" }, { status: 404 });

    const invoicedAmount = po.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const remainingBalance = po.totalValue - invoicedAmount;
    const consumedPercent = po.totalValue > 0 ? (invoicedAmount / po.totalValue) * 100 : 0;

    // Auto-update status based on consumption
    const calculatedStatus = calculatePOStatus(po.totalValue, invoicedAmount, po.status);
    if (calculatedStatus !== po.status && po.status !== "Closed" && po.status !== "Revised") {
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: calculatedStatus },
      });
    }

    return Response.json({
      purchaseOrder: {
        ...po,
        status: calculatedStatus,
        invoicedAmount,
        remainingBalance,
        consumedPercent,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to fetch purchase order" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const data = await request.json();

    const updateData: Record<string, unknown> = {};
    if (data.poNumber !== undefined) updateData.poNumber = data.poNumber;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.orderDate !== undefined) updateData.orderDate = new Date(data.orderDate);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.totalValue !== undefined) updateData.totalValue = parseFloat(data.totalValue);
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms || null;
    if (data.contractReference !== undefined) updateData.contractReference = data.contractReference || null;
    if (data.rigSiteName !== undefined) updateData.rigSiteName = data.rigSiteName || null;
    if (data.deliveryAddress !== undefined) updateData.deliveryAddress = data.deliveryAddress || null;
    if (data.invoiceAddress !== undefined) updateData.invoiceAddress = data.invoiceAddress || null;
    if (data.buyerContactName !== undefined) updateData.buyerContactName = data.buyerContactName || null;
    if (data.buyerContactEmail !== undefined) updateData.buyerContactEmail = data.buyerContactEmail || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.revenueType !== undefined) updateData.revenueType = data.revenueType || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    // If lineItems array is provided, replace all existing line items
    if (Array.isArray(data.lineItems)) {
      await prisma.$transaction([
        prisma.pOLineItem.deleteMany({ where: { purchaseOrderId: id } }),
        ...data.lineItems.map((li: { lineNumber: number; description: string; quantity: number; unitOfMeasure?: string; unitPrice: number; netAmount: number; deliveryDate?: string | null }, idx: number) =>
          prisma.pOLineItem.create({
            data: {
              purchaseOrderId: id,
              lineNumber: li.lineNumber ?? idx + 1,
              description: li.description,
              quantity: parseFloat(String(li.quantity)) || 1,
              unitOfMeasure: li.unitOfMeasure || null,
              unitPrice: parseFloat(String(li.unitPrice)) || 0,
              netAmount: parseFloat(String(li.netAmount)) || 0,
              deliveryDate: li.deliveryDate ? new Date(li.deliveryDate) : null,
            },
          })
        ),
      ]);
    }

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: { client: true, lineItems: { orderBy: { lineNumber: "asc" } } },
    });

    return Response.json({ purchaseOrder: po });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to update purchase order" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await prisma.purchaseOrder.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to delete purchase order" }, { status: 500 });
  }
}
