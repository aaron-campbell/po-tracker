import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, fullName: true, role: true },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ user });
}

export async function DELETE() {
  const response = Response.json({ success: true });
  response.headers.set("Set-Cookie", "token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return response;
}
