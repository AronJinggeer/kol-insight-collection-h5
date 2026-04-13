import { NextResponse } from "next/server";
import { appendSubmission } from "@/lib/storage";
import {
  hasErrors,
  normalizeSubmission,
  validateSubmission,
} from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawPayload = (await request.json()) as Record<string, unknown>;
    const payload = normalizeSubmission(rawPayload);
    const errors = validateSubmission(payload);

    if (hasErrors(errors)) {
      return NextResponse.json(
        {
          success: false,
          message: Object.values(errors)[0] ?? "请完善必填信息",
          errors,
        },
        { status: 400 },
      );
    }

    await appendSubmission({
      ...payload,
      code: payload.code ?? "",
    });

    return NextResponse.json({
      success: true,
      message: "提交成功",
    });
  } catch (error) {
    console.error("submit failed", error);

    return NextResponse.json(
      {
        success: false,
        message: "服务暂时不可用，请稍后重试",
      },
      { status: 500 },
    );
  }
}
