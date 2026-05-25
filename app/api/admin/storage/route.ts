import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSurveyStorageInfo } from "@/lib/survey-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  return NextResponse.json(getSurveyStorageInfo());
}
