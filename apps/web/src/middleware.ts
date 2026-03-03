import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/v1/:path*",
  ],
};

export default auth((req: NextRequest & { auth: unknown }) => {
  const isAuthenticated = !!(req.auth as any);
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/v1/");
  const isDashboardRoute = req.nextUrl.pathname.startsWith("/dashboard");

  if (!isAuthenticated) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isDashboardRoute) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
});
