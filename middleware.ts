import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "sasoriza-auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ログインページ・認証APIは認証不要
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const password = process.env.SITE_PASSWORD;

  if (password && token === password) {
    return NextResponse.next();
  }

  // ログインページへリダイレクト
  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
