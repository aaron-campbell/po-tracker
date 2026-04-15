import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password, fullName } = await request.json();

    if (!username || !password || !fullName) {
      return Response.json({ error: "Username, password, and full name are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return Response.json({ error: "Username already exists" }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword, fullName },
    });

    const token = createToken({ userId: user.id, username: user.username, role: user.role });

    const response = Response.json({ user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role } });
    response.headers.set("Set-Cookie", `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json({ error: "Registration failed" }, { status: 500 });
  }
}
