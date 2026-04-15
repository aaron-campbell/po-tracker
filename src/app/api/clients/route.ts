import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { purchaseOrders: true } },
      },
    });
    return Response.json({ clients });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const data = await request.json();

    if (!data.name) {
      return Response.json({ error: "Client name is required" }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        name: data.name,
        legalEntity: data.legalEntity || null,
        country: data.country || null,
        invoiceEmail: data.invoiceEmail || null,
        notes: data.notes || null,
      },
    });

    return Response.json({ client }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: "Failed to create client" }, { status: 500 });
  }
}
