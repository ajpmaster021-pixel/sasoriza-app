import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const correctPassword = process.env.SITE_PASSWORD;

  if (!correctPassword || password !== correctPassword) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("sasoriza-auth", correctPassword, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: "/",
  });
  return res;
}
