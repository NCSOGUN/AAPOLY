import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow /admin/login through without session check
  if (pathname === "/admin/login") {
    return;
  }

  // Protect all other /admin routes
  if (pathname.startsWith("/admin") && !req.auth) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
