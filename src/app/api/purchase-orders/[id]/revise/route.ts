import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const data = await request.json();

    const existingPO = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existingPO) return Response.json({ error: "Purchase order not found" }, { status: 404 });

    if (!data.newValue) {
      return Response.json({ error: "New value is required" }, { status: 400 });
    }

    const newRevisionNumber = existingPO.revisionNumber + 1;

    await prisma.$transaction([
      prisma.pORevision.create({
        data: {
          purchaseOrderId: id,
          revisionNumber: newRevisionNumber,
          previousValue: existingPO.totalValue,
          newValue: parseFloat(data.newValue),
          changeNotes: data.changeNotes || null,
        },
      }),
      prisma.purchaseOrder.update({
        where: { id },
        data: {
          totalValue: parseFloat(data.newValue),
          revisionNumber: newRevisionNumber,
          status: "Revised",
        },
      }),
    ]);

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { client: true, lineItems: true, revisions: true },
    });

    return Response.json({ purchaseOrder: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Revise PO error:", error);
    return Response.json({ error: "Failed to revise purchase order" }, { status: 500 });
  }
}
