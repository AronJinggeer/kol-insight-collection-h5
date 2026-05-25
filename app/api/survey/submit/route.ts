import { NextResponse } from "next/server";
import { appendSurveyResponse } from "@/lib/survey-storage";
import type { SurveySubmitPayload } from "@/lib/survey-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SurveySubmitPayload;
    const bundle = await appendSurveyResponse(payload);
    return NextResponse.json({ success: true, kolId: bundle.kol.id });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "提交失败，请稍后重试",
      },
      { status: 400 },
    );
  }
}
