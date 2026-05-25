import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  createSurveyExportBuffer,
  createSurveyExportFilename,
} from "@/lib/survey-export";
import { getProducts, getSurveyResponseBundles } from "@/lib/survey-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const [products, bundles] = await Promise.all([
    getProducts(),
    getSurveyResponseBundles(),
  ]);
  const buffer = createSurveyExportBuffer(products, bundles);
  const filename = encodeURIComponent(createSurveyExportFilename());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
