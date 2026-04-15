import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const path = request.nextUrl.pathname;

  const isAuthPage = path.startsWith("/login");
  const isApiAuth = path.startsWith("/api/auth");
  const isApi = path.startsWith("/api");

  // Always allow API auth routes
  if (isApiAuth) return NextResponse.next();

  // Unauthenticated user
  if (!token) {
    if (isAuthPage) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated user hitting login page → redirect to dashboard
  if (isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
