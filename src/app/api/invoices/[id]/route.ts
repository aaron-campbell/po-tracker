import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          select: { poNumber: true, totalValue: true, client: { select: { name: true } } },
        },
        lineItems: true,
      },
    });

    if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404 });
    return Response.json({ invoice });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to fetch invoice" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const data = await request.json();

    const updateData: Record<string, unknown> = {};
    if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
    if (data.purchaseOrderId !== undefined) updateData.purchaseOrderId = data.purchaseOrderId;
    if (data.invoiceDate !== undefined) updateData.invoiceDate = new Date(data.invoiceDate);
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.subtotal !== undefined) updateData.subtotal = parseFloat(data.subtotal);
    if (data.taxAmount !== undefined) updateData.taxAmount = parseFloat(data.taxAmount);
    if (data.totalAmount !== undefined) updateData.totalAmount = parseFloat(data.totalAmount);
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;
    if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate ? new Date(data.paymentDate) : null;
    if (data.ourReference !== undefined) updateData.ourReference = data.ourReference || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.pdfPath !== undefined) updateData.pdfPath = data.pdfPath || null;

    // Replace line items if provided
    if (Array.isArray(data.lineItems)) {
      await prisma.$transaction([
        prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
        ...data.lineItems.map((li: { description: string; quantity: number; unitPrice: number; taxPercent: number; amount: number }) =>
          prisma.invoiceLineItem.create({
            data: {
              invoiceId: id,
              description: li.description,
              quantity: parseFloat(String(li.quantity)) || 1,
              unitPrice: parseFloat(String(li.unitPrice)) || 0,
              taxPercent: parseFloat(String(li.taxPercent)) || 0,
              amount: parseFloat(String(li.amount)) || 0,
            },
          })
        ),
      ]);
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { lineItems: true },
    });

    return Response.json({ invoice });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await prisma.invoice.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}
