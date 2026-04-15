import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { orderDate: "desc" },
          include: {
            invoices: { select: { totalAmount: true, paymentStatus: true } },
          },
        },
      },
    });
    if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
    return Response.json({ client });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to fetch client" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const data = await request.json();

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: data.name,
        legalEntity: data.legalEntity || null,
        country: data.country || null,
        invoiceEmail: data.invoiceEmail || null,
        notes: data.notes || null,
      },
    });
    return Response.json({ client });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to update client" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await prisma.client.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
