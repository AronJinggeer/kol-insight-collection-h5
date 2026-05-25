import { NextResponse } from "next/server";
import { getAdminCookieName, getAdminPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    return NextResponse.json(
      { success: false, message: "请先配置 ADMIN_PASSWORD 环境变量" },
      { status: 500 },
    );
  }
  if (password !== adminPassword) {
    return NextResponse.json(
      { success: false, message: "后台密码不正确" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(getAdminCookieName(), adminPassword, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
