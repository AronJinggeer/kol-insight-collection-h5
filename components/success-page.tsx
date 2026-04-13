"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PrimaryButton } from "@/components/ui";

export function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  function goHome() {
    const query = code ? `?code=${encodeURIComponent(code)}` : "";
    router.push(`/${query}`);
  }

  return (
    <main className="flex min-h-screen items-center px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl rounded-[32px] border border-white/60 bg-grain p-6 shadow-card sm:p-10">
        <div className="space-y-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-moss/15 bg-moss text-2xl text-white">
            ✓
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-sage">SUBMITTED</p>
            <h1 className="font-display text-[40px] leading-tight text-ink">
              提交成功
            </h1>
            <p className="max-w-xl text-[15px] leading-7 text-muted">
              感谢你的分享，后续如有内容共创或补充沟通，我们会再联系你。
            </p>
          </div>
          <div className="rounded-[24px] border border-line bg-white/65 p-4 text-sm leading-7 text-muted">
            {code
              ? `本次提交已关联专属标识 ${code}。`
              : "本次提交未携带专属标识，也已正常入库。"}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryButton onClick={goHome} className="w-full sm:w-auto sm:min-w-36">
              返回首页
            </PrimaryButton>
            <button
              type="button"
              onClick={goHome}
              className="field-transition min-h-12 rounded-full border border-line bg-white/70 px-6 py-3 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:bg-white"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
